"use client";

import type { RefObject } from "react";
import type { CardPlace } from "@/game/types";
import type { FlightEvent } from "@/hooks/useGameEvents";
import { FLIGHT_MS, flightStepMs } from "@/shared/landing";
import { CardBack, CardFace } from "./CardFace";

/**
 * 자리마다 카드가 거기서 갖는 크기 — 날리는 카드(sm) 대비.
 * 좌석의 손패 수 아이콘은 아주 작아서 그대로 줄이면 안 보인다. 거기서는 조금 크게 두고 사라지게 한다.
 */
const SCALE = { pile: 1, hand: 0.45, equip: 0.5 } as const;

interface Anchor {
  x: number;
  y: number;
  scale: number;
}

/**
 * 남의 카드가 오가는 장면. 내 손패는 DealIn/FlyAway가 실제 카드를 날리지만,
 * 남의 손패는 화면에 없어서 좌석의 손패 수만 바뀌었다 — 로그 줄에 실린 이동(moves)을
 * 그 줄이 재생되는 순간에 카드 사본으로 그린다.
 *
 * 위치는 그릴 때 DOM에서 잰다. 상태를 거치지 않고 ref 콜백에서 스타일을 바로 넣어,
 * 한 번 그린 뒤 다시 그리지 않는다 (애니메이션이 처음부터 다시 걸리지 않게).
 */
export function CardFlights({
  flight,
  deckRef,
  discardRef,
  tableRef,
}: {
  flight: FlightEvent | null;
  deckRef: RefObject<HTMLElement | null>;
  discardRef: RefObject<HTMLElement | null>;
  /** 작은 화면에서는 덱·버림을 숨긴다 — 그때는 테이블 한가운데를 쓴다 */
  tableRef: RefObject<HTMLElement | null>;
}) {
  if (!flight) return null;

  const visible = (el: Element | null | undefined) => {
    const r = el?.getBoundingClientRect();
    return r && r.width > 0 ? r : null;
  };
  const center = (r: DOMRect, scale: number): Anchor => ({ x: r.left + r.width / 2, y: r.top + r.height / 2, scale });

  const anchor = (place: CardPlace): Anchor | null => {
    if (place === "deck" || place === "discard") {
      const r = visible((place === "deck" ? deckRef : discardRef).current) ?? visible(tableRef.current);
      return r && center(r, SCALE.pile);
    }
    // 첫 콜론에서만 가른다 — 봇 id가 "bot:uuid"라 split(":")은 id를 잘라먹는다
    const cut = place.indexOf(":");
    const kind = place.slice(0, cut) as "hand" | "equip";
    const id = place.slice(cut + 1);
    const seat = document.querySelector(`[data-seat="${CSS.escape(id)}"]`);
    // 장착 줄은 카드가 없으면 그려지지 않는다 — 그때는 좌석 가운데로
    const r = visible(document.querySelector(`[data-${kind}="${CSS.escape(id)}"]`)) ?? visible(seat);
    return r && center(r, SCALE[kind]);
  };

  const step = flightStepMs(flight.moves.length);

  return (
    // 좌석·화살표 위, 판정 패널 아래와 겹쳐도 조작은 통과시킨다
    <div key={flight.key} className="pointer-events-none fixed inset-0 z-40" aria-hidden>
      {flight.moves.map((mv, i) => (
        <div
          key={i}
          className="absolute left-0 top-0"
          ref={(el) => {
            if (!el || el.classList.contains("anim-move")) return;
            const from = anchor(mv.from);
            const to = anchor(mv.to);
            // 출발지나 도착지가 화면에 없으면(나간 사람의 좌석 등) 날릴 곳이 없다
            if (!from || !to) return;
            const box = el.getBoundingClientRect();
            el.style.left = `${Math.round(from.x - box.width / 2)}px`;
            el.style.top = `${Math.round(from.y - box.height / 2)}px`;
            el.style.setProperty("--move-x", `${Math.round(to.x - from.x)}px`);
            el.style.setProperty("--move-y", `${Math.round(to.y - from.y)}px`);
            el.style.setProperty("--move-s0", `${from.scale}`);
            el.style.setProperty("--move-s1", `${to.scale}`);
            // 길이는 여기서 넣는다 — 손패 수가 바뀌는 시각(landMs)이 같은 숫자를 본다.
            // animation-duration을 직접 쓰면 인라인이라 "움직임 줄이기" 설정을 이겨 버린다
            el.style.setProperty("--move-ms", `${FLIGHT_MS}ms`);
            el.style.animationDelay = `${Math.round(i * step)}ms`;
            el.classList.add("anim-move");
          }}
          // 위치를 잡기 전 한 프레임도 왼쪽 위에 보이면 안 된다 — anim-move의 첫 프레임이 불투명도를 맡는다
          style={{ opacity: 0 }}
        >
          {mv.card ? <CardFace card={mv.card} size="sm" /> : <CardBack size="sm" />}
        </div>
      ))}
    </div>
  );
}
