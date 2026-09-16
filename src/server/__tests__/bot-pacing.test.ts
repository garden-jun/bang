import { beforeEach, expect, test } from "vitest";
import { botCandidates } from "@/game/bot";
import { responder } from "@/game/core";
import type { LogEntry } from "@/game/types";
import { CHECK_HOLD_MS, playbackMs, stepMs } from "@/shared/pacing";
import type { Store } from "../store";

/**
 * 봇은 직전 수의 연출이 화면에서 끝날 때까지 기다린다.
 * bot-runner.test는 BOT_MIN_MOVE_MS=0으로 기다림을 끄므로, 켠 상태는 여기서 따로 본다
 * (환경변수를 모듈을 읽을 때 한 번 읽는다 — 파일마다 모듈이 따로 뜬다).
 */

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  process.env.BOT_MIN_MOVE_MS = "1650";
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = undefined;
  g.__bangRoomCache?.clear();
});

test("연출 길이: 밀린 줄일수록 빨리, 판정은 붙잡는다", () => {
  expect(playbackMs([])).toBe(0);
  expect(playbackMs([{}])).toBe(stepMs(0));
  expect(playbackMs([{}, {}, {}])).toBe(stepMs(2) + stepMs(1) + stepMs(0));
  const check: Pick<LogEntry, "meta"> = { meta: { kind: "check", from: "a", check: "jail", cards: [], ok: true } };
  expect(playbackMs([check, {}, {}, {}, {}])).toBe(Math.max(stepMs(4), CHECK_HOLD_MS) + stepMs(3) + stepMs(2) + stepMs(1) + stepMs(0));
});

/** 봇 차례까지 사람이 두고 방 코드를 돌려준다 */
async function toBotTurn() {
  const { createSession } = await import("../session");
  const { createRoom, addBot, startGame, doAction } = await import("../roomService");
  const { loadRoom } = await import("../room");
  const me = await createSession("사람");
  const { code } = await createRoom(me, { maxPlayers: 5, turnSeconds: 60 });
  for (let i = 0; i < 4; i++) await addBot(me, code);
  await startGame(me, code);
  let room = (await loadRoom(code, true))!;
  for (let i = 0; i < 30 && !room.players.find((p) => p.id === responder(room.game!))?.isBot; i++) {
    await doAction(me, code, botCandidates(room.game!, responder(room.game!))[0].action);
    room = (await loadRoom(code, true))!;
  }
  expect(room.players.find((p) => p.id === responder(room.game!))?.isBot, "봇 차례가 오지 않았다").toBe(true);
  return { me, code };
}

test("BOT_MIN_MOVE_MS가 비었거나 이상하면 기본값 — 0은 명시했을 때만", async () => {
  const { envMs } = await import("../botRunner");
  expect(envMs(undefined, 1650)).toBe(1650);
  expect(envMs("", 1650)).toBe(1650); // .env.example을 그대로 옮긴 경우
  expect(envMs("  ", 1650)).toBe(1650);
  expect(envMs("abc", 1650)).toBe(1650);
  expect(envMs("-5", 1650)).toBe(1650);
  expect(envMs("0", 1650)).toBe(0);
  expect(envMs("2000", 1650)).toBe(2000);
});

test("수를 두면 연출이 끝날 때까지 봇을 붙잡는다", async () => {
  const { me, code } = await toBotTurn();
  const { loadRoom } = await import("../room");
  const { pollState } = await import("../roomService");
  const room = (await loadRoom(code, true))!;
  expect(room.botNotBefore).toBeGreaterThan(Date.now());
  // 기다리는 동안 폴링은 구동부를 띄우지 않는다
  expect((await pollState(me, code, null)).botDue).toBe(false);
});

test("기다림이 예산을 넘으면 두지 않고 물러나고, 끝나면 폴링이 다시 띄운다", async () => {
  const { me, code } = await toBotTurn();
  const { loadRoom, saveRoom } = await import("../room");
  const { pollState } = await import("../roomService");
  const { runBots } = await import("../botRunner");

  const room = (await loadRoom(code, true))!;
  room.botNotBefore = Date.now() + 60_000;
  await saveRoom(room, Date.now());
  const before = room.version;
  await runBots(code);
  expect((await loadRoom(code, true))!.version, "기다리지 않고 뒀다").toBe(before);

  const due = (await loadRoom(code, true))!;
  due.botNotBefore = Date.now() - 1;
  await saveRoom(due, Date.now());
  expect((await pollState(me, code, due.version)).botDue).toBe(true);
});
