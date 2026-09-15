"use client";

import { CHARACTER_KO, ROLE_KO } from "@/game/i18n";
import type { PlayerView } from "@/game/view";
import { CardBack, CardFace } from "./CardFace";

export function Seat({
  player,
  name,
  isMe,
  isTurn,
  isResponder,
  connected,
  targetable,
  onTarget,
}: {
  player: PlayerView;
  name: string;
  isMe: boolean;
  isTurn: boolean;
  isResponder: boolean;
  connected: boolean;
  targetable: boolean;
  onTarget?: () => void;
}) {
  const ch = CHARACTER_KO[player.character];
  const ring = targetable
    ? "cursor-pointer ring-2 ring-red-500 hover:bg-red-900/30"
    : isTurn
      ? "ring-2 ring-amber-400"
      : isResponder
        ? "ring-2 ring-sky-400"
        : "ring-1 ring-white/10";

  return (
    <div
      onClick={targetable ? onTarget : undefined}
      className={`rounded-lg bg-black/30 p-2 text-xs transition ${ring} ${player.alive ? "" : "opacity-40 grayscale"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 truncate font-bold">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-green-400" : "bg-white/30"}`} />
          <span className={isMe ? "text-amber-300" : ""}>{name}</span>
        </span>
        {player.role && (
          <span className={`shrink-0 rounded px-1 ${player.role === "sheriff" ? "bg-amber-600 text-black" : "bg-white/15"}`}>
            {ROLE_KO[player.role]}
          </span>
        )}
      </div>
      <div className="mt-1 truncate text-white/70" title={ch.desc}>
        {ch.name}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-red-400" aria-label={`생명 ${player.hp}/${player.maxHp}`}>
          {"♥".repeat(Math.max(0, player.hp))}
          <span className="text-white/20">{"♥".repeat(Math.max(0, player.maxHp - player.hp))}</span>
        </span>
        <span className="ml-auto flex items-center gap-1 text-white/60">
          <CardBack size="sm" count={player.handCount} />
        </span>
      </div>
      {player.equipment.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {player.equipment.map((c) => (
            <CardFace key={c.id} card={c} size="sm" />
          ))}
        </div>
      )}
      {player.hand && !isMe && (
        <div className="mt-1 flex flex-wrap gap-1 border-t border-white/10 pt-1">
          {player.hand.map((c) => (
            <CardFace key={c.id} card={c} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
