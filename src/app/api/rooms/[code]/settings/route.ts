import { handle, readJson, requireSession } from "@/server/api";
import { updateSettings } from "@/server/roomService";
import type { RoomSettings } from "@/shared/types";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/settings">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const body = await readJson<Partial<RoomSettings>>(req);
    return Response.json(await updateSettings(session, code.toUpperCase(), body));
  });
}
