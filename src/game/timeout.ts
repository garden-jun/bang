import { alivePlayers, player, responder, topPending } from "./core";
import { applyAction, settle } from "./engine";
import type { Action, GameState } from "./types";

/** 연결이 끊긴 플레이어에게 주는 짧은 유예 */
export const DISCONNECTED_GRACE_MS = 5000;

/**
 * 마감이 지난 응답/턴을 자동 행동으로 처리한다.
 * 바뀐 게 없으면 null, 있으면 새 상태를 반환한다.
 */
export function applyTimeouts(
  input: GameState,
  now: number,
  isDisconnected: (playerId: string) => boolean = () => false,
): GameState | null {
  let state = input;
  let changed = false;

  for (let guard = 0; guard < 20; guard++) {
    if (state.winner) break;

    const top = topPending(state);
    const timer = top ?? state.turn;
    const who = responder(state);
    const deadline = isDisconnected(who)
      ? Math.min(timer.deadline, timer.startedAt + DISCONNECTED_GRACE_MS)
      : timer.deadline;
    if (now < deadline) break;

    const action = autoAction(state, who);
    if (!action) {
      // start/jail 단계는 settle이 처리
      const s = structuredClone(state);
      settle(s, now);
      state = s;
      changed = true;
      continue;
    }

    try {
      state = applyAction(state, who, action, now);
    } catch {
      // 자동 행동이 거부되면 무한 루프 방지를 위해 중단
      break;
    }
    changed = true;

    // 턴 종료 직후 버리기 단계로 넘어갔다면 잠수 플레이어를 더 기다리지 않는다
    if (!topPending(state) && state.turn.playerId === who && state.turn.phase === "discard") {
      state.turn.deadline = now;
    }
  }

  return changed ? state : null;
}

function autoAction(state: GameState, who: string): Action | null {
  const top = topPending(state);
  const p = player(state, who);
  if (top) {
    switch (top.kind) {
      case "bang":
      case "gatling":
      case "indians":
      case "duel":
        return { type: "respond", cardIds: [] };
      case "generalStore":
        return { type: "pickCards", cardIds: [top.cards[0].id] };
      case "kitCarlson":
        return { type: "pickCards", cardIds: top.cards.slice(0, 2).map((c) => c.id) };
      case "dying": {
        const need = 1 - p.hp;
        const beers = p.hand.filter((c) => c.name === "beer").slice(0, need);
        const ok = alivePlayers(state).length > 2 && beers.length >= need;
        return { type: "respond", cardIds: ok ? beers.map((c) => c.id) : [] };
      }
    }
  }
  switch (state.turn.phase) {
    case "draw":
      return { type: "draw" };
    case "play":
      return { type: "endTurn" };
    case "discard":
      return { type: "discard", cardIds: p.hand.slice(0, p.hand.length - p.hp).map((c) => c.id) };
    default:
      return null;
  }
}
