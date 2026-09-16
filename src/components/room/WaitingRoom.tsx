"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/ui";
import { MIN_PLAYERS } from "@/game/roles";
import type { RoomSettings, RoomView } from "@/shared/types";

export function WaitingRoom({
  view,
  onStart,
  onKick,
  onAddBot,
  onRemoveBot,
  onSettings,
  onSwitchSeat,
  onLeave,
}: {
  view: RoomView;
  onStart: () => void;
  onKick: (id: string) => void;
  onAddBot: () => void;
  onRemoveBot: (id: string) => void;
  onSettings: (s: Partial<RoomSettings>) => void;
  onSwitchSeat: (as: "player" | "spectator") => void;
  onLeave: () => void;
}) {
  const isHost = view.hostId === view.me.id;
  const [copied, setCopied] = useState(false);
  const canStart = view.players.length >= MIN_PLAYERS;
  const full = view.players.length >= view.settings.maxPlayers;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 불가 */
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-amber-400">
            대기실 <span className="font-mono text-white">{view.code}</span>
          </h1>
          <p className="text-xs text-white/50">{view.settings.isPublic ? "공개 방" : "비공개 방"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => copy(view.code)}>
            {copied ? "복사됨!" : "코드 복사"}
          </Button>
          <Button variant="ghost" onClick={() => copy(`${location.origin}/room/${view.code}`)}>
            초대 링크
          </Button>
          <Button variant="danger" onClick={onLeave}>
            나가기
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title={`플레이어 ${view.players.length}/${view.settings.maxPlayers}`} className="md:col-span-2">
          <ul className="space-y-1">
            {view.players.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-white/5">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${p.connected ? "bg-green-400" : "bg-white/20"}`} />
                  <span className={p.id === view.me.id ? "font-bold text-amber-300" : ""}>{p.nickname}</span>
                  {p.isBot && <span className="rounded bg-sky-800/70 px-1.5 text-xs text-sky-200">AI</span>}
                  {p.id === view.hostId && <span className="rounded bg-amber-700/60 px-1.5 text-xs">방장</span>}
                </span>
                {isHost && p.id !== view.me.id && (
                  <button
                    className="text-xs text-red-300/70 hover:text-red-200"
                    onClick={() => (p.isBot ? onRemoveBot(p.id) : onKick(p.id))}
                  >
                    {p.isBot ? "빼기" : "강퇴"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {view.spectators.length > 0 && (
            <p className="mt-3 text-xs text-white/50">관전: {view.spectators.map((s) => s.nickname).join(", ")}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {view.me.seat === "player" ? (
              <Button variant="ghost" onClick={() => onSwitchSeat("spectator")}>
                관전으로 전환
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => onSwitchSeat("player")} disabled={full}>
                플레이어로 참가
              </Button>
            )}
            {isHost && (
              <Button variant="ghost" onClick={onAddBot} disabled={full}>
                AI 봇 추가
              </Button>
            )}
            {isHost && (
              <Button onClick={onStart} disabled={!canStart}>
                {canStart ? "게임 시작" : `${MIN_PLAYERS}명 이상 필요`}
              </Button>
            )}
          </div>
          {!isHost && <p className="mt-3 text-xs text-white/50">방장이 시작하기를 기다리는 중…</p>}
        </Panel>

        <Panel title="설정">
          <div className="space-y-3 text-sm">
            <Row label="최대 인원">
              {isHost ? (
                <select
                  className="rounded border border-white/20 bg-black/30 px-2 py-1"
                  value={view.settings.maxPlayers}
                  onChange={(e) => onSettings({ maxPlayers: Number(e.target.value) })}
                >
                  {[4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}명
                    </option>
                  ))}
                </select>
              ) : (
                `${view.settings.maxPlayers}명`
              )}
            </Row>
            <Row label="턴 시간">
              {isHost ? (
                <select
                  className="rounded border border-white/20 bg-black/30 px-2 py-1"
                  value={view.settings.turnSeconds}
                  onChange={(e) => onSettings({ turnSeconds: Number(e.target.value) })}
                >
                  {[30, 45, 60, 90, 120].map((n) => (
                    <option key={n} value={n}>
                      {n}초
                    </option>
                  ))}
                </select>
              ) : (
                `${view.settings.turnSeconds}초`
              )}
            </Row>
            <Row label="방 공개 여부">
              {isHost ? (
                <input type="checkbox" checked={view.settings.isPublic} onChange={(e) => onSettings({ isPublic: e.target.checked })} />
              ) : view.settings.isPublic ? (
                "표시"
              ) : (
                "숨김"
              )}
            </Row>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/70">{label}</span>
      <span>{children}</span>
    </div>
  );
}
