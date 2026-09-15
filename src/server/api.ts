import { GameError } from "@/game/types";
import { getSession, type Session } from "./session";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession(req: Request): Promise<Session> {
  const s = await getSession(req.headers.get("x-player-token"));
  if (!s) throw new ApiError(401, "세션이 없습니다. 닉네임을 다시 입력해 주세요.");
  return s;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** 라우트 핸들러를 감싸 에러를 JSON 응답으로 바꾼다 */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof GameError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e);
    const msg = e instanceof Error ? e.message : "서버 오류";
    return Response.json({ error: msg }, { status: 500 });
  });
}
