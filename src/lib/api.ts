"use client";

import type { Action } from "@/game/types";
import type { RoomSettings, RoomSummary, RoomView, SessionInfo } from "@/shared/types";

const TOKEN_KEY = "bang.token";
const NICK_KEY = "bang.nickname";

export class ApiClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getSavedNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveSession(token: string, nickname: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(NICK_KEY, nickname);
  } catch {
    /* 저장 불가 환경이면 세션 유지만 포기 */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.json !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-player-token": token } : {}),
      ...(init.headers ?? {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    cache: "no-store",
  });
  if (res.status === 304) return null as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiClientError(res.status, (data as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export const api = {
  async createSession(nickname: string) {
    const r = await request<{ token: string; playerId: string; nickname: string }>("/api/session", { method: "POST", json: { nickname } });
    saveSession(r.token, r.nickname);
    return r;
  },
  session: () => request<SessionInfo>("/api/session"),
  listRooms: () => request<RoomSummary[]>("/api/rooms"),
  roomInfo: (code: string) => request<RoomSummary>(`/api/rooms/${code}/info`),
  createRoom: (settings: Partial<RoomSettings>) => request<RoomView>("/api/rooms", { method: "POST", json: settings }),
  join: (code: string, as: "player" | "spectator") => request<RoomView>(`/api/rooms/${code}/join`, { method: "POST", json: { as } }),
  leave: (code: string) => request<{ ok: true }>(`/api/rooms/${code}/leave`, { method: "POST" }),
  state: (code: string, since: number | null) =>
    request<RoomView | null>(`/api/rooms/${code}/state${since !== null ? `?since=${since}` : ""}`),
  settings: (code: string, s: Partial<RoomSettings>) => request<RoomView>(`/api/rooms/${code}/settings`, { method: "POST", json: s }),
  start: (code: string) => request<RoomView>(`/api/rooms/${code}/start`, { method: "POST" }),
  action: (code: string, action: Action) => request<RoomView>(`/api/rooms/${code}/action`, { method: "POST", json: action }),
  kick: (code: string, playerId: string) => request<RoomView>(`/api/rooms/${code}/kick`, { method: "POST", json: { playerId } }),
  reset: (code: string) => request<RoomView>(`/api/rooms/${code}/reset`, { method: "POST" }),
};
