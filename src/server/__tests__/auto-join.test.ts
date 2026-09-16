import { beforeEach, expect, test } from "vitest";
import type { Store } from "../store";

/**
 * 입장할 때 클라이언트가 roomInfo로 자리 수를 먼저 재던 것을 없애고
 * 서버가 락 안에서 정하게 했다 (`as: "auto"`). 왕복 하나를 줄이는 것과 별개로,
 * 낡은 값으로 고르면 마지막 한 자리에서 튕기는 사람이 생긴다.
 */

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = undefined;
  g.__bangRoomCache?.clear();
});

test("자리가 있으면 플레이어로 앉힌다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, joinRoom } = await import("../roomService");

  const host = await createSession("방장");
  const { code } = await createRoom(host, { maxPlayers: 4 });
  const guest = await createSession("손님");

  const v = await joinRoom(guest, code, "auto");
  expect(v.me.seat).toBe("player");
});

test("자리가 차 있으면 관전으로 내려간다 — 에러로 튕기지 않는다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, joinRoom } = await import("../roomService");

  const host = await createSession("방장");
  const { code } = await createRoom(host, { maxPlayers: 4 });
  for (let i = 0; i < 3; i++) await addBot(host, code); // 4/4

  const late = await createSession("늦은손님");
  const v = await joinRoom(late, code, "auto");
  expect(v.me.seat).toBe("spectator");
  expect(v.players).toHaveLength(4);
});

test("게임이 이미 시작됐으면 관전으로 들어간다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, joinRoom, startGame } = await import("../roomService");

  const host = await createSession("방장");
  const { code } = await createRoom(host, { maxPlayers: 7 });
  for (let i = 0; i < 3; i++) await addBot(host, code);
  await startGame(host, code);

  const late = await createSession("구경꾼");
  const v = await joinRoom(late, code, "auto");
  expect(v.me.seat).toBe("spectator");
});

test("마지막 한 자리에 두 명이 들어오면 한 명만 앉고 다른 한 명은 관전이 된다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, addBot, joinRoom } = await import("../roomService");

  const host = await createSession("방장");
  const { code } = await createRoom(host, { maxPlayers: 4 });
  await addBot(host, code);
  await addBot(host, code); // 3/4 — 남은 자리 하나

  const a = await createSession("동시A");
  const b = await createSession("동시B");
  const [va, vb] = await Promise.all([joinRoom(a, code, "auto"), joinRoom(b, code, "auto")]);

  const seats = [va.me.seat, vb.me.seat].sort();
  expect(seats).toEqual(["player", "spectator"]);
});

test("이미 앉아 있는 사람이 다시 auto로 들어와도 자리를 옮기지 않는다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, joinRoom } = await import("../roomService");

  const host = await createSession("방장");
  const { code } = await createRoom(host, { maxPlayers: 4 });
  const watcher = await createSession("관전자");

  await joinRoom(watcher, code, "spectator");
  // 자리가 비어 있어도 관전자로 남아야 한다 (새로고침이 자리를 바꿔 버리면 안 된다)
  const v = await joinRoom(watcher, code, "auto");
  expect(v.me.seat).toBe("spectator");
});
