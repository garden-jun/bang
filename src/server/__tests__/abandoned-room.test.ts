import { beforeEach, expect, test } from "vitest";
import type { Store } from "../store";

/**
 * 탭을 닫고 떠난 방이 TTL 6시간 동안 로비에 남아 있었다.
 * 들어가 봐야 방장이 없어 시작도 못 하는 방이라 목록만 지저분해진다.
 *
 * 다만 사람 1명이 봇과 플레이 중인 방은 절대 지우면 안 된다.
 */

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = undefined;
  g.__bangRoomCache?.clear();
});

/** 그 방의 사람들이 마지막으로 폴링한 시각을 과거로 돌린다 */
async function ageHumans(code: string, minutes: number) {
  const { loadRoom, saveRoom } = await import("../room");
  const room = (await loadRoom(code, true))!;
  const t = Date.now() - minutes * 60 * 1000;
  for (const m of [...room.players, ...room.spectators]) if (!m.isBot) m.lastSeen = t;
  await saveRoom(room, Date.now());
  g.__bangRoomCache?.clear();
}

test("아무도 안 보는 채로 10분이 지나면 방이 닫힌다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, listRooms } = await import("../roomService");
  const { loadRoom } = await import("../room");

  const me = await createSession("사람");
  const { code } = await createRoom(me, {});
  expect((await listRooms()).map((r) => r.code)).toContain(code);

  await ageHumans(code, 11);
  expect((await listRooms()).map((r) => r.code)).not.toContain(code);
  // 목록에서 감추는 게 아니라 실제로 지운다
  expect(await loadRoom(code, true)).toBeNull();
});

test("10분이 안 지났으면 그대로 둔다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, listRooms } = await import("../roomService");

  const me = await createSession("사람");
  const { code } = await createRoom(me, {});
  await ageHumans(code, 9);
  expect((await listRooms()).map((r) => r.code)).toContain(code);
});

test("봇과 둘이 플레이 중이어도 사람이 보고 있으면 살아남는다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, listRooms } = await import("../roomService");
  const { loadRoom } = await import("../room");

  const me = await createSession("사람");
  const { code } = await createRoom(me, {});
  for (let i = 0; i < 5; i++) await addBot(me, code); // 사람 1 + 봇 5

  // 봇은 폴링하지 않아 lastSeen이 낡지만, 사람이 보고 있으면 기준이 되지 않는다
  const room = (await loadRoom(code, true))!;
  expect(room.players.filter((p) => p.isBot)).toHaveLength(5);
  expect((await listRooms()).map((r) => r.code)).toContain(code);

  // 그 사람이 떠나면 그제서야 닫힌다
  await ageHumans(code, 11);
  expect((await listRooms()).map((r) => r.code)).not.toContain(code);
});
