"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ErrorBanner, Input, NicknameField, Panel } from "@/components/ui";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/api";
import { DEFAULT_SETTINGS, type RoomSettings, type RoomSummary } from "@/shared/types";

export default function LobbyPage() {
  const router = useRouter();
  const session = useSession();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [code, setCode] = useState("");
  /** null이면 아직 손대지 않음 — 저장된 닉네임을 그대로 보여준다 */
  const [typedNick, setTypedNick] = useState<string | null>(null);
  const nick = typedNick ?? session.info?.nickname ?? session.savedNickname;

  // 로비를 켜둔 채 방치하는 탭이 흔해서, 짧은 주기로 돌리면 그것만으로 무료 티어가 녹는다.
  // 30초 주기 + 탭이 숨겨져 있으면 정지, 필요하면 수동 새로고침.
  const loadRooms = useCallback(async () => {
    try {
      setRooms(await api.listRooms());
    } catch {
      /* 목록은 실패해도 조용히 둔다 */
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void loadRooms();
    };
    // 마운트 후 비동기로 첫 로드 (렌더 중 동기 setState 방지)
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [loadRooms]);

  const nickname = nick.trim();
  const ready = nickname.length >= 1 && nickname.length <= 12;

  /**
   * 방을 만들거나 들어가는 순간에 세션을 만든다 — 닉네임만 받는 별도 화면을
   * 두지 않으려고. 닉네임이 바뀌었으면 같은 호출이 이름을 갱신한다.
   */
  const go = (fn: () => Promise<void>) => async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      if (session.status !== "ready" || session.info?.nickname !== nickname) {
        await session.login(nickname);
      }
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const createRoom = go(async () => {
    const r = await api.createRoom(settings);
    router.push(`/room/${r.code}`);
  });

  const enter = (target: string) => go(async () => router.push(`/room/${target}`));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-amber-400">BANG!</h1>
          <p className="text-xs text-white/60">친구들과 브라우저로 즐기는 서부 총잡이 카드 게임</p>
        </div>
        <NicknameField value={nick} onChange={setTypedNick} disabled={busy} />
      </header>

      <div className="mb-4">
        <ErrorBanner message={error} onClose={() => setError(null)} />
      </div>

      {session.info?.roomCode && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-sm">
          <span>
            참여 중인 방 <b>{session.info.roomCode}</b>이(가) 있습니다.
          </span>
          <Button onClick={() => router.push(`/room/${session.info!.roomCode}`)}>복귀</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="방 만들기">
          <Button className="w-full" disabled={!ready || busy} onClick={createRoom}>
            새 방 만들기
          </Button>
          {/* 기본값이 이미 무난하고, 대기실에서 방장이 언제든 바꿀 수 있다 */}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-white/50 hover:text-white/80">설정 바꾸기</summary>
            <div className="mt-3 space-y-3 text-sm">
              <label className="flex items-center justify-between">
                <span>최대 인원</span>
                <select
                  className="rounded border border-white/20 bg-black/30 px-2 py-1"
                  value={settings.maxPlayers}
                  onChange={(e) => setSettings({ ...settings, maxPlayers: Number(e.target.value) })}
                >
                  {[4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}명
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between">
                <span>턴 제한시간</span>
                <select
                  className="rounded border border-white/20 bg-black/30 px-2 py-1"
                  value={settings.turnSeconds}
                  onChange={(e) => setSettings({ ...settings, turnSeconds: Number(e.target.value) })}
                >
                  {[30, 45, 60, 90, 120].map((n) => (
                    <option key={n} value={n}>
                      {n}초
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between">
                <span>관전자에게</span>
                <select
                  className="rounded border border-white/20 bg-black/30 px-2 py-1"
                  value={settings.spectatorMode}
                  onChange={(e) => setSettings({ ...settings, spectatorMode: e.target.value as RoomSettings["spectatorMode"] })}
                >
                  <option value="public">공개 정보만</option>
                  <option value="all">손패·역할 전부</option>
                </select>
              </label>
              <label className="flex items-center justify-between">
                <span>공개 목록에 표시</span>
                <input
                  type="checkbox"
                  checked={settings.isPublic}
                  onChange={(e) => setSettings({ ...settings, isPublic: e.target.checked })}
                />
              </label>
            </div>
          </details>
        </Panel>

        <Panel title="코드로 입장">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length === 6) void enter(c)();
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="6자리 코드"
              className="flex-1 font-mono tracking-widest"
            />
            <Button type="submit" variant="ghost" disabled={!ready || busy || code.trim().length !== 6}>
              입장
            </Button>
          </form>
          <p className="mt-2 text-xs text-white/40">비공개 방은 코드로만 들어갈 수 있어요.</p>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title={
          <span className="flex items-center justify-between">
            공개 방
            <button className="font-normal normal-case text-white/50 underline hover:text-white" onClick={() => void loadRooms()}>
              새로고침
            </button>
          </span>
        }
      >
        {rooms.length === 0 ? (
          <p className="text-sm text-white/40">열린 방이 없습니다. 하나 만들어 보세요!</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {rooms.map((r) => (
              <li key={r.code} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-mono text-amber-300">{r.code}</span>
                  <span className="ml-3 text-white/80">{r.hostNickname}의 방</span>
                  <span className="ml-3 text-white/50">
                    {r.players}/{r.maxPlayers}
                  </span>
                  {r.status === "playing" && <span className="ml-2 rounded bg-red-800 px-1.5 py-0.5 text-xs">진행 중</span>}
                </div>
                <Button variant="ghost" disabled={!ready || busy} onClick={enter(r.code)}>
                  {r.status === "playing" ? "관전" : "입장"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!ready && <p className="mt-3 text-xs text-amber-300/70">닉네임을 입력하면 방을 만들거나 들어갈 수 있어요.</p>}
      </Panel>
    </main>
  );
}
