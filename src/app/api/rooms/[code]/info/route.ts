import { handle } from "@/server/api";
import { roomInfo } from "@/server/roomService";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[code]/info">) {
  return handle(async () => {
    const { code } = await ctx.params;
    return Response.json(await roomInfo(code.toUpperCase()));
  });
}
