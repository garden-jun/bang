import { expect, test } from "vitest";
import { botCandidates } from "../bot";
import { responder, topPending } from "../core";
import { applyAction, settle } from "../engine";
import { createGame } from "../setup";
import type { GameState } from "../types";

/**
 * 봇 후보의 계약은 하나다: **엔진이 전부 받아준다.**
 * 이게 깨지면 봇이 자기 턴에 멈춘다. 봇끼리 판을 끝까지 돌려서 확인한다.
 */

function newGame(seed: string, players = 7): GameState {
  return createGame(
    Array.from({ length: players }, (_, i) => ({ id: `p${i}`, nickname: `봇${i}` })),
    seed,
    1_700_000_000_000,
    { turnSeconds: 60 },
  );
}

/** 시드 고정 난수 — 후보 중 아무거나 고르되 재현 가능하게 */
function pick(seed: number) {
  let s = seed;
  return (n: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % n;
  };
}

function playOut(state: GameState, seed: number): { state: GameState; steps: number } {
  const rand = pick(seed);
  const now = 1_700_000_000_000;
  let steps = 0;

  while (!state.winner && steps < 3000) {
    const who = responder(state);
    const cands = botCandidates(state, who);

    if (cands.length === 0) {
      // start/jail 단계는 둘 수가 없다 — 엔진이 알아서 넘긴다
      const phase = state.turn.phase;
      expect(topPending(state)).toBeUndefined();
      expect(["start", "jail"]).toContain(phase);
      const next = structuredClone(state);
      settle(next, now);
      expect(next.turn.phase !== phase || next.winner).toBeTruthy();
      state = next;
      continue;
    }

    const chosen = cands[rand(cands.length)];
    // 여기서 던지면 후보가 불법이라는 뜻 — 이 테스트의 존재 이유다
    state = applyAction(state, who, chosen.action, now);
    steps++;
  }
  return { state, steps };
}

test("봇끼리 둬도 엔진이 모든 후보를 받아준다 (7인 × 40판)", () => {
  for (let seed = 0; seed < 40; seed++) {
    const { state, steps } = playOut(newGame(`seed-${seed}`), seed + 1);
    expect(steps, `seed ${seed}에서 진행이 멈췄다`).toBeGreaterThan(20);
    expect(state.winner, `seed ${seed}에서 승자가 안 나왔다`).toBeTruthy();
  }
});

test("4인에서도 끝까지 간다", () => {
  for (let seed = 0; seed < 20; seed++) {
    const { state } = playOut(newGame(`small-${seed}`, 4), seed + 100);
    expect(state.winner).toBeTruthy();
  }
});

test("행동해야 하는 사람에게는 항상 후보가 있다", () => {
  const state = newGame("candidates");
  settle(state, 1_700_000_000_000);
  const who = responder(state);
  expect(botCandidates(state, who).length).toBeGreaterThan(0);
  // 차례가 아닌 사람에게는 없다
  const other = state.players.find((p) => p.id !== who)!;
  expect(botCandidates(state, other.id)).toEqual([]);
});

test("후보 0번은 턴을 끝내는 수가 아니다 (손에 쓸 게 있으면)", () => {
  // play 단계에서 쓸 카드가 있으면 그냥 넘기지 않는다
  const state = newGame("priority");
  settle(state, 1_700_000_000_000);
  let s = state;
  // draw 단계를 넘겨 play 단계로
  s = applyAction(s, responder(s), { type: "draw" }, 1_700_000_000_000);
  const cands = botCandidates(s, responder(s));
  if (cands.length > 1) expect(cands[0].action.type).not.toBe("endTurn");
});

test("같은 점수의 후보는 늘 같은 순서가 아니다", () => {
  // 같은 상황이 반복될 때 항상 같은 좌석을 쏘면 봇 여럿이 판박이가 된다.
  // 판이 진행되면(rngState·로그가 바뀌면) 동점 후보의 순서가 달라져야 한다.
  const firsts = new Set<string>();
  for (let seed = 0; seed < 60; seed++) {
    let s = newGame(`tie-${seed}`);
    settle(s, 1_700_000_000_000);
    s = applyAction(s, responder(s), { type: "draw" }, 1_700_000_000_000);
    const cands = botCandidates(s, responder(s));
    const bangs = cands.filter((c) => c.label.startsWith("뱅!"));
    if (bangs.length > 1) firsts.add(bangs[0].label);
  }
  expect(firsts.size, "뱅! 대상이 늘 고정되어 있다").toBeGreaterThan(1);
});

test("생명이 넉넉하면 맥주를 후보에 넣지 않는다", () => {
  let s = newGame("beer");
  settle(s, 1_700_000_000_000);
  s = applyAction(s, responder(s), { type: "draw" }, 1_700_000_000_000);

  const me = s.players.find((p) => p.id === responder(s))!;
  me.hand = [{ id: "beer1", name: "beer", suit: "H", rank: 5 }];

  me.hp = me.maxHp;
  expect(botCandidates(s, me.id).some((c) => c.label.startsWith("맥주"))).toBe(false);

  me.hp = me.maxHp - 1; // 절반보다 위 — 아직 아낀다
  expect(botCandidates(s, me.id).some((c) => c.label.startsWith("맥주"))).toBe(false);

  me.hp = 1; // 급하면 마신다
  const cands = botCandidates(s, me.id);
  expect(cands[0].label.startsWith("맥주")).toBe(true);
});
