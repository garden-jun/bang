import type { LogEntry } from "@/game/types";

/**
 * 연출 속도. 화면(useGameEvents)이 사건을 흘리는 간격과, 서버(botRunner)가 "화면이 다 보여줄
 * 때까지" 봇을 기다리게 하는 계산이 같은 숫자를 봐야 해서 한곳에 둔다.
 */

/** 한 번에 여러 사건이 몰려와도 이 간격으로 하나씩 보여준다 */
export const STEP_MS = 1350;
/** 밀린 사건이 많으면 더 빨리 흘린다 (봇이 연달아 둘 때) */
export const MIN_STEP_MS = 630;
/** 밀린 사건 하나당 간격을 이만큼 줄인다 */
export const STEP_SPEEDUP_MS = 180;
/**
 * 판정 장면은 카드가 뒤집히고 결과 도장이 찍히는 것까지 봐야 의미가 있어,
 * 큐가 밀려 있어도 이만큼은 붙잡는다.
 */
export const CHECK_HOLD_MS = 1500;
/** 밀린 큐에서 다음 장면까지 기다리는 시간. 큐에 n개가 남았을 때 */
export const stepMs = (remaining: number) => Math.max(MIN_STEP_MS, STEP_MS - remaining * STEP_SPEEDUP_MS);

/**
 * 한 번에 도착한 로그 줄들을 화면이 마지막 장면까지 다 보여주는 데 걸리는 시간.
 * 화면의 pump를 그대로 흉내 낸다 — 첫 장면은 바로, 이후는 남은 개수에 따라 줄어드는 간격,
 * 마지막 장면도 제 간격만큼 머문다.
 */
export function playbackMs(lines: Pick<LogEntry, "meta">[]): number {
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const step = stepMs(lines.length - 1 - i);
    total += lines[i].meta?.kind === "check" ? Math.max(step, CHECK_HOLD_MS) : step;
  }
  return total;
}
