"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameBoard } from "@/components/game/GameBoard";
import { ResultScreen } from "@/components/room/ResultScreen";
import { WaitingRoom } from "@/components/room/WaitingRoom";
import { Button, ErrorBanner, NicknameField, Panel } from "@/components/ui";
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
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** null이면 아직 손대지 않음 — 저장된 닉네임을 그대로 보여준다 */
  const [typedNick, setTypedNick] = useState<string | null>(null);

  // 이미 이 방에 참여 중이면 바로 폴링으로 들어간다
  const member = joined || (session.status === "ready" && session.info?.roomCode === code);
  const room = useRoom(code, member);

  // 방 정보는 세션이 없어도 볼 수 있다 — 초대 링크로 들어온 사람이
  // "여기가 무슨 방인지" 먼저 보고 닉네임을 정하도록.
  useEffect(() => {
    api.roomInfo(code)
      .then(setInfo)
      .catch(() => setInfo("missing"));
  }, [code]);

  const nick = typedNick ?? session.info?.nickname ?? session.savedNickname;
  const nickname = nick.trim();
  const ready = nickname.length >= 1 && nickname.length <= 12;

  /** 입장하는 순간에 세션을 만든다 (닉네임만 받는 화면을 따로 두지 않으려고) */
  const join = async (as: "player" | "spectator") => {
    if (!ready) return;
    setJoinError(null);
    setBusy(true);
    try {
      if (session.status !== "ready" || session.info?.nickname !== nickname) {
        await session.login(nickname);
      }
      await api.join(code, as);
      setJoined(true);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "입장 실패");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await room.leave().catch(() => {});
    router.push("/");
  };

  if (session.status === "loading") return <Center>불러오는 중…</Center>;

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
          <NicknameField value={nick} onChange={setTypedNick} disabled={busy} className="mt-3 justify-between" />
          <div className="mt-3 flex flex-col gap-2">
            <Button disabled={!ready || busy || full || playing} onClick={() => join("player")}>
              플레이어로 참가{full ? " (가득 참)" : playing ? " (진행 중)" : ""}
            </Button>
            <Button variant="ghost" disabled={!ready || busy} onClick={() => join("spectator")}>
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

  // 게임판은 페이지가 아니라 화면이다 — 스크롤 없이 한 화면에 들어와야 한다
  const playing = view.status === "playing" && !!view.game;

  return (
    <main className={`mx-auto w-full px-2 sm:px-4 ${playing ? "max-w-7xl py-2" : "max-w-6xl py-4"}`}>
      <div className={room.error ? "mb-2" : ""}>
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
      {playing && <GameBoard view={view} act={room.act} onLeave={leave} />}
      {view.status === "finished" && view.game && <ResultScreen view={view} onReset={room.reset} onLeave={leave} />}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center text-white/80">{children}</main>;
}
