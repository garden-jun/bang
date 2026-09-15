import { responder } from "./core";
import type { Card, CharacterName, GameConfig, GameState, LogEntry, Pending, Role, Turn, Winner } from "./types";

export interface PlayerView {
  id: string;
  character: CharacterName;
  maxHp: number;
  hp: number;
  alive: boolean;
  equipment: Card[];
  handCount: number;
  /** 공개된 경우에만 */
  role?: Role;
  /** 본인 또는 전체 공개 관전일 때만 */
  hand?: Card[];
}

export type PendingView =
  | Extract<Pending, { kind: "bang" | "indians" | "gatling" | "duel" | "dying" | "generalStore" }>
  | (Omit<Extract<Pending, { kind: "kitCarlson" }>, "cards"> & { cards?: Card[] });

export interface GameView {
  players: PlayerView[];
  turn: Turn;
  pending: PendingView[];
  responder: string;
  deckCount: number;
  discardTop?: Card;
  log: LogEntry[];
  winner?: Winner;
  names: Record<string, string>;
  config: GameConfig;
}

export type ViewerMode =
  | { kind: "player"; id: string }
  | { kind: "spectator"; revealAll: boolean };

export function toView(state: GameState, viewer: ViewerMode): GameView {
  const revealAll = viewer.kind === "spectator" && viewer.revealAll;
  const me = viewer.kind === "player" ? viewer.id : undefined;
  const gameOver = !!state.winner;

  return {
    players: state.players.map((p) => ({
      id: p.id,
      character: p.character,
      maxHp: p.maxHp,
      hp: p.hp,
      alive: p.alive,
      equipment: p.equipment,
      handCount: p.hand.length,
      role: p.roleRevealed || revealAll || gameOver || p.id === me ? p.role : undefined,
      hand: revealAll || p.id === me ? p.hand : undefined,
    })),
    turn: state.turn,
    pending: state.pending.map((pd) => {
      if (pd.kind === "kitCarlson" && !(revealAll || pd.playerId === me)) {
        const rest: PendingView = { ...pd };
        delete rest.cards;
        return rest;
      }
      return pd;
    }),
    responder: state.winner ? "" : responder(state),
    deckCount: state.deck.length,
    discardTop: state.discard[state.discard.length - 1],
    log: state.log.slice(-60),
    winner: state.winner,
    names: state.names,
    config: state.config,
  };
}
