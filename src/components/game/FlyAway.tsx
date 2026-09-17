"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { Card } from "@/game/types";
import { HAND_FLY_MS, HAND_FLY_STAGGER_MS } from "@/shared/landing";

/**
 * 손패에서 빠져나간 카드를 도착지까지 날려 보낸다.
 *
 * 받는 쪽(DealIn)과 방향만 다른 게 아니다. 카드가 들어올 때는 DOM이 새로 붙으니 거기에
 * 애니메이션을 걸면 되지만, 나갈 때는 React가 이미 지운 뒤라 날려 보낼 물건이 없다.
 * 그래서 매번 손패 카드의 자리와 모양(DOM 사본)을 적어 두었다가, 사라진 카드의 사본을
 * 마지막 자리에 띄워 날린다. 사본은 React 바깥의 레이어에서만 살다 사라지므로
 * 연출이 도는 동안 게임판은 한 번도 다시 그려지지 않는다.
 *
 * @param destFor 그 카드가 간 곳과 거기서의 카드 크기 배율 — 좌석의 장비 줄이면 작게, 버림 더미면 조금 작게.
 *                배율을 도착지 요소 크기에서 뽑으면 안 된다 — 좌석 상자는 카드보다 넓어서 카드가 커진다.
 * @returns 날아가는 카드가 담길 레이어 ref
 */
export function useFlyAway(
  handRef: RefObject<HTMLElement | null>,
  hand: Card[],
  ready: RefObject<boolean>,
  destFor: (card: Card) => { el: HTMLElement | null; scale: number },
) {
  const layerRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Map<string, { card: Card; rect: DOMRect; node: HTMLElement }>());

  useLayoutEffect(() => {
    const now = new Map<string, { card: Card; rect: DOMRect; node: HTMLElement }>();
    const byId = new Map(hand.map((c) => [c.id, c]));
    for (const el of handRef.current?.querySelectorAll<HTMLElement>("[data-card-id]") ?? []) {
      const card = byId.get(el.dataset.cardId ?? "");
      // 사본은 지금 떠 두는 수밖에 없다 — 카드가 사라진 뒤에는 원본이 없다
      if (card) now.set(card.id, { card, rect: el.getBoundingClientRect(), node: el.cloneNode(true) as HTMLElement });
    }

    const gone = [...seen.current.values()].filter((v) => !now.has(v.card.id));
    seen.current = now;

    const layer = layerRef.current;
    if (!ready.current || !layer) return;

    let slot = 0;
    for (const { card, rect, node } of gone) {
      const { el, scale } = destFor(card);
      const dest = el?.getBoundingClientRect();
      // 도착지가 화면에 없으면(좁은 화면에서는 덱·버림을 숨긴다) 날릴 곳이 없다 — 그냥 사라지게 둔다
      if (!dest || dest.width === 0 || rect.width === 0) continue;

      node.style.position = "absolute";
      node.style.left = `${rect.left}px`;
      node.style.top = `${rect.top}px`;
      node.style.setProperty("--fly-x", `${Math.round(dest.left + dest.width / 2 - (rect.left + rect.width / 2))}px`);
      node.style.setProperty("--fly-y", `${Math.round(dest.top + dest.height / 2 - (rect.top + rect.height / 2))}px`);
      node.style.setProperty("--fly-s", `${scale}`);
      // 한꺼번에 여러 장을 버릴 때 한 장씩 보이도록. 길이는 장착 줄이 바뀌는 시각(handLandMs)과 같은 숫자
      node.style.setProperty("--fly-ms", `${HAND_FLY_MS}ms`);
      node.style.animationDelay = `${slot++ * HAND_FLY_STAGGER_MS}ms`;
      node.classList.add("anim-fly");
      node.addEventListener("animationend", () => node.remove(), { once: true });
      layer.appendChild(node);
    }
  }, [hand, handRef, ready, destFor]);

  return layerRef;
}

/** 날아가는 카드가 사는 곳. 게임판 위에 겹치되 조작은 통과시킨다 */
export function FlyLayer({ layer }: { layer: RefObject<HTMLDivElement | null> }) {
  return <div ref={layer} className="pointer-events-none fixed inset-0 z-50" aria-hidden />;
}
