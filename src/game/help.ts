import { CARD_KO, CHARACTER_KO, ROLE_KO } from "./i18n";
import type { Card, CharacterName, Phase, Role } from "./types";
import type { GameView, PlayerView } from "./view";
import { isEquip, playReason, targetsFor, viewDistance, weaponRange } from "./viewRules";

/**
 * 처음 하는 사람을 위한 설명문. 전부 순수 함수 — 뷰만 보고 문장을 만든다.
 * 규칙 판단은 viewRules에 있고, 여기는 그걸 말로 옮기는 곳이다.
 */

export interface HelpText {
  title: string;
  body: string;
  /** "지금 이 상황에서" — 사용 가능 여부, 대상, 거리 등 */
  now?: string;
  /** now가 "안 된다"는 뜻일 때 (흐리게 표시) */
  blocked?: boolean;
}

export const ROLE_HELP: Record<Role, { goal: string; detail: string }> = {
  sheriff: {
    goal: "무법자와 배신자를 모두 쓰러뜨리세요",
    detail: "유일하게 정체가 공개됩니다. 생명이 1 많고, 감옥에 갇히지 않습니다. 부관을 죽이면 카드를 전부 잃으니 조심하세요.",
  },
  deputy: {
    goal: "보안관을 지키고 무법자와 배신자를 쓰러뜨리세요",
    detail: "정체는 비밀입니다. 보안관은 당신이 누군지 모르니, 행동으로 편임을 보여주세요.",
  },
  outlaw: {
    goal: "보안관을 쓰러뜨리세요",
    detail: "정체는 비밀입니다. 다른 무법자가 누군지도 모릅니다. 무법자를 죽인 사람은 카드 3장을 받으니 서로 쏘는 건 손해입니다.",
  },
  renegade: {
    goal: "마지막까지 혼자 살아남으세요",
    detail: "보안관이 살아 있는 동안 무법자를 정리하고, 마지막에 보안관과 1:1로 남아 이기는 게 정석입니다. 보안관이 먼저 죽으면 무법자 승리입니다.",
  },
};

export const PHASE_HELP: Record<Phase, string> = {
  start: "턴 시작 — 다이너마이트·감옥 판정",
  jail: "턴 시작 — 감옥 판정",
  draw: "드로우 단계 — 덱에서 2장을 뽑습니다",
  play: "플레이 단계 — 카드를 원하는 만큼 사용합니다 (뱅!은 턴당 1장)",
  discard: "버리기 단계 — 손패를 생명 수 이하로 줄입니다",
};

const CHARACTER_DRAW_NOTE: Partial<Record<CharacterName, string>> = {
  blackJack: "2번째 카드를 공개해 빨간색이면 1장 더",
  kitCarlson: "3장을 보고 2장 선택",
  jesseJones: "첫 장을 남의 손패에서 가져올 수 있음",
  pedroRamirez: "첫 장을 버림 더미에서 가져올 수 있음",
};

/** 지금 무슨 일이 벌어지고 있는지 한 문장 */
export function describeSituation(game: GameView): string {
  const n = (id: string) => game.names[id] ?? id;
  if (game.winner) return "게임이 끝났습니다";
  const top = game.pending[game.pending.length - 1];
  if (top) {
    switch (top.kind) {
      case "bang":
        return `${n(top.from)}이(가) ${n(top.to)}에게 뱅! — ${n(top.to)}은(는) 빗나감! ${top.missedNeeded}장으로 막거나 피해 1`;
      case "gatling":
        return `${n(top.from)}의 개틀링 — ${n(top.targets[0])} 차례: 빗나감!을 내거나 피해 1 (남은 대상 ${top.targets.length}명)`;
      case "indians":
        return `${n(top.from)}의 인디언! — ${n(top.targets[0])} 차례: 뱅!을 내거나 피해 1 (남은 대상 ${top.targets.length}명)`;
      case "duel":
        return `${n(top.from)} ↔ ${n(top.to)} 결투 — ${n(top.current)} 차례: 뱅!을 내면 상대 차례, 못 내면 피해 1`;
      case "generalStore":
        return `잡화점 — ${n(top.order[0])} 차례로 공개된 카드 중 1장을 가져갑니다`;
      case "kitCarlson":
        return `${n(top.playerId)} (킷 칼슨) 3장 중 2장을 고르는 중`;
      case "dying":
        return `${n(top.playerId)} 쓰러지기 직전 — 맥주를 쓰면 살아날 수 있습니다`;
    }
  }
  const who = n(game.turn.playerId);
  const me = game.players.find((p) => p.id === game.turn.playerId);
  let s = `${who}의 ${PHASE_HELP[game.turn.phase]}`;
  if (game.turn.phase === "draw" && me) {
    const note = CHARACTER_DRAW_NOTE[me.character];
    if (note) s += ` (${CHARACTER_KO[me.character].name}: ${note})`;
  }
  return s;
}

export function explainCard(game: GameView, me: PlayerView | undefined, card: Card, canPlayNow: boolean): HelpText {
  const info = CARD_KO[card.name];
  const kind = isEquip(card.name) || card.name === "jail" || card.name === "dynamite" ? "장착 카드 — 내면 앞에 놓이고 계속 효과를 냅니다" : "";
  const body = kind ? `${info.desc} ${kind}` : info.desc;
  if (!me || !me.alive) return { title: info.name, body };
  const reason = playReason(game, me, card, canPlayNow);
  if (reason) return { title: info.name, body, now: reason, blocked: true };
  const targets = targetsFor(game, me, card);
  const needsTarget = ["bang", "missed", "panic", "catBalou", "duel", "jail"].includes(card.name);
  return {
    title: info.name,
    body,
    now: needsTarget ? `지금 사용 가능 — 대상: ${targets.map((p) => game.names[p.id]).join(", ")}` : "지금 사용 가능",
  };
}

export function explainSeat(game: GameView, me: PlayerView | undefined, p: PlayerView): HelpText {
  const ch = CHARACTER_KO[p.character];
  const name = game.names[p.id] ?? p.id;
  let body = `${ch.name}: ${ch.desc}`;
  if (p.role) body += ` · ${ROLE_KO[p.role]} — ${ROLE_HELP[p.role].goal}`;
  if (!p.alive) return { title: name, body: `탈락 · ${body}` };
  if (!me || me.id === p.id) return { title: name, body };
  const d = viewDistance(game, me.id, p.id);
  const range = weaponRange(me);
  const mods: string[] = [];
  if (p.equipment.some((c) => c.name === "mustang") || p.character === "paulRegret") mods.push("상대 머스탱 +1");
  if (me.equipment.some((c) => c.name === "scope") || me.character === "roseDoolan") mods.push("내 조준경 -1");
  const modTxt = mods.length ? ` (${mods.join(", ")})` : "";
  return d <= range
    ? { title: name, body, now: `거리 ${d}${modTxt} — 내 사거리(${range}) 안, 뱅!을 쏠 수 있습니다` }
    : { title: name, body, now: `거리 ${d}${modTxt} — 내 사거리(${range}) 밖, 더 긴 무기가 필요합니다`, blocked: true };
}

export function explainRole(role: Role): HelpText {
  return { title: ROLE_KO[role], body: ROLE_HELP[role].detail, now: `목표: ${ROLE_HELP[role].goal}` };
}

export function explainCharacter(ch: CharacterName): HelpText {
  return { title: CHARACTER_KO[ch].name, body: CHARACTER_KO[ch].desc };
}

/** 시작 안내에 쓰는 턴 순서 */
export const TURN_STEPS = [
  "카드 2장 뽑기",
  "카드 사용 — 뱅!은 턴당 1장, 사거리 안의 상대만",
  "손패가 생명보다 많으면 버리고 턴 종료",
];

export const DISTANCE_HELP = "거리는 테이블에서 몇 자리 떨어져 있는지입니다 (탈락자는 건너뜀). 기본 사거리 1 = 양옆만. 무기로 늘리고, 머스탱·조준경으로 ±1.";
