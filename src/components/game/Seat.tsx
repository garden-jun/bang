"use client";

import { CHARACTER_KO, ROLE_KO } from "@/game/i18n";
import type { Card, CardName, CharacterName } from "@/game/types";
import type { PlayerView } from "@/game/view";
import type { SeatEffect } from "@/hooks/useGameEvents";
import { CardBack, CardFace } from "./CardFace";

/**
 * 장착 카드 없이도 늘 가지고 있는 효과. 좌석에 안 보이면 "머스탱도 없는데 왜 거리가 2지?"가 된다.
 */
const INNATE: Partial<Record<CharacterName, CardName>> = {
  paulRegret: "mustang",
  jourdonnais: "barrel",
  roseDoolan: "scope",
};

export function Seat({
  player,
  name,
  isMe,
  isActive,
  connected,
  isBot,
  distance,
  inRange,
  targetable,
  effect,
  onTarget,
  onHover,
  onCardHover,
}: {
  player: PlayerView;
  name: string;
  isMe: boolean;
  /** 지금 이 사람이 행동/응답할 차례 */
  isActive: boolean;
  connected: boolean;
  isBot?: boolean;
  /** 나로부터의 거리 (나 자신이면 undefined) */
  distance?: number;
  /** 내 무기 사거리 안 — 조준 중이 아니어도 항상 보여준다 */
  inRange?: boolean;
  /** 지금 고른 카드의 대상이 될 수 있음 */
  targetable: boolean;
  effect?: SeatEffect;
  onTarget?: () => void;
  /** 도움말: 마우스를 올리면 설명 줄에 이 좌석 설명을 띄운다 */
  onHover?: (on: boolean) => void;
  /** 도움말: 좌석에 깔린 카드에 마우스를 올렸을 때 (ghost는 장착이 아니라 캐릭터 능력) */
  onCardHover?: (card: Card | null, ghost?: boolean) => void;
}) {
  const ch = CHARACTER_KO[player.character];
  const dead = !player.alive;
  const innate = INNATE[player.character];
  const innateCard: Card | null = innate ? { id: `innate-${player.id}`, name: innate, suit: "S", rank: 1 } : null;

  /**
   * 카드에서 마우스가 빠질 때 좌석 설명을 되살린다 — 커서는 아직 좌석 안이라
   * 좌석의 mouseleave가 오지 않는다. 그냥 지우면 설명 줄이 빈 채로 남는다.
   */
  const cardHover = (c: Card, ghost?: boolean) =>
    onCardHover
      ? (on: boolean) => {
          onCardHover(on ? c : null, ghost);
          if (!on) onHover?.(true);
        }
      : undefined;

  const anim =
    effect?.kind === "hit" ? "anim-hit anim-flash-hit" : effect?.kind === "heal" ? "anim-flash-heal" : effect?.kind === "death" ? "anim-death" : "";

  const ring = targetable
    ? "ring-2 ring-red-500 bg-red-950/40 cursor-pointer hover:bg-red-900/50 hover:scale-[1.03]"
    : isActive
      ? "anim-active bg-black/50"
      : "ring-1 ring-white/10 bg-black/40";

  // 사거리 밖은 흐리게 — "누굴 쏠 수 있나"가 카드를 들기 전에 보여야 한다
  const reach = dead || isMe || inRange === undefined ? "" : inRange ? "" : "opacity-45";

  return (
    <div
      key={effect?.key}
      // 손패에서 날아가는 카드가 이 좌석을 도착지로 찾는다 (FlyAway)
      data-seat={player.id}
      onClick={targetable ? onTarget : undefined}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      className={`${anim} ${ring} ${reach} ${dead ? "grayscale" : ""} relative w-full rounded-xl border border-white/10 p-1.5 text-[9px]
        backdrop-blur-sm transition sm:p-2 sm:text-[11px]`}
    >
      <div className="flex items-center gap-1">
        {!isBot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-green-400" : "bg-white/25"}`} />}
        {isBot && <span className="shrink-0 rounded bg-sky-800/80 px-1 text-[8px] font-bold text-sky-200">AI</span>}
        <span className={`truncate font-bold ${isMe ? "text-amber-300" : ""}`}>{name}</span>
        {player.role && (
          <span
            className={`ml-auto shrink-0 rounded px-1 text-[9px] font-bold ${
              player.role === "sheriff" ? "bg-amber-500 text-black" : "bg-white/15 text-white/80"
            }`}
          >
            {ROLE_KO[player.role]}
          </span>
        )}
        {!player.role && distance !== undefined && !dead && (
          <span
            className={`ml-auto shrink-0 rounded px-1 text-[9px] font-mono ${inRange ? "bg-amber-500/25 text-amber-200" : "bg-white/10 text-white/40"}`}
            title={`거리 ${distance}${inRange ? " — 사거리 안" : " — 사거리 밖"}`}
          >
            {distance}
          </span>
        )}
      </div>

      <div className="mt-0.5 truncate text-white/55" title={ch.desc}>
        {ch.name}
      </div>

      <div className="mt-1 flex items-center gap-1">
        <span className="tracking-tighter" aria-label={`생명 ${player.hp}/${player.maxHp}`}>
          <span className="text-red-500">{"♥".repeat(Math.max(0, player.hp))}</span>
          <span className="text-white/15">{"♥".repeat(Math.max(0, player.maxHp - player.hp))}</span>
        </span>
        <span className="ml-auto flex items-center gap-0.5 text-white/50">
          <CardBack size="xs" count={player.handCount} />
        </span>
      </div>

      {/* 막았다! — 맞았을 때만 연출이 있고 막았을 땐 아무것도 없던 걸 채운다 */}
      {effect?.kind === "dodge" && (
        <div key={effect.key} className="anim-badge pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-black text-white shadow-lg ring-2 ring-white/60">
          빗나감!
        </div>
      )}

      {(player.equipment.length > 0 || innate) && (
        <div className="mt-1 flex flex-wrap gap-0.5" data-equip={player.id}>
          {player.equipment.map((c) => (
            <CardFace key={c.id} card={c} size="xs" onHover={cardHover(c)} />
          ))}
          {/* 같은 이름의 진짜 카드를 이미 장착했으면 중복해서 보여주지 않는다 */}
          {innateCard && !player.equipment.some((c) => c.name === innateCard.name) && (
            <CardFace card={innateCard} size="xs" ghost onHover={cardHover(innateCard, true)} />
          )}
        </div>
      )}

      {/* 전체 공개 관전 */}
      {player.hand && !isMe && (
        <div className="mt-1 flex flex-wrap gap-0.5 border-t border-white/10 pt-1">
          {player.hand.map((c) => (
            <CardFace key={c.id} card={c} size="xs" onHover={cardHover(c)} />
          ))}
        </div>
      )}
    </div>
  );
}
