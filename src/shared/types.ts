import type { GameState } from "@/game/types";
import type { GameView } from "@/game/view";

export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomSettings {
  isPublic: boolean;
  turnSeconds: number;
  maxPlayers: number;
}

export interface RoomMember {
  id: string;
  nickname: string;
  lastSeen: number;
  /** AI 봇. 폴링하지 않으므로 접속 판정에서 제외된다 */
  isBot?: boolean;
}

/** Redis에 저장되는 방 전체 상태. 토큰은 절대 포함하지 않는다. */
export interface RoomState {
  code: string;
  version: number;
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
  settings: RoomSettings;
  hostId: string;
  players: RoomMember[];
  spectators: RoomMember[];
  /** 마지막으로 계산한 접속 중 플레이어 (변화 감지용) */
  connectedIds: string[];
  /**
   * 게임이 시작되지 않았거나 끝난 채로 사람이 한 명뿐이 된 시각.
   * 여럿이 되거나 게임이 시작되면 지운다. 화면에는 안 보이는 정리용 기록.
   */
  aloneSince?: number;
  /**
   * 이 시각 전에는 봇이 두지 않는다. 직전 수의 연출이 모든 화면에서 끝날 때까지 기다리게 한다.
   * 봇 구동부는 여러 요청에서 동시에 뜨므로(액션·폴링) 기다림을 구동부 안이 아니라 방에 적는다.
   */
  botNotBefore?: number;
  game?: GameState;
}

// ---------- 클라이언트로 내려가는 뷰 ----------

export interface MemberView {
  id: string;
  nickname: string;
  connected: boolean;
  isBot?: boolean;
}

export interface RoomView {
  code: string;
  version: number;
  status: RoomStatus;
  settings: RoomSettings;
  hostId: string;
  players: MemberView[];
  spectators: MemberView[];
  game?: GameView;
  me: { id: string; nickname: string; seat: "player" | "spectator" | "none" };
  now: number;
  pollMs: number;
}

export interface RoomSummary {
  code: string;
  hostNickname: string;
  players: number;
  maxPlayers: number;
  status: RoomStatus;
}

export interface SessionInfo {
  playerId: string;
  nickname: string;
  roomCode?: string;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  isPublic: true,
  turnSeconds: 60,
  maxPlayers: 7,
};

/**
 * 마지막 폴링 후 이 시간이 지나면 "연결 끊김".
 * 접속 시각 저장 간격(PRESENCE_WRITE_MS)보다 넉넉히 길어야 한다 — 아니면
 * 멀쩡히 폴링 중인 사람이 끊긴 것으로 잡힌다.
 */
export const DISCONNECT_AFTER_MS = 30_000;
