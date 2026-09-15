import { beforeEach, expect, test, vi } from "vitest";
import type { Store } from "../store";

/**
 * 폴링이 Redis 커맨드를 몇 개 쓰는지 실제로 센다.
 * 무료 티어(월 50만)가 몇 시간을 버티는지가 여기서 나오므로,
 * 폴링 경로에 커맨드가 늘면 이 테스트가 먼저 알려준다.
 */

let commands = 0;

class CountingStore implements Store {
  private kv = new Map<string, { value: unknown; expires?: number }>();
  private z = new Map<string, Map<string, number>>();

  private live(key: string) {
    const e = this.kv.get(key);
    if (!e) return null;
    if (e.expires && e.expires < Date.now()) {
      this.kv.delete(key);
      return null;
    }
    return e;
  }
  async get<T>(key: string) {
    commands++;
    return (this.live(key)?.value as T) ?? null;
  }
  async mget<T>(keys: string[]) {
    commands++;
    return keys.map((k) => (this.live(k)?.value as T) ?? null);
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    commands++;
    this.kv.set(key, { value: structuredClone(value), expires: ttlSec ? Date.now() + ttlSec * 1000 : undefined });
  }
  async del(key: string) {
    commands++;
    this.kv.delete(key);
  }
  async setNx(key: string, value: unknown, ttlMs: number) {
    commands++;
    if (this.live(key)) return false;
    this.kv.set(key, { value, expires: Date.now() + ttlMs });
    return true;
  }
  async zadd(key: string, score: number, member: string) {
    commands++;
    if (!this.z.has(key)) this.z.set(key, new Map());
    this.z.get(key)!.set(member, score);
  }
  async zrem(key: string, member: string) {
    commands++;
    this.z.get(key)?.delete(member);
  }
  async zrangeDesc(key: string, limit: number) {
    commands++;
    return [...(this.z.get(key) ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([m]) => m);
  }
}

const g = globalThis as unknown as { __bangStore?: Store; __bangRoomCache?: Map<string, unknown> };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  g.__bangStore = new CountingStore();
  g.__bangRoomCache?.clear();
  commands = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

/** coldInstance: 매 요청이 다른 서버 인스턴스에 떨어져 메모리 캐시가 늘 비는 최악의 경우 */
async function measure(coldInstance: boolean): Promise<number> {
  const { createSession } = await import("../session");
  const { createRoom, joinRoom, startGame, getState } = await import("../roomService");

  const sessions = [];
  for (let i = 0; i < 7; i++) sessions.push(await createSession(`플레이어${i}`));

  const room = await createRoom(sessions[0], { maxPlayers: 7, turnSeconds: 60 });
  for (let i = 1; i < 7; i++) await joinRoom(sessions[i], room.code, "player");
  await startGame(sessions[0], room.code);

  // 여기까지는 준비 비용. 폴링만 따로 센다.
  commands = 0;

  const start = Date.now();
  const nextPoll = sessions.map(() => start);
  const versions: (number | null)[] = sessions.map(() => null);
  const DURATION_MS = 60_000;

  while (Date.now() - start < DURATION_MS) {
    // 다음으로 폴링할 사람에게 시계를 맞춘다
    const due = Math.min(...nextPoll);
    vi.setSystemTime(new Date(Math.max(due, Date.now())));
    for (let i = 0; i < sessions.length; i++) {
      if (nextPoll[i] > Date.now()) continue;
      if (coldInstance) g.__bangRoomCache?.clear();
      const v = await getState(sessions[i], room.code, versions[i]);
      if (v) versions[i] = v.version;
      nextPoll[i] = Date.now() + (v?.pollMs ?? 2000);
    }
  }

  return commands / (DURATION_MS / 1000);
}

function report(label: string, perSecond: number) {
  const hours = 500_000 / (perSecond * 3600);
  console.log(`7인 폴링 (${label}): ${perSecond.toFixed(1)} 커맨드/초 → 무료 티어 ${hours.toFixed(0)}시간`);
}

test("7인 게임 폴링 커맨드 사용량 — 캐시 적중", async () => {
  const perSecond = await measure(false);
  report("메모리 캐시 적중", perSecond);
  expect(perSecond).toBeLessThan(5);
});

test("7인 게임 폴링 커맨드 사용량 — 캐시 전부 실패 (최악)", async () => {
  const perSecond = await measure(true);
  report("캐시 전부 실패", perSecond);
  // 개선 전 기준선은 초당 약 23개였다. 회귀하면 여기서 걸린다.
  expect(perSecond).toBeLessThan(8);
});
