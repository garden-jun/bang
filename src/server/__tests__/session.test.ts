import { expect, test, vi } from "vitest";

/**
 * 서명 토큰은 Redis를 거치지 않으므로, 위조를 막는 건 오직 서명이다.
 * 이 테스트가 이 파일의 유일한 방어선이다.
 */

/** NODE_ENV는 타입상 읽기 전용이라 테스트에서만 우회한다 */
function setNodeEnv(v: string) {
  (process.env as Record<string, string>).NODE_ENV = v;
}

async function freshModule(secret: string | undefined, nodeEnv = "test") {
  vi.resetModules();
  if (secret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = secret;
  setNodeEnv(nodeEnv);
  (globalThis as { __bangStore?: unknown }).__bangStore = undefined;
  return import("../session");
}

test("서명 토큰은 Redis 없이 왕복한다", async () => {
  const { createSession, getSession } = await freshModule("secret-a");
  const s = await createSession("총잡이");
  expect(s.token.startsWith("v1.")).toBe(true);

  const back = await getSession(s.token);
  expect(back).toEqual({ token: s.token, playerId: s.playerId, nickname: "총잡이" });
});

test("페이로드를 고치면 거부된다", async () => {
  const { createSession, getSession } = await freshModule("secret-a");
  const s = await createSession("총잡이");
  const [, payload, sig] = s.token.split(".");

  // 남의 playerId로 바꿔치기 시도
  const forged = Buffer.from(JSON.stringify({ i: "someone-else", n: "관리자", e: Date.now() + 60_000 })).toString(
    "base64url",
  );
  expect(await getSession(`v1.${forged}.${sig}`)).toBeNull();
  expect(await getSession(`v1.${payload}.${"A".repeat(sig.length)}`)).toBeNull();
  expect(await getSession("v1.garbage.garbage")).toBeNull();
});

test("다른 키로 서명된 토큰은 거부된다", async () => {
  const a = await freshModule("secret-a");
  const s = await a.createSession("총잡이");
  const b = await freshModule("secret-b");
  expect(await b.getSession(s.token)).toBeNull();
});

test("만료된 토큰은 거부된다", async () => {
  const { createSession, getSession } = await freshModule("secret-a");
  const s = await createSession("총잡이");

  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000); // TTL 24h
  expect(await getSession(s.token)).toBeNull();
  vi.useRealTimers();
});

test("닉네임을 바꾸면 새 토큰이 나오고 playerId는 유지된다", async () => {
  const { createSession, renameSession, getSession } = await freshModule("secret-a");
  const s = await createSession("총잡이");
  const r = await renameSession(s, "보안관");

  expect(r.playerId).toBe(s.playerId);
  expect(r.token).not.toBe(s.token);
  expect((await getSession(r.token))?.nickname).toBe("보안관");
});

test("개발 환경은 키가 없어도 서명 토큰을 쓴다", async () => {
  const { createSession, getSession } = await freshModule(undefined, "development");
  const s = await createSession("총잡이");
  expect(s.token.startsWith("v1.")).toBe(true);
  expect((await getSession(s.token))?.nickname).toBe("총잡이");
});

test("배포 환경에 키가 없으면 Redis 저장 방식으로 물러난다", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { createSession, getSession } = await freshModule(undefined, "production");
  const s = await createSession("총잡이");

  expect(s.token.startsWith("v1.")).toBe(false);
  expect((await getSession(s.token))?.nickname).toBe("총잡이");
  expect(await getSession("v1.fake.fake")).toBeNull();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
  setNodeEnv("test");
});
