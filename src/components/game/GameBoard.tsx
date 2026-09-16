"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { describeSituation, explainCard, explainRole, explainSeat, type HelpText } from "@/game/help";
import { CARD_KO, CHARACTER_KO, ROLE_KO, cardLabel } from "@/game/i18n";
import type { Action, Card, CardName } from "@/game/types";
import type { GameView, PlayerView } from "@/game/view";
import { playReason, targetReason, viewDistance, weaponRange } from "@/game/viewRules";
import { useGameEvents } from "@/hooks/useGameEvents";
import type { RoomView } from "@/shared/types";
import { CardBack, CardFace } from "./CardFace";
import { HelpSheet } from "./HelpSheet";
import { HelpStrip } from "./HelpStrip";
import { LogFeed } from "./LogFeed";
import { Seat } from "./Seat";
import { Table } from "./Table";

const NEEDS_TARGET: ReadonlySet<CardName> = new Set(["bang", "missed", "panic", "catBalou", "duel", "jail"]);
const NEEDS_TARGET_CARD: ReadonlySet<CardName> = new Set(["panic", "catBalou"]);

const HELP_KEY = "bang.help";

function readHelpOn(): boolean {
  try {
    return localStorage.getItem(HELP_KEY) !== "off";
  } catch {
    return true;
  }
}

type HelpFocus = { kind: "card"; card: Card } | { kind: "seat"; player: PlayerView } | { kind: "role"; role: NonNullable<PlayerView["role"]> };

type Mode =
  | { kind: "idle" }
  | { kind: "target"; card: Card }
  | { kind: "targetCard"; card: Card; target: PlayerView }
  | { kind: "drawFrom" }
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
  const [hovered, setHovered] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  // ---------- 도움말 ----------
  // 이 컴포넌트는 폴링 결과가 온 뒤 클라이언트에서만 붙으므로 초기값에서 브라우저를 읽어도 된다
  const [helpOn, setHelpOn] = useState(() => readHelpOn());
  const [isTouch] = useState(
    () => typeof window !== "undefined" && (window.matchMedia("(hover: none)").matches || window.matchMedia("(pointer: coarse)").matches),
  );
  // 판이 시작될 때(이 컴포넌트가 붙을 때) 한 번: 내 역할과 규칙
  const [sheet, setSheet] = useState<"intro" | "open" | null>(() => (isPlayer && readHelpOn() ? "intro" : null));
  /** 힌트 줄에 설명할 대상 */
  const [focus, setFocus] = useState<HelpFocus | null>(null);
  const toggleHelp = () => {
    setHelpOn((v) => {
      try {
        localStorage.setItem(HELP_KEY, v ? "off" : "on");
      } catch {
        /* noop */
      }
      return !v;
    });
    setFocus(null);
  };

  const events = useGameEvents(view);

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
    setHovered(null);
  }

  const send = async (a: Action) => {
    setBusy(true);
    try {
      await act(a);
    } finally {
      setBusy(false);
      setMode({ kind: "idle" });
      setHovered(null);
    }
  };

  // ---------- 좌석 순서: 내가 아래 중앙 ----------
  const seats = useMemo(() => {
    const idx = game.players.findIndex((p) => p.id === meId);
    if (idx < 0) return game.players;
    return [...game.players.slice(idx + 1), ...game.players.slice(0, idx + 1)];
  }, [game.players, meId]);

  const canPlayNow = isPlayer && myTurn && game.turn.phase === "play" && !top && !busy;
  const myRange = me ? weaponRange(me) : 1;

  /** 이 카드를 낼 수 있나 — 낼 수 없는 이유가 보이도록 손패에서 흐리게 처리한다 (이유는 힌트 줄에) */
  const playable = (c: Card): boolean => !!me && playReason(game, me, c, canPlayNow) === null;

  /** 카드 c로 p를 칠 수 있나 */
  const canTarget = (c: Card, p: PlayerView): boolean => !!me && targetReason(game, me, c, p) === null;

  const onHandClick = (card: Card) => {
    // 모바일 + 도움말: 첫 탭은 설명, 같은 카드를 한 번 더 탭하면 사용
    if (helpOn && isTouch && mode.kind !== "multi" && !(focus?.kind === "card" && focus.card.id === card.id)) {
      setFocus({ kind: "card", card });
      return;
    }
    if (mode.kind === "multi") {
      const ids = mode.ids.includes(card.id) ? mode.ids.filter((i) => i !== card.id) : [...mode.ids, card.id];
      setMode({ ...mode, ids });
      return;
    }
    if (!playable(card)) return;
    if (NEEDS_TARGET.has(card.name)) setMode({ kind: "target", card });
    else void send({ type: "play", cardId: card.id });
  };

  const onSeatClick = (t: PlayerView) => {
    if (mode.kind === "drawFrom") {
      void send({ type: "draw", source: { playerId: t.id } });
      return;
    }
    if (mode.kind !== "target") return;
    if (NEEDS_TARGET_CARD.has(mode.card.name)) setMode({ kind: "targetCard", card: mode.card, target: t });
    else void send({ type: "play", cardId: mode.card.id, targetId: t.id });
  };

  /** 조준 중이거나, 손패 카드에 마우스를 올렸을 때 미리 보여줄 대상 */
  const aimCard = mode.kind === "target" ? mode.card : mode.kind === "idle" ? hovered : null;
  const targetable = (p: PlayerView): boolean => {
    if (mode.kind === "drawFrom") return p.alive && p.id !== meId && p.handCount > 0;
    if (!aimCard) return false;
    return canTarget(aimCard, p);
  };

  const help: HelpText | null = !helpOn
    ? null
    : focus?.kind === "card"
      ? explainCard(game, me, focus.card, canPlayNow)
      : focus?.kind === "seat"
        ? explainSeat(game, me, focus.player)
        : focus?.kind === "role"
          ? explainRole(focus.role)
          : null;
  const helpHint = isTouch ? "카드나 자리를 한 번 탭하면 설명, 한 번 더 탭하면 사용" : "카드나 자리에 마우스를 올리면 설명이 나옵니다";

  const prompt = isPlayer && me ? buildPrompt(game, me, iRespond, myTurn, mode, setMode, send, busy) : null;
  const urgent = iRespond || (myTurn && !top);
  const activeName = game.names[game.responder] ?? "";

  return (
    <div className="flex h-[calc(100dvh-1rem)] flex-col gap-2">
      {/* ---------- 상단 ---------- */}
      <header className="flex shrink-0 items-center gap-2 text-sm">
        <span className="hidden font-mono text-xs text-amber-300/70 sm:inline">{view.code}</span>
        <span className="truncate">
          <b className={urgent ? "text-amber-300" : ""}>{game.names[game.turn.playerId]}</b>
          <span className="text-white/50"> · {PHASE_KO[game.turn.phase]}</span>
        </span>
        {top && (
          <span className="shrink-0 rounded bg-sky-900/70 px-2 py-0.5 text-[11px]">
            {PENDING_KO[top.kind]} · {activeName} 대기
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            className={`rounded border px-2 py-1 text-xs ${helpOn ? "border-amber-500/50 bg-amber-900/30 text-amber-200" : "border-white/15 text-white/50"} hover:bg-white/10`}
            onClick={toggleHelp}
            title="초보자 도움말 켜기/끄기"
          >
            도움말
          </button>
          <button
            className="rounded border border-white/15 px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10"
            onClick={() => setSheet("open")}
            title="규칙·카드·캐릭터 보기"
            aria-label="규칙 보기"
          >
            ?
          </button>
          <button
            className="rounded border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10 lg:hidden"
            onClick={() => setLogOpen((v) => !v)}
          >
            기록
          </button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onLeave}>
            나가기
          </Button>
        </div>
      </header>

      {/* 내 차례/대응일 때는 타이머를 화면 폭으로 키운다 */}
      <TimerBar
        remaining={remaining}
        total={(deadline - (top?.startedAt ?? game.turn.startedAt)) || 1}
        big={urgent}
        label={urgent ? (iRespond && top ? "대응하세요" : "당신의 턴") : `${activeName}의 차례`}
      />
      <div className="flex shrink-0 items-baseline gap-2 text-[11px]">
        {helpOn && (
          <p className="min-w-0 flex-1 truncate text-sky-200/80" data-testid="situation">
            {describeSituation(game)}
          </p>
        )}
        {/* 작은 화면에서는 테이블 중앙의 덱·버림을 숨기므로 여기서 글자로 */}
        <p className="ml-auto shrink-0 text-white/45 sm:hidden">
          덱 {game.deckCount} · 버림 {game.discardTop ? cardLabel(game.discardTop) : "없음"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {/* ---------- 테이블 ---------- */}
          <div className="relative min-h-0 flex-1">
            <Table
              center={
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-center">
                    <CardBack size="sm" count={game.deckCount} />
                    <span className="mt-0.5 block text-[9px] text-white/40">덱</span>
                  </div>
                  <div className="text-center">
                    {game.discardTop ? (
                      <CardFace card={game.discardTop} size="sm" />
                    ) : (
                      <div className="h-16 w-11 rounded-lg border-2 border-dashed border-white/15" />
                    )}
                    <span className="mt-0.5 block text-[9px] text-white/40">버림</span>
                  </div>
                </div>
              }
              seats={seats.map((p) => (
                <Seat
                  key={p.id}
                  player={p}
                  name={game.names[p.id]}
                  isMe={p.id === meId}
                  isActive={game.responder === p.id && p.alive}
                  connected={view.players.find((x) => x.id === p.id)?.connected ?? false}
                  isBot={view.players.find((x) => x.id === p.id)?.isBot}
                  distance={p.id === meId ? undefined : viewDistance(game, meId, p.id)}
                  inRange={p.id === meId || !isPlayer ? undefined : viewDistance(game, meId, p.id) <= myRange}
                  targetable={targetable(p)}
                  effect={events.seat[p.id]}
                  onTarget={() => onSeatClick(p)}
                  onHover={helpOn ? (on) => setFocus(on ? { kind: "seat", player: p } : null) : undefined}
                />
              ))}
            />

            {/* 방금 일어난 일 */}
            {events.message && (
              /* 위쪽에 두면 좌석을 가린다 — 덱 바로 위, 펠트 안쪽이 비어 있다 */
              <div className="pointer-events-none absolute inset-x-0 top-[30%] z-30 flex justify-center px-4">
                <div key={events.message} className="anim-toast rounded-full bg-black/85 px-4 py-1.5 text-sm font-semibold shadow-lg ring-1 ring-amber-400/30">
                  {events.message}
                </div>
              </div>
            )}

            {/* 조준 안내 */}
            {(mode.kind === "target" || mode.kind === "drawFrom") && (
              <div className="absolute inset-x-0 bottom-1 z-30 flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-red-950/90 px-4 py-1.5 text-xs ring-1 ring-red-500/50">
                  <b>{mode.kind === "target" ? CARD_KO[mode.card.name].name : "카드를 가져올 사람"}</b>
                  <span className="text-white/70">— 대상을 클릭하세요</span>
                  <button className="underline" onClick={() => setMode({ kind: "idle" })}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {helpOn && <HelpStrip help={help} hint={helpHint} />}

          {/* ---------- 프롬프트 ---------- */}
          {mode.kind === "targetCard" && (
            <div className="shrink-0 rounded-lg border border-red-500/40 bg-red-950/40 p-2 text-sm">
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
                  <CardFace key={c.id} card={c} size="sm" onClick={() => send({ type: "play", cardId: mode.card.id, targetId: mode.target.id, targetCardId: c.id })} />
                ))}
                <button className="text-xs underline" onClick={() => setMode({ kind: "idle" })}>
                  취소
                </button>
              </div>
            </div>
          )}
          {prompt}

          {/* ---------- 내 손패 ---------- */}
          {isPlayer && me ? (
            <div className={`shrink-0 rounded-xl border p-2 ${urgent ? "border-amber-500/40 bg-amber-950/20" : "border-white/10 bg-black/40"}`}>
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="tracking-tighter text-base leading-none">
                  <span className="text-red-500">{"♥".repeat(Math.max(0, me.hp))}</span>
                  <span className="text-white/15">{"♥".repeat(Math.max(0, me.maxHp - me.hp))}</span>
                </span>
                <span className="font-bold text-amber-300">{CHARACTER_KO[me.character].name}</span>
                <span className="truncate text-white/50">{CHARACTER_KO[me.character].desc}</span>
                {me.role && (
                  <span
                    className="ml-auto shrink-0 cursor-help rounded bg-white/15 px-1.5 py-0.5 font-bold"
                    onMouseEnter={() => helpOn && setFocus({ kind: "role", role: me.role! })}
                    onMouseLeave={() => setFocus(null)}
                    onClick={() => helpOn && setFocus({ kind: "role", role: me.role! })}
                  >
                    {ROLE_KO[me.role]}
                  </span>
                )}
                {!me.alive && <span className="shrink-0 text-red-400">사망</span>}
              </div>
              <div className="flex flex-wrap items-end gap-1.5 sm:gap-2" data-testid="hand">
                {(me.hand ?? []).map((c) => {
                  const selecting = mode.kind === "multi";
                  return (
                    <CardFace
                      key={c.id}
                      card={c}
                      size="md"
                      selected={selecting && mode.ids.includes(c.id)}
                      disabled={!selecting && !playable(c)}
                      dimmed={mode.kind === "target" && mode.card.id !== c.id}
                      onClick={() => onHandClick(c)}
                      onHover={(on) => {
                        setHovered(on && playable(c) ? c : null);
                        if (helpOn) setFocus(on ? { kind: "card", card: c } : null);
                      }}
                    />
                  );
                })}
                {(me.hand?.length ?? 0) === 0 && <span className="text-xs text-white/40">손패가 없습니다</span>}
              </div>
            </div>
          ) : (
            <p className="shrink-0 text-center text-xs text-white/50">관전 중입니다</p>
          )}
        </div>

        {/* ---------- 기록 ---------- */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <LogFeed log={game.log} />
        </aside>
      </div>

      {sheet && (
        <HelpSheet
          role={me?.role}
          character={me ? CHARACTER_KO[me.character].name : undefined}
          initialTab="role"
          onClose={() => setSheet(null)}
        />
      )}

      {/* 모바일 기록 시트 */}
      {logOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/70 lg:hidden" onClick={() => setLogOpen(false)}>
          <div className="mt-auto max-h-[70dvh] rounded-t-2xl bg-[#16130f] p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-amber-400">기록</h3>
              <button className="text-sm text-white/60 underline" onClick={() => setLogOpen(false)}>
                닫기
              </button>
            </div>
            <LogFeed log={game.log} />
          </div>
        </div>
      )}
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
  const box = (title: string, body: React.ReactNode, danger = false) => (
    <div
      className={`shrink-0 rounded-xl border p-2.5 text-sm ${
        danger ? "border-red-500/60 bg-red-950/40 shadow-[0_0_24px_rgba(239,68,68,0.15)]" : "border-sky-500/40 bg-sky-950/40"
      }`}
    >
      <p className={`mb-2 font-bold ${danger ? "text-red-200" : ""}`}>{title}</p>
      <div className="flex flex-wrap items-center gap-2">{body}</div>
    </div>
  );
  const selectedIds = mode.kind === "multi" ? mode.ids : [];
  const startMulti = (purpose: "discard" | "respond" | "sid" | "pick", count: number) => setMode({ kind: "multi", purpose, count, ids: [] });

  if (!me.alive) return null;

  const sidAvailable = me.character === "sidKetchum" && me.hp < me.maxHp && hand.length >= 2 && (!top || (top.kind === "dying" && top.playerId === me.id));

  if (top && iRespond) {
    switch (top.kind) {
      case "bang":
      case "gatling": {
        const cards = has("missed");
        const need = top.kind === "bang" ? top.missedNeeded : 1;
        return box(
          `${game.names[top.from]}의 ${top.kind === "bang" ? "뱅!" : "개틀링"} — 빗나감! ${need}장으로 막을 수 있습니다`,
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
          true,
        );
      }
      case "indians":
      case "duel": {
        const cards = has("bang");
        return box(
          top.kind === "indians" ? `${game.names[top.from]}의 인디언! — 뱅!을 내거나 피해 1` : "결투 중! — 뱅!을 내거나 패배",
          <>
            <Button disabled={cards.length === 0 || busy} onClick={() => send({ type: "respond", cardIds: [cards[0].id] })}>
              뱅! 사용 ({cards.length}장 보유)
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => send({ type: "respond", cardIds: [] })}>
              {top.kind === "indians" ? "맞는다" : "포기"}
            </Button>
          </>,
          true,
        );
      }
      case "generalStore":
        return box(
          "잡화점 — 1장을 고르세요",
          top.cards.map((c) => <CardFace key={c.id} card={c} size="sm" disabled={busy} onClick={() => send({ type: "pickCards", cardIds: [c.id] })} />),
        );
      case "kitCarlson":
        return box(
          `킷 칼슨 — 2장을 고르세요 (${selectedIds.length}/2)`,
          <>
            {(top.cards ?? []).map((c) => (
              <CardFace
                key={c.id}
                card={c}
                size="sm"
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
          `쓰러지기 직전! 맥주 ${need}장이 필요합니다`,
          <>
            <Button disabled={beers.length < need || busy} onClick={() => send({ type: "respond", cardIds: beers.slice(0, need).map((c) => c.id) })}>
              맥주 {need}장 사용 ({beers.length}장 보유)
            </Button>
            {sidAvailable && <SidButton mode={mode} setMode={setMode} send={send} busy={busy} />}
            <Button variant="danger" disabled={busy} onClick={() => send({ type: "respond", cardIds: [] })}>
              포기
            </Button>
          </>,
          true,
        );
      }
    }
  }

  if (top) return null;

  if (!myTurn) {
    return sidAvailable ? box("시드 케첨 능력", <SidButton mode={mode} setMode={setMode} send={send} busy={busy} />) : null;
  }

  switch (game.turn.phase) {
    case "draw": {
      const canPickPlayer = me.character === "jesseJones" && game.players.some((p) => p.alive && p.id !== me.id && p.handCount > 0);
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
          {/* 버튼을 인원수만큼 늘어놓는 대신 테이블에서 직접 고르게 한다 */}
          {canPickPlayer && (
            <Button variant="ghost" disabled={busy} onClick={() => setMode({ kind: "drawFrom" })}>
              남의 손패에서 1장 + 1장 (테이블에서 선택)
            </Button>
          )}
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
        `손패가 생명보다 많습니다 — ${excess}장을 버리세요 (${selectedIds.length}/${excess})`,
        <Button disabled={selectedIds.length !== excess || busy} onClick={() => send({ type: "discard", cardIds: selectedIds })}>
          버리기
        </Button>,
        true,
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

function TimerBar({ remaining, total, big, label }: { remaining: number; total: number; big: boolean; label: string }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const sec = Math.ceil(remaining / 1000);
  const hot = sec <= 10;
  return (
    <div className={`shrink-0 ${big ? "" : "opacity-60"}`}>
      <div className="mb-0.5 flex items-center justify-between text-[10px]">
        <span className={hot && big ? "anim-urgent font-bold text-red-300" : "text-white/50"}>{label}</span>
        <span className={`font-mono ${hot ? "text-red-400" : "text-white/50"}`}>{sec}s</span>
      </div>
      <div className={`overflow-hidden rounded-full bg-white/10 ${big ? "h-2" : "h-1"}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${hot ? "bg-red-500" : "bg-amber-400"} ${hot && big ? "anim-urgent" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
