import { describe, expect, it } from "vitest";
import { log } from "../core";
import { applyAction, settle } from "../engine";
import { NOW, card, makeState, p } from "./util";

function four() {
  return makeState([
    { id: "s", role: "sheriff" },
    { id: "o1", role: "outlaw" },
    { id: "o2", role: "outlaw" },
    { id: "r", role: "renegade" },
  ]);
}
const last = (st: ReturnType<typeof four>) => st.log[st.log.length - 1];

describe("로그 메타 (연출용)", () => {
  it("뱅!은 from/to, 빗나감!은 dodge", () => {
    const bang = card("bang"), missed = card("missed");
    const st = four();
    p(st, "s").hand = [bang];
    p(st, "o1").hand = [missed];
    const a = applyAction(st, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(a.log.find((l) => l.meta?.kind === "bang")?.meta).toEqual({ kind: "bang", from: "s", to: "o1" });
    const b = applyAction(a, "o1", { type: "respond", cardIds: [missed.id] }, NOW);
    expect(last(b).meta).toEqual({ kind: "dodge", from: "o1" });
  });

  it("인디언!/개틀링은 targets, 결투는 응답마다 화살표가 바뀐다", () => {
    const ind = card("indians"), duel = card("duel"), b1 = card("bang");
    const st = four();
    p(st, "s").hand = [ind, duel];
    p(st, "o1").hand = [b1];
    const a = applyAction(st, "s", { type: "play", cardId: ind.id }, NOW);
    expect(a.log.find((l) => l.meta?.kind === "indians")?.meta).toEqual({ kind: "indians", from: "s", targets: ["o1", "o2", "r"] });
    let b = a;
    for (const id of ["o1", "o2", "r"]) b = applyAction(b, id, { type: "respond", cardIds: id === "o1" ? [b1.id] : [] }, NOW);
    p(b, "o1").hand = [card("bang")];
    const c = applyAction(b, "s", { type: "play", cardId: duel.id, targetId: "o1" }, NOW);
    expect(last(c).meta).toEqual({ kind: "duel", from: "s", to: "o1" });
    const d = applyAction(c, "o1", { type: "respond", cardIds: [p(c, "o1").hand[0].id] }, NOW);
    expect(last(d).meta).toEqual({ kind: "duel", from: "o1", to: "s" });
  });

  it("패닉!/캣 발루/감옥", () => {
    const panic = card("panic"), cat = card("catBalou"), jail = card("jail");
    const st = four();
    p(st, "s").hand = [panic, cat, jail];
    p(st, "o1").hand = [card("beer")];
    p(st, "o2").equipment = [card("mustang")];
    let a = applyAction(st, "s", { type: "play", cardId: panic.id, targetId: "o1", targetCardId: "hand" }, NOW);
    expect(last(a).meta).toEqual({ kind: "panic", from: "s", to: "o1" });
    a = applyAction(a, "s", { type: "play", cardId: cat.id, targetId: "o2", targetCardId: p(a, "o2").equipment[0].id }, NOW);
    expect(last(a).meta).toEqual({ kind: "catBalou", from: "s", to: "o2" });
    a = applyAction(a, "s", { type: "play", cardId: jail.id, targetId: "r" }, NOW);
    expect(last(a).meta).toEqual({ kind: "jail", from: "s", to: "r" });
  });

  it("턴 시작 판정: check 메타와 결과(탈출/건너뜀/폭발), 불발 다이너마이트는 화살표", () => {
    const heart = card("beer", "H", 5), club = card("beer", "C", 5), spade3 = card("beer", "S", 3);
    // 덱은 뒤에서부터 뽑는다
    const st = four();
    st.turn = { ...st.turn, playerId: "o1", phase: "start" };
    p(st, "o1").equipment = [card("jail"), card("dynamite")];
    st.deck = [heart, club];
    settle(st, NOW);
    const metas = st.log.map((l) => l.meta).filter(Boolean);
    expect(metas).toEqual([
      { kind: "check", from: "o1", check: "dynamite", cards: [club], ok: false },
      { kind: "dynamite", from: "o1", to: "o2" },
      { kind: "check", from: "o1", check: "jail", cards: [heart], ok: true },
      { kind: "outcome", from: "o1", outcome: "escape" },
    ]);

    const st2 = four();
    st2.turn = { ...st2.turn, playerId: "o1", phase: "start" };
    p(st2, "o1").equipment = [card("jail"), card("dynamite")];
    st2.deck = [club, spade3];
    settle(st2, NOW);
    const m2 = st2.log.map((l) => l.meta).filter(Boolean);
    expect(m2).toContainEqual({ kind: "outcome", from: "o1", outcome: "explode" });
    expect(m2).toContainEqual({ kind: "outcome", from: "o1", outcome: "skip" });
  });

  it("술통 판정도 check 메타", () => {
    const bang = card("bang");
    const st = four();
    p(st, "s").hand = [bang];
    p(st, "o1").equipment = [card("barrel")];
    st.deck = [card("beer", "H", 2)];
    const a = applyAction(st, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(a.log.find((l) => l.meta?.kind === "check")?.meta).toMatchObject({ kind: "check", from: "o1", check: "barrel", ok: true });
  });
});

describe("로그 번호", () => {
  it("앞을 잘라낸 뒤에도 계속 늘어난다 (화면이 새 줄을 알아채는 기준)", () => {
    const st = four();
    for (let i = 0; i < 200; i++) log(st, `줄 ${i}`);
    const ts = st.log.map((l) => l.t);
    expect(new Set(ts).size).toBe(ts.length);
    expect(ts.at(-1)).toBe(199);
  });
});
