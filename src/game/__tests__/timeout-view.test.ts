import { describe, expect, it } from "vitest";
import { applyAction } from "../engine";
import { applyTimeouts } from "../timeout";
import { toView } from "../view";
import { NOW, card, filler, makeState, p } from "./util";

function four() {
  return makeState(
    [
      { id: "s", role: "sheriff" },
      { id: "o1", role: "outlaw" },
      { id: "o2", role: "outlaw" },
      { id: "r", role: "renegade" },
    ],
    { deck: filler(20) },
  );
}

describe("타임아웃", () => {
  it("마감 전이면 아무것도 안 함", () => {
    const s = four();
    expect(applyTimeouts(s, NOW + 1000)).toBeNull();
  });

  it("플레이 단계 마감 → 턴 종료 (초과 손패도 즉시 버림)", () => {
    const s = four();
    p(s, "s").hp = 1;
    p(s, "s").hand = filler(4);
    const st = applyTimeouts(s, NOW + 61_000)!;
    expect(st.turn.playerId).toBe("o1");
    expect(p(st, "s").hand).toHaveLength(1);
  });

  it("뱅! 응답 마감 → 맞음", () => {
    const bang = card("bang");
    const s = four();
    p(s, "s").hand = [bang];
    const st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    const after = applyTimeouts(st, NOW + 31_000)!;
    expect(p(after, "o1").hp).toBe(3);
    expect(after.pending).toHaveLength(0);
  });

  it("연결 끊긴 플레이어는 5초만 기다리고 턴 전체가 자동 진행됨", () => {
    const s = four();
    s.turn.phase = "draw";
    expect(applyTimeouts(s, NOW + 6000)).toBeNull();
    const st = applyTimeouts(s, NOW + 6000, (id) => id === "s")!;
    expect(p(st, "s").hand).toHaveLength(2); // 자동 드로우
    expect(st.turn.playerId).toBe("o1"); // 플레이 단계도 바로 넘어감
  });

  it("죽기 직전 마감 → 맥주가 충분하면 자동 사용", () => {
    const bang = card("bang"), beer = card("beer");
    const s = four();
    p(s, "s").hand = [bang];
    p(s, "o1").hp = 1;
    p(s, "o1").hand = [beer];
    let st = applyAction(s, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    st = applyAction(st, "o1", { type: "respond", cardIds: [] }, NOW);
    const after = applyTimeouts(st, NOW + 31_000)!;
    expect(p(after, "o1").alive).toBe(true);
    expect(p(after, "o1").hp).toBe(1);
  });
});

describe("뷰 가림", () => {
  it("플레이어는 자기 손패/역할만, 관전자(공개)는 아무 손패도 못 봄", () => {
    const s = four();
    p(s, "s").hand = [card("bang")];
    p(s, "o1").hand = [card("beer")];
    const v = toView(s, { kind: "player", id: "o1" });
    expect(v.players.find((x) => x.id === "o1")!.hand).toHaveLength(1);
    expect(v.players.find((x) => x.id === "o1")!.role).toBe("outlaw");
    expect(v.players.find((x) => x.id === "s")!.hand).toBeUndefined();
    expect(v.players.find((x) => x.id === "s")!.handCount).toBe(1);
    expect(v.players.find((x) => x.id === "s")!.role).toBe("sheriff");
    expect(v.players.find((x) => x.id === "o2")!.role).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain('"deck"');

    const sp = toView(s, { kind: "spectator", revealAll: false });
    expect(sp.players.every((x) => x.hand === undefined)).toBe(true);
    const all = toView(s, { kind: "spectator", revealAll: true });
    expect(all.players.every((x) => x.role !== undefined)).toBe(true);
  });

  it("게임 종료 후엔 전원 역할 공개", () => {
    const s = four();
    s.winner = "outlaws";
    const v = toView(s, { kind: "player", id: "s" });
    expect(v.players.every((x) => x.role !== undefined)).toBe(true);
  });
});
