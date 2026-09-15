import type { GameState } from "@/game/types";
import type { GameView } from "@/game/view";

export type RoomStatus = "waiting" | "playing" | "finished";
export type SpectatorMode = "public" | "all";

export interface RoomSettings {
  isPublic: boolean;
  spectatorMode: SpectatorMode;
  turnSeconds: number;
  maxPlayers: number;
}

export interface RoomMember {
  id: string;
  nickname: string;
  lastSeen: number;
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
  game?: GameState;
}

// ---------- 클라이언트로 내려가는 뷰 ----------

export interface MemberView {
  id: string;
  nickname: string;
  connected: boolean;
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
  spectatorMode: "public",
  turnSeconds: 60,
  maxPlayers: 7,
};

/** 마지막 폴링 후 이 시간이 지나면 "연결 끊김" */
export const DISCONNECT_AFTER_MS = 10_000;
