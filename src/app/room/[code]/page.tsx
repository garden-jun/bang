"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameBoard } from "@/components/game/GameBoard";
import { ResultScreen } from "@/components/room/ResultScreen";
import { WaitingRoom } from "@/components/room/WaitingRoom";
import { Button, ErrorBanner, NicknameForm, Panel } from "@/components/ui";
import { useRoom } from "@/hooks/useRoom";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/api";
import type { RoomSummary } from "@/shared/types";

export default function RoomPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = String(raw).toUpperCase();
  const router = useRouter();
  const session = useSession();
  const [info, setInfo] = useState<RoomSummary | null | "missing">(null);
  const [member, setMember] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const room = useRoom(code, member);

  // 방 존재 확인 + 이미 참여 중이면 바로 폴링
  useEffect(() => {
    if (session.status !== "ready") return;
    api.roomInfo(code)
      .then((i) => {
        setInfo(i);
        if (session.info?.roomCode === code) setMember(true);
      })
      .catch(() => setInfo("missing"));
  }, [session.status, session.info?.roomCode, code]);

  const join = async (as: "player" | "spectator") => {
    setJoinError(null);
    try {
      await api.join(code, as);
      setMember(true);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "입장 실패");
    }
  };

  const leave = async () => {
    await room.leave().catch(() => {});
    router.push("/");
  };

  if (session.status === "loading") return <Center>불러오는 중…</Center>;

  if (session.status === "none") {
    return (
      <Center>
        <Panel title={`방 ${code}에 입장하려면 닉네임이 필요해요`} className="w-full max-w-sm">
          <NicknameForm initial={session.savedNickname} onSubmit={(n) => session.login(n)} />
        </Panel>
      </Center>
    );
  }

  if (info === "missing" || room.gone === "notFound") {
    return (
      <Center>
        <p className="mb-4">존재하지 않거나 닫힌 방입니다.</p>
        <Link href="/" className="underline">
          로비로
        </Link>
      </Center>
    );
  }

  if (room.gone === "notMember") {
    return (
      <Center>
        <p className="mb-4">방에서 나가졌습니다 (강퇴 또는 세션 만료).</p>
        <Link href="/" className="underline">
          로비로
        </Link>
      </Center>
    );
  }

  if (!member) {
    if (!info) return <Center>불러오는 중…</Center>;
    const full = info.players >= info.maxPlayers;
    const playing = info.status === "playing";
    return (
      <Center>
        <Panel title={`${info.hostNickname}의 방 · ${code}`} className="w-full max-w-sm">
          <p className="mb-4 text-sm text-white/60">
            플레이어 {info.players}/{info.maxPlayers} · {playing ? "게임 진행 중" : "대기 중"}
          </p>
          <ErrorBanner message={joinError} />
          <div className="mt-3 flex flex-col gap-2">
            <Button disabled={full || playing} onClick={() => join("player")}>
              플레이어로 참가{full ? " (가득 참)" : playing ? " (진행 중)" : ""}
            </Button>
            <Button variant="ghost" onClick={() => join("spectator")}>
              관전하기
            </Button>
            <Link href="/" className="text-center text-xs text-white/50 underline">
              로비로 돌아가기
            </Link>
          </div>
        </Panel>
      </Center>
    );
  }

  const view = room.view;
  if (!view) return <Center>방에 연결하는 중…</Center>;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-4">
      <div className="mb-3">
        <ErrorBanner message={room.error} onClose={room.clearError} />
      </div>
      {view.status === "waiting" && (
        <WaitingRoom
          view={view}
          onStart={room.start}
          onKick={room.kick}
          onAddBot={room.addBot}
          onRemoveBot={room.removeBot}
          onSettings={room.updateSettings}
          onSwitchSeat={room.join}
          onLeave={leave}
        />
      )}
      {view.status === "playing" && view.game && <GameBoard view={view} act={room.act} onLeave={leave} />}
      {view.status === "finished" && view.game && <ResultScreen view={view} onReset={room.reset} onLeave={leave} />}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center text-white/80">{children}</main>;
}
