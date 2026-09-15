import type { RoomState } from "@/shared/types";
import { ApiError } from "./api";
import { getStore } from "./store";

const ROOM_TTL_SEC = 60 * 60 * 6; // 6h, 활동 시 갱신
const LOCK_TTL_MS = 3000;
const PUBLIC_LIST = "rooms:public";

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

export async function loadRoom(code: string): Promise<RoomState | null> {
  if (!isValidCode(code)) return null;
  return getStore().get<RoomState>(roomKey(code));
}

export async function requireRoom(code: string): Promise<RoomState> {
  const r = await loadRoom(code);
  if (!r) throw new ApiError(404, "존재하지 않는 방입니다.");
  return r;
}

/** 저장한다 (version은 호출자가 관리). 공개 목록도 동기화. */
export async function saveRoom(room: RoomState, now: number): Promise<RoomState> {
  room.updatedAt = now;
  const store = getStore();
  await store.set(roomKey(room.code), room, ROOM_TTL_SEC);
  if (room.settings.isPublic && room.status !== "finished") await store.zadd(PUBLIC_LIST, room.createdAt, room.code);
  else await store.zrem(PUBLIC_LIST, room.code);
  return room;
}

export async function deleteRoom(code: string): Promise<void> {
  const store = getStore();
  await store.del(roomKey(code));
  await store.zrem(PUBLIC_LIST, code);
}

export async function listPublicRooms(limit = 30): Promise<RoomState[]> {
  const store = getStore();
  const codes = await store.zrangeDesc(PUBLIC_LIST, limit);
  if (codes.length === 0) return [];
  const rooms = await store.mget<RoomState>(codes.map(roomKey));
  const out: RoomState[] = [];
  for (let i = 0; i < codes.length; i++) {
    const r = rooms[i];
    if (r && r.settings.isPublic && r.status !== "finished") out.push(r);
    else await store.zrem(PUBLIC_LIST, codes[i]); // 만료/비공개 정리
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
    const room = await requireRoom(code);
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
