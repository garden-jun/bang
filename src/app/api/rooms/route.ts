import { handle, readJson, requireSession } from "@/server/api";
import { createRoom, listRooms } from "@/server/roomService";
import type { RoomSettings } from "@/shared/types";

export async function GET() {
  return handle(async () => Response.json(await listRooms()));
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const body = await readJson<Partial<RoomSettings>>(req);
    return Response.json(await createRoom(session, body));
  });
}
