import type { Card, LogEntry } from "@/game/types";

/** 카드 한 장이 날아가는 시간 (CardFlights) */
export const FLIGHT_MS = 640;
/** 한 장면에 여러 장이 움직이면 한 장씩 보이도록. 벌처 샘처럼 장수가 많으면 간격을 줄인다 */
const STAGGER_MS = 110;
const MAX_STAGGER_TOTAL_MS = 600;
export const flightStepMs = (n: number) => Math.min(STAGGER_MS, MAX_STAGGER_TOTAL_MS / Math.max(1, n - 1));
/**
 * 장면이 시작된 뒤 마지막 카드가 도착지에 닿는 시각. 끝의 20%는 도착지에서 사라지는 구간이라
 * 거기서 숫자를 바꿔야 "들어갔다"로 읽힌다.
 */
export const landMs = (n: number) => (n > 0 ? Math.round(FLIGHT_MS * 0.8 + (n - 1) * flightStepMs(n)) : 0);

/** 내 손패에서 나가는 카드가 날아가는 시간과 간격 (FlyAway) */
export const HAND_FLY_MS = 460;
export const HAND_FLY_STAGGER_MS = 90;
/** 내 손패에서 n장이 나갈 때 마지막 카드가 도착지에 닿는 시각. 이 연출은 끝까지 도착지로 다가가며 흐려진다 */
export const handLandMs = (n: number) => (n > 0 ? Math.round(HAND_FLY_MS * 0.85 + (n - 1) * HAND_FLY_STAGGER_MS) : 0);

/**
 * 한 로그 줄에서 버림 더미에 마지막으로 얹히는 카드 — 낸 카드든 판정 카드든.
 * 판정 카드는 이동(moves)이 아니라 check 메타로만 온다 (테이블 중앙 패널이 따로 보여준다).
 */
export function discardArrival(line: Pick<LogEntry, "meta" | "moves">): Card | undefined {
  const cards = [
    ...(line.meta?.kind === "check" ? line.meta.cards : []),
    ...(line.moves ?? []).filter((m) => m.to === "discard" && m.card).map((m) => m.card!),
  ];
  return cards.at(-1);
}

/**
 * 화면에 보여줄 손패 수와 버림 더미 맨 위 — 카드가 도착한 만큼만 반영한다.
 *
 * 폴링은 최신 상태를 통째로 주므로 그대로 그리면 숫자와 버림 더미가 카드보다 먼저 바뀐다.
 * 아직 도착하지 않은 줄(t > landedT)의 이동을 실제 값에서 되돌린다. 실제 상태에서 거꾸로
 * 계산하므로, 로그에 안 남는 이동이 있어도 마지막 줄이 도착하면 늘 실제 값으로 돌아온다.
 *
 * @param landedT 카드가 도착한 마지막 로그 줄
 * @param landedDiscard 도착한 카드 중 버림 더미에 마지막으로 얹힌 것. 아직 아무것도 안 얹혔으면 게임판이 열릴 때의
 *                      버림 더미 — 비어 있었으면 undefined이고, 그때는 빈 채로 둔다 (실제 값으로 가면 카드보다 먼저 뜬다)
 * @param liveId 손패 수를 늦추지 않을 사람 — 내 손패는 카드가 즉시 보이니 숫자만 늦으면 어긋난다
 */
export function landedBoard(
  game: { log: LogEntry[]; players: { id: string; handCount: number; equipment: Card[] }[]; discardTop?: Card },
  landedT: number,
  landedDiscard: Card | undefined,
  liveId?: string,
): { handCount: Record<string, number>; equipment: Record<string, Card[]>; discardTop?: Card } {
  const handCount = Object.fromEntries(game.players.map((p) => [p.id, p.handCount]));
  const equipment = Object.fromEntries(game.players.map((p) => [p.id, p.equipment]));
  let discardPending = false;
  for (const line of game.log) {
    if (line.t <= landedT) continue;
    for (const m of line.moves ?? []) {
      const to = m.to.startsWith("hand:") ? m.to.slice(5) : null;
      const from = m.from.startsWith("hand:") ? m.from.slice(5) : null;
      if (to !== null && to !== liveId && to in handCount) handCount[to] -= 1;
      if (from !== null && from !== liveId && from in handCount) handCount[from] += 1;
      // 장착 카드는 내 것도 늦춘다 — 손패에서 날아간 카드가 닿기 전에 좌석에 먼저 깔리면 안 된다.
      // 장착 카드는 모두에게 공개라 이동에 늘 card가 실려 있다
      const card = m.card;
      if (!card) continue;
      const eqTo = m.to.startsWith("equip:") ? m.to.slice(6) : null;
      const eqFrom = m.from.startsWith("equip:") ? m.from.slice(6) : null;
      if (eqTo !== null && eqTo in equipment) equipment[eqTo] = equipment[eqTo].filter((c) => c.id !== card.id);
      if (eqFrom !== null && eqFrom in equipment && !equipment[eqFrom].some((c) => c.id === card.id)) {
        equipment[eqFrom] = [...equipment[eqFrom], card];
      }
    }
    if (discardArrival(line)) discardPending = true;
  }
  for (const id in handCount) handCount[id] = Math.max(0, handCount[id]);
  return { handCount, equipment, discardTop: discardPending ? landedDiscard : game.discardTop };
}
