"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * 같은 순간에 들어온 카드들을 조금씩 늦춰 한 장씩 날아오게 한다.
 * 한 번의 커밋에서 레이아웃 이펙트는 연달아 돌기 때문에, 직전 카드와의 시간차로
 * "이번에 같이 뽑힌 묶음"을 알아낼 수 있다 — 어느 카드가 새 카드인지 따로 세지 않아도 된다.
 */
const GROUP_MS = 150;
const STAGGER_MS = 120;
let lastDealAt = 0;
let dealSlot = 0;

/**
 * 새로 들어온 카드를 덱에서 날아오게 감싼다. 카드가 그냥 손패에 나타나면
 * 몇 장을 받았는지, 어디서 왔는지가 안 보인다.
 *
 * 애니메이션은 이 상자가 처음 붙을 때 한 번만 건다 — 손패 카드는 카드 id를 key로 쓰므로
 * 새 카드만 새로 붙는다. 게임판이 막 열렸을 때는(ready가 아직 false) 원래 있던 손패가
 * 우르르 날아오지 않게 건너뛴다.
 */
export function DealIn({
  cardId,
  from,
  ready,
  children,
}: {
  /** 사라질 때 이 자리에서 날아가도록 FlyAway가 찾아 쓴다 */
  cardId: string;
  /** 출발점 (덱). 화면이 좁아 덱이 숨어 있으면 위에서 내려온다 */
  from: RefObject<HTMLElement | null>;
  ready: RefObject<boolean>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ready.current) return;

    const card = el.getBoundingClientRect();
    const deck = from.current?.getBoundingClientRect();
    // 덱이 숨어 있으면 rect가 0이다 — 그때는 손패 위쪽에서 내려오게 둔다
    const [dx, dy] =
      deck && deck.width > 0
        ? [deck.left + deck.width / 2 - (card.left + card.width / 2), deck.top + deck.height / 2 - (card.top + card.height / 2)]
        : [0, -140];

    const now = performance.now();
    dealSlot = now - lastDealAt > GROUP_MS ? 0 : dealSlot + 1;
    lastDealAt = now;

    el.style.setProperty("--deal-x", `${Math.round(dx)}px`);
    el.style.setProperty("--deal-y", `${Math.round(dy)}px`);
    el.style.animationDelay = `${dealSlot * STAGGER_MS}ms`;
    el.classList.add("anim-deal");

    // 날아온 뒤에는 클래스를 떼어 둔다 — 붙어 있으면 z-index가 남아 손패 위로 겹친다
    const done = () => el.classList.remove("anim-deal");
    el.addEventListener("animationend", done, { once: true });
    return () => el.removeEventListener("animationend", done);
  }, [from, ready]);

  return (
    <div ref={ref} data-card-id={cardId} className="inline-flex shrink-0">
      {children}
    </div>
  );
}
