"use client";

import { isEquipment, isWeapon } from "@/game/cards";
import { CARD_KO, SUIT_SYMBOL } from "@/game/i18n";
import type { Card, CardName } from "@/game/types";

const RANK: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

/**
 * 카드 아이콘. 11px 글씨를 읽어야 뱅!과 빗나감!을 구분하던 문제 때문에,
 * 흘끗 봐도 갈라지는 모양을 하나씩 준다.
 */
function CardIcon({ name, className = "" }: { name: CardName; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<CardName, React.ReactNode> = {
    // 총알이 날아가는 모양
    bang: <><circle cx="6" cy="12" r="2.5" {...p} /><path d="M9 12h10M15 9l4 3-4 3" {...p} /></>,
    // 방패
    missed: <path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6z" {...p} />,
    // 맥주잔
    beer: <><path d="M6 7h10v13H6zM16 10h3v5h-3" {...p} /><path d="M8 4c1.5 1.5 2.5 1.5 4 0s2.5-1.5 4 0" {...p} /></>,
    // 손이 카드를 낚아챔
    panic: <><rect x="4" y="7" width="8" height="11" rx="1" {...p} /><path d="M13 12h7M17 9l3 3-3 3" {...p} /></>,
    // 카드가 버려짐
    catBalou: <><rect x="4" y="6" width="8" height="11" rx="1" {...p} /><path d="M15 9l5 6M20 9l-5 6" {...p} /></>,
    // 마차 바퀴 둘
    stagecoach: <><circle cx="8" cy="16" r="3.5" {...p} /><circle cx="17" cy="16" r="3.5" {...p} /><path d="M4 10h14l2 3" {...p} /></>,
    wellsFargo: <><circle cx="7" cy="16" r="3" {...p} /><circle cx="17" cy="16" r="3" {...p} /><path d="M3 9h15l3 4" {...p} /><path d="M10 5h4" {...p} /></>,
    // 진열대
    generalStore: <><path d="M4 9h16v11H4zM4 9l2-4h12l2 4" {...p} /><path d="M10 20v-6h4v6" {...p} /></>,
    // 화살 여러 발
    indians: <><path d="M4 20L20 4M20 4h-6M20 4v6" {...p} /><path d="M4 12l8-8M4 12h5M4 12v-5" {...p} /></>,
    // 마주 선 두 사람
    duel: <><path d="M7 4v16M17 4v16" {...p} /><path d="M9 12h6M13 10l2 2-2 2" {...p} /></>,
    // 여러 총구
    gatling: <><circle cx="8" cy="12" r="4" {...p} /><path d="M12 9h9M12 12h9M12 15h9" {...p} /></>,
    // 술집 문
    saloon: <><path d="M4 4h16v16H4z" {...p} /><path d="M12 4v16M8 12h1M15 12h1" {...p} /></>,
    // 통
    barrel: <><path d="M7 5h10c1 3 1 11 0 14H7c-1-3-1-11 0-14z" {...p} /><path d="M5 10h14M5 14h14" {...p} /></>,
    // 조준경
    scope: <><circle cx="12" cy="12" r="6" {...p} /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" {...p} /></>,
    // 말
    mustang: <><path d="M6 20V12l3-4 4-3 2 3h3l-2 4v8" {...p} /><path d="M9 20v-4M16 20v-4" {...p} /></>,
    // 창살
    jail: <><rect x="4" y="4" width="16" height="16" rx="1" {...p} /><path d="M9 4v16M15 4v16" {...p} /></>,
    // 도화선 붙은 다발
    dynamite: <><rect x="5" y="9" width="12" height="11" rx="1" {...p} /><path d="M11 9V6c0-1.5 1.5-2 2.5-1M17 12h3" {...p} /></>,
    // 무기 — 총열 길이로 사거리를 암시
    volcanic: <><path d="M4 11h9v4H6z" {...p} /><path d="M13 12h3" {...p} /></>,
    schofield: <><path d="M4 11h11v4H6z" {...p} /><path d="M15 12h3" {...p} /></>,
    remington: <><path d="M3 11h14v3H5z" {...p} /><path d="M17 12h4" {...p} /></>,
    carabine: <><path d="M3 11h16v3H5z" {...p} /><path d="M19 12h2" {...p} /></>,
    winchester: <><path d="M2 11h18v3H4z" {...p} /><path d="M20 12h2" {...p} /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function CardFace({
  card,
  size = "md",
  selected,
  disabled,
  dimmed,
  onClick,
  onHover,
  title,
}: {
  card: Card;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  /** 낼 수는 있지만 지금 주목 대상이 아닐 때 (예: 다른 카드를 조준 중) */
  dimmed?: boolean;
  onClick?: () => void;
  onHover?: (on: boolean) => void;
  title?: string;
}) {
  const red = card.suit === "H" || card.suit === "D";
  const kind = isWeapon(card.name) ? "weapon" : isEquipment(card.name) ? "equip" : "action";
  const tone = {
    action: "border-amber-600/60 bg-gradient-to-b from-amber-50 to-amber-200 text-amber-950",
    equip: "border-sky-600/60 bg-gradient-to-b from-sky-50 to-sky-200 text-sky-950",
    weapon: "border-stone-500/70 bg-gradient-to-b from-stone-100 to-stone-300 text-stone-900",
  }[kind];
  const dims = {
    xs: "h-11 w-8 p-0.5",
    sm: "h-16 w-11 p-1",
    md: "h-24 w-[4.25rem] p-1.5",
    lg: "h-28 w-20 p-2",
  }[size];
  const icon = { xs: "h-4 w-4", sm: "h-6 w-6", md: "h-9 w-9", lg: "h-11 w-11" }[size];
  const nameSize = { xs: "text-[8px]", sm: "text-[10px]", md: "text-xs", lg: "text-sm" }[size];
  const info = CARD_KO[card.name];
  const interactive = !!onClick && !disabled;

  return (
    <button
      type="button"
      title={title ?? `${info.name} — ${info.desc}`}
      disabled={disabled || !onClick}
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      className={`relative flex ${dims} shrink-0 flex-col items-center justify-between rounded-lg border-2 font-bold shadow-md transition-transform
        ${tone}
        ${selected ? "-translate-y-3 ring-4 ring-amber-400" : ""}
        ${disabled ? "opacity-35 saturate-50" : dimmed ? "opacity-55" : ""}
        ${interactive ? "cursor-pointer hover:-translate-y-2 hover:shadow-xl" : "cursor-default"}`}
    >
      <span className={`self-start leading-none ${nameSize} ${red ? "text-red-600" : "text-black/70"}`}>
        {SUIT_SYMBOL[card.suit]}
        {RANK[card.rank] ?? card.rank}
      </span>
      <CardIcon name={card.name} className={`${icon} opacity-80`} />
      <span className={`w-full break-keep text-center leading-tight ${nameSize}`}>{info.name}</span>
    </button>
  );
}

export function CardBack({ size = "sm", count }: { size?: "xs" | "sm" | "md"; count?: number }) {
  const dims = { xs: "h-11 w-8 text-[10px]", sm: "h-16 w-11 text-sm", md: "h-24 w-[4.25rem] text-lg" }[size];
  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-lg border-2 border-red-950 bg-[repeating-linear-gradient(45deg,#7f1d1d_0_5px,#9f1239_5px_10px)] font-black text-white/90 shadow-md`}
    >
      {count ?? ""}
    </div>
  );
}
