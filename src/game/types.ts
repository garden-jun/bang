export type Suit = "S" | "H" | "D" | "C"; // ♠ ♥ ♦ ♣
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type CardName =
  | "bang"
  | "missed"
  | "beer"
  | "panic"
  | "catBalou"
  | "stagecoach"
  | "wellsFargo"
  | "generalStore"
  | "indians"
  | "duel"
  | "gatling"
  | "saloon"
  | "barrel"
  | "scope"
  | "mustang"
  | "jail"
  | "dynamite"
  | "volcanic"
  | "schofield"
  | "remington"
  | "carabine"
  | "winchester";

export type WeaponName = "volcanic" | "schofield" | "remington" | "carabine" | "winchester";

export type Role = "sheriff" | "deputy" | "outlaw" | "renegade";

export type CharacterName =
  | "bartCassidy"
  | "blackJack"
  | "calamityJanet"
  | "elGringo"
  | "jesseJones"
  | "jourdonnais"
  | "kitCarlson"
  | "luckyDuke"
  | "paulRegret"
  | "pedroRamirez"
  | "roseDoolan"
  | "sidKetchum"
  | "slabTheKiller"
  | "suzyLafayette"
  | "vultureSam"
  | "willyTheKid";

export interface Card {
  id: string;
  name: CardName;
  suit: Suit;
  rank: Rank;
}

export interface GamePlayer {
  id: string;
  role: Role;
  character: CharacterName;
  maxHp: number;
  hp: number;
  hand: Card[];
  equipment: Card[];
  alive: boolean;
  roleRevealed: boolean;
}

/** start: 다이너마이트 판정 → jail: 감옥 판정 → draw → play → discard */
export type Phase = "start" | "jail" | "draw" | "play" | "discard";

export interface Timed {
  startedAt: number;
  deadline: number;
}

export interface Turn extends Timed {
  playerId: string;
  phase: Phase;
  bangsPlayed: number;
}

/** 다른 플레이어의 응답을 기다리는 상황. 배열 마지막이 현재 응답 대상. */
export type Pending =
  | ({ kind: "bang"; from: string; to: string; missedNeeded: number } & Timed)
  | ({ kind: "indians"; from: string; targets: string[] } & Timed)
  | ({ kind: "gatling"; from: string; targets: string[]; barrelCheckedFor?: string } & Timed)
  | ({ kind: "duel"; from: string; to: string; current: string } & Timed)
  | ({ kind: "generalStore"; cards: Card[]; order: string[] } & Timed)
  | ({ kind: "kitCarlson"; playerId: string; cards: Card[] } & Timed)
  | ({ kind: "dying"; playerId: string; sourceId?: string } & Timed);

export type Winner = "sheriff" | "outlaws" | "renegade";

/** 카드 한 장을 뒤집어 운을 보는 판정 */
export type CheckKind = "jail" | "dynamite" | "barrel";

/** 연출용 구조화 정보 — "누가 누구에게 무엇을". 문장은 사람이, 메타는 화면이 읽는다. */
export type LogMeta =
  /** 화살표로 그리는 것. dynamite는 불발돼 다음 사람에게 넘어갈 때 */
  | {
      kind: "bang" | "duel" | "panic" | "catBalou" | "jail" | "indians" | "gatling" | "dynamite";
      from: string;
      to?: string;
      targets?: string[];
    }
  | { kind: "dodge"; from: string }
  /** ok는 "판정 조건이 나왔다" — 다이너마이트는 ok가 곧 폭발이다 */
  | { kind: "check"; from: string; check: CheckKind; cards: Card[]; ok: boolean }
  /** 턴 시작 판정의 결과 */
  | { kind: "outcome"; from: string; outcome: "escape" | "skip" | "explode" };

export interface LogEntry {
  t: number;
  msg: string;
  meta?: LogMeta;
}

export interface GameConfig {
  turnSeconds: number;
  reactionSeconds: number;
}

export interface GameState {
  seed: string;
  /** 시드 기반 RNG 진행 카운터 */
  rngState: number;
  config: GameConfig;
  names: Record<string, string>;
  deck: Card[];
  discard: Card[];
  players: GamePlayer[];
  turn: Turn;
  pending: Pending[];
  winner?: Winner;
  log: LogEntry[];
}

export type DrawSource = "deck" | "discard" | { playerId: string };

export type Action =
  | { type: "draw"; source?: DrawSource }
  | { type: "pickCards"; cardIds: string[] }
  | { type: "play"; cardId: string; targetId?: string; targetCardId?: string }
  | { type: "respond"; cardIds: string[] }
  | { type: "endTurn" }
  | { type: "discard"; cardIds: string[] }
  | { type: "ability"; name: "sidKetchum"; cardIds: string[] };

export class GameError extends Error {}
