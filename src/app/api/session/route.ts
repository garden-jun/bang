import { ApiError, handle, readJson } from "@/server/api";
import { createSession, getSession, normalizeNickname, renameSession } from "@/server/session";
import { currentRoomOf } from "@/server/roomService";
import type { SessionInfo } from "@/shared/types";

/** 세션 조회 (복귀용). 토큰이 없거나 만료면 401 */
export async function GET(req: Request) {
  return handle(async () => {
    const s = await getSession(req.headers.get("x-player-token"));
    if (!s) throw new ApiError(401, "세션 없음");
    const roomCode = (await currentRoomOf(s)) ?? undefined;
    const info: SessionInfo = { playerId: s.playerId, nickname: s.nickname, roomCode };
    return Response.json(info);
  });
}

/** 세션 생성 또는 닉네임 변경 */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ nickname?: string }>(req);
    let nickname: string;
    try {
      nickname = normalizeNickname(body.nickname);
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    const existing = await getSession(req.headers.get("x-player-token"));
    const s = existing ? await renameSession(existing, nickname) : await createSession(nickname);
    return Response.json({ token: s.token, playerId: s.playerId, nickname: s.nickname });
  });
}
