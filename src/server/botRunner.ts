import { botCandidates } from "@/game/bot";
import { responder } from "@/game/core";
import { applyAction } from "@/game/engine";
import { toView } from "@/game/view";
import { playbackMs } from "@/shared/pacing";
import type { RoomState, RoomView } from "@/shared/types";
import { chooseCandidate } from "./llm";
import { getStore } from "./store";
import { loadRoom, withRoomLock } from "./room";

/** 한 번 불렸을 때 이어서 둘 수 있는 최대 수 (봇끼리 무한히 도는 것 방지) */
const MAX_MOVES = 24;

/**
 * 봇의 한 수 사이 최소 간격. 실제 간격은 직전 수의 연출 길이(holdBots)와 이것 중 긴 쪽이다.
 *
 * BOT_MIN_MOVE_MS로 조절한다 (0이면 기다리지 않는다 — 테스트용).
 */
const MIN_MOVE_MS = Number(process.env.BOT_MIN_MOVE_MS ?? 1650);

/**
 * 상태가 바뀐 뒤 화면에 도착하기까지의 여유. 봇 차례에 구경하는 사람의 폴링 간격이
 * 1.8초(toRoomView의 pollMs)라 평균 0.9초쯤 늦게 받는다.
 */
const ARRIVAL_MS = 1000;

/**
 * 방금 생긴 로그 줄의 연출이 화면에서 다 끝날 때까지 봇을 붙잡는다.
 *
 * 전에는 봇의 한 수마다 1.65초만 쉬었는데, 한 수가 로그를 여러 줄 남기면(뽑기·공격·술통 판정·피해)
 * 화면은 그걸 한 줄씩 흘리느라 5초 넘게 걸려 봇이 연출을 계속 앞질렀다. 사람의 수 뒤에도 건다 —
 * 사람이 뱅!을 쏘자마자 봇이 대응하면 쏘는 장면과 막는 장면이 겹친다.
 *
 * @param prevT 바뀌기 전 마지막 로그 번호
 */
export function holdBots(room: RoomState, prevT: number, now: number): void {
  if (MIN_MOVE_MS <= 0 || !room.game) return;
  const fresh = room.game.log.filter((l) => l.t > prevT);
  if (fresh.length === 0) return;
  const until = now + Math.max(MIN_MOVE_MS, playbackMs(fresh) + ARRIVAL_MS);
  room.botNotBefore = Math.max(room.botNotBefore ?? 0, until);
}

export const lastLogT = (room: RoomState) => room.game?.log.at(-1)?.t ?? -1;

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
  for (let moves = 0; moves < MAX_MOVES; ) {
    if (Date.now() - runStartedAt > BUDGET_MS) return;
    const room = await loadRoom(code, true);
    if (!room?.game || room.status !== "playing" || room.game.winner) return;

    const who = responder(room.game);
    if (!isBot(room, who)) return;

    // 직전 연출이 아직 화면에 돌고 있다. 예산 안에서 기다릴 수 있으면 기다렸다가 다시 읽고,
    // 넘치면 그만둔다 — 기다림이 끝난 뒤의 폴링이 구동부를 다시 띄운다 (roomService.getState).
    const wait = (room.botNotBefore ?? 0) - Date.now();
    if (wait > 0) {
      if (Date.now() + wait - runStartedAt > BUDGET_MS) return;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

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
        const prevT = lastLogT(fresh);
        const now = Date.now();
        fresh.game = applyAction(fresh.game, who, action, now);
        holdBots(fresh, prevT, now);
      } catch {
        // 후보가 거부되는 건 버그지만, 판을 멈추느니 넘긴다
        return { room: null, result: false };
      }
      if (fresh.game.winner) fresh.status = "finished";
      return { room: fresh, result: true };
    }).catch(() => false);

    if (!applied) return;
    moves++;
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
