import { buildDeck } from "./cards";
import { CHARACTERS, CHARACTER_NAMES } from "./characters";
import { log, timed } from "./core";
import { makeRng } from "./rng";
import { rolesFor } from "./roles";
import type { GameConfig, GamePlayer, GameState } from "./types";

export interface SetupPlayer {
  id: string;
  nickname: string;
}

/** 좌석 순서(players 배열 순서)대로 게임을 시작한다. 보안관이 첫 턴. */
export function createGame(
  players: SetupPlayer[],
  seed: string,
  now: number,
  config: Partial<GameConfig> = {},
): GameState {
  const turnSeconds = config.turnSeconds ?? 60;
  const state: GameState = {
    seed,
    rngState: 0,
    config: {
      turnSeconds,
      reactionSeconds: config.reactionSeconds ?? Math.max(15, Math.ceil(turnSeconds / 2)),
    },
    names: Object.fromEntries(players.map((p) => [p.id, p.nickname])),
    deck: [],
    discard: [],
    players: [],
    turn: { playerId: "", phase: "start", bangsPlayed: 0, startedAt: now, deadline: now },
    pending: [],
    log: [],
  };
  const r = makeRng(seed, state);

  const roles = r.shuffle(rolesFor(players.length));
  const chars = r.shuffle(CHARACTER_NAMES).slice(0, players.length);
  state.deck = r.shuffle(buildDeck());

  state.players = players.map<GamePlayer>((p, i) => {
    const role = roles[i];
    const character = chars[i];
    const maxHp = CHARACTERS[character].hp + (role === "sheriff" ? 1 : 0);
    return {
      id: p.id,
      role,
      character,
      maxHp,
      hp: maxHp,
      hand: [],
      equipment: [],
      alive: true,
      roleRevealed: role === "sheriff",
    };
  });

  for (const p of state.players) {
    p.hand = state.deck.splice(-p.maxHp, p.maxHp);
  }

  const sheriff = state.players.find((p) => p.role === "sheriff")!;
  state.turn = {
    playerId: sheriff.id,
    phase: "start",
    bangsPlayed: 0,
    ...timed(state, now, turnSeconds),
  };
  log(state, `게임 시작! 보안관은 ${state.names[sheriff.id]}입니다.`);
  return state;
}
