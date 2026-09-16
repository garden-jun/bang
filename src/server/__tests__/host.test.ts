import { beforeEach, expect, test } from "vitest";
import type { Store } from "../store";

/**
 * 봇이 방장이 되면 아무도 시작 버튼을 누를 수 없는 방이 된다.
 * 실제로 "방 만들기 → 봇 추가 → 관전"에서 걸렸다.
 */

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = undefined;
  g.__bangRoomCache?.clear();
});

test("방장이 관전으로 바꿔도 봇에게 방장이 넘어가지 않는다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, joinRoom } = await import("../roomService");

  const me = await createSession("사람");
  const { code } = await createRoom(me, {});
  await addBot(me, code);
  await addBot(me, code);

  const v = await joinRoom(me, code, "spectator");
  expect(v.players.every((p) => p.isBot)).toBe(true); // 자리에는 봇만 남았다
  expect(v.hostId).toBe(me.playerId); // 그래도 방장은 나
  expect(v.me.seat).toBe("spectator");
});

test("방장이 나가면 봇을 건너뛰고 사람에게 넘어간다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, joinRoom, leaveRoom, getState } = await import("../roomService");

  const host = await createSession("방장");
  const other = await createSession("손님");
  const { code } = await createRoom(host, {});
  await addBot(host, code); // players: [방장, 봇]
  await joinRoom(other, code, "player"); // players: [방장, 봇, 손님]
  await leaveRoom(host, code); // players: [봇, 손님] — 봇이 맨 앞이다

  const v = await getState(other, code, null);
  expect(v?.hostId).toBe(other.playerId);
});

test("사람이 관전자뿐이어도 봇이 아니라 그 사람이 방장", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, joinRoom, leaveRoom, getState } = await import("../roomService");

  const host = await createSession("방장");
  const watcher = await createSession("관전자");
  const { code } = await createRoom(host, {});
  await addBot(host, code);
  await joinRoom(watcher, code, "spectator");
  await leaveRoom(host, code); // 자리에는 봇만, 사람은 관전자뿐

  const v = await getState(watcher, code, null);
  expect(v?.hostId).toBe(watcher.playerId);
});

test("봇 이름은 AI_1, AI_2 순서이고 뺀 번호를 다시 채운다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, removeBot } = await import("../roomService");

  const me = await createSession("사람");
  const { code } = await createRoom(me, {});
  await addBot(me, code);
  await addBot(me, code);
  const v = await addBot(me, code);
  expect(v.players.filter((p) => p.isBot).map((p) => p.nickname)).toEqual(["AI_1", "AI_2", "AI_3"]);

  const ai2 = v.players.find((p) => p.nickname === "AI_2")!;
  await removeBot(me, code, ai2.id);
  const after = await addBot(me, code);
  expect(after.players.filter((p) => p.isBot).map((p) => p.nickname).sort()).toEqual(["AI_1", "AI_2", "AI_3"]);
});
