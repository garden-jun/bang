import { ApiError, handle, readJson, requireSession } from "@/server/api";
import { kickPlayer } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/kick">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const body = await readJson<{ playerId?: string }>(req);
    if (!body.playerId) throw new ApiError(400, "대상을 지정하세요.");
    return Response.json(await kickPlayer(session, code.toUpperCase(), body.playerId));
  });
}
