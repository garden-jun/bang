"use client";

import { CHARACTER_KO, ROLE_KO } from "@/game/i18n";
import type { Card, CardName, CharacterName } from "@/game/types";
import type { PlayerView } from "@/game/view";
import type { SeatBadge, SeatEffect } from "@/hooks/useGameEvents";
import { CardFace, CardIcon } from "./CardFace";

/**
 * 장착 카드 없이도 늘 가지고 있는 효과. 좌석에 안 보이면 "머스탱도 없는데 왜 거리가 2지?"가 된다.
 */
const INNATE: Partial<Record<CharacterName, CardName>> = {
  paulRegret: "mustang",
  jourdonnais: "barrel",
  roseDoolan: "scope",
};

const BADGE: Record<SeatBadge["kind"], { text: string; tone: string }> = {
  dodge: { text: "빗나감!", tone: "bg-sky-500" },
  escape: { text: "탈출!", tone: "bg-emerald-500" },
  skip: { text: "턴 건너뜀", tone: "bg-stone-500" },
  explode: { text: "💥 폭발! -3", tone: "bg-orange-600" },
};

/** 감옥 창살 — 좌석 위에 겹친다. 누르거나 올리는 건 아래 좌석이 받아야 해서 포인터를 통과시킨다 */
const BARS = "repeating-linear-gradient(90deg, transparent 0 16px, rgba(203,213,225,0.5) 16px 19px, rgba(15,23,42,0.35) 19px 20px)";

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
  badge,
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
  badge?: SeatBadge;
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
  const jailed = !dead && player.equipment.some((c) => c.name === "jail");
  const dynamite = !dead && player.equipment.some((c) => c.name === "dynamite");
  // 감옥 카드는 판정 순간 이미 버려져 있다 — 결과 배지가 뜰 때 창살이 떨어져 나가는 장면을 따로 그린다
  const barsFalling = !jailed && (badge?.kind === "escape" || badge?.kind === "skip");

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
    // 바깥은 고정, 안쪽 상자만 key로 갈아끼워 흔들림을 다시 건다. 배지처럼 한 번만 재생할
    // 연출을 안쪽에 두면 뒤따르는 "피해" 흔들림이 상자를 갈아끼울 때 처음부터 다시 재생된다.
    <div
      // 손패에서 날아가는 카드가 이 좌석을 도착지로 찾는다 (FlyAway)
      data-seat={player.id}
      onClick={targetable ? onTarget : undefined}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      className="relative w-full"
    >
      <div
        key={effect?.key}
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
          {/* 손패 수 — 카드 뒷면을 통째로 그리면 좌석 높이의 절반을 먹어 좌석끼리 겹쳤다 */}
          <span className="ml-auto flex items-center gap-1 font-bold text-white/80" title={`손패 ${player.handCount}장`}>
            <span className="h-3.5 w-2.5 rounded-sm border border-red-950 bg-[repeating-linear-gradient(45deg,#7f1d1d_0_2px,#9f1239_2px_4px)]" />
            {player.handCount}
          </span>
        </div>

        {jailed && (
          <>
            <div className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-slate-950/30" style={{ backgroundImage: BARS }} />
            <div
              className="absolute -left-1.5 -top-2 z-20 flex items-center gap-0.5 rounded-full bg-slate-300 px-1.5 py-px text-[9px] font-black text-slate-900 shadow ring-1 ring-black/40"
              title="감옥 — 턴 시작에 ♥가 나오면 탈출, 아니면 턴을 건너뜁니다"
            >
              <CardIcon name="jail" className="h-2.5 w-2.5" />
              감옥
            </div>
          </>
        )}

        {dynamite && (
          <div
            className="absolute -right-1.5 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white shadow ring-1 ring-black/40"
            title="다이너마이트 — 턴 시작에 ♠2~9가 나오면 폭발(생명 -3, 약 15%), 아니면 다음 사람에게 넘어갑니다"
          >
            <CardIcon name="dynamite" className="h-3 w-3" />
            <span className="anim-fuse absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-yellow-300" />
          </div>
        )}

        {(player.equipment.length > 0 || innate) && (
          <div className="mt-1 flex flex-wrap gap-0.5" data-equip={player.id}>
            {player.equipment.map((c) => (
              <CardFace key={c.id} card={c} size="chip" onHover={cardHover(c)} />
            ))}
            {/* 같은 이름의 진짜 카드를 이미 장착했으면 중복해서 보여주지 않는다 */}
            {innateCard && !player.equipment.some((c) => c.name === innateCard.name) && (
              <CardFace card={innateCard} size="chip" ghost onHover={cardHover(innateCard, true)} />
            )}
          </div>
        )}

        {/* 전체 공개 관전 */}
        {player.hand && !isMe && (
          <div className="mt-1 flex flex-wrap gap-0.5 border-t border-white/10 pt-1">
            {player.hand.map((c) => (
              <CardFace key={c.id} card={c} size="chip" onHover={cardHover(c)} />
            ))}
          </div>
        )}
      </div>

      {/* 형제끼리 key가 겹치면 안쪽 상자의 key가 바뀔 때(피해 흔들림) React가 둘 다 새로 만들어
          연출이 처음부터 다시 재생된다 — 창살과 배지는 접두사로 key를 가른다 */}
      {barsFalling && (
        <div key={`bars-${badge.key}`} className="anim-bars-fall pointer-events-none absolute inset-0 z-10 rounded-xl" style={{ backgroundImage: BARS }} />
      )}
      {/* 막았다·탈출·폭발 — 맞았을 때만 연출이 있고 나머지는 아무것도 없던 걸 채운다 */}
      {badge && (
        <div key={`badge-${badge.key}`} className="pointer-events-none absolute inset-0 z-30">
          {badge.kind === "explode" && <div className="anim-explode absolute inset-0 rounded-xl" />}
          <div
            className={`anim-badge absolute -top-2 left-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow-lg ring-2 ring-white/60 ${BADGE[badge.kind].tone}`}
          >
            {BADGE[badge.kind].text}
          </div>
        </div>
      )}
    </div>
  );
}
