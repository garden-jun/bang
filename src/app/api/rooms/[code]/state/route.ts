import { after } from "next/server";
import { handle, requireSession } from "@/server/api";
import { botShouldMove, runBots } from "@/server/botRunner";
import { getState } from "@/server/roomService";

export async function GET(req: Request, ctx: RouteContext<"/api/rooms/[code]/state">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const sinceRaw = new URL(req.url).searchParams.get("since");
    const since = sinceRaw === null ? null : Number(sinceRaw);
    const view = await getState(session, code.toUpperCase(), Number.isFinite(since) ? since : null);
    if (!view) return new Response(null, { status: 304 });
    // 사람이 시간초과로 턴을 넘겨 봇 차례가 되는 경우는 폴링에서만 드러난다
    if (botShouldMove(view)) after(() => runBots(view.code));
    return Response.json(view, { headers: { "cache-control": "no-store" } });
  });
}
