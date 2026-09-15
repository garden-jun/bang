import { handle, requireSession } from "@/server/api";
import { leaveRoom } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/leave">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    await leaveRoom(session, code.toUpperCase());
    return Response.json({ ok: true });
  });
}
