import { describe, expect, it } from "vitest";
import { applyAction } from "../engine";
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
});
