import { randomUUID } from "node:crypto";
import { applyAction, forfeit } from "@/game/engine";
import { randomSeed } from "@/game/rng";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/game/roles";
import { createGame } from "@/game/setup";
import { applyTimeouts } from "@/game/timeout";
import type { Action } from "@/game/types";
import { toView } from "@/game/view";
import {
  DEFAULT_SETTINGS,
  DISCONNECT_AFTER_MS,
  type RoomMember,
  type RoomSettings,
  type RoomState,
  type RoomSummary,
  type RoomView,
} from "@/shared/types";
import { ApiError } from "./api";
import { deleteRoom, listPublicRooms, loadRoom, newRoomCode, requireRoom, saveRoom, withRoomLock } from "./room";
import { getRoomOf, setRoomOf, type Session } from "./session";

/**
 * 마지막 접속 시각을 이 간격보다 자주 저장하지 않는다 (Redis 커맨드 절약).
 * 저장 한 번이 락까지 포함해 커맨드 5개라, 폴링 자체보다 이쪽이 더 비쌌다.
 */
const PRESENCE_WRITE_MS = 12_000;

// ---------- 뷰 ----------

function seatOf(room: RoomState, playerId: string): RoomView["me"]["seat"] {
  if (room.players.some((p) => p.id === playerId)) return "player";
  if (room.spectators.some((p) => p.id === playerId)) return "spectator";
  return "none";
}

function isConnected(m: RoomMember, now: number): boolean {
  // 봇은 폴링하지 않으므로 lastSeen이 갱신되지 않는다. 항상 접속 상태로 본다 —
  // 아니면 applyTimeouts가 봇 차례를 끊긴 것으로 보고 먼저 처리해 버린다.
  if (m.isBot) return true;
  return now - m.lastSeen < DISCONNECT_AFTER_MS;
}

export function toRoomView(room: RoomState, session: Session, now: number): RoomView {
  const seat = seatOf(room, session.playerId);
  const memberView = (m: RoomMember) => ({
    id: m.id,
    nickname: m.nickname,
    connected: isConnected(m, now),
    ...(m.isBot ? { isBot: true as const } : {}),
  });
  const game = room.game
    ? toView(
        room.game,
        seat === "player"
          ? { kind: "player", id: session.playerId }
          : { kind: "spectator", revealAll: room.settings.spectatorMode === "all" },
      )
    : undefined;

  // 사람끼리 하는 판에서는 "남이 한 수"가 폴링 간격만큼 늦게 도착한다 — 체감 지연을
  // 지배하는 건 이 값이다. 내 액션은 응답에 최신 뷰가 실려 오므로 영향받지 않는다.
  // 단, 봇 차례에는 사람이 구경만 하므로 봇이 두는 속도(BOT_MIN_MOVE_MS, 기본 1650)에 맞춘다 —
  // 여기만 빨리 당기면 같은 상태를 헛되이 다시 받을 뿐이고, 더 느리면 여러 수가 한 번에
  // 몰려 와서 무슨 일이 있었는지 못 본다.
  let pollMs = 1200;
  if (room.status === "playing" && game) {
    if (game.responder === session.playerId) pollMs = 700;
    else pollMs = room.players.find((p) => p.id === game.responder)?.isBot ? 1800 : 800;
  }

  return {
    code: room.code,
    version: room.version,
    status: room.status,
    settings: room.settings,
    hostId: room.hostId,
    players: room.players.map(memberView),
    spectators: room.spectators.map(memberView),
    game,
    me: { id: session.playerId, nickname: session.nickname, seat },
    now,
    pollMs,
  };
}

export function toSummary(room: RoomState): RoomSummary {
  const host = room.players.find((p) => p.id === room.hostId) ?? room.players[0];
  return {
    code: room.code,
    hostNickname: host?.nickname ?? "?",
    players: room.players.length,
    maxPlayers: room.settings.maxPlayers,
    status: room.status,
  };
}

// ---------- 내부 헬퍼 ----------

function memberOf(room: RoomState, id: string): RoomMember | undefined {
  return room.players.find((p) => p.id === id) ?? room.spectators.find((p) => p.id === id);
}

/**
 * 다음 방장. 봇은 시작·설정·강퇴를 할 수 없으므로 절대 방장이 되면 안 된다 —
 * 봇이 방장이 되면 아무도 게임을 시작할 수 없는 방이 된다.
 * 자리에 앉은 사람을 먼저, 없으면 관전자를 고른다.
 */
function nextHost(room: RoomState, excludeId?: string): string | undefined {
  const human = (m: RoomMember) => !m.isBot && m.id !== excludeId;
  return (room.players.find(human) ?? room.spectators.find(human))?.id;
}

function requireHost(room: RoomState, session: Session): void {
  if (room.hostId !== session.playerId) throw new ApiError(403, "방장만 할 수 있습니다.");
}

/**
 * 게임이 시작되지 않았거나(waiting) 끝난(finished) 방에 사람이 한 명뿐인가.
 * 진행 중인 게임은 사람 1명 + 봇들이 정상이므로 절대 여기 걸리지 않는다.
 */
function isSolo(room: RoomState): boolean {
  if (room.status === "playing") return false;
  return [...room.players, ...room.spectators].filter((m) => !m.isBot).length <= 1;
}

/** 접속 시각 갱신 + 접속 목록 재계산 + 타임아웃 적용. 뷰가 바뀌었으면 changed */
function tick(room: RoomState, now: number, touchId?: string): { changed: boolean; touched: boolean } {
  let touched = false;
  if (touchId) {
    const m = memberOf(room, touchId);
    if (m && now - m.lastSeen >= PRESENCE_WRITE_MS) {
      m.lastSeen = now;
      touched = true;
    }
  }

  let changed = false;
  const connected = room.players.filter((p) => isConnected(p, now)).map((p) => p.id);
  if (connected.join(",") !== room.connectedIds.join(",")) {
    room.connectedIds = connected;
    changed = true;
  }

  if (room.status === "playing" && room.game) {
    const next = applyTimeouts(room.game, now, (id) => !room.connectedIds.includes(id));
    if (next) {
      room.game = next;
      changed = true;
    }
  }
  if (room.game?.winner && room.status === "playing") {
    room.status = "finished";
    changed = true;
  }

  // 혼자 붙들고 있기 시작한 시각. 화면에 안 보이는 기록이라 version은 올리지 않는다.
  const solo = isSolo(room);
  if (solo && !room.aloneSince) {
    room.aloneSince = now;
    touched = true;
  } else if (!solo && room.aloneSince !== undefined) {
    delete room.aloneSince;
    touched = true;
  }
  return { changed, touched };
}

function validateSettings(input: Partial<RoomSettings>, current: RoomSettings, playerCount: number): RoomSettings {
  const s = { ...current };
  if (input.isPublic !== undefined) s.isPublic = !!input.isPublic;
  if (input.spectatorMode !== undefined) {
    if (input.spectatorMode !== "public" && input.spectatorMode !== "all") throw new ApiError(400, "잘못된 관전 설정입니다.");
    s.spectatorMode = input.spectatorMode;
  }
  if (input.turnSeconds !== undefined) {
    const t = Number(input.turnSeconds);
    if (!Number.isInteger(t) || t < 20 || t > 180) throw new ApiError(400, "턴 시간은 20~180초여야 합니다.");
    s.turnSeconds = t;
  }
  if (input.maxPlayers !== undefined) {
    const m = Number(input.maxPlayers);
    if (!Number.isInteger(m) || m < MIN_PLAYERS || m > MAX_PLAYERS) throw new ApiError(400, `인원은 ${MIN_PLAYERS}~${MAX_PLAYERS}명이어야 합니다.`);
    if (m < playerCount) throw new ApiError(400, "현재 인원보다 적게 설정할 수 없습니다.");
    s.maxPlayers = m;
  }
  return s;
}

// ---------- 공개 API ----------

export async function listRooms(): Promise<RoomSummary[]> {
  return (await listPublicRooms()).map(toSummary);
}

/**
 * 이 플레이어가 복귀할 방. 가리키는 방이 이미 없으면 포인터를 지우고 null.
 * (방 TTL 6시간 < 포인터 TTL 24시간이라 죽은 포인터가 남을 수 있다)
 */
export async function currentRoomOf(session: Session): Promise<string | null> {
  const code = await getRoomOf(session.playerId);
  if (!code) return null;
  if (await loadRoom(code)) return code;
  await setRoomOf(session.playerId, null);
  return null;
}

/** 입장 전 확인용 공개 정보 (비공개 방도 코드를 알면 조회 가능) */
export async function roomInfo(code: string): Promise<RoomSummary> {
  return toSummary(await requireRoom(code));
}

export async function createRoom(session: Session, input: Partial<RoomSettings>): Promise<RoomView> {
  await leaveCurrentRoom(session);
  const now = Date.now();
  const code = await newRoomCode();
  const room: RoomState = {
    code,
    version: 1,
    status: "waiting",
    createdAt: now,
    updatedAt: now,
    settings: validateSettings(input, DEFAULT_SETTINGS, 1),
    hostId: session.playerId,
    players: [{ id: session.playerId, nickname: session.nickname, lastSeen: now }],
    spectators: [],
    connectedIds: [session.playerId],
  };
  await saveRoom(room, now);
  await setRoomOf(session.playerId, code);
  return toRoomView(room, session, now);
}

/**
 * `as: "auto"`는 자리 상황을 **락 안에서** 보고 정한다.
 * 예전에는 클라이언트가 `roomInfo`를 먼저 읽어 player/spectator를 골랐는데,
 * 그 왕복이 입장 경로에 그대로 얹혔고 값도 이미 낡은 것이었다 — 마지막 한 자리에
 * 두 명이 동시에 들어오면 한 명은 관전으로 내려가지 않고 에러를 보고 튕겼다.
 */
export async function joinRoom(session: Session, code: string, as: "player" | "spectator" | "auto"): Promise<RoomView> {
  const current = await getRoomOf(session.playerId);
  if (current && current !== code) await leaveRoom(session, current).catch(() => {});

  return withRoomLock(code, async (room) => {
    const now = Date.now();
    const existing = memberOf(room, session.playerId);
    const seat = seatOf(room, session.playerId);
    const want: "player" | "spectator" =
      as !== "auto"
        ? as
        : existing && seat !== "none"
          ? seat // 이미 앉아 있으면 그 자리를 유지한다 (자동 입장이 자리를 옮기면 안 된다)
          : room.status === "waiting" && room.players.length < room.settings.maxPlayers
            ? "player"
            : "spectator";
    if (existing && (seat === want || room.status !== "waiting")) {
      existing.lastSeen = now;
      existing.nickname = session.nickname;
      tick(room, now);
      return { room, result: toRoomView(room, session, now), silent: true };
    }
    // 대기실에서 플레이어 ↔ 관전자 전환
    if (existing) {
      room.players = room.players.filter((p) => p.id !== existing.id);
      room.spectators = room.spectators.filter((p) => p.id !== existing.id);
    }
    const member: RoomMember = existing ?? { id: session.playerId, nickname: session.nickname, lastSeen: now };
    if (want === "player") {
      if (room.status === "playing") throw new ApiError(400, "진행 중인 게임에는 관전으로만 들어갈 수 있습니다.");
      if (room.players.length >= room.settings.maxPlayers) throw new ApiError(400, "방이 가득 찼습니다.");
      room.players.push(member);
      if (!room.players.some((p) => p.id === room.hostId)) room.hostId = member.id;
    } else {
      room.spectators.push(member);
      // 관전으로 내려가도 방장은 그대로 둔다. 예전엔 players[0]에게 넘겼는데
      // 그게 봇이면 아무도 시작할 수 없는 방이 됐다 (방 만들기 → 봇 추가 → 관전).
    }
    await setRoomOf(session.playerId, code);
    tick(room, now);
    return { room, result: toRoomView(room, session, now) };
  });
}

export async function leaveRoom(session: Session, code: string): Promise<void> {
  let empty = false;
  // 방이 이미 사라졌어도(TTL 만료 등) 참여 포인터는 반드시 지운다.
  // 안 지우면 로비가 "참여 중인 방이 있습니다"를 계속 띄우고,
  // 복귀하면 "없는 방"이 나오는 무한 반복이 된다.
  try {
    await withRoomLock(code, async (room) => {
      const now = Date.now();
      const id = session.playerId;
      const wasPlayer = room.players.some((p) => p.id === id);

      if (wasPlayer && room.status === "playing" && room.game) {
        room.game = forfeit(room.game, id, now);
      }
      room.players = room.players.filter((p) => p.id !== id);
      room.spectators = room.spectators.filter((p) => p.id !== id);

      if (room.hostId === id) {
        room.hostId = nextHost(room) ?? "";
      }
      tick(room, now);
      // 봇만 남은 방은 아무도 폴링하지 않아 그대로 방치된다 — 같이 닫는다
      const humans = [...room.players, ...room.spectators].filter((m) => !m.isBot);
      empty = humans.length === 0;
      return { room: empty ? null : room, result: undefined };
    });
  } finally {
    await setRoomOf(session.playerId, null);
  }
  if (empty) await deleteRoom(code);
}

async function leaveCurrentRoom(session: Session): Promise<void> {
  const current = await getRoomOf(session.playerId);
  if (current) await leaveRoom(session, current).catch(() => {});
}

/**
 * 폴링 진입점. 변경이 필요할 때만 락을 잡고 저장한다.
 * since와 버전이 같으면 null (304).
 */
export async function getState(session: Session, code: string, since: number | null): Promise<RoomView | null> {
  const room = await requireRoom(code);
  const now = Date.now();
  if (seatOf(room, session.playerId) === "none") throw new ApiError(403, "이 방의 참가자가 아닙니다.");

  const probe = structuredClone(room);
  const { changed, touched } = tick(probe, now, session.playerId);

  let view: RoomView;
  if (changed || touched) {
    view = await withRoomLock(code, async (fresh) => {
      const r = tick(fresh, now, session.playerId);
      return { room: fresh, result: toRoomView(fresh, session, now), silent: !r.changed };
    });
  } else {
    view = toRoomView(room, session, now);
  }
  return since !== null && since === view.version ? null : view;
}

export async function updateSettings(session: Session, code: string, input: Partial<RoomSettings>): Promise<RoomView> {
  return withRoomLock(code, async (room) => {
    requireHost(room, session);
    if (room.status === "playing") throw new ApiError(400, "게임 중에는 설정을 바꿀 수 없습니다.");
    room.settings = validateSettings(input, room.settings, room.players.length);
    const now = Date.now();
    tick(room, now, session.playerId);
    return { room, result: toRoomView(room, session, now) };
  });
}

export async function startGame(session: Session, code: string): Promise<RoomView> {
  return withRoomLock(code, async (room) => {
    requireHost(room, session);
    if (room.status === "playing") throw new ApiError(400, "이미 진행 중입니다.");
    if (room.players.length < MIN_PLAYERS) throw new ApiError(400, `최소 ${MIN_PLAYERS}명이 필요합니다.`);
    const now = Date.now();
    // 좌석 순서는 매 판 새로 섞는다
    room.players = shuffle(room.players);
    room.game = createGame(
      room.players.map((p) => ({ id: p.id, nickname: p.nickname })),
      randomSeed(),
      now,
      { turnSeconds: room.settings.turnSeconds },
    );
    room.status = "playing";
    tick(room, now, session.playerId);
    return { room, result: toRoomView(room, session, now) };
  });
}

export async function doAction(session: Session, code: string, action: Action): Promise<RoomView> {
  return withRoomLock(code, async (room) => {
    if (room.status !== "playing" || !room.game) throw new ApiError(400, "진행 중인 게임이 없습니다.");
    if (!room.players.some((p) => p.id === session.playerId)) throw new ApiError(403, "플레이어만 행동할 수 있습니다.");
    const now = Date.now();
    tick(room, now, session.playerId);

    let error: unknown;
    try {
      room.game = applyAction(room.game, session.playerId, action, now);
    } catch (e) {
      error = e;
    }
    if (room.game.winner) room.status = "finished";
    return { room, result: toRoomView(room, session, now), error };
  });
}

export async function kickPlayer(session: Session, code: string, targetId: string): Promise<RoomView> {
  return withRoomLock(code, async (room) => {
    requireHost(room, session);
    if (room.status === "playing") throw new ApiError(400, "게임 중에는 강퇴할 수 없습니다.");
    if (targetId === session.playerId) throw new ApiError(400, "자기 자신은 강퇴할 수 없습니다.");
    const before = room.players.length + room.spectators.length;
    room.players = room.players.filter((p) => p.id !== targetId);
    room.spectators = room.spectators.filter((p) => p.id !== targetId);
    if (before === room.players.length + room.spectators.length) throw new ApiError(404, "그런 참가자가 없습니다.");
    if (!targetId.startsWith("bot:")) await setRoomOf(targetId, null);
    const now = Date.now();
    tick(room, now, session.playerId);
    return { room, result: toRoomView(room, session, now) };
  });
}

/**
 * 봇 이름은 AI1, AI2… 사람 닉네임처럼 보이는 이름을 주면 누가 봇인지 헷갈린다.
 * 빠진 번호가 있으면 다시 채운다 (봇을 뺐다 넣어도 번호가 치솟지 않게).
 */
function nextBotName(room: RoomState): string {
  const taken = new Set(room.players.map((p) => p.nickname));
  for (let i = 1; ; i++) {
    const name = `AI${i}`;
    if (!taken.has(name)) return name;
  }
}

/** 방장이 AI 봇을 자리에 앉힌다 */
export async function addBot(session: Session, code: string): Promise<RoomView> {
  return withRoomLock(code, async (room) => {
    requireHost(room, session);
    if (room.status !== "waiting") throw new ApiError(400, "대기실에서만 봇을 추가할 수 있습니다.");
    if (room.players.length >= room.settings.maxPlayers) throw new ApiError(400, "자리가 가득 찼습니다.");

    const now = Date.now();
    room.players.push({ id: `bot:${randomUUID()}`, nickname: nextBotName(room), lastSeen: now, isBot: true });
    tick(room, now, session.playerId);
    return { room, result: toRoomView(room, session, now) };
  });
}

export async function removeBot(session: Session, code: string, botId: string): Promise<RoomView> {
  return withRoomLock(code, async (room) => {
    requireHost(room, session);
    if (room.status !== "waiting") throw new ApiError(400, "대기실에서만 봇을 뺄 수 있습니다.");
    const bot = room.players.find((p) => p.id === botId && p.isBot);
    if (!bot) throw new ApiError(404, "그런 봇이 없습니다.");
    room.players = room.players.filter((p) => p.id !== botId);
    const now = Date.now();
    tick(room, now, session.playerId);
    return { room, result: toRoomView(room, session, now) };
  });
}

/** 결과 화면에서 대기실로 되돌리기 (방장) */
export async function resetRoom(session: Session, code: string): Promise<RoomView> {
  return withRoomLock(code, async (room) => {
    requireHost(room, session);
    if (room.status !== "finished") throw new ApiError(400, "끝난 게임만 초기화할 수 있습니다.");
    room.status = "waiting";
    delete room.game;
    const now = Date.now();
    tick(room, now, session.playerId);
    return { room, result: toRoomView(room, session, now) };
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
