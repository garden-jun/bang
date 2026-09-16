import type { RoomState } from "@/shared/types";
import { ApiError } from "./api";
import { getStore } from "./store";

const ROOM_TTL_SEC = 60 * 60 * 6; // 6h, 활동 시 갱신
const LOCK_TTL_MS = 3000;
const PUBLIC_LIST = "rooms:public";

/**
 * 접속 중인 사람이 아무도 없는 채로 이 시간이 지나면 방을 닫는다.
 *
 * 탭을 닫고 떠난 방이 TTL 6시간 동안 로비에 남아 있었다. 들어가 봐야 방장이 없어
 * 시작도 못 하는 방이라, 목록만 지저분해진다.
 *
 * 사람 1명이 봇과 플레이 중인 방은 지워지면 안 된다 — 그 사람이 폴링하는 한
 * `lastSeen`이 계속 갱신되므로 여기에 걸리지 않는다.
 */
const ABANDONED_MS = 10 * 60 * 1000;

/**
 * 같은 서버 인스턴스로 몰리는 폴링을 흡수하는 초단기 캐시.
 * 폴링 간격(2초)보다 훨씬 짧아, 최악의 경우에도 한 프레임 늦게 보일 뿐이다.
 * 락 안에서는 절대 쓰지 않는다 — 덮어쓰기가 난다.
 */
const CACHE_MS = 400;
const g = globalThis as unknown as { __bangRoomCache?: Map<string, { room: RoomState; at: number }> };
const cache = (g.__bangRoomCache ??= new Map());

function cachePut(room: RoomState): void {
  cache.set(room.code, { room: structuredClone(room), at: Date.now() });
  // 죽은 방이 쌓이지 않게 가끔 청소
  if (cache.size > 200) {
    const cutoff = Date.now() - CACHE_MS;
    for (const [k, v] of cache) if (v.at < cutoff) cache.delete(k);
  }
}

const roomKey = (code: string) => `room:${code}`;
const lockKey = (code: string) => `lock:room:${code}`;

// 헷갈리는 글자(0/O, 1/I) 제외
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isValidCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code);
}

export async function newRoomCode(): Promise<string> {
  const store = getStore();
  for (let i = 0; i < 10; i++) {
    let code = "";
    for (let j = 0; j < 6; j++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!(await store.get(roomKey(code)))) return code;
  }
  throw new ApiError(500, "방 코드를 만들지 못했습니다.");
}

/**
 * 방을 읽는다. 호출자가 반환값을 마음대로 고쳐도 되도록 항상 독립된 객체다.
 * `fresh`면 캐시를 건너뛴다 (락 안에서 필수).
 */
export async function loadRoom(code: string, fresh = false): Promise<RoomState | null> {
  if (!isValidCode(code)) return null;
  if (!fresh) {
    const hit = cache.get(code);
    if (hit && Date.now() - hit.at < CACHE_MS) return structuredClone(hit.room);
  }
  const room = await getStore().get<RoomState>(roomKey(code));
  if (room) cachePut(room);
  else cache.delete(code);
  return room;
}

export async function requireRoom(code: string, fresh = false): Promise<RoomState> {
  const r = await loadRoom(code, fresh);
  if (!r) throw new ApiError(404, "존재하지 않는 방입니다.");
  return r;
}

const isListed = (r: RoomState) => r.settings.isPublic && r.status !== "finished";

/** 사람이 아무도 안 보고 있는 방인가 (봇은 폴링하지 않으므로 세지 않는다) */
function isAbandoned(room: RoomState, now: number): boolean {
  const humans = [...room.players, ...room.spectators].filter((m) => !m.isBot);
  if (humans.length === 0) return true;
  return now - Math.max(...humans.map((m) => m.lastSeen)) > ABANDONED_MS;
}

/** 저장한다 (version은 호출자가 관리). 공개 목록도 동기화. */
export async function saveRoom(room: RoomState, now: number): Promise<RoomState> {
  room.updatedAt = now;
  const store = getStore();

  // 목록 상태가 그대로면 zadd/zrem은 어차피 no-op이므로 건너뛴다 (저장마다 커맨드 1개 절약).
  // 직전 상태를 모르면(캐시 만료) 안전하게 동기화한다.
  const prev = cache.get(room.code)?.room;
  const listed = isListed(room);
  const needsSync = !prev || isListed(prev) !== listed;

  await store.set(roomKey(room.code), room, ROOM_TTL_SEC);
  cachePut(room);
  if (needsSync) {
    if (listed) await store.zadd(PUBLIC_LIST, room.createdAt, room.code);
    else await store.zrem(PUBLIC_LIST, room.code);
  }
  return room;
}

export async function deleteRoom(code: string): Promise<void> {
  const store = getStore();
  cache.delete(code);
  await store.del(roomKey(code));
  await store.zrem(PUBLIC_LIST, code);
}

export async function listPublicRooms(limit = 30): Promise<RoomState[]> {
  const store = getStore();
  const codes = await store.zrangeDesc(PUBLIC_LIST, limit);
  if (codes.length === 0) return [];
  const rooms = await store.mget<RoomState>(codes.map(roomKey));
  const out: RoomState[] = [];
  const now = Date.now();
  for (let i = 0; i < codes.length; i++) {
    const r = rooms[i];
    if (!r || !isListed(r)) {
      await store.zrem(PUBLIC_LIST, codes[i]); // 만료/비공개 정리
      continue;
    }
    // 상주 프로세스가 없으니 로비를 여는 순간이 곧 청소 시점이다
    if (isAbandoned(r, now)) {
      await deleteRoom(r.code);
      continue;
    }
    out.push(r);
  }
  return out;
}

export interface LockResult<T> {
  /** 저장할 상태. null이면 저장하지 않음 */
  room: RoomState | null;
  result: T;
  /** true면 version을 올리지 않고 저장 */
  silent?: boolean;
  /** 저장은 하되 호출자에게 던질 에러 (타임아웃 처리 후 액션이 거부된 경우 등) */
  error?: unknown;
}

/**
 * 방 단위 락. 짧게 재시도하고 실패하면 409.
 * fn은 최신 상태를 받아 저장할 상태와 결과를 돌려준다.
 */
export async function withRoomLock<T>(
  code: string,
  fn: (room: RoomState) => Promise<LockResult<T>>,
): Promise<T> {
  const store = getStore();
  const key = lockKey(code);
  let locked = false;
  for (let i = 0; i < 8 && !locked; i++) {
    locked = await store.setNx(key, 1, LOCK_TTL_MS);
    if (!locked) await new Promise((r) => setTimeout(r, 80 + Math.random() * 80));
  }
  if (!locked) throw new ApiError(409, "잠시 후 다시 시도해 주세요.");
  try {
    // 캐시를 읽으면 남의 변경을 덮어쓴다 — 락 안에서는 반드시 실제 값
    const room = await requireRoom(code, true);
    // fn이 만드는 뷰가 저장될 버전을 갖도록 미리 올려둔다
    const base = room.version;
    room.version = base + 1;
    const { room: next, result, silent, error } = await fn(room);
    if (next) {
      if (silent) next.version = base;
      await saveRoom(next, Date.now());
    }
    if (error) throw error;
    return result;
  } finally {
    await store.del(key);
  }
}
