"use client";

import { isEquipment, isWeapon } from "@/game/cards";
import { CARD_KO, SUIT_SYMBOL } from "@/game/i18n";
import type { Card, CardName } from "@/game/types";

const RANK: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

/** 카드 이름 글자 크기 (px): 기본값과, 폭에 맞추느라 줄여도 되는 하한 */
const NAME_PX = { xs: [8, 6], sm: [10, 7], md: [12, 11], lg: [14, 12] } as const;

/**
 * 굵은 글씨로 쓴 이름의 대략적인 폭 (em). 실측(Noto Sans KR 굵게)은 한글 0.92, 공백 0.35, ! 0.46 —
 * OS마다 글꼴이 달라 한글은 조금 넉넉히 잡는다.
 */
function nameEm(name: string): number {
  let em = 0;
  for (const ch of name) em += /[가-힣]/.test(ch) ? 0.96 : ch === " " ? 0.36 : ch === "!" ? 0.48 : 0.6;
  return em;
}

/**
 * 카드 폭에 맞춰 이름을 그린다. "다이너마이트"는 띄어쓰기가 없어 break-keep으로는 줄이
 * 안 바뀌고 카드 밖으로 삐져나갔다. 먼저 글자를 폭에 맞게 줄이고(카드 내용 폭 100cqw 기준),
 * 하한에 걸려도 길면 단어 가운데서만 한 번 줄을 바꾼다 ("다이너/마이트").
 */
function CardName({ name, size }: { name: string; size: keyof typeof NAME_PX }) {
  const [base, min] = NAME_PX[size];
  const words = name.split(" ").map((w, i, all) => {
    const cut = w.length >= 5 ? Math.ceil(w.length / 2) : 0;
    return (
      <span key={i}>
        {cut ? <>{w.slice(0, cut)}<wbr />{w.slice(cut)}</> : w}
        {i < all.length - 1 ? " " : ""}
      </span>
    );
  });
  return (
    <span
      className="w-full break-keep text-center leading-tight"
      style={{ fontSize: `clamp(${min}px, calc(100cqw / ${nameEm(name).toFixed(2)}), ${base}px)` }}
    >
      {words}
    </span>
  );
}

/**
 * 카드 아이콘. 11px 글씨를 읽어야 뱅!과 빗나감!을 구분하던 문제 때문에,
 * 흘끗 봐도 갈라지는 모양을 하나씩 준다.
 */
export function CardIcon({ name, className = "" }: { name: CardName; className?: string }) {
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
    // 빨간 막대 세 개를 띠로 묶고 도화선에 불이 붙은 다발. 다른 아이콘과 달리 색을 칠한다 —
    // 선만으로는 네모 상자(감옥과 비슷)로 읽혔다. 윤곽선은 주황 배경 위에서 빨강이 묻히지 않게.
    // 불꽃(.dyn-spark)은 조상에 .dyn-lit가 있을 때만 깜빡인다 (좌석 배지)
    dynamite: (
      <>
        <g stroke="#1c1917" strokeWidth={1.1} strokeLinejoin="round">
          <rect x="3" y="12" width="5.2" height="10" rx="1.3" fill="#dc2626" />
          <rect x="15.8" y="12" width="5.2" height="10" rx="1.3" fill="#dc2626" />
          <rect x="9.2" y="10" width="5.6" height="12" rx="1.3" fill="#ef4444" />
        </g>
        <rect x="2.4" y="15.3" width="19.2" height="2.4" rx=".5" fill="#1c1917" />
        <path d="M12 10c0-2.6.8-4 2.6-4.3 1.6-.3 2.3-1 2.4-2.2" {...p} />
        <g className="dyn-spark">
          <circle cx="17.6" cy="3.7" r="1.1" fill="#fff7cc" />
          <path
            d="M17.6 1.2v1.4M17.6 4.8v1.4M14.8 3.7h1.4M19 3.7h1.4M15.8 1.9l.9.9M18.5 4.6l.9.9M19.4 1.9l-.9.9M16.7 4.6l-.9.9"
            stroke="#fde047"
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        </g>
      </>
    ),
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
  ghost,
  onClick,
  onHover,
  title,
}: {
  card: Card;
  /** chip: 좌석 장착 줄용 — 이름을 빼고 무늬와 아이콘만 (이름은 올리면 설명에) */
  size?: "chip" | "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  /** 낼 수는 있지만 지금 주목 대상이 아닐 때 (예: 다른 카드를 조준 중) */
  dimmed?: boolean;
  /** 실제 카드가 아니라 캐릭터가 원래 가진 효과 (폴 리그렛의 머스탱 등) */
  ghost?: boolean;
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
    chip: "h-8 w-6 p-px",
    xs: "h-11 w-8 p-0.5",
    sm: "h-16 w-11 p-1",
    md: "h-24 w-[4.25rem] p-1.5",
    lg: "h-28 w-20 p-2",
  }[size];
  const icon = { chip: "h-3.5 w-3.5", xs: "h-4 w-4", sm: "h-6 w-6", md: "h-9 w-9", lg: "h-11 w-11" }[size];
  const nameSize = { chip: "text-[8px]", xs: "text-[8px]", sm: "text-[10px]", md: "text-xs", lg: "text-sm" }[size];
  const info = CARD_KO[card.name];
  const interactive = !!onClick && !disabled;
  const label = ghost ? `${info.name} (캐릭터 능력 — 실제 카드가 아니라 뺏기지 않습니다)` : `${info.name} — ${info.desc}`;

  return (
    <button
      type="button"
      title={title ?? label}
      // disabled 속성을 쓰면 hover/tap 이벤트가 죽어 "왜 못 내는지" 설명을 띄울 수 없다.
      // 클릭은 그대로 올리고(게임판이 낼 수 없는 카드를 무시한다) 모양으로만 표시한다.
      aria-disabled={disabled || undefined}
      // 같은 이유로, 누를 일이 없어도 설명을 띄워야 하면 disabled를 걸지 않는다.
      // 대신 탭 순서에서는 빼 둔다 — 남의 장착 카드까지 키보드로 짚고 다닐 일은 없다.
      disabled={!onClick && !onHover}
      tabIndex={onClick ? undefined : -1}
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      className={`@container relative flex ${dims} shrink-0 flex-col items-center justify-between rounded-lg border-2 font-bold shadow-md transition-transform
        ${tone}
        ${ghost ? "border-dashed opacity-60 saturate-[0.6]" : ""}
        ${selected ? "-translate-y-3 ring-4 ring-amber-400" : ""}
        ${disabled ? "opacity-35 saturate-50" : dimmed ? "opacity-55" : ""}
        ${interactive ? "cursor-pointer hover:-translate-y-2 hover:shadow-xl" : "cursor-default"}`}
    >
      <span className={`self-start leading-none ${nameSize} ${red ? "text-red-600" : "text-black/70"}`}>
        {ghost ? "능력" : `${SUIT_SYMBOL[card.suit]}${RANK[card.rank] ?? card.rank}`}
      </span>
      {/* 선 아이콘은 살짝 눌러 글씨보다 튀지 않게. 색을 칠한 다이너마이트는 그러면 분홍으로 바랜다 */}
      <CardIcon name={card.name} className={`${icon} ${card.name === "dynamite" ? "" : "opacity-80"}`} />
      {size === "chip" ? <span /> : <CardName name={info.name} size={size} />}
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
