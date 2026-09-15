import type { Action } from "@/game/types";
import { ApiError, handle, readJson, requireSession } from "@/server/api";
import { doAction } from "@/server/roomService";

const ACTION_TYPES = new Set(["draw", "pickCards", "play", "respond", "endTurn", "discard", "ability"]);

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/action">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const body = await readJson<Partial<Action>>(req);
    if (!body.type || !ACTION_TYPES.has(body.type)) throw new ApiError(400, "잘못된 액션입니다.");
    return Response.json(await doAction(session, code.toUpperCase(), body as Action));
  });
}
