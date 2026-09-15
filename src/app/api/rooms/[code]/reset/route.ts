import { handle, requireSession } from "@/server/api";
import { resetRoom } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/reset">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    return Response.json(await resetRoom(session, code.toUpperCase()));
  });
}
