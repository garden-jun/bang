"use client";

import { isEquipment, isWeapon } from "@/game/cards";
import { CARD_KO, SUIT_SYMBOL } from "@/game/i18n";
import type { Card } from "@/game/types";

const RANK: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

export function CardFace({
  card,
  size = "md",
  selected,
  disabled,
  onClick,
  title,
}: {
  card: Card;
  size?: "sm" | "md";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const red = card.suit === "H" || card.suit === "D";
  const kind = isWeapon(card.name) ? "weapon" : isEquipment(card.name) ? "equip" : "action";
  const tone = {
    action: "border-amber-700/70 bg-gradient-to-b from-amber-100 to-amber-200 text-amber-950",
    equip: "border-sky-800/70 bg-gradient-to-b from-sky-100 to-sky-200 text-sky-950",
    weapon: "border-stone-600 bg-gradient-to-b from-stone-200 to-stone-300 text-stone-900",
  }[kind];
  const dims = size === "sm" ? "h-14 w-10 text-[9px]" : "h-24 w-16 text-[11px]";
  const info = CARD_KO[card.name];

  return (
    <button
      type="button"
      title={title ?? `${info.name} — ${info.desc}`}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex ${dims} shrink-0 flex-col justify-between rounded-md border-2 p-1 text-left font-semibold shadow transition
        ${tone} ${selected ? "-translate-y-2 ring-2 ring-amber-400" : ""} ${disabled ? "opacity-50" : onClick ? "hover:-translate-y-1" : ""}`}
    >
      <span className={`leading-none ${red ? "text-red-600" : ""}`}>
        {SUIT_SYMBOL[card.suit]}
        {RANK[card.rank] ?? card.rank}
      </span>
      <span className="break-keep leading-tight">{info.name}</span>
    </button>
  );
}

export function CardBack({ size = "sm", count }: { size?: "sm" | "md"; count?: number }) {
  const dims = size === "sm" ? "h-14 w-10" : "h-24 w-16";
  return (
    <div className={`${dims} flex items-center justify-center rounded-md border-2 border-red-900 bg-[repeating-linear-gradient(45deg,#7f1d1d_0_4px,#991b1b_4px_8px)] text-sm font-bold text-white shadow`}>
      {count ?? ""}
    </div>
  );
}
