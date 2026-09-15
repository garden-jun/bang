import { beforeEach, expect, test } from "vitest";
import type { Store } from "../store";

/**
 * 방이 사라졌는데 "참여 중인 방" 포인터만 남으면,
 * 로비가 복귀 배너를 띄우고 → 복귀하면 없는 방 → 다시 로비… 가 무한 반복된다.
 */

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = undefined;
  g.__bangRoomCache?.clear();
});

test("방이 사라진 뒤 나가기를 해도 포인터가 남지 않는다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, leaveRoom, currentRoomOf } = await import("../roomService");
  const { deleteRoom } = await import("../room");

  const me = await createSession("사람");
  const { code } = await createRoom(me, {});
  expect(await currentRoomOf(me)).toBe(code);

  // 방만 사라진 상황 (TTL 만료 등)
  await deleteRoom(code);

  // 나가기는 실패하더라도 포인터는 지워져야 한다
  await leaveRoom(me, code).catch(() => {});
  expect(await currentRoomOf(me)).toBeNull();
});

test("죽은 포인터는 세션 조회에서 스스로 정리된다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, currentRoomOf } = await import("../roomService");
  const { deleteRoom } = await import("../room");
  const { getRoomOf } = await import("../session");

  const me = await createSession("사람");
  const { code } = await createRoom(me, {});
  await deleteRoom(code);

  // 나가기를 아예 하지 않아도 (탭을 그냥 닫은 경우)
  expect(await getRoomOf(me.playerId)).toBe(code); // 아직 남아 있음
  expect(await currentRoomOf(me)).toBeNull(); // 조회하면서 정리
  expect(await getRoomOf(me.playerId)).toBeNull(); // 다시 물어도 없음
});

test("새 방을 만들면 죽은 포인터가 새 방으로 갱신된다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, currentRoomOf } = await import("../roomService");
  const { deleteRoom } = await import("../room");

  const me = await createSession("사람");
  const first = (await createRoom(me, {})).code;
  await deleteRoom(first);

  const second = (await createRoom(me, {})).code;
  expect(second).not.toBe(first);
  expect(await currentRoomOf(me)).toBe(second);
});
