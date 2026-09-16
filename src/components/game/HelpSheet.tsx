"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { CHARACTERS, CHARACTER_NAMES } from "@/game/characters";
import { DISTANCE_HELP, ROLE_HELP, TURN_STEPS } from "@/game/help";
import { CARD_KO, CHARACTER_KO, ROLE_KO } from "@/game/i18n";
import type { CardName, Role } from "@/game/types";
import { CardFace } from "./CardFace";

type Tab = "role" | "cards" | "characters";

const ROLES: Role[] = ["sheriff", "deputy", "outlaw", "renegade"];
const CARD_ORDER: CardName[] = [
  "bang", "missed", "beer", "panic", "catBalou", "stagecoach", "wellsFargo", "generalStore", "indians", "duel", "gatling", "saloon",
  "barrel", "scope", "mustang", "jail", "dynamite", "volcanic", "schofield", "remington", "carabine", "winchester",
];

/**
 * 규칙서 겸 시작 안내. 게임 시작 직후 내 역할 탭으로 한 번 열리고, 헤더의 ?로 다시 연다.
 */
export function HelpSheet({
  role,
  character,
  initialTab = "role",
  onClose,
}: {
  role?: Role;
  character?: string;
  initialTab?: Tab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-[#1c1813] shadow-2xl ring-1 ring-amber-500/30 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 border-b border-white/10 px-3 pt-3">
          {(
            [
              ["role", role ? "내 역할" : "규칙"],
              ["cards", "카드"],
              ["characters", "캐릭터"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-3 py-1.5 text-sm font-bold ${tab === t ? "bg-white/10 text-amber-300" : "text-white/50 hover:text-white/80"}`}
            >
              {label}
            </button>
          ))}
          <button className="ml-auto px-2 text-white/50 hover:text-white" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {tab === "role" && (
            <div className="space-y-4">
              {role && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4">
                  <p className="text-xs text-white/60">당신은</p>
                  <p className="text-2xl font-black text-amber-300">{ROLE_KO[role]}</p>
                  <p className="mt-1 font-semibold">목표: {ROLE_HELP[role].goal}</p>
                  <p className="mt-1 text-white/70">{ROLE_HELP[role].detail}</p>
                  {character && <p className="mt-2 text-xs text-white/60">캐릭터: {character}</p>}
                </div>
              )}
              <section>
                <h3 className="mb-1.5 font-bold text-amber-400">역할</h3>
                <ul className="space-y-1">
                  {ROLES.map((r) => (
                    <li key={r} className="flex gap-2">
                      <span className="w-14 shrink-0 font-bold">{ROLE_KO[r]}</span>
                      <span className="text-white/75">{ROLE_HELP[r].goal}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-white/50">보안관만 공개. 나머지는 탈락할 때 공개됩니다.</p>
              </section>
              <section>
                <h3 className="mb-1.5 font-bold text-amber-400">내 턴에 하는 일</h3>
                <ol className="list-decimal space-y-0.5 pl-5 text-white/80">
                  {TURN_STEPS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </section>
              <section>
                <h3 className="mb-1.5 font-bold text-amber-400">거리와 사거리</h3>
                <p className="text-white/75">{DISTANCE_HELP}</p>
              </section>
              <section>
                <h3 className="mb-1.5 font-bold text-amber-400">피해와 탈락</h3>
                <p className="text-white/75">
                  생명이 0이 되면 탈락합니다. 그 순간 맥주를 내면 1 회복해 버팁니다 (2명만 남으면 불가). 뱅!을 맞을 때 빗나감!을 내면 무효.
                </p>
              </section>
            </div>
          )}

          {tab === "cards" && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {CARD_ORDER.map((name) => (
                <li key={name} className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
                  <CardFace card={{ id: `help-${name}`, name, suit: "S", rank: 1 }} size="xs" />
                  <div className="min-w-0">
                    <p className="font-bold">{CARD_KO[name].name}</p>
                    <p className="text-xs text-white/70">{CARD_KO[name].desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "characters" && (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {CHARACTER_NAMES.map((ch) => (
                <li key={ch} className="rounded-lg bg-white/5 p-2">
                  <p className="font-bold">
                    {CHARACTER_KO[ch].name} <span className="text-xs font-normal text-red-400">{"♥".repeat(CHARACTERS[ch].hp)}</span>
                  </p>
                  <p className="text-xs text-white/70">{CHARACTER_KO[ch].desc}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          <Button className="w-full" onClick={onClose}>
            {role && tab === "role" ? "알겠어요, 시작!" : "닫기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
