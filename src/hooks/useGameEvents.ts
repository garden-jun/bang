"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, CheckKind, LogMeta } from "@/game/types";
import type { GameView } from "@/game/view";
import type { RoomView } from "@/shared/types";

export interface SeatEffect {
  kind: "hit" | "heal" | "death";
  /** 같은 효과가 연달아 나도 애니메이션이 다시 걸리게 하는 키 */
  key: number;
}

/**
 * 좌석 위에 튀어오르는 배지. 흔들림(SeatEffect)과 따로 둔다 — 폭발 배지 바로 뒤에
 * "피해 3" 흔들림이 오는데, 한 칸에 두면 흔들림이 배지를 덮어써 배지가 잘린다.
 */
export interface SeatBadge {
  kind: "dodge" | "escape" | "skip" | "explode";
  key: number;
}

/** 테이블 중앙에 크게 뒤집어 보여주는 판정 카드 */
export interface CheckEvent {
  from: string;
  check: CheckKind;
  cards: Card[];
  ok: boolean;
  key: number;
}

/**
 * 한 번에 여러 사건이 몰려와도 이 간격으로 하나씩 보여준다.
 * globals.css의 --toast-ms/--arrow-ms, 서버의 BOT_MIN_MOVE_MS와 같이 움직인다 —
 * 하나만 바꾸면 연출이 잘리거나 혼자 남는다.
 */
const STEP_MS = 1350;
/** 밀린 사건이 많으면 더 빨리 흘린다 (봇이 연달아 둘 때) */
const MIN_STEP_MS = 630;
/**
 * 내가 행동할 차례인데 아직 지난 장면을 재생 중일 때 쓰는 간격.
 *
 * 화면판과 프롬프트는 최신 상태를 바로 반영하는데 연출 큐만 뒤처지면,
 * "봇 턴이 안 끝났는데 내가 조작할 수 있는" 상태로 보인다. 밀린 것은 빠르게
 * 흘려보내고 마지막 한 장면(= 나에게 벌어진 일)만 제 속도로 보여준다.
 */
const CATCH_UP_MS = 180;
/**
 * 마지막 장면을 보여준 뒤 최소한 이만큼은 지나야 다음 장면으로 넘어간다.
 *
 * 큐가 빈 뒤에도 pump는 STEP_MS 뒤에 한 번 더 깨어나 말풍선을 지운다. 그 잔여 대기 중에
 * 새 사건이 도착하면 아무 이유 없이 최대 STEP_MS를 더 기다리게 되는데, 사람끼리 하는 판은
 * 사건이 몇 초 간격으로 띄엄띄엄 와서 거의 매번 여기에 걸렸다. 그럴 때는 잔여 대기를
 * 버리고 이 간격만 지킨다 — 봇이 연달아 둘 때의 큐 속도(STEP_MS/MIN_STEP_MS)는 그대로다.
 */
const NEW_BEAT_GAP_MS = MIN_STEP_MS;
/**
 * 판정 장면은 카드가 뒤집히고 결과 도장이 찍히는 것까지 봐야 의미가 있어,
 * 큐가 밀려 있어도 이만큼은 붙잡는다. 따라잡기 중에는 내 판정일 때만.
 */
const CHECK_HOLD_MS = 1500;

/** 테이블 위에 그릴 화살표 — 공격자에서 대상(들)로 */
export interface ArrowEvent {
  kind: Exclude<LogMeta["kind"], "dodge" | "check" | "outcome">;
  from: string;
  to: string[];
  key: number;
}

interface Beat {
  msg: string | null;
  effects?: Record<string, SeatEffect>;
  badges?: Record<string, SeatBadge>;
  arrow?: ArrowEvent;
  check?: CheckEvent;
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
  const [arrow, setArrow] = useState<ArrowEvent | null>(null);
  const [badge, setBadge] = useState<Record<string, SeatBadge>>({});
  const [check, setCheck] = useState<CheckEvent | null>(null);

  const lastLogT = useRef<number | null>(null);
  const prevHp = useRef<Map<string, number>>(new Map());
  const prevAlive = useRef<Map<string, boolean>>(new Map());
  const queue = useRef<Beat[]>([]);
  /** pump가 setTimeout으로 스스로를 다시 걸기 때문에 최신 값을 ref로 읽는다 */
  const iActNow = useRef(false);
  const meId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectKey = useRef(0);
  /** 마지막으로 장면을 보여준 시각 — 새 사건이 잔여 대기를 건너뛸 때 쓴다 */
  const lastBeatAt = useRef(0);

  const game: GameView | undefined = view?.game;

  useEffect(() => {
    // 렌더 중에 ref를 쓰면 안 되므로(react-hooks/refs) 이펙트에서 갱신한다.
    // pump는 setTimeout으로 스스로를 다시 걸기 때문에 옛 클로저도 이 최신 값을 읽는다.
    iActNow.current = !!game && !game.winner && !!view && game.responder === view.me.id;
    meId.current = view?.me.id ?? null;
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
    // 큐는 비었는데 타이머만 남았다면 = 직전 장면의 잔여 대기. 여기에 새 사건이 붙으면
    // 그 대기를 이어받을 이유가 없다 (아래에서 다시 건다).
    const onlyTailWait = queue.current.length === 0 && timer.current !== null;
    if (fresh.length === 0) {
      if (hasEffects) queue.current.push({ msg: null, effects });
    } else {
      // 이번 폴링의 연출은 이 묶음의 마지막 사건에 붙인다
      queue.current.push(
        ...fresh.map((l, i) => {
          const beat: Beat = { msg: l.msg, effects: i === fresh.length - 1 && hasEffects ? effects : undefined };
          const m = l.meta;
          if (m?.kind === "dodge") {
            // 막았다는 표시는 좌석 배지로
            beat.badges = { [m.from]: { kind: "dodge", key: ++effectKey.current } };
          } else if (m?.kind === "outcome") {
            beat.badges = { [m.from]: { kind: m.outcome, key: ++effectKey.current } };
          } else if (m?.kind === "check") {
            beat.check = { from: m.from, check: m.check, cards: m.cards, ok: m.ok, key: ++effectKey.current };
          } else if (m) {
            beat.arrow = { kind: m.kind, from: m.from, to: m.to ? [m.to] : (m.targets ?? []), key: ++effectKey.current };
          }
          return beat;
        }),
      );
    }

    // setState는 타이머 콜백에서만 — 이펙트 본문에서 바로 부르면 연쇄 렌더가 된다
    if (!timer.current && queue.current.length > 0) {
      timer.current = setTimeout(pump, 0);
    } else if (onlyTailWait && queue.current.length > 0) {
      clearTimeout(timer.current!);
      timer.current = setTimeout(pump, Math.max(0, NEW_BEAT_GAP_MS - (Date.now() - lastBeatAt.current)));
    }

    function pump() {
      const next = queue.current.shift();
      if (!next) {
        timer.current = null;
        setMessage(null);
        return;
      }
      lastBeatAt.current = Date.now();
      // 판정은 테이블 중앙 패널이 같은 내용을 크게 보여주므로 말풍선을 겹쳐 띄우지 않는다
      setMessage(next.check ? null : next.msg);
      // 화살표는 다음 화살표가 올 때까지 둔다 — 사라지는 건 CSS 애니메이션이 맡는다.
      // 여기서 지우면 뒤따르는 "피해 1" 사건이 0.9초 만에 선을 끊어 버린다.
      if (next.arrow) setArrow(next.arrow);
      if (next.effects) setSeat((s) => ({ ...s, ...next.effects }));
      if (next.badges) setBadge((b) => ({ ...b, ...next.badges }));
      // 판정 카드도 화살표처럼 다음 판정이 올 때까지 두고, 사라지는 건 CSS가 맡는다
      if (next.check) setCheck(next.check);
      // 내 차례인데 밀린 장면이 남아 있으면 빠르게 따라잡는다. 큐가 비면(=지금 보여준 게
      // 마지막 장면) 평소 속도로 돌아가, 나에게 벌어진 일은 놓치지 않는다.
      const catchUp = iActNow.current && queue.current.length > 0;
      let step = catchUp ? CATCH_UP_MS : Math.max(MIN_STEP_MS, STEP_MS - queue.current.length * 180);
      if (next.check && (!catchUp || next.check.from === meId.current)) step = Math.max(step, CHECK_HOLD_MS);
      timer.current = setTimeout(pump, step);
    }
  }, [game, view]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, seat, badge, check, arrow };
}
