import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getStore } from "./store";

export interface Session {
  token: string;
  playerId: string;
  nickname: string;
}

const SESSION_TTL_SEC = 60 * 60 * 24; // 24h

const sessionKey = (token: string) => `player:${token}`;
const roomOfKey = (playerId: string) => `playerRoom:${playerId}`;

/**
 * 서명 토큰 (v1.payload.sig).
 *
 * 폴링은 매 요청마다 세션을 확인하는데, 토큰을 Redis에 저장하면 그 확인이
 * 커맨드 1개씩 쌓인다 (무료 티어에서는 전체의 약 1/3). 서명 토큰은 Redis를
 * 전혀 건드리지 않는다.
 *
 * SESSION_SECRET이 없으면 예전처럼 Redis에 저장한다 — 배포 환경에서 키를
 * 빠뜨려도 로그인이 깨지지 않도록.
 */
const SECRET =
  process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? null : "dev-only-insecure-secret");

let warned = false;
function stateless(): boolean {
  if (SECRET) return true;
  if (!warned) {
    warned = true;
    console.warn("[session] SESSION_SECRET 미설정 — 세션을 Redis에 저장합니다 (커맨드 사용량 약 1.5배). 임의의 긴 문자열을 넣어주세요.");
  }
  return false;
}

const b64 = (b: Buffer) => b.toString("base64url");

function sign(payload: string): string {
  return b64(createHmac("sha256", SECRET!).update(payload).digest());
}

function issue(playerId: string, nickname: string): string {
  const payload = b64(Buffer.from(JSON.stringify({ i: playerId, n: nickname, e: Date.now() + SESSION_TTL_SEC * 1000 })));
  return `v1.${payload}.${sign(payload)}`;
}

function verify(token: string): { playerId: string; nickname: string } | null {
  // 키가 없으면 검증할 방법이 없다 — 통과시키지 말고 조용히 거부한다
  if (!SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payload, sig] = parts;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const { i, n, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      i: string;
      n: string;
      e: number;
    };
    if (!i || !n || !(e > Date.now())) return null;
    return { playerId: i, nickname: n };
  } catch {
    return null;
  }
}

export async function createSession(nickname: string): Promise<Session> {
  const playerId = randomUUID();
  if (stateless()) return { token: issue(playerId, nickname), playerId, nickname };

  const token = randomBytes(24).toString("base64url");
  await getStore().set(sessionKey(token), { playerId, nickname }, SESSION_TTL_SEC);
  return { token, playerId, nickname };
}

export async function getSession(token: string | null): Promise<Session | null> {
  if (!token || token.length > 512) return null;
  // 서명 토큰이면 Redis를 건드리지 않는다
  if (token.startsWith("v1.")) {
    const v = verify(token);
    return v ? { token, ...v } : null;
  }
  const v = await getStore().get<{ playerId: string; nickname: string }>(sessionKey(token));
  return v ? { token, ...v } : null;
}

/** 닉네임이 토큰 안에 있으므로 새 토큰을 발급한다 (클라이언트가 교체 저장) */
export async function renameSession(s: Session, nickname: string): Promise<Session> {
  if (stateless() && s.token.startsWith("v1.")) {
    return { token: issue(s.playerId, nickname), playerId: s.playerId, nickname };
  }
  await getStore().set(sessionKey(s.token), { playerId: s.playerId, nickname }, SESSION_TTL_SEC);
  return { ...s, nickname };
}

/** 플레이어가 현재 참여 중인 방 (복귀용) */
export async function getRoomOf(playerId: string): Promise<string | null> {
  return getStore().get<string>(roomOfKey(playerId));
}

export async function setRoomOf(playerId: string, code: string | null): Promise<void> {
  if (code) await getStore().set(roomOfKey(playerId), code, SESSION_TTL_SEC);
  else await getStore().del(roomOfKey(playerId));
}

export function normalizeNickname(raw: unknown): string {
  const n = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (n.length < 1 || n.length > 12) throw new Error("닉네임은 1~12자여야 합니다.");
  return n;
}
