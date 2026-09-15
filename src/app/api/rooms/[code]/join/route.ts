import { handle, readJson, requireSession } from "@/server/api";
import { joinRoom } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const body = await readJson<{ as?: string }>(req);
    const as = body.as === "spectator" ? "spectator" : "player";
    return Response.json(await joinRoom(session, code.toUpperCase(), as));
  });
}
