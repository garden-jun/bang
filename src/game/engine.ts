import { isDynamiteExplode, isEquipment, isHeart, isRed, isWeapon } from "./cards";
import {
  afterHandChange,
  alivePlayers,
  cardName,
  countsAs,
  damage,
  die,
  discardFrom,
  distance,
  drawCards,
  drawCheck,
  drawToHand,
  hasBarrel,
  hasEquip,
  heal,
  log,
  name,
  nextAlive,
  othersClockwise,
  player,
  pushPending,
  removeCard,
  requireHandCard,
  responder,
  rng,
  timed,
  topPending,
  unlimitedBang,
  weaponRange,
} from "./core";
import { cardLabel } from "./i18n";
import type { Action, Card, DrawSource, GamePlayer, GameState, Pending } from "./types";
import { GameError } from "./types";

/**
 * 액션을 적용한 새 상태를 반환한다. 입력은 변경하지 않는다.
 * 규칙 위반은 GameError로 던진다.
 */
export function applyAction(input: GameState, playerId: string, action: Action, now: number): GameState {
  const state = structuredClone(input);
  if (state.winner) throw new GameError("게임이 이미 끝났습니다.");
  const p = player(state, playerId);
  if (!p.alive) throw new GameError("사망한 플레이어는 행동할 수 없습니다.");

  if (action.type === "ability") {
    handleAbility(state, p, action);
  } else {
    const top = topPending(state);
    if (top) {
      if (responder(state) !== playerId) throw new GameError("지금은 다른 플레이어의 응답을 기다리는 중입니다.");
      handlePendingResponse(state, p, top, action, now);
    } else {
      if (state.turn.playerId !== playerId) throw new GameError("당신의 턴이 아닙니다.");
      handleTurnAction(state, p, action, now);
    }
  }

  settle(state, now);
  return state;
}

/** 플레이어가 게임을 떠날 때: 사망 처리 (보상 없음) */
export function forfeit(input: GameState, playerId: string, now: number): GameState {
  const state = structuredClone(input);
  const p = player(state, playerId);
  if (!p.alive || state.winner) return state;
  log(state, `${name(state, playerId)} 님이 게임을 떠났습니다.`);
  die(state, playerId);
  settle(state, now);
  return state;
}

// ---------- 턴 액션 ----------

function handleTurnAction(state: GameState, p: GamePlayer, action: Action, now: number): void {
  const { phase } = state.turn;
  switch (action.type) {
    case "draw":
      if (phase !== "draw") throw new GameError("지금은 드로우 단계가 아닙니다.");
      doDraw(state, p, action.source, now);
      return;
    case "play":
      if (phase !== "play") throw new GameError("지금은 카드를 낼 수 없습니다.");
      playCard(state, p, action, now);
      return;
    case "endTurn":
      if (phase !== "play") throw new GameError("지금은 턴을 끝낼 수 없습니다.");
      if (p.hand.length > p.hp) {
        state.turn.phase = "discard";
        Object.assign(state.turn, timed(state, now, state.config.turnSeconds));
      } else {
        nextTurn(state, now);
      }
      return;
    case "discard": {
      if (phase !== "discard") throw new GameError("지금은 버리기 단계가 아닙니다.");
      const excess = p.hand.length - p.hp;
      if (action.cardIds.length !== excess) throw new GameError(`정확히 ${excess}장을 버려야 합니다.`);
      for (const id of new Set(action.cardIds)) discardFrom(state, p, requireHandCard(p, id).id);
      log(state, `${name(state, p.id)} 카드 ${excess}장 버림`);
      nextTurn(state, now);
      return;
    }
    default:
      throw new GameError("지금 할 수 없는 행동입니다.");
  }
}

function doDraw(state: GameState, p: GamePlayer, source: DrawSource | undefined, now: number): void {
  const n = name(state, p.id);
  switch (p.character) {
    case "blackJack": {
      const cards = drawToHand(state, p, 2);
      const second = cards[1];
      log(state, `${n} (블랙 잭) 2번째 카드 공개: ${cardLabel(second)}`);
      if (second && isRed(second)) {
        drawToHand(state, p, 1);
        log(state, `${n} 빨간 카드라 1장 추가로 뽑음`);
      }
      break;
    }
    case "kitCarlson": {
      const cards = drawCards(state, 3);
      pushPending(state, now, { kind: "kitCarlson", playerId: p.id, cards });
      return; // 선택 후 play 단계로
    }
    case "jesseJones": {
      if (source && typeof source === "object") {
        const t = player(state, source.playerId);
        if (!t.alive || t.id === p.id || t.hand.length === 0) throw new GameError("손패가 있는 다른 플레이어를 골라야 합니다.");
        const c = t.hand.splice(rng(state).int(t.hand.length), 1)[0];
        p.hand.push(c);
        afterHandChange(state, t);
        drawToHand(state, p, 1);
        log(state, `${n} (제시 존스) ${name(state, t.id)}의 손패에서 1장 + 덱에서 1장`);
      } else {
        drawToHand(state, p, 2);
        log(state, `${n} 카드 2장 뽑음`);
      }
      break;
    }
    case "pedroRamirez": {
      if (source === "discard") {
        const c = state.discard.pop();
        if (!c) throw new GameError("버림 더미가 비어 있습니다.");
        p.hand.push(c);
        drawToHand(state, p, 1);
        log(state, `${n} (페드로 라미레즈) 버림 더미에서 ${cardLabel(c)} + 덱에서 1장`);
      } else {
        drawToHand(state, p, 2);
        log(state, `${n} 카드 2장 뽑음`);
      }
      break;
    }
    default:
      drawToHand(state, p, 2);
      log(state, `${n} 카드 2장 뽑음`);
  }
  state.turn.phase = "play";
}

function playCard(
  state: GameState,
  p: GamePlayer,
  action: { cardId: string; targetId?: string; targetCardId?: string },
  now: number,
): void {
  const card = requireHandCard(p, action.cardId);
  let kind = card.name;
  if (kind === "missed") {
    if (p.character !== "calamityJanet") throw new GameError("빗나감!은 뱅!에 대응할 때만 쓸 수 있습니다.");
    kind = "bang";
  }
  const n = name(state, p.id);
  const target = action.targetId ? player(state, action.targetId) : undefined;
  const requireTarget = (): GamePlayer => {
    if (!target || !target.alive) throw new GameError("대상을 선택하세요.");
    if (target.id === p.id) throw new GameError("자신을 대상으로 할 수 없습니다.");
    return target;
  };
  const spendCard = () => discardFrom(state, p, card.id);

  switch (kind) {
    case "bang": {
      const t = requireTarget();
      if (state.turn.bangsPlayed >= 1 && !unlimitedBang(p)) throw new GameError("이번 턴에 이미 뱅!을 사용했습니다.");
      const d = distance(state, p.id, t.id);
      if (d > weaponRange(p)) throw new GameError(`사거리 밖입니다. (거리 ${d}, 사거리 ${weaponRange(p)})`);
      spendCard();
      state.turn.bangsPlayed += 1;
      log(state, `${n} → ${name(state, t.id)} 뱅!`);
      startBang(state, now, p, t);
      break;
    }
    case "beer": {
      if (alivePlayers(state).length <= 2) throw new GameError("2명만 남으면 맥주를 쓸 수 없습니다.");
      if (p.hp >= p.maxHp) throw new GameError("생명이 이미 가득합니다.");
      spendCard();
      heal(state, p, 1);
      log(state, `${n} 맥주로 생명 1 회복`);
      break;
    }
    case "panic": {
      const t = requireTarget();
      if (distance(state, p.id, t.id) > 1) throw new GameError("패닉!은 거리 1인 대상에게만 쓸 수 있습니다.");
      spendCard();
      takeCard(state, p, t, action.targetCardId, "steal");
      break;
    }
    case "catBalou": {
      const t = requireTarget();
      spendCard();
      takeCard(state, p, t, action.targetCardId, "discard");
      break;
    }
    case "stagecoach":
      spendCard();
      drawToHand(state, p, 2);
      log(state, `${n} 역마차로 2장 뽑음`);
      break;
    case "wellsFargo":
      spendCard();
      drawToHand(state, p, 3);
      log(state, `${n} 웰스 파고로 3장 뽑음`);
      break;
    case "generalStore": {
      spendCard();
      const order = [p.id, ...othersClockwise(state, p.id).map((x) => x.id)];
      const cards = drawCards(state, order.length);
      log(state, `${n} 잡화점: ${cards.map(cardLabel).join(", ")}`);
      pushPending(state, now, { kind: "generalStore", cards, order });
      break;
    }
    case "indians": {
      spendCard();
      log(state, `${n} 인디언! — 모두 뱅!을 내거나 피해 1`);
      pushPending(state, now, { kind: "indians", from: p.id, targets: othersClockwise(state, p.id).map((x) => x.id) });
      break;
    }
    case "gatling": {
      spendCard();
      log(state, `${n} 개틀링! — 모두에게 뱅!`);
      pushPending(state, now, { kind: "gatling", from: p.id, targets: othersClockwise(state, p.id).map((x) => x.id) });
      break;
    }
    case "duel": {
      const t = requireTarget();
      spendCard();
      log(state, `${n} → ${name(state, t.id)} 결투!`);
      pushPending(state, now, { kind: "duel", from: p.id, to: t.id, current: t.id });
      break;
    }
    case "saloon":
      spendCard();
      for (const x of alivePlayers(state)) heal(state, x, 1);
      log(state, `${n} 술집 — 모두 생명 1 회복`);
      break;
    case "jail": {
      const t = requireTarget();
      if (t.role === "sheriff") throw new GameError("보안관은 감옥에 가둘 수 없습니다.");
      if (hasEquip(t, "jail")) throw new GameError("이미 감옥에 있습니다.");
      t.equipment.push(removeCard(p, card.id));
      log(state, `${n} → ${name(state, t.id)} 감옥에 가둠`);
      break;
    }
    default: {
      if (!isEquipment(kind)) throw new GameError("알 수 없는 카드입니다.");
      if (hasEquip(p, kind)) throw new GameError(`${cardName(card)}은(는) 이미 장착 중입니다.`);
      if (isWeapon(kind)) {
        const old = p.equipment.find((c) => isWeapon(c.name));
        if (old) discardFrom(state, p, old.id);
      }
      p.equipment.push(removeCard(p, card.id));
      log(state, `${n} ${cardName(card)} 장착`);
    }
  }
  afterHandChange(state, p);
}

/** 패닉!/캣 발루: targetCardId가 장착 카드 id면 그것, 'hand' 또는 생략이면 손패에서 무작위 */
function takeCard(state: GameState, from: GamePlayer, to: GamePlayer, targetCardId: string | undefined, mode: "steal" | "discard"): void {
  let card: Card;
  if (targetCardId && targetCardId !== "hand") {
    const eq = to.equipment.find((c) => c.id === targetCardId);
    if (!eq) throw new GameError("대상의 장착 카드가 아닙니다.");
    card = removeCard(to, eq.id);
  } else {
    if (to.hand.length === 0) throw new GameError("대상의 손패가 없습니다.");
    card = to.hand.splice(rng(state).int(to.hand.length), 1)[0];
  }
  if (mode === "steal") {
    from.hand.push(card);
    log(state, `${name(state, from.id)} 패닉! → ${name(state, to.id)}의 카드 1장 가져옴`);
  } else {
    state.discard.push(card);
    log(state, `${name(state, from.id)} 캣 발루 → ${name(state, to.id)}의 ${cardName(card)} 버림`);
  }
  afterHandChange(state, to);
}

function startBang(state: GameState, now: number, from: GamePlayer, to: GamePlayer): void {
  pushPending(state, now, {
    kind: "bang",
    from: from.id,
    to: to.id,
    missedNeeded: from.character === "slabTheKiller" ? 2 : 1,
  });
  const pd = topPending(state) as Extract<Pending, { kind: "bang" }>;
  for (let i = 0; i < hasBarrel(to) && pd.missedNeeded > 0; i++) {
    if (drawCheck(state, to, "술통", isHeart)) pd.missedNeeded -= 1;
  }
  if (pd.missedNeeded <= 0) {
    state.pending.pop();
    log(state, `${name(state, to.id)} 술통으로 뱅! 회피`);
  }
}

// ---------- 응답 ----------

function handlePendingResponse(state: GameState, p: GamePlayer, top: Pending, action: Action, now: number): void {
  const n = name(state, p.id);
  switch (top.kind) {
    case "bang": {
      const ids = expectRespond(action);
      if (ids.length === 0) {
        state.pending.pop();
        damage(state, now, p.id, 1, top.from);
        return;
      }
      const cards = ids.map((id) => requireHandCard(p, id));
      if (!cards.every((c) => countsAs(p, c, "missed"))) throw new GameError("빗나감!만 사용할 수 있습니다.");
      if (cards.length !== top.missedNeeded) throw new GameError(`빗나감! ${top.missedNeeded}장이 필요합니다.`);
      for (const c of cards) discardFrom(state, p, c.id);
      state.pending.pop();
      log(state, `${n} 빗나감!`);
      afterHandChange(state, p);
      return;
    }
    case "gatling":
    case "indians": {
      const ids = expectRespond(action);
      const need = top.kind === "gatling" ? "missed" : "bang";
      top.targets.shift();
      if (ids.length === 0) {
        damage(state, now, p.id, 1, top.from);
        return;
      }
      if (ids.length !== 1) throw new GameError("카드 1장만 낼 수 있습니다.");
      const c = requireHandCard(p, ids[0]);
      if (!countsAs(p, c, need)) throw new GameError(need === "missed" ? "빗나감!만 사용할 수 있습니다." : "뱅!만 사용할 수 있습니다.");
      discardFrom(state, p, c.id);
      log(state, `${n} ${cardName(c)}(으)로 대응`);
      afterHandChange(state, p);
      return;
    }
    case "duel": {
      const ids = expectRespond(action);
      const other = top.current === top.from ? top.to : top.from;
      if (ids.length === 0) {
        state.pending.pop();
        log(state, `${n} 결투에서 패배`);
        damage(state, now, p.id, 1, other);
        return;
      }
      if (ids.length !== 1) throw new GameError("카드 1장만 낼 수 있습니다.");
      const c = requireHandCard(p, ids[0]);
      if (!countsAs(p, c, "bang")) throw new GameError("뱅!만 사용할 수 있습니다.");
      discardFrom(state, p, c.id);
      log(state, `${n} 결투: 뱅!`);
      top.current = other;
      afterHandChange(state, p);
      return;
    }
    case "generalStore": {
      if (action.type !== "pickCards" || action.cardIds.length !== 1) throw new GameError("카드 1장을 고르세요.");
      const i = top.cards.findIndex((c) => c.id === action.cardIds[0]);
      if (i < 0) throw new GameError("고를 수 없는 카드입니다.");
      const c = top.cards.splice(i, 1)[0];
      p.hand.push(c);
      top.order.shift();
      log(state, `${n} 잡화점에서 ${cardLabel(c)} 선택`);
      return;
    }
    case "kitCarlson": {
      if (action.type !== "pickCards" || new Set(action.cardIds).size !== 2) throw new GameError("카드 2장을 고르세요.");
      const picked = action.cardIds.map((id) => {
        const c = top.cards.find((x) => x.id === id);
        if (!c) throw new GameError("고를 수 없는 카드입니다.");
        return c;
      });
      const rest = top.cards.filter((c) => !picked.includes(c));
      p.hand.push(...picked);
      state.deck.push(...rest);
      state.pending.pop();
      state.turn.phase = "play";
      log(state, `${n} (킷 칼슨) 3장 중 2장 선택`);
      return;
    }
    case "dying": {
      const ids = expectRespond(action);
      if (ids.length > 0) {
        if (alivePlayers(state).length <= 2) throw new GameError("2명만 남으면 맥주를 쓸 수 없습니다.");
        const cards = ids.map((id) => requireHandCard(p, id));
        if (!cards.every((c) => c.name === "beer")) throw new GameError("맥주만 사용할 수 있습니다.");
        for (const c of cards) discardFrom(state, p, c.id);
        p.hp += cards.length;
        log(state, `${n} 맥주 ${cards.length}장으로 생명 ${p.hp}`);
      }
      if (p.hp >= 1) {
        state.pending.pop();
        afterHandChange(state, p);
      } else {
        die(state, p.id, top.sourceId);
      }
      return;
    }
  }
}

function expectRespond(action: Action): string[] {
  if (action.type !== "respond") throw new GameError("응답이 필요한 상황입니다.");
  return Array.from(new Set(action.cardIds));
}

// ---------- 능력 ----------

function handleAbility(state: GameState, p: GamePlayer, action: Extract<Action, { type: "ability" }>): void {
  if (action.name !== "sidKetchum" || p.character !== "sidKetchum") throw new GameError("사용할 수 없는 능력입니다.");
  const top = topPending(state);
  const dyingForMe = top?.kind === "dying" && top.playerId === p.id;
  if (top && !dyingForMe) throw new GameError("지금은 능력을 쓸 수 없습니다.");
  if (p.hp >= p.maxHp) throw new GameError("생명이 이미 가득합니다.");
  const ids = Array.from(new Set(action.cardIds));
  if (ids.length !== 2) throw new GameError("카드 2장을 버려야 합니다.");
  for (const id of ids) discardFrom(state, p, requireHandCard(p, id).id);
  p.hp += 1;
  log(state, `${name(state, p.id)} (시드 케첨) 카드 2장 버리고 생명 1 회복`);
  if (dyingForMe && p.hp >= 1) state.pending.pop();
  afterHandChange(state, p);
}

// ---------- 진행 ----------

export function nextTurn(state: GameState, now: number): void {
  const next = nextAlive(state, state.turn.playerId);
  state.turn = {
    playerId: next.id,
    phase: "start",
    bangsPlayed: 0,
    ...timed(state, now, state.config.turnSeconds),
  };
  log(state, `— ${name(state, next.id)}의 턴 —`);
}

/**
 * 자동으로 진행되는 부분을 처리한다: 대기 스택 정리, 사망자 턴 넘기기, 턴 시작 판정.
 * 플레이어 입력이 필요해지거나 게임이 끝나면 멈춘다.
 */
export function settle(state: GameState, now: number): void {
  for (let guard = 0; guard < 50; guard++) {
    if (state.winner) return;

    const top = topPending(state);
    if (top) {
      if (top.kind === "gatling" || top.kind === "indians") {
        if (top.targets.length === 0) { state.pending.pop(); continue; }
        if (top.kind === "gatling" && advanceGatling(state, top)) continue;
      }
      if (top.kind === "generalStore") {
        if (top.order.length === 1 && top.cards.length >= 1) {
          const last = player(state, top.order[0]);
          const c = top.cards.shift()!;
          last.hand.push(c);
          log(state, `${name(state, last.id)} 잡화점에서 ${cardLabel(c)} (마지막)`);
          top.order = [];
        }
        if (top.order.length === 0) {
          state.discard.push(...top.cards); // 선택자가 모두 죽은 경우 남은 카드
          state.pending.pop();
          continue;
        }
      }
      return;
    }

    const cur = player(state, state.turn.playerId);
    if (!cur.alive) { nextTurn(state, now); continue; }

    switch (state.turn.phase) {
      case "start":
        processDynamite(state, cur, now);
        continue;
      case "jail":
        processJail(state, cur, now);
        continue;
      case "discard":
        if (cur.hand.length <= cur.hp) { nextTurn(state, now); continue; }
        return;
      default:
        return;
    }
  }
}

/** 개틀링 맨 앞 대상의 술통 판정. 회피해서 대상이 바뀌면 true */
function advanceGatling(state: GameState, top: Extract<Pending, { kind: "gatling" }>): boolean {
  const tid = top.targets[0];
  if (top.barrelCheckedFor === tid) return false;
  top.barrelCheckedFor = tid;
  const t = player(state, tid);
  for (let i = 0; i < hasBarrel(t); i++) {
    if (drawCheck(state, t, "술통", isHeart)) {
      top.targets.shift();
      log(state, `${name(state, tid)} 술통으로 개틀링 회피`);
      return true;
    }
  }
  return false;
}

function processDynamite(state: GameState, cur: GamePlayer, now: number): void {
  state.turn.phase = "jail";
  const dyn = cur.equipment.find((c) => c.name === "dynamite");
  if (!dyn) return;
  if (drawCheck(state, cur, "다이너마이트", isDynamiteExplode)) {
    discardFrom(state, cur, dyn.id);
    log(state, `💥 ${name(state, cur.id)} 다이너마이트 폭발!`);
    damage(state, now, cur.id, 3);
  } else {
    removeCard(cur, dyn.id);
    const next = nextAlive(state, cur.id);
    next.equipment.push(dyn);
    log(state, `다이너마이트가 ${name(state, next.id)}에게 넘어감`);
  }
}

function processJail(state: GameState, cur: GamePlayer, now: number): void {
  const jail = cur.equipment.find((c) => c.name === "jail");
  if (jail) {
    discardFrom(state, cur, jail.id);
    if (!drawCheck(state, cur, "감옥", isHeart)) {
      log(state, `${name(state, cur.id)} 감옥에서 못 나와 턴을 건너뜀`);
      nextTurn(state, now);
      return;
    }
    log(state, `${name(state, cur.id)} 감옥 탈출`);
  }
  state.turn.phase = "draw";
  Object.assign(state.turn, timed(state, now, state.config.turnSeconds));
}
