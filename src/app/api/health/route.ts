import { getStore, storeKind } from "@/server/store";

/** 배포가 실제 Redis에 붙었는지 확인한다. 브라우저에서 /api/health 를 열어보면 된다. */
export async function GET() {
  const kind = storeKind();
  let redis: "ok" | string = "ok";
  try {
    await getStore().get("health");
  } catch (e) {
    redis = e instanceof Error ? e.message : String(e);
  }
  // 값은 절대 내보내지 않고, 서버가 보는 변수 "이름"만 — 어떤 이름으로 주입됐는지 확인용
  // 값의 길이와 앞 8글자만 (URL은 https://... 로 시작해야 한다)
  const envNames = Object.keys(process.env)
    .filter((k) => /REDIS|KV_|UPSTASH/i.test(k))
    .sort()
    .map((k) => `${k}=${(process.env[k] ?? "").length}:${(process.env[k] ?? "").slice(0, 8)}`);
  return Response.json(
    { store: kind, redis, sessionSecret: !!process.env.SESSION_SECRET, envNames, vercelEnv: process.env.VERCEL_ENV ?? null },
    { status: kind === "upstash" && redis === "ok" ? 200 : 503 },
  );
}
