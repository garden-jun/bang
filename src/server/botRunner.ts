import { botCandidates } from "@/game/bot";
import { responder } from "@/game/core";
import { applyAction } from "@/game/engine";
import { toView } from "@/game/view";
import type { RoomState, RoomView } from "@/shared/types";
import { chooseCandidate } from "./llm";
import { getStore } from "./store";
import { loadRoom, withRoomLock } from "./room";

/** 한 번 불렸을 때 이어서 둘 수 있는 최대 수 (봇끼리 무한히 도는 것 방지) */
const MAX_MOVES = 24;

/**
 * 봇의 한 수가 최소 이만큼은 걸리게 한다.
 *
 * 안 그러면 봇 여럿의 턴이 폴링 한 번 사이에 전부 끝나서, 사람은 결과만
 * 보고 무슨 일이 있었는지 못 본다. LLM이 이미 시간을 썼으면 그만큼 덜 쉰다.
 *
 * BOT_MIN_MOVE_MS로 조절한다 (0이면 즉시 — 테스트용).
 * 클라이언트 연출 간격(useGameEvents의 STEP_MS)과 함께 움직여야 한다 —
 * 봇이 연출보다 빨리 두면 큐가 밀려 사람이 따라 읽지 못한다.
 */
const MIN_MOVE_MS = Number(process.env.BOT_MIN_MOVE_MS ?? 1650);

/**
 * 한 요청에서 봇에 쓸 수 있는 시간. 서버리스 함수에는 실행시간 상한이 있는데,
 * 한 수가 느려질수록 MAX_MOVES를 다 채우기 전에 잘릴 수 있다. 플랫폼이 끊기를
 * 기다리지 말고 스스로 멈춘다 — 남은 수는 다음 폴링이 이어받는다.
 */
const BUDGET_MS = 8000;

/**
 * 지금 행동해야 할 사람이 봇이면 대신 둔다. 연속된 봇 차례는 이어서 처리한다.
 *
 * 응답을 붙잡지 않도록 라우트에서 `after()`로 부른다. Vercel에는 상주
 * 프로세스가 없으므로, "봇 차례"를 알아채는 시점은 결국 상태를 바꾼 요청뿐이다.
 */
export async function runBots(code: string): Promise<void> {
  const runStartedAt = Date.now();
  for (let i = 0; i < MAX_MOVES; i++) {
    if (Date.now() - runStartedAt > BUDGET_MS) return;
    const startedAt = Date.now();
    const room = await loadRoom(code, true);
    if (!room?.game || room.status !== "playing" || room.game.winner) return;

    const who = responder(room.game);
    if (!isBot(room, who)) return;

    // 같은 상태를 두 요청이 동시에 굴리지 않게 한 번만 잡는다.
    // 버전을 키에 넣어서, 다음 수는 다시 경쟁할 수 있게 둔다.
    const loadedVersion = room.version;
    const claim = `botmove:${code}:${loadedVersion}`;
    if (!(await getStore().setNx(claim, 1, 20_000))) return;

    const candidates = botCandidates(room.game, who);
    if (candidates.length === 0) return;

    // LLM은 락 밖에서 부른다 — 락 TTL(3초)보다 오래 걸릴 수 있다
    const view = toView(room.game, { kind: "player", id: who });
    const idx = await chooseCandidate(view, who, candidates);
    const action = candidates[idx].action;

    const applied = await withRoomLock(code, async (fresh) => {
      // 기다리는 동안 사람이 뭔가 했으면 이 수는 버린다
      if (fresh.version - 1 !== loadedVersion || !fresh.game || fresh.status !== "playing") {
        return { room: null, result: false };
      }
      if (responder(fresh.game) !== who) return { room: null, result: false };
      try {
        fresh.game = applyAction(fresh.game, who, action, Date.now());
      } catch {
        // 후보가 거부되는 건 버그지만, 판을 멈추느니 넘긴다
        return { room: null, result: false };
      }
      if (fresh.game.winner) fresh.status = "finished";
      return { room: fresh, result: true };
    }).catch(() => false);

    if (!applied) return;

    const spent = Date.now() - startedAt;
    if (spent < MIN_MOVE_MS) await new Promise((r) => setTimeout(r, MIN_MOVE_MS - spent));
  }
}

function isBot(room: RoomState, playerId: string): boolean {
  return !!room.players.find((p) => p.id === playerId)?.isBot;
}

/**
 * 봇이 둘 차례인가 — 라우트가 `after(runBots)`를 걸지 판단할 때 쓴다.
 * 이미 만들어둔 뷰로 판단하므로 Redis를 더 읽지 않는다.
 */
export function botShouldMove(view: RoomView): boolean {
  if (!view.game || view.status !== "playing" || view.game.winner) return false;
  return !!view.players.find((p) => p.id === view.game!.responder)?.isBot;
}
