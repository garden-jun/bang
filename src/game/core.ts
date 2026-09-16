import { WEAPON_RANGE, isWeapon } from "./cards";
import { CARD_KO, cardLabel } from "./i18n";
import { makeRng, type Rng } from "./rng";
import type { Card, CardMove, CardName, CheckKind, GamePlayer, GameState, LogMeta, Pending, Timed, Winner } from "./types";
import { GameError } from "./types";

// ---------- 조회 ----------

export function rng(state: GameState): Rng {
  return makeRng(state.seed, state);
}

export function player(state: GameState, id: string): GamePlayer {
  const p = state.players.find((p) => p.id === id);
  if (!p) throw new GameError("존재하지 않는 플레이어입니다.");
  return p;
}

export function name(state: GameState, id: string): string {
  return state.names[id] ?? id;
}

export function alivePlayers(state: GameState): GamePlayer[] {
  return state.players.filter((p) => p.alive);
}

/** fromId 다음(시계방향) 생존자부터 시작해 fromId 직전까지 순서대로 */
export function othersClockwise(state: GameState, fromId: string): GamePlayer[] {
  const n = state.players.length;
  const start = state.players.findIndex((p) => p.id === fromId);
  const out: GamePlayer[] = [];
  for (let i = 1; i < n; i++) {
    const p = state.players[(start + i) % n];
    if (p.alive) out.push(p);
  }
  return out;
}

export function nextAlive(state: GameState, fromId: string): GamePlayer {
  const others = othersClockwise(state, fromId);
  if (others.length === 0) return player(state, fromId);
  return others[0];
}

export function hasEquip(p: GamePlayer, cardName: CardName): boolean {
  return p.equipment.some((c) => c.name === cardName);
}

export function weaponRange(p: GamePlayer): number {
  const w = p.equipment.find((c) => isWeapon(c.name));
  return w && isWeapon(w.name) ? WEAPON_RANGE[w.name] : 1;
}

export function hasBarrel(p: GamePlayer): number {
  return (hasEquip(p, "barrel") ? 1 : 0) + (p.character === "jourdonnais" ? 1 : 0);
}

export function unlimitedBang(p: GamePlayer): boolean {
  return p.character === "willyTheKid" || hasEquip(p, "volcanic");
}

/** from이 to를 볼 때의 거리 (생존자 좌석 기준 + 보정) */
export function distance(state: GameState, fromId: string, toId: string): number {
  const alive = alivePlayers(state);
  const a = alive.findIndex((p) => p.id === fromId);
  const b = alive.findIndex((p) => p.id === toId);
  if (a < 0 || b < 0) return Infinity;
  const diff = Math.abs(a - b);
  let d = Math.min(diff, alive.length - diff);
  const from = player(state, fromId);
  const to = player(state, toId);
  if (hasEquip(to, "mustang") || to.character === "paulRegret") d += 1;
  if (hasEquip(from, "scope") || from.character === "roseDoolan") d -= 1;
  return Math.max(1, d);
}

export function findCard(cards: Card[], id: string): Card | undefined {
  return cards.find((c) => c.id === id);
}

export function requireHandCard(p: GamePlayer, id: string): Card {
  const c = findCard(p.hand, id);
  if (!c) throw new GameError("손에 없는 카드입니다.");
  return c;
}

/** 캘러미티 재닛은 뱅!/빗나감!을 서로 대신 사용 */
export function countsAs(p: GamePlayer, c: Card, as: "bang" | "missed"): boolean {
  if (c.name === as) return true;
  return p.character === "calamityJanet" && (c.name === "bang" || c.name === "missed");
}

// ---------- 로그 ----------

export function log(state: GameState, msg: string, meta?: LogMeta, moves?: CardMove[]): void {
  // 길이로 번호를 매기면 아래에서 앞을 잘라낸 뒤로 번호가 80에 멈춘다 —
  // 화면은 "이 번호보다 큰 줄"을 새 사건으로 보므로 연출이 통째로 끊긴다.
  const t = (state.log.at(-1)?.t ?? -1) + 1;
  state.log.push({ t, msg, ...(meta && { meta }), ...(moves && moves.length > 0 && { moves }) });
  // 뷰는 최근 60줄만 쓴다. 방 전체가 매 폴링마다 오가므로 상한이 곧 대역폭이다.
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

// ---------- 카드 이동 (연출용) ----------

/** 덱에서 n장 — 무엇을 뽑았는지는 본인만 안다 */
export const fromDeck = (toId: string, n: number): CardMove[] =>
  Array.from({ length: n }, () => ({ from: "deck", to: `hand:${toId}` }));

/** 손패에서 낸 카드 — 버림 더미에 앞면으로 놓이니 모두가 본다 */
export const toDiscard = (fromId: string, cards: Card[]): CardMove[] =>
  cards.map((card) => ({ from: `hand:${fromId}`, to: "discard", card }));

/** 손패에서 손패로 무작위로 넘어간 카드 — 뒷면으로만 */
export const handToHand = (fromId: string, toId: string, n: number): CardMove[] =>
  Array.from({ length: n }, () => ({ from: `hand:${fromId}`, to: `hand:${toId}` }));

// ---------- 덱 ----------

export function drawCards(state: GameState, n: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) break;
      const top = state.discard.pop()!; // 버림 더미 맨 위는 남겨둔다
      state.deck = rng(state).shuffle(state.discard);
      state.discard = [top];
      log(state, "덱을 다시 섞었습니다.");
    }
    out.push(state.deck.pop()!);
  }
  return out;
}

export function giveCards(state: GameState, p: GamePlayer, cards: Card[]): void {
  p.hand.push(...cards);
}

export function drawToHand(state: GameState, p: GamePlayer, n: number): Card[] {
  const cards = drawCards(state, n);
  giveCards(state, p, cards);
  return cards;
}

/** 손패/장착에서 카드를 빼 버림 더미로 */
export function discardFrom(state: GameState, p: GamePlayer, cardId: string): Card {
  const c = removeCard(p, cardId);
  state.discard.push(c);
  return c;
}

export function removeCard(p: GamePlayer, cardId: string): Card {
  let i = p.hand.findIndex((c) => c.id === cardId);
  if (i >= 0) return p.hand.splice(i, 1)[0];
  i = p.equipment.findIndex((c) => c.id === cardId);
  if (i >= 0) return p.equipment.splice(i, 1)[0];
  throw new GameError("해당 카드를 찾을 수 없습니다.");
}

/** 손패 변동 후: 수지 라파예트 */
export function afterHandChange(state: GameState, p: GamePlayer): void {
  if (p.alive && p.character === "suzyLafayette" && p.hand.length === 0) {
    const cards = drawToHand(state, p, 1);
    log(state, `${name(state, p.id)} (수지 라파예트) 손패가 비어 1장 뽑습니다.`, undefined, fromDeck(p.id, cards.length));
  }
}

/** "뽑기 판정": 덱 맨 위를 공개해 버리고 조건 확인. 럭키 듀크는 2장 중 유리한 쪽. */
const CHECK_LABEL: Record<CheckKind, string> = { jail: "감옥", dynamite: "다이너마이트", barrel: "술통" };

export function drawCheck(
  state: GameState,
  p: GamePlayer,
  check: CheckKind,
  pred: (c: Card) => boolean,
): boolean {
  const n = p.character === "luckyDuke" ? 2 : 1;
  const cards = drawCards(state, n);
  state.discard.push(...cards);
  const ok = cards.some(pred);
  log(
    state,
    `${name(state, p.id)} ${CHECK_LABEL[check]} 판정: ${cards.map(cardLabel).join(", ")} → ${ok ? "성공" : "실패"}`,
    { kind: "check", from: p.id, check, cards, ok },
  );
  return ok;
}

// ---------- 시간 ----------

export function timed(state: GameState, now: number, seconds: number): Timed {
  return { startedAt: now, deadline: now + seconds * 1000 };
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export function pushPending(state: GameState, now: number, p: DistributiveOmit<Pending, keyof Timed>): void {
  state.pending.push({ ...p, ...timed(state, now, state.config.reactionSeconds) } as Pending);
}

export function topPending(state: GameState): Pending | undefined {
  return state.pending[state.pending.length - 1];
}

/** 현재 응답해야 하는 플레이어 (pending 우선, 없으면 턴 플레이어) */
export function responder(state: GameState): string {
  const p = topPending(state);
  if (!p) return state.turn.playerId;
  switch (p.kind) {
    case "bang": return p.to;
    case "indians":
    case "gatling": return p.targets[0];
    case "duel": return p.current;
    case "generalStore": return p.order[0];
    case "kitCarlson":
    case "dying": return p.playerId;
  }
}

// ---------- 피해 / 사망 / 승리 ----------

export function heal(state: GameState, p: GamePlayer, n: number): void {
  p.hp = Math.min(p.maxHp, p.hp + n);
}

/**
 * 피해 적용. hp가 0 이하가 되면 맥주로 살 수 있을 때만 dying 대기, 아니면 즉시 사망.
 */
export function damage(state: GameState, now: number, targetId: string, n: number, sourceId?: string): void {
  const t = player(state, targetId);
  if (!t.alive) return;
  t.hp -= n;
  log(state, `${name(state, targetId)} 피해 ${n} (남은 생명 ${Math.max(0, t.hp)})`);

  if (t.hp > 0) {
    if (t.character === "bartCassidy") {
      const cards = drawToHand(state, t, n);
      log(state, `${name(state, targetId)} (바트 캐시디) 카드 ${n}장 뽑음`, undefined, fromDeck(t.id, cards.length));
    }
    if (t.character === "elGringo" && sourceId && sourceId !== targetId) {
      const s = player(state, sourceId);
      let taken = 0;
      for (; taken < n && s.hand.length > 0; taken++) {
        const c = s.hand.splice(rng(state).int(s.hand.length), 1)[0];
        t.hand.push(c);
      }
      // 가져온 장면 뒤에 수지 라파예트가 뽑아야 순서가 맞는다
      log(state, `${name(state, targetId)} (엘 그링고) ${name(state, sourceId)}의 손패에서 카드를 가져옴`, undefined, handToHand(s.id, t.id, taken));
      afterHandChange(state, s);
    }
    return;
  }

  const beers = t.hand.filter((c) => c.name === "beer").length;
  const canBeer = alivePlayers(state).length > 2;
  const canSid = t.character === "sidKetchum" && t.hand.length >= 2;
  // 살아날 가능성이 조금이라도 있으면 선택권을 준다. 부족하면 응답 시 사망 처리.
  if ((canBeer && beers > 0) || canSid) {
    pushPending(state, now, { kind: "dying", playerId: targetId, sourceId });
    return;
  }
  die(state, targetId, sourceId);
}

export function die(state: GameState, targetId: string, sourceId?: string): void {
  const t = player(state, targetId);
  t.alive = false;
  t.hp = 0;
  t.roleRevealed = true;

  // 카드 처리: 벌처 샘이 살아 있으면 전부 가져감
  const vulture = alivePlayers(state).find((p) => p.character === "vultureSam");
  const cards = [...t.hand, ...t.equipment];
  // 손패는 가져가는 사람에게도 뒷면이다. 버려지면 더미에 앞면으로 놓인다
  const moves: CardMove[] = [
    ...t.hand.map((c): CardMove => ({ from: `hand:${t.id}`, to: vulture ? `hand:${vulture.id}` : "discard", ...(!vulture && { card: c }) })),
    ...t.equipment.map((c): CardMove => ({ from: `equip:${t.id}`, to: vulture ? `hand:${vulture.id}` : "discard", card: c })),
  ];
  t.hand = [];
  t.equipment = [];
  log(state, `☠ ${name(state, targetId)} 사망 — 역할은 ${roleKo(t)}였습니다.`, undefined, vulture ? undefined : moves);
  if (vulture) {
    vulture.hand.push(...cards);
    log(state, `${name(state, vulture.id)} (벌처 샘) 카드 ${cards.length}장 획득`, undefined, moves);
  } else {
    state.discard.push(...cards);
  }

  // 보상 / 벌칙
  if (sourceId && sourceId !== targetId) {
    const s = player(state, sourceId);
    if (t.role === "outlaw" && s.alive) {
      const drawn = drawToHand(state, s, 3);
      log(state, `${name(state, sourceId)} 무법자 처치 보상으로 3장 뽑음`, undefined, fromDeck(s.id, drawn.length));
    }
    if (t.role === "deputy" && s.role === "sheriff") {
      const lost: CardMove[] = [
        ...toDiscard(s.id, s.hand),
        ...s.equipment.map((c): CardMove => ({ from: `equip:${s.id}`, to: "discard", card: c })),
      ];
      state.discard.push(...s.hand, ...s.equipment);
      s.hand = [];
      s.equipment = [];
      log(state, `${name(state, sourceId)} 보안관이 부관을 죽여 카드를 모두 버림`, undefined, lost);
      afterHandChange(state, s);
    }
  }

  // 죽은 사람이 관련된 pending 정리
  state.pending = state.pending.filter((pd) => !pendingInvolves(pd, targetId));
  for (const pd of state.pending) {
    if (pd.kind === "indians" || pd.kind === "gatling") pd.targets = pd.targets.filter((id) => id !== targetId);
    if (pd.kind === "generalStore") pd.order = pd.order.filter((id) => id !== targetId);
  }

  checkWinner(state);
}

function pendingInvolves(pd: Pending, id: string): boolean {
  switch (pd.kind) {
    case "bang": return pd.to === id || pd.from === id;
    case "duel": return pd.to === id || pd.from === id;
    case "kitCarlson":
    case "dying": return pd.playerId === id;
    default: return false;
  }
}

function roleKo(p: GamePlayer): string {
  return { sheriff: "보안관", deputy: "부관", outlaw: "무법자", renegade: "배신자" }[p.role];
}

export function checkWinner(state: GameState): Winner | undefined {
  if (state.winner) return state.winner;
  const alive = alivePlayers(state);
  const sheriffAlive = alive.some((p) => p.role === "sheriff");
  const outlaws = alive.filter((p) => p.role === "outlaw").length;
  const renegades = alive.filter((p) => p.role === "renegade").length;

  let w: Winner | undefined;
  if (!sheriffAlive) {
    w = alive.length === 1 && renegades === 1 ? "renegade" : "outlaws";
  } else if (outlaws === 0 && renegades === 0) {
    w = "sheriff";
  }
  if (w) {
    state.winner = w;
    state.pending = [];
    log(state, `🏁 게임 종료 — ${{ sheriff: "보안관 진영", outlaws: "무법자", renegade: "배신자" }[w]} 승리!`);
  }
  return w;
}

export function cardName(c: Card): string {
  return CARD_KO[c.name].name;
}
