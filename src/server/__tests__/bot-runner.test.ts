import { beforeEach, expect, test } from "vitest";
import { botCandidates } from "@/game/bot";
import { responder } from "@/game/core";
import type { Store } from "../store";

/**
 * 봇이 실제로 판을 굴리는지 방 레이어까지 통과시켜 확인한다.
 * OPENAI_API_KEY가 없으면 LLM을 건너뛰고 기본 수를 두므로, 이 테스트는
 * 네트워크를 타지 않는다.
 */

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = undefined; // 인메모리 스토어로 새로 시작
  g.__bangRoomCache?.clear();
});

test("봇 6명 + 사람 1명이 끝까지 간다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, startGame, doAction, getState } = await import("../roomService");
  const { runBots } = await import("../botRunner");
  const { loadRoom } = await import("../room");

  const me = await createSession("사람");
  const created = await createRoom(me, { maxPlayers: 7, turnSeconds: 60 });
  const code = created.code;

  for (let i = 0; i < 6; i++) await addBot(me, code);
  const started = await startGame(me, code);
  expect(started.players.filter((p) => p.isBot)).toHaveLength(6);

  let view = started;
  for (let i = 0; i < 400 && view.status === "playing"; i++) {
    // 사람 차례면 사람이 두고, 아니면 봇 구동부에 맡긴다
    const mustAct = view.game!.responder;
    if (mustAct === me.playerId) {
      // 사람의 수도 후보 생성기로 고른다. 뷰는 가려져 있으므로 실제 상태를 읽는다.
      const room = await loadRoom(code, true);
      const cands = botCandidates(room!.game!, me.playerId);
      if (cands.length === 0) break;
      view = await doAction(me, code, cands[0].action);
    } else {
      await runBots(code);
      view = (await getState(me, code, null)) ?? view;
    }
  }

  expect(view.status, "게임이 끝나지 않았다 — 봇이 어딘가에서 멈췄다").toBe("finished");
  expect(view.game?.winner).toBeTruthy();
});

test("봇 차례가 되면 runBots 한 번으로 스스로 둔다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, startGame, doAction } = await import("../roomService");
  const { runBots } = await import("../botRunner");
  const { loadRoom } = await import("../room");

  const me = await createSession("사람");
  const { code } = await createRoom(me, { maxPlayers: 5, turnSeconds: 60 });
  for (let i = 0; i < 4; i++) await addBot(me, code);
  await startGame(me, code);

  // 선턴은 보안관이고 보안관은 무작위다 — 봇 차례가 올 때까지 사람이 먼저 둔다
  let room = (await loadRoom(code, true))!;
  for (let i = 0; i < 30; i++) {
    const who = responder(room.game!);
    if (room.players.find((p) => p.id === who)?.isBot) break;
    const cands = botCandidates(room.game!, who);
    expect(cands.length).toBeGreaterThan(0);
    await doAction(me, code, cands[0].action);
    room = (await loadRoom(code, true))!;
  }

  const who = responder(room.game!);
  expect(room.players.find((p) => p.id === who)?.isBot, "봇 차례가 오지 않았다").toBe(true);

  const before = room.version;
  await runBots(code);
  const after = (await loadRoom(code, true))!;
  expect(after.version, "봇이 한 수도 두지 않았다").toBeGreaterThan(before);
});

test("봇이 없으면 runBots는 아무것도 하지 않는다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, joinRoom, startGame, getState } = await import("../roomService");
  const { runBots } = await import("../botRunner");

  const a = await createSession("A");
  const { code } = await createRoom(a, { maxPlayers: 4, turnSeconds: 60 });
  for (const n of ["B", "C", "D"]) await joinRoom(await createSession(n), code, "player");
  await startGame(a, code);

  const before = (await getState(a, code, null))!.version;
  await runBots(code);
  expect((await getState(a, code, null))!.version).toBe(before);
});
