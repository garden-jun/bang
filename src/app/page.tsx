"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorBanner, Input, NicknameForm, Panel } from "@/components/ui";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/api";
import { DEFAULT_SETTINGS, type RoomSettings, type RoomSummary } from "@/shared/types";

export default function LobbyPage() {
  const router = useRouter();
  const session = useSession();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingNick, setEditingNick] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [code, setCode] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () => api.listRooms().then((r) => alive && setRooms(r)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const needNick = session.status === "none" || editingNick;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-black tracking-tight text-amber-400">BANG!</h1>
        <p className="mt-1 text-sm text-white/60">친구들과 브라우저로 즐기는 서부 총잡이 카드 게임</p>
      </header>

      <div className="mb-4">
        <ErrorBanner message={error} onClose={() => setError(null)} />
      </div>

      {session.status === "loading" ? (
        <p className="text-center text-white/50">불러오는 중…</p>
      ) : needNick ? (
        <Panel title="닉네임">
          <NicknameForm
            initial={session.info?.nickname ?? session.savedNickname}
            busy={busy}
            onSubmit={(n) =>
              run(async () => {
                await session.login(n);
                setEditingNick(false);
              })
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              안녕하세요, <b className="text-amber-300">{session.info?.nickname}</b> 님
            </span>
            <button className="text-white/50 underline hover:text-white" onClick={() => setEditingNick(true)}>
              닉네임 변경
            </button>
          </div>

          {session.info?.roomCode && (
            <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-sm">
              <span>
                참여 중인 방 <b>{session.info.roomCode}</b>이(가) 있습니다.
              </span>
              <Button onClick={() => router.push(`/room/${session.info!.roomCode}`)}>복귀</Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Panel title="방 만들기">
              <div className="space-y-3 text-sm">
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
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await api.createRoom(settings);
                      router.push(`/room/${r.code}`);
                    })
                  }
                >
                  방 만들기
                </Button>
              </div>
            </Panel>

            <Panel title="코드로 입장">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const c = code.trim().toUpperCase();
                  if (c.length === 6) router.push(`/room/${c}`);
                }}
              >
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="6자리 코드"
                  className="flex-1 font-mono tracking-widest"
                />
                <Button type="submit" variant="ghost" disabled={code.trim().length !== 6}>
                  입장
                </Button>
              </form>
              <p className="mt-2 text-xs text-white/40">비공개 방은 코드로만 들어갈 수 있어요.</p>
            </Panel>
          </div>

          <Panel title="공개 방">
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
                    <Button variant="ghost" onClick={() => router.push(`/room/${r.code}`)}>
                      {r.status === "playing" ? "관전" : "입장"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </main>
  );
}
