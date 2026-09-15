import { randomBytes, randomUUID } from "node:crypto";
import { getStore } from "./store";

export interface Session {
  token: string;
  playerId: string;
  nickname: string;
}

const SESSION_TTL_SEC = 60 * 60 * 24; // 24h

const sessionKey = (token: string) => `player:${token}`;
const roomOfKey = (playerId: string) => `playerRoom:${playerId}`;

export async function createSession(nickname: string): Promise<Session> {
  const s: Session = { token: randomBytes(24).toString("base64url"), playerId: randomUUID(), nickname };
  await getStore().set(sessionKey(s.token), { playerId: s.playerId, nickname }, SESSION_TTL_SEC);
  return s;
}

export async function getSession(token: string | null): Promise<Session | null> {
  if (!token || token.length > 64) return null;
  const v = await getStore().get<{ playerId: string; nickname: string }>(sessionKey(token));
  return v ? { token, ...v } : null;
}

export async function renameSession(s: Session, nickname: string): Promise<Session> {
  const next = { ...s, nickname };
  await getStore().set(sessionKey(s.token), { playerId: s.playerId, nickname }, SESSION_TTL_SEC);
  return next;
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
