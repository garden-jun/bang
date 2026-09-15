import { after } from "next/server";
import { handle, readJson, requireSession } from "@/server/api";
import { botShouldMove, runBots } from "@/server/botRunner";
import { addBot, removeBot } from "@/server/roomService";

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/bot">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    return Response.json(await addBot(session, code.toUpperCase()));
  });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/rooms/[code]/bot">) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await ctx.params;
    const { botId } = await readJson<{ botId?: string }>(req);
    const view = await removeBot(session, code.toUpperCase(), String(botId ?? ""));
    // 봇을 뺀 뒤 다음 차례가 또 봇일 수 있다
    if (botShouldMove(view)) after(() => runBots(view.code));
    return Response.json(view);
  });
}
