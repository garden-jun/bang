import { WEAPON_RANGE, isWeapon } from "./cards";
import { CARD_KO } from "./i18n";
import type { Card, CardName } from "./types";
import type { GameView, PlayerView } from "./view";

/**
 * 클라이언트 뷰(GameView)만으로 판단할 수 있는 규칙들.
 * 엔진(core.ts)과 같은 규칙이지만 손패가 가려진 뷰 위에서 돈다.
 * 게임판 UI와 도움말이 같은 판단을 쓰도록 한곳에 모았다.
 */

const EQUIP: ReadonlySet<CardName> = new Set(["barrel", "scope", "mustang", "volcanic", "schofield", "remington", "carabine", "winchester"]);
export const isEquip = (n: CardName) => EQUIP.has(n);

export const unlimitedBang = (p: PlayerView) => p.character === "willyTheKid" || p.equipment.some((c) => c.name === "volcanic");

export function weaponRange(p: PlayerView): number {
  const w = p.equipment.find((c) => isWeapon(c.name));
  return w && isWeapon(w.name) ? WEAPON_RANGE[w.name] : 1;
}

export function viewDistance(game: GameView, fromId: string, toId: string): number {
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

/** 카드 c로 p를 대상 삼을 수 없는 이유. null이면 가능 */
export function targetReason(game: GameView, me: PlayerView, c: Card, p: PlayerView): string | null {
  if (p.id === me.id) return "자신은 대상이 될 수 없습니다";
  if (!p.alive) return "이미 탈락한 플레이어입니다";
  const n = c.name;
  if (n === "jail") {
    if (p.role === "sheriff") return "보안관은 감옥에 가둘 수 없습니다";
    if (p.equipment.some((e) => e.name === "jail")) return "이미 감옥에 있습니다";
    return null;
  }
  const d = viewDistance(game, me.id, p.id);
  const range = weaponRange(me);
  if (n === "bang" || n === "missed") return d <= range ? null : `거리 ${d} — 사거리(${range}) 밖`;
  if (n === "panic") {
    if (d > 1) return `거리 ${d} — 패닉!은 거리 1만 가능`;
    if (p.handCount === 0 && p.equipment.length === 0) return "가져올 카드가 없습니다";
    return null;
  }
  if (n === "catBalou") return p.handCount > 0 || p.equipment.length > 0 ? null : "버리게 할 카드가 없습니다";
  return null;
}

export const canTarget = (game: GameView, me: PlayerView, c: Card, p: PlayerView) => targetReason(game, me, c, p) === null;

export function targetsFor(game: GameView, me: PlayerView, c: Card): PlayerView[] {
  return game.players.filter((p) => canTarget(game, me, c, p));
}

/**
 * 지금 이 카드를 낼 수 없는 이유. null이면 낼 수 있다.
 * canPlayNow: 내 턴의 플레이 단계이고 대기 중인 응답이 없을 때
 */
export function playReason(game: GameView, me: PlayerView, c: Card, canPlayNow: boolean): string | null {
  if (!canPlayNow) {
    if (game.pending.length > 0) return "다른 플레이어의 응답을 기다리는 중입니다";
    if (game.turn.playerId !== me.id) return "내 턴이 아닙니다";
    if (game.turn.phase === "draw") return "먼저 카드를 뽑아야 합니다";
    if (game.turn.phase === "discard") return "버리기 단계에서는 카드를 낼 수 없습니다";
    return "지금은 카드를 낼 수 없습니다";
  }
  const alive = game.players.filter((p) => p.alive);
  const range = weaponRange(me);
  const noTarget = (msg: string) => (targetsFor(game, me, c).length > 0 ? null : msg);
  switch (c.name) {
    case "missed":
      if (me.character !== "calamityJanet") return "빗나감!은 뱅!을 맞을 때 대응으로만 씁니다";
      return noTarget(`사거리(${range}) 안에 쏠 사람이 없습니다`);
    case "bang":
      if (game.turn.bangsPlayed >= 1 && !unlimitedBang(me)) return "이번 턴에 이미 뱅!을 사용했습니다 (볼캐닉·윌리 더 키드는 무제한)";
      return noTarget(`사거리(${range}) 안에 쏠 사람이 없습니다`);
    case "beer":
      if (alive.length <= 2) return "2명만 남으면 맥주를 쓸 수 없습니다";
      if (me.hp >= me.maxHp) return "생명이 이미 가득합니다";
      return null;
    case "panic":
      return noTarget("거리 1에 카드를 가진 사람이 없습니다");
    case "catBalou":
      return noTarget("카드를 가진 사람이 없습니다");
    case "duel":
      return noTarget("결투할 상대가 없습니다");
    case "jail":
      return noTarget("가둘 수 있는 사람이 없습니다 (보안관·이미 감옥인 사람 제외)");
    case "saloon":
      return alive.some((p) => p.hp < p.maxHp) ? null : "회복할 사람이 없습니다";
    default:
      if (isEquip(c.name) && me.equipment.some((e) => e.name === c.name)) return `${CARD_KO[c.name].name}은(는) 이미 장착 중입니다`;
      return null;
  }
}
