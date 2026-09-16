import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Store } from "../store";

/**
 * 접속 시각만 저장하는 폴링(silent)은 version을 올리지 않는다.
 * 그런데 뷰를 락 안에서 먼저 만들면 뷰에는 "올려둔" 버전이 실려 나가,
 * 클라이언트가 저장된 값보다 1 앞선 버전을 쥐게 된다. 그러면 다음 변경이
 * 바로 그 번호로 저장되고, 클라이언트는 since가 같으니 304만 받는다 —
 * 자기 다음 접속 시각 저장(최대 12초)까지 남의 변경을 못 본다.
 */

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = undefined;
  g.__bangRoomCache?.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

test("접속 시각 저장 폴링이 돌려준 버전 뒤의 변경을 다음 폴링에서 받는다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, joinRoom, pollState, updateSettings } = await import("../roomService");

  const host = await createSession("방장");
  const { code } = await createRoom(host, {});
  const guest = await createSession("손님");
  await joinRoom(guest, code, "auto");

  // 접속 시각 저장이 일어날 만큼 시간을 흘린다
  vi.setSystemTime(Date.now() + 13_000);
  const touched = (await pollState(guest, code, null)).view!;
  g.__bangRoomCache?.clear();
  const stored = (await pollState(guest, code, null)).view!;
  expect(touched.version).toBe(stored.version);

  await updateSettings(host, code, { turnSeconds: 90 });
  g.__bangRoomCache?.clear();
  const next = (await pollState(guest, code, touched.version)).view;
  expect(next?.settings.turnSeconds).toBe(90);
});

test("이미 앉아 있는 사람의 재입장(silent)도 저장된 버전을 돌려준다", async () => {
  const { createSession } = await import("../session");
  const { createRoom, joinRoom, pollState } = await import("../roomService");

  const host = await createSession("방장");
  const { code } = await createRoom(host, {});
  const again = await joinRoom(host, code, "auto");
  g.__bangRoomCache?.clear();
  expect(again.version).toBe((await pollState(host, code, null)).view!.version);
});
