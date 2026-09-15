import { isEquipment, isWeapon } from "./cards";
import {
  alivePlayers,
  countsAs,
  distance,
  hasEquip,
  player,
  responder,
  topPending,
  unlimitedBang,
  weaponRange,
} from "./core";
import { CARD_KO } from "./i18n";
import type { Action, GamePlayer, GameState } from "./types";

/**
 * 봇이 둘 수 있는 수 하나. `label`은 LLM에게 보여줄 한 줄 설명이다.
 *
 * 여기 담기는 수는 **전부 엔진이 받아주는 합법수**여야 한다. 그래야 LLM이
 * 번호만 고르면 되고, 거부당해 되돌릴 일이 없다.
 */
export interface Candidate {
  action: Action;
  label: string;
}

const ko = (p: GamePlayer, id: string) => CARD_KO[p.hand.find((c) => c.id === id)!.name].name;

/**
 * 지금 이 플레이어가 둘 만한 수를 모은다. 항상 1개 이상이고,
 * **0번이 무난한 기본값**이다 (LLM을 못 쓰면 이걸 둔다).
 *
 * 합법수 전체를 뽑지는 않는다 — 봇은 "적당히" 두면 되므로, 판을 굴리는 데
 * 필요한 수만 만든다. 후보가 1개면 호출부가 LLM을 건너뛴다.
 */
export function botCandidates(state: GameState, playerId: string): Candidate[] {
  const p = player(state, playerId);
  const top = topPending(state);

  if (top) {
    if (responder(state) !== playerId) return [];
    return pendingCandidates(state, p, top);
  }
  if (state.turn.playerId !== playerId) return [];

  switch (state.turn.phase) {
    case "draw":
      return [{ action: { type: "draw" }, label: "덱에서 2장 뽑는다" }];
    case "play":
      return playCandidates(state, p);
    case "discard": {
      const excess = p.hand.length - p.hp;
      const ids = p.hand.slice(0, excess).map((c) => c.id);
      return [{ action: { type: "discard", cardIds: ids }, label: `손패 ${excess}장 버린다` }];
    }
    default:
      return [];
  }
}

function pendingCandidates(state: GameState, p: GamePlayer, top: NonNullable<ReturnType<typeof topPending>>): Candidate[] {
  const take: Candidate = { action: { type: "respond", cardIds: [] }, label: "대응하지 않는다 (피해 1)" };

  switch (top.kind) {
    case "bang":
    case "gatling": {
      const misses = p.hand.filter((c) => countsAs(p, c, "missed"));
      const need = top.kind === "bang" ? top.missedNeeded : 1;
      if (misses.length < need) return [take];
      const ids = misses.slice(0, need).map((c) => c.id);
      return [{ action: { type: "respond", cardIds: ids }, label: `빗나감!으로 피한다 (${need}장)` }, take];
    }
    case "indians":
    case "duel": {
      const bangs = p.hand.filter((c) => countsAs(p, c, "bang"));
      if (bangs.length === 0) return [take];
      return [
        { action: { type: "respond", cardIds: [bangs[0].id] }, label: `${ko(p, bangs[0].id)}(으)로 받아친다` },
        take,
      ];
    }
    case "dying": {
      // 살 수 있으면 산다 — 고민할 여지가 없으므로 후보를 하나만 준다
      const need = 1 - p.hp;
      const beers = p.hand.filter((c) => c.name === "beer").slice(0, need);
      const canSave = alivePlayers(state).length > 2 && beers.length >= need;
      return [
        canSave
          ? { action: { type: "respond", cardIds: beers.map((c) => c.id) }, label: `맥주 ${need}장으로 버틴다` }
          : take,
      ];
    }
    case "generalStore":
      return shuffleTies(
        top.cards.map((c) => ({
          action: { type: "pickCards", cardIds: [c.id] } as Action,
          label: `${CARD_KO[c.name].name} 가져간다`,
        })),
        () => 0,
        seedOf(state, p.id),
      );
    case "kitCarlson": {
      const out: Candidate[] = [];
      for (let i = 0; i < top.cards.length; i++) {
        for (let j = i + 1; j < top.cards.length; j++) {
          const pair = [top.cards[i], top.cards[j]];
          out.push({
            action: { type: "pickCards", cardIds: pair.map((c) => c.id) },
            label: `${pair.map((c) => CARD_KO[c.name].name).join(", ")} 가져간다`,
          });
        }
      }
      return shuffleTies(out, () => 0, seedOf(state, p.id));
    }
  }
}

function playCandidates(state: GameState, p: GamePlayer): Candidate[] {
  const others = alivePlayers(state).filter((x) => x.id !== p.id);
  const nameOf = (x: GamePlayer) => state.names[x.id] ?? x.id;
  const out: Candidate[] = [];
  const add = (action: Action, label: string) => out.push({ action, label });

  const canBang = state.turn.bangsPlayed < 1 || unlimitedBang(p);
  const range = weaponRange(p);

  for (const card of p.hand) {
    const cardId = card.id;
    const label = CARD_KO[card.name].name;

    switch (card.name) {
      case "bang":
        if (!canBang) break;
        for (const t of others) {
          if (distance(state, p.id, t.id) <= range) add({ type: "play", cardId, targetId: t.id }, `${label} → ${nameOf(t)}`);
        }
        break;
      case "beer":
        // 생명이 넉넉할 때 마시면 정작 필요할 때 없다. 절반 이하일 때만 고려한다.
        if (alivePlayers(state).length > 2 && p.hp * 2 <= p.maxHp) add({ type: "play", cardId }, `${label} (생명 1 회복)`);
        break;
      case "panic":
        for (const t of others) {
          if (distance(state, p.id, t.id) <= 1 && t.hand.length > 0) {
            add({ type: "play", cardId, targetId: t.id }, `${label} → ${nameOf(t)}의 카드 1장 뺏기`);
          }
        }
        break;
      case "catBalou":
        for (const t of others) {
          if (t.hand.length > 0) add({ type: "play", cardId, targetId: t.id }, `${label} → ${nameOf(t)}의 카드 1장 버리게`);
        }
        break;
      case "duel":
        for (const t of others) add({ type: "play", cardId, targetId: t.id }, `${label} → ${nameOf(t)}`);
        break;
      case "jail":
        for (const t of others) {
          if (t.role !== "sheriff" && !hasEquip(t, "jail")) add({ type: "play", cardId, targetId: t.id }, `${label} → ${nameOf(t)}`);
        }
        break;
      case "saloon":
        if (alivePlayers(state).some((x) => x.hp < x.maxHp)) add({ type: "play", cardId }, `${label} (모두 회복)`);
        break;
      case "stagecoach":
      case "wellsFargo":
      case "generalStore":
      case "indians":
      case "gatling":
        add({ type: "play", cardId }, label);
        break;
      case "missed":
        break; // 캘러미티 재닛의 예외는 봇이 굳이 쓰지 않는다
      default:
        if (isEquipment(card.name) && !hasEquip(p, card.name)) add({ type: "play", cardId }, `${label} 장착`);
    }
  }

  add({ type: "endTurn" }, "턴을 끝낸다");
  return sortByPriority(out, p, seedOf(state, p.id));
}

/**
 * 상태에서 뽑아낸 시드. `Math.random`을 쓰지 않으므로 같은 판을 다시 돌리면
 * 같은 결과가 나오고, 턴이 진행되면(rngState·로그가 늘면) 값이 달라진다.
 */
function seedOf(state: GameState, playerId: string): number {
  let h = 2166136261 ^ state.rngState ^ (state.log.length << 8);
  for (let i = 0; i < playerId.length; i++) h = Math.imul(h ^ playerId.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * 점수가 같은 후보끼리 순서를 섞는다.
 *
 * 안 섞으면 정렬이 안정적이라 **항상 같은 좌석을 쏜다** — 봇 여럿이 판박이처럼
 * 움직인다. 점수가 다른 후보의 우선순위는 그대로 둔다.
 */
function shuffleTies<T>(items: T[], scoreOf: (x: T) => number, seed: number): T[] {
  let s = seed || 1;
  const rand = (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % n;
  };
  const out = [...items];
  let i = 0;
  while (i < out.length) {
    let j = i + 1;
    while (j < out.length && scoreOf(out[j]) === scoreOf(out[i])) j++;
    for (let k = j - 1; k > i; k--) {
      const t = i + rand(k - i + 1);
      [out[k], out[t]] = [out[t], out[k]];
    }
    i = j;
  }
  return out;
}

/**
 * 0번이 "LLM 없이 둬도 부끄럽지 않은 수"가 되도록 정렬한다.
 * 손패를 불리고 → 무장하고 → 급하면 회복하고 → 쏘고 → 끝낸다.
 * 점수가 같은 것끼리는 섞어서, 봇마다 매번 같은 수를 두지 않게 한다.
 */
function sortByPriority(cands: Candidate[], p: GamePlayer, seed: number): Candidate[] {
  const score = (c: Candidate): number => {
    const action = c.action;
    if (action.type !== "play") return 0; // endTurn은 맨 뒤
    const name = p.hand.find((x) => x.id === action.cardId)?.name;
    switch (name) {
      case "wellsFargo":
      case "stagecoach":
        return 100;
      case "beer":
        return p.hp <= 1 ? 95 : 45;
      case "gatling":
      case "indians":
        return 60;
      case "bang":
        return 50;
      case "panic":
      case "catBalou":
        return 40;
      case "duel":
        return 35;
      case "jail":
        return 30;
      case "generalStore":
        return 25;
      case "saloon":
        return 20;
      default:
        return name && isWeapon(name) ? 80 : 70; // 무기 > 나머지 장비
    }
  };
  const sorted = [...cands].sort((a, b) => score(b) - score(a));
  return shuffleTies(sorted, score, seed);
}
