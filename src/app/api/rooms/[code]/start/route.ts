import { handle, requireSession } from "@/server/api";
import { startGame } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/start">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    return Response.json(await startGame(session, code.toUpperCase()));
  });
}
