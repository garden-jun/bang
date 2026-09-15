import { handle, requireSession } from "@/server/api";
import { getState } from "@/server/roomService";

export async function GET(req: Request, ctx: RouteContext<"/api/rooms/[code]/state">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const sinceRaw = new URL(req.url).searchParams.get("since");
    const since = sinceRaw === null ? null : Number(sinceRaw);
    const view = await getState(session, code.toUpperCase(), Number.isFinite(since) ? since : null);
    if (!view) return new Response(null, { status: 304 });
    return Response.json(view, { headers: { "cache-control": "no-store" } });
  });
}
