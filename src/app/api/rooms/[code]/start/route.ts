import { after } from "next/server";
import { handle, requireSession } from "@/server/api";
import { botShouldMove, runBots } from "@/server/botRunner";
import { startGame } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/start">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const view = await startGame(session, code.toUpperCase());
    if (botShouldMove(view)) after(() => runBots(view.code));
    return Response.json(view);
  });
}
