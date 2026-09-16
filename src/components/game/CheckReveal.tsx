"use client";

import { isDynamiteExplode, isHeart } from "@/game/cards";
import type { Card, CheckKind } from "@/game/types";
import type { CheckEvent } from "@/hooks/useGameEvents";
import { CardFace } from "./CardFace";

/**
 * 판정마다 무엇이 나와야 하는지와 결과를 부르는 말.
 * 엔진의 "성공"은 "조건이 나왔다"라서 다이너마이트는 성공이 곧 폭발이다 —
 * 그대로 쓰면 거꾸로 읽히므로 결과를 그 사람 입장의 말로 바꾼다.
 */
const RULE: Record<CheckKind, { title: string; need: string; pred: (c: Card) => boolean; ok: [string, boolean]; fail: [string, boolean] }> = {
  jail: { title: "감옥 판정", need: "♥ 나오면 탈출", pred: isHeart, ok: ["탈출", true], fail: ["갇힘", false] },
  dynamite: { title: "다이너마이트 판정", need: "♠2~9 나오면 폭발", pred: isDynamiteExplode, ok: ["폭발", false], fail: ["불발", true] },
  barrel: { title: "술통 판정", need: "♥ 나오면 막음", pred: isHeart, ok: ["막음", true], fail: ["실패", false] },
};

/** 턴 시작(과 술통) 판정을 테이블 중앙에 크게 — 로그 한 줄로는 무엇이 나왔는지 따라갈 수 없었다 */
export function CheckReveal({ event, name }: { event: CheckEvent; name: string }) {
  const rule = RULE[event.check];
  const [label, good] = event.ok ? rule.ok : rule.fail;
  // 럭키 듀크는 두 장 중 하나만 맞으면 된다 — 어느 장이 결정했는지 짚어준다
  const decisive = event.cards.length > 1 && event.ok;

  return (
    <div key={event.key} className="anim-check flex flex-col items-center gap-1.5 rounded-2xl bg-stone-950 px-5 py-2.5 shadow-2xl ring-1 ring-amber-400/30">
      <div className="text-xs font-bold">
        <span className="text-amber-300">{name}</span> · {rule.title}
      </div>
      <div className="relative mr-12 flex gap-2">
        {event.cards.map((c) => (
          <div key={c.id} className={`anim-flip rounded-lg ${decisive && rule.pred(c) ? "ring-2 ring-amber-300" : ""}`}>
            <CardFace card={c} size="md" />
          </div>
        ))}
        <div
          className={`anim-stamp absolute -right-14 top-1/2 -mt-4 flex h-9 w-16 items-center justify-center rounded-md border-[3px] bg-stone-950/90 text-lg font-black ${
            good ? "border-emerald-400 text-emerald-300" : "border-red-500 text-red-400"
          }`}
        >
          {label}
        </div>
      </div>
      <div className="text-[11px] text-white/60">{rule.need}</div>
    </div>
  );
}
