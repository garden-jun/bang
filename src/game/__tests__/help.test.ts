import { describe, expect, it } from "vitest";
import { applyAction } from "../engine";
import { describeSituation, explainCard, explainSeat } from "../help";
import { toView } from "../view";
import { playReason, targetReason, viewDistance } from "../viewRules";
import { NOW, card, makeState, p } from "./util";

function four() {
  return makeState([
    { id: "s", role: "sheriff" },
    { id: "o1", role: "outlaw" },
    { id: "o2", role: "outlaw" },
    { id: "r", role: "renegade" },
  ]);
}
const asPlayer = (state: ReturnType<typeof four>, id: string) => toView(state, { kind: "player", id });

describe("상황 설명", () => {
  it("플레이 단계", () => {
    const v = asPlayer(four(), "s");
    expect(describeSituation(v)).toBe("S의 플레이 단계 — 카드를 원하는 만큼 사용합니다 (뱅!은 턴당 1장)");
  });

  it("뱅! 대응 대기", () => {
    const bang = card("bang");
    const st = four();
    p(st, "s").hand = [bang];
    const after = applyAction(st, "s", { type: "play", cardId: bang.id, targetId: "o1" }, NOW);
    expect(describeSituation(asPlayer(after, "o2"))).toBe("S이(가) O1에게 뱅! — O1은(는) 빗나감! 1장으로 막거나 피해 1");
  });

  it("드로우 단계에 캐릭터 변형 안내", () => {
    const st = four();
    st.turn.phase = "draw";
    p(st, "s").character = "kitCarlson";
    expect(describeSituation(asPlayer(st, "s"))).toContain("킷 칼슨: 3장을 보고 2장 선택");
  });
});

describe("카드 설명", () => {
  it("사거리 밖이면 이유를 말한다", () => {
    const st = four();
    // o1은 거리 1 — 머스탱을 줘서 2로 만든다. o2는 거리 2, r은 거리 1 → r도 머스탱
    p(st, "o1").equipment = [card("mustang")];
    p(st, "r").equipment = [card("mustang")];
    const v = asPlayer(st, "s");
    const me = v.players.find((x) => x.id === "s")!;
    expect(playReason(v, me, card("bang"), true)).toBe("사거리(1) 안에 쏠 사람이 없습니다");
    const h = explainCard(v, me, card("bang"), true);
    expect(h.blocked).toBe(true);
    expect(h.title).toBe("뱅!");
  });

  it("낼 수 있으면 대상 목록을 보여준다", () => {
    const v = asPlayer(four(), "s");
    const me = v.players.find((x) => x.id === "s")!;
    const h = explainCard(v, me, card("bang"), true);
    expect(h.blocked).toBeUndefined();
    expect(h.now).toBe("지금 사용 가능 — 대상: O1, R");
  });

  it("내 턴이 아닐 때, 빗나감!, 맥주 2인 규칙", () => {
    const st = four();
    const v = asPlayer(st, "o1");
    const me = v.players.find((x) => x.id === "o1")!;
    expect(playReason(v, me, card("bang"), false)).toBe("내 턴이 아닙니다");
    const vs = asPlayer(st, "s");
    const s = vs.players.find((x) => x.id === "s")!;
    expect(playReason(vs, s, card("missed"), true)).toBe("빗나감!은 뱅!을 맞을 때 대응으로만 씁니다");

    const two = makeState([{ id: "s", role: "sheriff", hp: 1 }, { id: "r", role: "renegade" }]);
    const v2 = asPlayer(two, "s");
    expect(playReason(v2, v2.players[0], card("beer"), true)).toBe("2명만 남으면 맥주를 쓸 수 없습니다");
  });

  it("대상 불가 이유", () => {
    const v = asPlayer(four(), "s");
    const me = v.players.find((x) => x.id === "s")!;
    const o2 = v.players.find((x) => x.id === "o2")!;
    expect(targetReason(v, me, card("bang"), o2)).toBe("거리 2 — 사거리(1) 밖");
    expect(targetReason(v, me, card("jail"), me)).toBe("자신은 대상이 될 수 없습니다");
  });
});

describe("좌석 설명", () => {
  // 실제로 겪은 혼동: 바로 옆자리인데 거리가 2로 나와 "머스탱도 없는데?" 했던 경우.
  // 폴 리그렛은 장착 없이도 머스탱 효과를 가지므로 2가 맞다.
  it("옆자리 폴 리그렛은 장착이 없어도 거리 2", () => {
    const st = four();
    p(st, "o1").character = "paulRegret";
    expect(p(st, "o1").equipment).toHaveLength(0);
    const v = asPlayer(st, "s");
    const me = v.players.find((x) => x.id === "s")!;
    const jake = v.players.find((x) => x.id === "o1")!;
    // 좌석상으로는 바로 옆(1)이지만 내재 머스탱으로 2
    expect(viewDistance(v, "s", "o1")).toBe(2);
    const h = explainSeat(v, me, jake);
    expect(h.now).toBe("거리 2 (상대 폴 리그렛 능력 +1) — 내 사거리(1) 밖, 더 긴 무기가 필요합니다");
    // 장착 카드가 아니라 캐릭터 능력임이 드러나야 한다
    expect(h.now).not.toContain("상대 머스탱");
    expect(h.body).toContain("머스탱을 항상 가진 것으로 취급한다");
  });

  it("진짜 머스탱을 장착했으면 카드 이름으로 말한다", () => {
    const st = four();
    p(st, "o1").equipment = [card("mustang")];
    const v = asPlayer(st, "s");
    const me = v.players.find((x) => x.id === "s")!;
    const h = explainSeat(v, me, v.players.find((x) => x.id === "o1")!);
    expect(h.now).toContain("상대 머스탱 +1");
    expect(h.now).not.toContain("폴 리그렛");
  });

  it("로즈 둘런도 조준경 장착과 구분된다", () => {
    const st = four();
    p(st, "s").character = "roseDoolan";
    const v = asPlayer(st, "s");
    const me = v.players.find((x) => x.id === "s")!;
    const h = explainSeat(v, me, v.players.find((x) => x.id === "o2")!);
    expect(h.now).toContain("내 로즈 둘런 능력 -1");
  });

  it("거리·사거리와 보정 요인", () => {
    const st = four();
    p(st, "o2").equipment = [card("mustang")];
    p(st, "s").equipment = [card("scope"), card("winchester")];
    const v = asPlayer(st, "s");
    const me = v.players.find((x) => x.id === "s")!;
    const h = explainSeat(v, me, v.players.find((x) => x.id === "o2")!);
    expect(h.now).toBe("거리 2 (상대 머스탱 +1, 내 조준경 -1) — 내 사거리(5) 안, 뱅!을 쏠 수 있습니다");
    expect(h.body).toContain("윌리 더 키드");
  });
});
