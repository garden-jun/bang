import { handle, readJson, requireSession } from "@/server/api";
import { joinRoom } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const body = await readJson<{ as?: string }>(req);
    // 기본값은 "player" 그대로 — 대기실의 자리 바꾸기는 여전히 명시적으로 보낸다.
    const as = body.as === "spectator" ? "spectator" : body.as === "auto" ? "auto" : "player";
    return Response.json(await joinRoom(session, code.toUpperCase(), as));
  });
}
