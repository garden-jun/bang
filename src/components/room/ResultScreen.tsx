"use client";

import { Button, Panel } from "@/components/ui";
import { CHARACTER_KO, ROLE_KO } from "@/game/i18n";
import type { RoomView } from "@/shared/types";

const WINNER_KO = { sheriff: "보안관 진영", outlaws: "무법자", renegade: "배신자" } as const;

export function ResultScreen({ view, onReset, onLeave }: { view: RoomView; onReset: () => void; onLeave: () => void }) {
  const game = view.game!;
  const isHost = view.hostId === view.me.id;
  const winner = game.winner ? WINNER_KO[game.winner] : "?";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="text-center">
        <p className="text-sm text-white/60">게임 종료</p>
        <h1 className="text-3xl font-black text-amber-400">{winner} 승리!</h1>
      </header>

      <Panel title="역할 공개">
        <ul className="divide-y divide-white/10">
          {game.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span className={p.alive ? "" : "text-white/40 line-through"}>
                {game.names[p.id]}
                {p.id === view.me.id && <span className="ml-1 text-amber-300">(나)</span>}
              </span>
              <span className="text-white/70">
                {p.role ? ROLE_KO[p.role] : "?"} · {CHARACTER_KO[p.character].name}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="flex justify-center gap-2">
        {isHost ? (
          <Button onClick={onReset}>대기실로 (다시 하기)</Button>
        ) : (
          <p className="self-center text-sm text-white/50">방장이 다시 시작하기를 기다리는 중…</p>
        )}
        <Button variant="ghost" onClick={onLeave}>
          나가기
        </Button>
      </div>
    </div>
  );
}
