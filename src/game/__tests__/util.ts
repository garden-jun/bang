import { buildDeck } from "../cards";
import { CHARACTERS } from "../characters";
import { createGame } from "../setup";
import type { Card, CardName, CharacterName, GamePlayer, GameState, Role } from "../types";

export const NOW = 1_000_000;

let cardSeq = 0;
/** 테스트용 카드. 무늬/숫자는 판정 테스트에서만 의미 있음 */
export function card(name: CardName, suit: Card["suit"] = "C", rank: Card["rank"] = 5): Card {
  return { id: `${name}#${++cardSeq}`, name, suit, rank };
}

export interface Seat {
  id: string;
  role: Role;
  character?: CharacterName;
  hand?: Card[];
  equipment?: Card[];
  hp?: number;
}

/**
 * 좌석 순서대로 플레이어를 배치한 결정적 상태.
 * 덱은 비어 있는 상태로 시작하므로 필요한 테스트는 state.deck을 직접 채운다.
 */
export function makeState(seats: Seat[], opts: { deck?: Card[]; discard?: Card[]; turn?: string } = {}): GameState {
  // createGame은 4인 이상만 받으므로 더미로 채운 뒤 players를 통째로 교체한다
  const padded = [...seats.map((s) => s.id), "_a", "_b", "_c", "_d"].slice(0, Math.max(4, seats.length));
  const base = createGame(
    padded.map((id) => ({ id, nickname: id.toUpperCase() })),
    "test",
    NOW,
    { turnSeconds: 60, reactionSeconds: 30 },
  );
  base.names = Object.fromEntries(seats.map((s) => [s.id, s.id.toUpperCase()]));
  base.players = seats.map<GamePlayer>((s) => {
    const character = s.character ?? "willyTheKid";
    const maxHp = CHARACTERS[character].hp + (s.role === "sheriff" ? 1 : 0);
    return {
      id: s.id,
      role: s.role,
      character,
      maxHp,
      hp: s.hp ?? maxHp,
      hand: s.hand ?? [],
      equipment: s.equipment ?? [],
      alive: true,
      roleRevealed: s.role === "sheriff",
    };
  });
  base.deck = opts.deck ?? [];
  base.discard = opts.discard ?? [];
  const first = opts.turn ?? seats.find((s) => s.role === "sheriff")!.id;
  base.turn = { playerId: first, phase: "play", bangsPlayed: 0, startedAt: NOW, deadline: NOW + 60_000 };
  base.pending = [];
  base.log = [];
  return base;
}

/** 덱에 무의미한 카드를 n장 채운다 (드로우가 필요할 때) */
export function filler(n: number): Card[] {
  return Array.from({ length: n }, () => card("stagecoach", "S", 9));
}

export function p(state: GameState, id: string): GamePlayer {
  return state.players.find((x) => x.id === id)!;
}

export function handNames(state: GameState, id: string): CardName[] {
  return p(state, id).hand.map((c) => c.name);
}

export { buildDeck };
