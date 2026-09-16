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
  return Response.json({ store: kind, redis, sessionSecret: !!process.env.SESSION_SECRET }, { status: kind === "upstash" && redis === "ok" ? 200 : 503 });
}
