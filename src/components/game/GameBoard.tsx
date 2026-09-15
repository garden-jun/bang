"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { WEAPON_RANGE, isWeapon } from "@/game/cards";
import { CARD_KO, CHARACTER_KO, ROLE_KO, cardLabel } from "@/game/i18n";
import type { Action, Card, CardName } from "@/game/types";
import type { GameView, PlayerView } from "@/game/view";
import type { RoomView } from "@/shared/types";
import { CardBack, CardFace } from "./CardFace";
import { Seat } from "./Seat";

const NEEDS_TARGET: ReadonlySet<CardName> = new Set(["bang", "missed", "panic", "catBalou", "duel", "jail"]);
const NEEDS_TARGET_CARD: ReadonlySet<CardName> = new Set(["panic", "catBalou"]);

type Mode =
  | { kind: "idle" }
  | { kind: "target"; card: Card }
  | { kind: "targetCard"; card: Card; target: PlayerView }
  | { kind: "multi"; purpose: "discard" | "respond" | "sid" | "pick"; count: number; ids: string[] };

export function GameBoard({ view, act, onLeave }: { view: RoomView; act: (a: Action) => Promise<unknown>; onLeave: () => void }) {
  const game = view.game!;
  const meId = view.me.id;
  const me = game.players.find((p) => p.id === meId);
  const isPlayer = view.me.seat === "player" && !!me;
  const myTurn = game.turn.playerId === meId;
  const top = game.pending[game.pending.length - 1];
  const iRespond = game.responder === meId;
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  // 서버/클라 시계 차이 보정한 남은 시간
  const skew = useRef(0);
  useEffect(() => {
    skew.current = Date.now() - view.now;
  }, [view.now]);
  const deadline = top?.deadline ?? game.turn.deadline;
  const remaining = useCountdown(deadline, skew);

  // 상태 버전이 바뀌면 선택 모드 초기화 (렌더 중 리셋 패턴)
  const [seenVersion, setSeenVersion] = useState(view.version);
  if (seenVersion !== view.version) {
    setSeenVersion(view.version);
    setMode({ kind: "idle" });
  }

  const send = async (a: Action) => {
    setBusy(true);
    try {
      await act(a);
    } finally {
      setBusy(false);
      setMode({ kind: "idle" });
    }
  };

  // ---------- 좌석 배치: 나를 아래 중앙으로 회전 ----------
  const seats = useMemo(() => {
    const idx = game.players.findIndex((p) => p.id === meId);
    if (idx < 0) return game.players;
    return [...game.players.slice(idx + 1), ...game.players.slice(0, idx + 1)];
  }, [game.players, meId]);

  // ---------- 카드 클릭 (플레이 단계) ----------
  const canPlayNow = isPlayer && myTurn && game.turn.phase === "play" && !top && !busy;

  const onHandClick = (card: Card) => {
    if (mode.kind === "multi") {
      const ids = mode.ids.includes(card.id) ? mode.ids.filter((i) => i !== card.id) : [...mode.ids, card.id];
      setMode({ ...mode, ids });
      return;
    }
    if (!canPlayNow) return;
    if (NEEDS_TARGET.has(card.name)) setMode({ kind: "target", card });
    else void send({ type: "play", cardId: card.id });
  };

  const onTarget = (t: PlayerView) => {
    if (mode.kind !== "target") return;
    if (NEEDS_TARGET_CARD.has(mode.card.name)) setMode({ kind: "targetCard", card: mode.card, target: t });
    else void send({ type: "play", cardId: mode.card.id, targetId: t.id });
  };

  const targetable = (p: PlayerView) => {
    if (mode.kind !== "target" || !p.alive || p.id === meId || !me) return false;
    const c = mode.card.name;
    if (c === "jail") return p.role !== "sheriff" && !p.equipment.some((e) => e.name === "jail");
    const d = viewDistance(game, meId, p.id);
    if (c === "bang" || c === "missed") return d <= weaponRange(me);
    if (c === "panic") return d <= 1 && (p.handCount > 0 || p.equipment.length > 0);
    if (c === "catBalou") return p.handCount > 0 || p.equipment.length > 0;
    return true;
  };

  // ---------- 응답/선택 프롬프트 ----------
  const prompt = isPlayer && me ? buildPrompt(game, me, iRespond, myTurn, mode, setMode, send, busy) : null;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-mono text-amber-300">{view.code}</span>
          <span>
            <b>{game.names[game.turn.playerId]}</b>의 턴 · {PHASE_KO[game.turn.phase]}
          </span>
          {top && <span className="rounded bg-sky-900/60 px-2 py-0.5 text-xs">{PENDING_KO[top.kind]} — {game.names[game.responder]} 응답 대기</span>}
        </div>
        <div className="flex items-center gap-3">
          <TimerBar remaining={remaining} total={(deadline - (top?.startedAt ?? game.turn.startedAt)) || 1} />
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onLeave}>
            나가기
          </Button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          {/* 테이블 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {seats.map((p) => (
              <Seat
                key={p.id}
                player={p}
                name={game.names[p.id]}
                isMe={p.id === meId}
                isTurn={game.turn.playerId === p.id}
                isResponder={!!top && game.responder === p.id}
                connected={view.players.find((x) => x.id === p.id)?.connected ?? false}
                targetable={targetable(p)}
                onTarget={() => onTarget(p)}
              />
            ))}
          </div>

          {/* 덱/버림 */}
          <div className="flex items-center gap-4 rounded-lg bg-black/20 p-3 text-xs text-white/60">
            <div className="flex items-center gap-2">
              <CardBack size="sm" count={game.deckCount} />
              <span>덱</span>
            </div>
            <div className="flex items-center gap-2">
              {game.discardTop ? <CardFace card={game.discardTop} size="sm" /> : <div className="h-14 w-10 rounded-md border border-dashed border-white/20" />}
              <span>버림</span>
            </div>
            {mode.kind === "target" && (
              <span className="ml-auto text-red-300">
                <b>{CARD_KO[mode.card.name].name}</b> 대상을 선택하세요 ·{" "}
                <button className="underline" onClick={() => setMode({ kind: "idle" })}>
                  취소
                </button>
              </span>
            )}
          </div>

          {/* 프롬프트 */}
          {mode.kind === "targetCard" && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm">
              <p className="mb-2">
                <b>{game.names[mode.target.id]}</b>의 어떤 카드를 {mode.card.name === "panic" ? "가져올까요" : "버리게 할까요"}?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {mode.target.handCount > 0 && (
                  <Button variant="ghost" onClick={() => send({ type: "play", cardId: mode.card.id, targetId: mode.target.id, targetCardId: "hand" })}>
                    손패에서 무작위 ({mode.target.handCount}장)
                  </Button>
                )}
                {mode.target.equipment.map((c) => (
                  <CardFace key={c.id} card={c} onClick={() => send({ type: "play", cardId: mode.card.id, targetId: mode.target.id, targetCardId: c.id })} />
                ))}
                <button className="text-xs underline" onClick={() => setMode({ kind: "idle" })}>
                  취소
                </button>
              </div>
            </div>
          )}
          {prompt}

          {/* 내 손패 */}
          {isPlayer && me && (
            <div className="rounded-lg bg-black/30 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span className="font-bold text-amber-300">{CHARACTER_KO[me.character].name}</span>
                <span title={CHARACTER_KO[me.character].desc} className="cursor-help underline decoration-dotted">
                  능력
                </span>
                {me.role && <span>· {ROLE_KO[me.role]}</span>}
                <span>· 생명 {me.hp}/{me.maxHp}</span>
                <span>· 손패 {me.hand?.length ?? 0}</span>
                {!me.alive && <span className="text-red-300">· 사망</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {(me.hand ?? []).map((c) => (
                  <CardFace
                    key={c.id}
                    card={c}
                    selected={mode.kind === "multi" && mode.ids.includes(c.id)}
                    disabled={mode.kind === "multi" ? false : !canPlayNow || (c.name === "missed" && me.character !== "calamityJanet")}
                    onClick={() => onHandClick(c)}
                  />
                ))}
                {(me.hand?.length ?? 0) === 0 && <span className="text-xs text-white/40">손패가 없습니다</span>}
              </div>
            </div>
          )}
          {!isPlayer && <p className="text-center text-xs text-white/50">관전 중입니다</p>}
        </div>

        {/* 로그 */}
        <aside className="max-h-[70vh] overflow-y-auto rounded-lg bg-black/30 p-3 text-xs">
          <h3 className="mb-2 font-bold text-amber-400">기록</h3>
          <ul className="space-y-1 text-white/70">
            {[...game.log].reverse().map((l) => (
              <li key={l.t}>{l.msg}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

// ---------- 프롬프트 빌더 ----------

function buildPrompt(
  game: GameView,
  me: PlayerView,
  iRespond: boolean,
  myTurn: boolean,
  mode: Mode,
  setMode: (m: Mode) => void,
  send: (a: Action) => Promise<void>,
  busy: boolean,
) {
  const hand = me.hand ?? [];
  const top = game.pending[game.pending.length - 1];
  const janet = me.character === "calamityJanet";
  const has = (n: CardName) => hand.filter((c) => c.name === n || (janet && (n === "bang" || n === "missed") && (c.name === "bang" || c.name === "missed")));
  const box = (title: string, body: React.ReactNode) => (
    <div className="rounded-lg border border-sky-500/40 bg-sky-950/30 p-3 text-sm">
      <p className="mb-2 font-bold">{title}</p>
      <div className="flex flex-wrap items-center gap-2">{body}</div>
    </div>
  );
  const selectedIds = mode.kind === "multi" ? mode.ids : [];
  const startMulti = (purpose: "discard" | "respond" | "sid" | "pick", count: number) => setMode({ kind: "multi", purpose, count, ids: [] });

  if (!me.alive) return null;

  // 시드 케첨 능력 (대기 없을 때 또는 죽기 직전)
  const sidAvailable = me.character === "sidKetchum" && me.hp < me.maxHp && hand.length >= 2 && (!top || (top.kind === "dying" && top.playerId === me.id));

  if (top && iRespond) {
    switch (top.kind) {
      case "bang":
      case "gatling": {
        const cards = has("missed");
        const need = top.kind === "bang" ? top.missedNeeded : 1;
        return box(
          `${game.names[top.from]}의 ${top.kind === "bang" ? "뱅!" : "개틀링"}! 빗나감! ${need}장으로 막을 수 있습니다.`,
          <>
            {mode.kind === "multi" && mode.purpose === "respond" ? (
              <>
                <span className="text-xs">손패에서 {need}장 선택 ({selectedIds.length}/{need})</span>
                <Button disabled={selectedIds.length !== need || busy} onClick={() => send({ type: "respond", cardIds: selectedIds })}>
                  막기
                </Button>
              </>
            ) : (
              <Button disabled={cards.length < need || busy} onClick={() => (need === 1 ? send({ type: "respond", cardIds: [cards[0].id] }) : startMulti("respond", need))}>
                빗나감! 사용 ({cards.length}장 보유)
              </Button>
            )}
            <Button variant="danger" disabled={busy} onClick={() => send({ type: "respond", cardIds: [] })}>
              맞는다
            </Button>
          </>,
        );
      }
      case "indians":
      case "duel": {
        const cards = has("bang");
        return box(
          top.kind === "indians" ? `${game.names[top.from]}의 인디언! 뱅!을 내거나 피해 1` : `결투 중! 뱅!을 내거나 패배`,
          <>
            <Button disabled={cards.length === 0 || busy} onClick={() => send({ type: "respond", cardIds: [cards[0].id] })}>
              뱅! 사용 ({cards.length}장 보유)
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => send({ type: "respond", cardIds: [] })}>
              {top.kind === "indians" ? "맞는다" : "포기"}
            </Button>
          </>,
        );
      }
      case "generalStore":
        return box(
          "잡화점 — 1장을 고르세요",
          top.cards.map((c) => <CardFace key={c.id} card={c} disabled={busy} onClick={() => send({ type: "pickCards", cardIds: [c.id] })} />),
        );
      case "kitCarlson":
        return box(
          `킷 칼슨 — 2장을 고르세요 (${selectedIds.length}/2)`,
          <>
            {(top.cards ?? []).map((c) => (
              <CardFace
                key={c.id}
                card={c}
                selected={selectedIds.includes(c.id)}
                onClick={() => {
                  const ids = selectedIds.includes(c.id) ? selectedIds.filter((i) => i !== c.id) : [...selectedIds, c.id].slice(-2);
                  setMode({ kind: "multi", purpose: "pick", count: 2, ids });
                }}
              />
            ))}
            <Button disabled={selectedIds.length !== 2 || busy} onClick={() => send({ type: "pickCards", cardIds: selectedIds })}>
              선택
            </Button>
          </>,
        );
      case "dying": {
        const beers = hand.filter((c) => c.name === "beer");
        const need = 1 - me.hp;
        return box(
          `쓰러지기 직전! 맥주 ${need}장이 필요합니다.`,
          <>
            <Button disabled={beers.length < need || busy} onClick={() => send({ type: "respond", cardIds: beers.slice(0, need).map((c) => c.id) })}>
              맥주 {need}장 사용 ({beers.length}장 보유)
            </Button>
            {sidAvailable && <SidButton mode={mode} setMode={setMode} send={send} busy={busy} />}
            <Button variant="danger" disabled={busy} onClick={() => send({ type: "respond", cardIds: [] })}>
              포기
            </Button>
          </>,
        );
      }
    }
  }

  if (top) return null; // 남의 응답 대기 중

  if (!myTurn) {
    return sidAvailable ? box("시드 케첨 능력", <SidButton mode={mode} setMode={setMode} send={send} busy={busy} />) : null;
  }

  switch (game.turn.phase) {
    case "draw": {
      const others = game.players.filter((p) => p.alive && p.id !== me.id && p.handCount > 0);
      return box(
        "드로우 단계",
        <>
          <Button disabled={busy} onClick={() => send({ type: "draw" })}>
            카드 2장 뽑기
          </Button>
          {me.character === "pedroRamirez" && game.discardTop && (
            <Button variant="ghost" disabled={busy} onClick={() => send({ type: "draw", source: "discard" })}>
              버림 더미에서 {cardLabel(game.discardTop)} + 1장
            </Button>
          )}
          {me.character === "jesseJones" &&
            others.map((p) => (
              <Button key={p.id} variant="ghost" disabled={busy} onClick={() => send({ type: "draw", source: { playerId: p.id } })}>
                {game.names[p.id]}의 손패에서 1장 + 1장
              </Button>
            ))}
        </>,
      );
    }
    case "play":
      return box(
        mode.kind === "target" ? "대상을 선택하세요" : "카드를 클릭해 사용하세요",
        <>
          {sidAvailable && <SidButton mode={mode} setMode={setMode} send={send} busy={busy} />}
          <Button variant="ghost" disabled={busy || mode.kind !== "idle"} onClick={() => send({ type: "endTurn" })}>
            턴 종료
          </Button>
        </>,
      );
    case "discard": {
      const excess = hand.length - me.hp;
      if (mode.kind !== "multi" || mode.purpose !== "discard") {
        startMulti("discard", excess);
      }
      return box(
        `손패가 생명보다 많습니다. ${excess}장을 버리세요 (${selectedIds.length}/${excess})`,
        <Button disabled={selectedIds.length !== excess || busy} onClick={() => send({ type: "discard", cardIds: selectedIds })}>
          버리기
        </Button>,
      );
    }
    default:
      return null;
  }
}

function SidButton({ mode, setMode, send, busy }: { mode: Mode; setMode: (m: Mode) => void; send: (a: Action) => Promise<void>; busy: boolean }) {
  if (mode.kind === "multi" && mode.purpose === "sid") {
    return (
      <>
        <span className="text-xs">버릴 카드 2장 선택 ({mode.ids.length}/2)</span>
        <Button disabled={mode.ids.length !== 2 || busy} onClick={() => send({ type: "ability", name: "sidKetchum", cardIds: mode.ids })}>
          회복
        </Button>
        <button className="text-xs underline" onClick={() => setMode({ kind: "idle" })}>
          취소
        </button>
      </>
    );
  }
  return (
    <Button variant="ghost" disabled={busy} onClick={() => setMode({ kind: "multi", purpose: "sid", count: 2, ids: [] })}>
      시드 케첨: 2장 버리고 회복
    </Button>
  );
}

// ---------- 유틸 ----------

const PHASE_KO = { start: "시작", jail: "감옥 판정", draw: "드로우", play: "플레이", discard: "버리기" } as const;
const PENDING_KO = { bang: "뱅!", indians: "인디언!", gatling: "개틀링", duel: "결투", generalStore: "잡화점", kitCarlson: "킷 칼슨", dying: "생사 기로" } as const;

function weaponRange(p: PlayerView): number {
  const w = p.equipment.find((c) => isWeapon(c.name));
  return w && isWeapon(w.name) ? WEAPON_RANGE[w.name] : 1;
}

function viewDistance(game: GameView, fromId: string, toId: string): number {
  const alive = game.players.filter((p) => p.alive);
  const a = alive.findIndex((p) => p.id === fromId);
  const b = alive.findIndex((p) => p.id === toId);
  if (a < 0 || b < 0) return 99;
  const diff = Math.abs(a - b);
  let d = Math.min(diff, alive.length - diff);
  const from = alive[a], to = alive[b];
  if (to.equipment.some((c) => c.name === "mustang") || to.character === "paulRegret") d += 1;
  if (from.equipment.some((c) => c.name === "scope") || from.character === "roseDoolan") d -= 1;
  return Math.max(1, d);
}

function useCountdown(deadline: number, skew: React.MutableRefObject<number>) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadline - (Date.now() - skew.current)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [deadline, skew]);
  return remaining;
}

function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const sec = Math.ceil(remaining / 1000);
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-2 w-24 overflow-hidden rounded bg-white/10">
        <div className={`h-full ${sec <= 10 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-8 font-mono ${sec <= 10 ? "text-red-400" : "text-white/70"}`}>{sec}s</span>
    </div>
  );
}
