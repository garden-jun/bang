"use client";

import { useEffect, useRef, useState } from "react";
import type { GameView } from "@/game/view";
import type { RoomView } from "@/shared/types";

export interface SeatEffect {
  kind: "hit" | "heal" | "death";
  /** 같은 효과가 연달아 나도 애니메이션이 다시 걸리게 하는 키 */
  key: number;
}

/** 한 번에 여러 사건이 몰려와도 이 간격으로 하나씩 보여준다 */
const STEP_MS = 900;
/** 밀린 사건이 많으면 더 빨리 흘린다 (봇이 연달아 둘 때) */
const MIN_STEP_MS = 420;

interface Beat {
  msg: string | null;
  effects?: Record<string, SeatEffect>;
}

/**
 * 폴링은 "무엇이 달라졌는지"를 알려주지 않고 최신 상태만 준다.
 * 그래서 로그 증분과 생명 변화를 직접 비교해 사건으로 바꾼다.
 *
 * 봇이 한 번에 여러 수를 두면 그 결과가 폴링 한 번에 몰려 오는데, 그대로
 * 반영하면 아무것도 못 보고 지나간다. 큐에 쌓아 하나씩 흘린다.
 */
export function useGameEvents(view: RoomView | null) {
  const [message, setMessage] = useState<string | null>(null);
  const [seat, setSeat] = useState<Record<string, SeatEffect>>({});

  const lastLogT = useRef<number | null>(null);
  const prevHp = useRef<Map<string, number>>(new Map());
  const prevAlive = useRef<Map<string, boolean>>(new Map());
  const queue = useRef<Beat[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectKey = useRef(0);

  const game: GameView | undefined = view?.game;

  useEffect(() => {
    if (!game) return;

    // 생명/사망은 로그보다 확실하다 — 원인이 무엇이든 결과가 남는다
    const effects: Record<string, SeatEffect> = {};
    for (const p of game.players) {
      const beforeHp = prevHp.current.get(p.id);
      const wasAlive = prevAlive.current.get(p.id);
      if (beforeHp !== undefined && p.hp !== beforeHp) {
        effects[p.id] = { kind: p.hp < beforeHp ? "hit" : "heal", key: ++effectKey.current };
      }
      if (wasAlive && !p.alive) effects[p.id] = { kind: "death", key: ++effectKey.current };
      prevHp.current.set(p.id, p.hp);
      prevAlive.current.set(p.id, p.alive);
    }

    const last = lastLogT.current;
    if (last === null) {
      // 첫 렌더에서 과거 기록이 우르르 흐르지 않게 기준점만 잡는다
      lastLogT.current = game.log.at(-1)?.t ?? -1;
      return;
    }

    const fresh = game.log.filter((l) => l.t > last);
    if (fresh.length > 0) lastLogT.current = fresh.at(-1)!.t;

    const hasEffects = Object.keys(effects).length > 0;
    if (fresh.length === 0) {
      if (hasEffects) queue.current.push({ msg: null, effects });
    } else {
      // 이번 폴링의 연출은 이 묶음의 마지막 사건에 붙인다
      queue.current.push(...fresh.map((l, i) => ({ msg: l.msg, effects: i === fresh.length - 1 && hasEffects ? effects : undefined })));
    }

    // setState는 타이머 콜백에서만 — 이펙트 본문에서 바로 부르면 연쇄 렌더가 된다
    if (!timer.current && queue.current.length > 0) {
      timer.current = setTimeout(pump, 0);
    }

    function pump() {
      const next = queue.current.shift();
      if (!next) {
        timer.current = null;
        setMessage(null);
        return;
      }
      setMessage(next.msg);
      if (next.effects) setSeat((s) => ({ ...s, ...next.effects }));
      // 밀린 게 많으면 간격을 줄여 따라잡는다
      const step = Math.max(MIN_STEP_MS, STEP_MS - queue.current.length * 120);
      timer.current = setTimeout(pump, step);
    }
  }, [game]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, seat };
}
