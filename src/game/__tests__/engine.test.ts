import { describe, expect, it } from "vitest";
import { applyAction, forfeit } from "../engine";
import { GameError, type GameState } from "../types";
import { NOW, card, filler, handNames, makeState, p } from "./util";

/** 보안관 s, 그 다음 무법자 o1, o2, 배신자 r — 4인 기본 배치 */
type SeatOver = Partial<Omit<Parameters<typeof makeState>[0][number], "id" | "role">>;
function four(over: Partial<Record<"s" | "o1" | "o2" | "r", SeatOver>> = {}, opts?: Parameters<typeof makeState>[1]) {
  return makeState(
    [
      { id: "s", role: "sheriff", ...over.s },
      { id: "o1", role: "outlaw", ...over.o1 },
      { id: "o2", role: "outlaw", ...over.o2 },
      { id: "r", role: "renegade", ...over.r },
    ],
    opts,
  );
}

describe("뱅!", () => {
  it("사거리 밖이면 거부", () => {
    const bang = card("bang");
    const s = four({ s: { hand: [bang], character: "willyTheKid" } });
    // s → o2 는 거리 2, 기본 사거리 1
    expect(() => applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o2" }, NOW)).toThrow(GameError);
  });

  it("맞으면 피해, 빗나감!으로 막을 수 있음", () => {
    const bang = card("bang");
    const missed = card("missed");
    const s = four({ s: { hand: [bang] }, o1: { hand: [missed] } });
    const after = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(after.pending[0]).toMatchObject({ kind: "bang", from: "s", to: "o1", missedNeeded: 1 });

    const hit = applyAction(after, "o1", { type: "respond", cardIds: [] }, NOW);
    expect(p(hit, "o1").hp).toBe(3);
    expect(hit.pending).toHaveLength(0);

    const dodged = applyAction(after, "o1", { type: "respond", cardIds: [missed.id] }, NOW);
    expect(p(dodged, "o1").hp).toBe(4);
    expect(p(dodged, "o1").hand).toHaveLength(0);
  });

  it("턴당 1장 제한, 볼캐닉이면 무제한", () => {
    const b1 = card("bang"), b2 = card("bang");
    const s = four({ s: { hand: [b1, b2], character: "bartCassidy" }, o1: { hand: [] } });
    let st = applyAction(s, "s", { type: "play", cardId: b1.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW);
    expect(() => applyAction(st, "s", { type: "play", cardId: b2.id, targetId: "o1" }, NOW)).toThrow(/이미 뱅/);

    const vol = card("volcanic");
    const s2 = four({ s: { hand: [b1, b2, vol], character: "bartCassidy" } });
    let st2 = applyAction(s2, "s", { type: "play", cardId: vol.id }, NOW);
    st2 = applyAction(st2, "s", { type: "play", cardId: b1.id, targetId: "o1" }, NOW);
    st2 = applyAction(st2, "o1", { type: "respond", cardIds: [] }, NOW);
    st2 = applyAction(st2, "s", { type: "play", cardId: b2.id, targetId: "o1" }, NOW);
    expect(st2.pending[0].kind).toBe("bang");
  });

  it("술통은 하트면 자동 회피", () => {
    const bang = card("bang");
    const s = four(
      { s: { hand: [bang] }, o1: { equipment: [card("barrel")] } },
      { deck: [card("stagecoach", "H", 5)] },
    );
    const after = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(after.pending).toHaveLength(0);
    expect(p(after, "o1").hp).toBe(4);
    expect(after.discard.some((c) => c.suit === "H")).toBe(true);
  });

  it("남의 턴에는 카드를 못 냄", () => {
    const bang = card("bang");
    const s = four({ o1: { hand: [bang] } });
    expect(() => applyAction(s, "o1", { type: "play", cardId: bang.id, targetId: "s" }, NOW)).toThrow(/턴이 아닙/);
  });
});

describe("사망과 승리", () => {
  it("무법자를 죽이면 3장 보상, 무법자 전멸+배신자 사망 시 보안관 승", () => {
    const bang = card("bang");
    const s = four({ s: { hand: [bang] }, o1: { hp: 1 } }, { deck: filler(5) });
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW);
    expect(p(st, "o1").alive).toBe(false);
    expect(p(st, "o1").roleRevealed).toBe(true);
    expect(p(st, "s").hand).toHaveLength(3);
    expect(st.winner).toBeUndefined();
  });

  it("보안관 사망 → 무법자 승 (배신자 홀로 남으면 배신자 승)", () => {
    const bang = card("bang");
    const s = four({ o1: { hand: [bang] }, s: { hp: 1 } }, { turn: "o1" });
    let st = applyAction(s, "o1", { type: "play", cardId: bang.id, targetId: "s" }, NOW);
    st = applyAction(st, "s", { type: "respond", cardIds: [] }, NOW);
    expect(st.winner).toBe("outlaws");

    const b2 = card("bang");
    const s2 = makeState([{ id: "s", role: "sheriff", hp: 1 }, { id: "r", role: "renegade", hand: [b2] }], { turn: "r" });
    let st2 = applyAction(s2, "r", { type: "play", cardId: b2.id, targetId: "s" }, NOW);
    st2 = applyAction(st2, "s", { type: "respond", cardIds: [] }, NOW);
    expect(st2.winner).toBe("renegade");
  });

  it("죽기 직전 맥주로 살아남", () => {
    const bang = card("bang"), beer = card("beer");
    const s = four({ s: { hand: [bang] }, o1: { hp: 1, hand: [beer] } });
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW); // 맞음
    expect(st.pending[0]).toMatchObject({ kind: "dying", playerId: "o1" });
    st = applyAction(st, "o1", { type: "respond", cardIds: [beer.id] }, NOW);
    expect(p(st, "o1").alive).toBe(true);
    expect(p(st, "o1").hp).toBe(1);
    expect(st.pending).toHaveLength(0);
  });

  it("보안관이 부관을 죽이면 카드 전부 버림", () => {
    const bang = card("bang");
    const s = makeState(
      [
        { id: "s", role: "sheriff", hand: [bang, card("beer")], equipment: [card("mustang")] },
        { id: "d", role: "deputy", hp: 1 },
        { id: "o", role: "outlaw" },
        { id: "o2", role: "outlaw" },
        { id: "r", role: "renegade" },
      ],
    );
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "d" }, NOW);
    st = applyAction(st, "d", { type: "respond", cardIds: [] }, NOW);
    expect(p(st, "s").hand).toHaveLength(0);
    expect(p(st, "s").equipment).toHaveLength(0);
  });

  it("게임 이탈은 사망 처리", () => {
    const s = four();
    const st = forfeit(s, "s", NOW);
    expect(p(st, "s").alive).toBe(false);
    expect(st.winner).toBe("outlaws");
  });
});

describe("턴 흐름", () => {
  it("드로우 → 플레이 → 초과 손패 버리기 → 다음 사람", () => {
    const s = four({ s: { hp: 1, hand: filler(1) } }, { deck: filler(10) });
    s.turn.phase = "draw";
    let st = applyAction(s, "s", { type: "draw" }, NOW);
    expect(st.turn.phase).toBe("play");
    expect(p(st, "s").hand).toHaveLength(3);
    expect(() => applyAction(st, "s", { type: "draw" }, NOW)).toThrow();

    st = applyAction(st, "s", { type: "endTurn" }, NOW);
    expect(st.turn.phase).toBe("discard");
    const ids = p(st, "s").hand.slice(0, 2).map((c) => c.id);
    expect(() => applyAction(st, "s", { type: "discard", cardIds: [ids[0]] }, NOW)).toThrow(/2장/);
    st = applyAction(st, "s", { type: "discard", cardIds: ids }, NOW);
    expect(st.turn.playerId).toBe("o1");
    expect(st.turn.phase).toBe("draw");
  });

  it("손패가 생명 이하면 endTurn 시 바로 넘어감", () => {
    const s = four({}, { deck: filler(10) });
    const st = applyAction(s, "s", { type: "endTurn" }, NOW);
    expect(st.turn.playerId).toBe("o1");
    expect(st.turn.phase).toBe("draw");
  });

  it("사망자는 건너뜀", () => {
    const s = four({}, { deck: filler(10) });
    p(s, "o1").alive = false;
    const st = applyAction(s, "s", { type: "endTurn" }, NOW);
    expect(st.turn.playerId).toBe("o2");
  });

  it("덱이 비면 버림 더미를 섞어 씀", () => {
    const s = four({ s: { hp: 5 } }, { deck: [], discard: filler(6) });
    s.turn.phase = "draw";
    const st = applyAction(s, "s", { type: "draw" }, NOW);
    expect(p(st, "s").hand).toHaveLength(2);
    expect(st.discard).toHaveLength(1);
    expect(st.deck).toHaveLength(3);
  });
});

describe("장착", () => {
  it("무기는 하나만, 교체 시 기존 무기 버림", () => {
    const sch = card("schofield"), win = card("winchester");
    const s = four({ s: { hand: [sch, win] } });
    let st = applyAction(s, "s", { type: "play", cardId: sch.id }, NOW);
    st = applyAction(st, "s", { type: "play", cardId: win.id }, NOW);
    expect(p(st, "s").equipment.map((c) => c.name)).toEqual(["winchester"]);
    expect(st.discard.map((c) => c.name)).toEqual(["schofield"]);
  });

  it("같은 장착 중복 불가", () => {
    const m1 = card("mustang"), m2 = card("mustang");
    const s = four({ s: { hand: [m1, m2] } });
    const st = applyAction(s, "s", { type: "play", cardId: m1.id }, NOW);
    expect(() => applyAction(st, "s", { type: "play", cardId: m2.id }, NOW)).toThrow(/이미 장착/);
  });

  it("사거리: 윈체스터로 거리 2 사격, 머스탱/조준경 보정", () => {
    const bang = card("bang");
    const s = four({ s: { hand: [bang], equipment: [card("schofield")] }, o2: { equipment: [card("mustang")] } });
    // s→o2 거리 2 + 머스탱 1 = 3 > 스코필드 2
    expect(() => applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o2" }, NOW)).toThrow(/사거리/);
    p(s, "s").equipment.push(card("scope"));
    const st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o2" }, NOW);
    expect(st.pending[0].kind).toBe("bang");
  });

  it("감옥: 하트가 아니면 턴 스킵, 보안관은 대상 불가", () => {
    const jail = card("jail");
    const s = four({ s: { hand: [jail] } }, { deck: [card("bang", "S", 3), ...filler(6)] });
    expect(() => applyAction(s, "o1", { type: "play", cardId: jail.id, targetId: "s" }, NOW)).toThrow();
    let st = applyAction(s, "s", { type: "play", cardId: jail.id, targetId: "o1" }, NOW);
    expect(p(st, "o1").equipment.map((c) => c.name)).toEqual(["jail"]);
    st = applyAction(st, "s", { type: "endTurn" }, NOW);
    // o1 턴 시작 → 판정 ♠3 실패 → o2 턴
    expect(st.turn.playerId).toBe("o2");
    expect(p(st, "o1").equipment).toHaveLength(0);
  });

  it("다이너마이트: 폭발하면 피해 3, 아니면 왼쪽으로", () => {
    const dyn = card("dynamite");
    const s = four({ s: { hand: [dyn] } }, { deck: [card("bang", "H", 3), ...filler(6)] });
    let st = applyAction(s, "s", { type: "play", cardId: dyn.id }, NOW);
    st = applyAction(st, "s", { type: "endTurn" }, NOW);
    // o1 턴 시작: 하트 → 안 터짐. 하지만 다이너마이트는 s(장착자) 턴 시작에 판정된다
    expect(p(st, "s").equipment.map((c) => c.name)).toEqual(["dynamite"]);
    // 한 바퀴 돌아 s 턴: 덱 위에 ♠5 → 폭발
    st.deck.push(card("bang", "S", 5));
    for (const id of ["o1", "o2", "r"]) {
      st = applyAction(st, id, { type: "draw" }, NOW);
      st = applyAction(st, id, { type: "endTurn" }, NOW);
    }
    expect(st.turn.playerId).toBe("s");
    expect(p(st, "s").hp).toBe(2);
    expect(p(st, "s").equipment).toHaveLength(0);
  });
});

describe("카드 효과", () => {
  it("인디언!: 뱅! 내거나 피해", () => {
    const ind = card("indians"), bang = card("bang");
    const s = four({ s: { hand: [ind] }, o1: { hand: [bang] } });
    let st = applyAction(s, "s", { type: "play", cardId: ind.id }, NOW);
    expect(st.pending[0]).toMatchObject({ kind: "indians", targets: ["o1", "o2", "r"] });
    st = applyAction(st, "o1", { type: "respond", cardIds: [bang.id] }, NOW);
    st = applyAction(st, "o2", { type: "respond", cardIds: [] }, NOW);
    expect(() => applyAction(st, "o2", { type: "respond", cardIds: [] }, NOW)).toThrow();
    st = applyAction(st, "r", { type: "respond", cardIds: [] }, NOW);
    expect(st.pending).toHaveLength(0);
    expect(p(st, "o1").hp).toBe(4);
    expect(p(st, "o2").hp).toBe(3);
    expect(p(st, "r").hp).toBe(3);
  });

  it("개틀링: 술통 자동 판정 후 나머지 응답", () => {
    const gat = card("gatling");
    const s = four(
      { s: { hand: [gat] }, o1: { equipment: [card("barrel")] } },
      { deck: [card("beer", "H", 6)] },
    );
    let st = applyAction(s, "s", { type: "play", cardId: gat.id }, NOW);
    // o1은 하트로 회피, 이제 o2 응답 차례
    expect(st.pending[0]).toMatchObject({ kind: "gatling", targets: ["o2", "r"] });
    st = applyAction(st, "o2", { type: "respond", cardIds: [] }, NOW);
    st = applyAction(st, "r", { type: "respond", cardIds: [] }, NOW);
    expect(st.pending).toHaveLength(0);
    expect(p(st, "o1").hp).toBe(4);
    expect(p(st, "o2").hp).toBe(3);
  });

  it("결투: 번갈아 뱅!, 못 내면 피해", () => {
    const duel = card("duel"), b1 = card("bang"), b2 = card("bang");
    const s = four({ s: { hand: [duel, b1] }, o1: { hand: [b2] } });
    let st = applyAction(s, "s", { type: "play", cardId: duel.id, targetId: "o1" }, NOW);
    expect(st.pending[0]).toMatchObject({ kind: "duel", current: "o1" });
    st = applyAction(st, "o1", { type: "respond", cardIds: [b2.id] }, NOW);
    expect(st.pending[0]).toMatchObject({ kind: "duel", current: "s" });
    st = applyAction(st, "s", { type: "respond", cardIds: [] }, NOW);
    expect(p(st, "s").hp).toBe(4); // 5 → 4
    expect(st.pending).toHaveLength(0);
    expect(st.turn.bangsPlayed).toBe(0); // 결투 중 뱅!은 턴 제한에 안 걸림
  });

  it("잡화점: 순서대로 선택, 마지막은 자동", () => {
    const gs = card("generalStore");
    const s = four({ s: { hand: [gs] } }, { deck: [card("beer"), card("missed"), card("bang"), card("saloon")] });
    let st = applyAction(s, "s", { type: "play", cardId: gs.id }, NOW);
    const pd = st.pending[0];
    expect(pd.kind).toBe("generalStore");
    if (pd.kind !== "generalStore") return;
    expect(pd.cards).toHaveLength(4);
    const want = pd.cards.find((c) => c.name === "bang")!;
    st = applyAction(st, "s", { type: "pickCards", cardIds: [want.id] }, NOW);
    expect(handNames(st, "s")).toEqual(["bang"]);
    st = applyAction(st, "o1", { type: "pickCards", cardIds: [(st.pending[0] as typeof pd).cards[0].id] }, NOW);
    st = applyAction(st, "o2", { type: "pickCards", cardIds: [(st.pending[0] as typeof pd).cards[0].id] }, NOW);
    expect(st.pending).toHaveLength(0);
    expect(p(st, "r").hand).toHaveLength(1);
  });

  it("패닉!은 거리 1, 캣 발루는 아무나. 장착 카드 지정 가능", () => {
    const panic = card("panic"), cat = card("catBalou");
    const mus = card("mustang");
    const s = four({ s: { hand: [panic, cat] }, o1: { hand: [card("beer")] }, o2: { equipment: [mus] } });
    expect(() => applyAction(s, "s", { type: "play", cardId: panic.id, targetId: "o2" }, NOW)).toThrow(/거리 1/);
    let st = applyAction(s, "s", { type: "play", cardId: panic.id, targetId: "o1", targetCardId: "hand" }, NOW);
    expect(handNames(st, "s")).toContain("beer");
    expect(p(st, "o1").hand).toHaveLength(0);
    st = applyAction(st, "s", { type: "play", cardId: cat.id, targetId: "o2", targetCardId: mus.id }, NOW);
    expect(p(st, "o2").equipment).toHaveLength(0);
    expect(st.discard.map((c) => c.name)).toContain("mustang");
  });

  it("맥주는 2인 남으면 불가, 술집은 전원 회복", () => {
    const beer = card("beer"), saloon = card("saloon");
    const s = four({ s: { hand: [beer, saloon], hp: 2 }, o1: { hp: 1 } });
    let st = applyAction(s, "s", { type: "play", cardId: saloon.id }, NOW);
    expect(p(st, "s").hp).toBe(3);
    expect(p(st, "o1").hp).toBe(2);
    st = applyAction(st, "s", { type: "play", cardId: beer.id }, NOW);
    expect(p(st, "s").hp).toBe(4);

    const s2 = makeState([{ id: "s", role: "sheriff", hp: 1, hand: [beer] }, { id: "r", role: "renegade" }]);
    expect(() => applyAction(s2, "s", { type: "play", cardId: beer.id }, NOW)).toThrow(/2명/);
  });

  it("역마차/웰스 파고", () => {
    const st = card("stagecoach"), wf = card("wellsFargo");
    const s = four({ s: { hand: [st, wf] } }, { deck: filler(10) });
    let a = applyAction(s, "s", { type: "play", cardId: st.id }, NOW);
    expect(p(a, "s").hand).toHaveLength(3);
    a = applyAction(a, "s", { type: "play", cardId: wf.id }, NOW);
    expect(p(a, "s").hand).toHaveLength(5);
  });
});

describe("캐릭터", () => {
  it("슬랩 더 킬러: 빗나감! 2장 필요", () => {
    const bang = card("bang"), m1 = card("missed"), m2 = card("missed");
    const s = four({ s: { hand: [bang], character: "slabTheKiller" }, o1: { hand: [m1, m2] } });
    const st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(() => applyAction(st, "o1", { type: "respond", cardIds: [m1.id] }, NOW)).toThrow(/2장/);
    const ok = applyAction(st, "o1", { type: "respond", cardIds: [m1.id, m2.id] }, NOW);
    expect(p(ok, "o1").hp).toBe(4);
  });

  it("캘러미티 재닛: 뱅!으로 막고 빗나감!으로 쏨", () => {
    const bang = card("bang"), missed = card("missed"), b2 = card("bang");
    const s = four({ s: { hand: [bang] }, o1: { hand: [b2, missed], character: "calamityJanet" } });
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [b2.id] }, NOW);
    expect(p(st, "o1").hp).toBe(4);
    st.turn.playerId = "o1";
    st.turn.bangsPlayed = 0;
    st = applyAction(st, "o1", { type: "play", cardId: missed.id, targetId: "s" }, NOW);
    expect(st.pending[0]).toMatchObject({ kind: "bang", to: "s" });
  });

  it("바트 캐시디: 피해마다 드로우 / 엘 그링고: 가해자 손패 강탈", () => {
    const bang = card("bang"), extra = card("beer");
    const s = four({ s: { hand: [bang, extra] }, o1: { character: "bartCassidy" } }, { deck: filler(3) });
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW);
    expect(p(st, "o1").hand).toHaveLength(1);

    const bang2 = card("bang");
    const s2 = four({ s: { hand: [bang2, extra] }, o1: { character: "elGringo" } });
    let st2 = applyAction(s2, "s", { type: "play", cardId: bang2.id, targetId: "o1" }, NOW);
    st2 = applyAction(st2, "o1", { type: "respond", cardIds: [] }, NOW);
    expect(handNames(st2, "o1")).toEqual(["beer"]);
    expect(p(st2, "s").hand).toHaveLength(0);
  });

  it("수지 라파예트: 손패 비면 1장", () => {
    const beer = card("beer");
    const s = four({ s: { hand: [beer], hp: 2, character: "suzyLafayette" } }, { deck: filler(3) });
    const st = applyAction(s, "s", { type: "play", cardId: beer.id }, NOW);
    expect(p(st, "s").hand).toHaveLength(1);
  });

  it("벌처 샘: 사망자 카드 획득", () => {
    const bang = card("bang");
    const s = four({ s: { hand: [bang] }, o1: { hp: 1, hand: [card("beer"), card("missed")], equipment: [card("scope")] }, r: { character: "vultureSam" } });
    // o1은 beer가 있어 dying 대기, 응답 없이 죽음
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW);
    expect(p(st, "o1").alive).toBe(false);
    expect(p(st, "r").hand).toHaveLength(3);
  });

  it("시드 케첨: 2장 버리고 회복, 죽기 직전에도 가능", () => {
    const a = card("beer"), b = card("beer"), bang = card("bang");
    const s = four({ s: { hand: [bang] }, o1: { character: "sidKetchum", hp: 1, hand: [a, b] } });
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW);
    expect(st.pending[0].kind).toBe("dying");
    st = applyAction(st, "o1", { type: "ability", name: "sidKetchum", cardIds: [a.id, b.id] }, NOW);
    expect(p(st, "o1").hp).toBe(1);
    expect(st.pending).toHaveLength(0);
  });

  it("킷 칼슨: 3장 중 2장 선택, 나머지는 덱 위로", () => {
    const s = four({ s: { character: "kitCarlson" } }, { deck: [card("beer"), card("bang"), card("missed"), card("saloon")] });
    s.turn.phase = "draw";
    let st = applyAction(s, "s", { type: "draw" }, NOW);
    const pd = st.pending[0];
    expect(pd.kind).toBe("kitCarlson");
    if (pd.kind !== "kitCarlson") return;
    const [x, y, z] = pd.cards;
    st = applyAction(st, "s", { type: "pickCards", cardIds: [x.id, z.id] }, NOW);
    expect(p(st, "s").hand.map((c) => c.id)).toEqual([x.id, z.id]);
    expect(st.deck[st.deck.length - 1].id).toBe(y.id);
    expect(st.turn.phase).toBe("play");
  });

  it("블랙 잭: 2번째가 빨간색이면 추가", () => {
    const s = four({ s: { character: "blackJack" } }, { deck: [card("beer", "C"), card("bang", "H"), card("missed", "S")] });
    s.turn.phase = "draw";
    const st = applyAction(s, "s", { type: "draw" }, NOW);
    expect(p(st, "s").hand).toHaveLength(3);
  });

  it("제시 존스 / 페드로 라미레즈 드로우 옵션", () => {
    const s = four({ s: { character: "jesseJones" }, o1: { hand: [card("beer")] } }, { deck: filler(3) });
    s.turn.phase = "draw";
    const st = applyAction(s, "s", { type: "draw", source: { playerId: "o1" } }, NOW);
    expect(handNames(st, "s")).toContain("beer");
    expect(p(st, "o1").hand).toHaveLength(0);

    const s2 = four({ s: { character: "pedroRamirez" } }, { deck: filler(3), discard: [card("saloon")] });
    s2.turn.phase = "draw";
    const st2 = applyAction(s2, "s", { type: "draw", source: "discard" }, NOW);
    expect(handNames(st2, "s")).toContain("saloon");
    expect(st2.discard).toHaveLength(0);
  });

  it("럭키 듀크: 판정 2장 중 유리한 쪽", () => {
    const bang = card("bang");
    const s = four(
      { s: { hand: [bang] }, o1: { character: "luckyDuke", equipment: [card("barrel")] } },
      { deck: [card("beer", "H"), card("beer", "S")] }, // pop 순서: ♠ 먼저, 그다음 ♥
    );
    const st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(st.pending).toHaveLength(0);
    expect(p(st, "o1").hp).toBe(4);
  });

  it("폴 리그렛/로즈 둘런 거리 보정, 주르도네 내장 술통", () => {
    const bang = card("bang");
    const s = four({ s: { hand: [bang], character: "roseDoolan" }, o2: { character: "paulRegret" } });
    // 거리 2 -1(로즈) +1(폴) = 2 > 1
    expect(() => applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o2" }, NOW)).toThrow(/사거리/);

    const s2 = four({ s: { hand: [bang] }, o1: { character: "jourdonnais" } }, { deck: [card("beer", "H")] });
    const st2 = applyAction(s2, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(st2.pending).toHaveLength(0);
  });
});

describe("불변성", () => {
  it("applyAction은 입력을 변경하지 않는다", () => {
    const bang = card("bang");
    const s: GameState = four({ s: { hand: [bang] } });
    const snapshot = JSON.stringify(s);
    applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
