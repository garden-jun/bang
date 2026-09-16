import { after } from "next/server";
import { handle, requireSession } from "@/server/api";
import { runBots } from "@/server/botRunner";
import { pollState } from "@/server/roomService";

export async function GET(req: Request, ctx: RouteContext<"/api/rooms/[code]/state">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const sinceRaw = new URL(req.url).searchParams.get("since");
    const since = sinceRaw === null ? null : Number(sinceRaw);
    const { view, botDue } = await pollState(session, code.toUpperCase(), Number.isFinite(since) ? since : null);
    // 사람이 시간초과로 턴을 넘겨 봇 차례가 되는 경우, 그리고 봇이 연출을 기다리다 멈춘 경우는
    // 폴링에서만 드러난다. 기다림이 안 끝났으면 띄우지 않는다 — 이미 기다리는 구동부가 있다.
    if (botDue) after(() => runBots(code.toUpperCase()));
    if (!view) return new Response(null, { status: 304 });
    return Response.json(view, { headers: { "cache-control": "no-store" } });
  });
}
