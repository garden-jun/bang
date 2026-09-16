import { describe, expect, it } from "vitest";
import { discardArrival, landMs, landedBoard } from "@/shared/landing";
import type { LogEntry } from "../types";
import { card } from "./util";

const bang = card("bang"), missed = card("missed"), heart = card("beer", "H", 5);

/** o1이 2장 뽑고, s가 뱅!을 쏘고, o1이 술통 판정 */
const log: LogEntry[] = [
  { t: 10, msg: "이전" },
  { t: 11, msg: "뽑기", moves: [{ from: "deck", to: "hand:o1" }, { from: "deck", to: "hand:o1" }] },
  { t: 12, msg: "뱅!", moves: [{ from: "hand:s", to: "discard", card: bang }] },
  { t: 13, msg: "판정", meta: { kind: "check", from: "o1", check: "barrel", cards: [heart], ok: true } },
];
const game = {
  log,
  players: [
    { id: "s", handCount: 3 },
    { id: "o1", handCount: 5 },
  ],
  discardTop: heart,
};

describe("카드가 도착한 만큼만 보여주기", () => {
  it("아직 안 도착한 줄의 이동을 손패 수에서 되돌린다", () => {
    expect(landedBoard(game, 10, missed).handCount).toEqual({ s: 4, o1: 3 });
    expect(landedBoard(game, 11, missed).handCount).toEqual({ s: 4, o1: 5 });
    expect(landedBoard(game, 13, heart).handCount).toEqual({ s: 3, o1: 5 });
  });

  it("버림 더미는 도착한 카드까지 — 판정 카드도 얹힌다", () => {
    expect(landedBoard(game, 11, missed).discardTop).toBe(missed);
    expect(landedBoard(game, 12, bang).discardTop).toBe(bang);
    // 다 도착하면 도착 기록과 상관없이 실제 상태
    expect(landedBoard(game, 13, bang).discardTop).toBe(heart);
    expect(discardArrival(log[3])).toBe(heart);
  });

  it("첫 버림이 아직 안 도착했으면 버림 더미는 빈 채로", () => {
    expect(landedBoard(game, 11, undefined).discardTop).toBeUndefined();
  });

  it("내 손패 수는 늦추지 않는다 — 내 손패 카드는 즉시 보인다", () => {
    expect(landedBoard(game, 10, missed, "s").handCount).toEqual({ s: 3, o1: 3 });
  });

  it("손패 수는 음수가 되지 않는다 (로그에 없는 이동이 섞여도)", () => {
    const g = { ...game, players: [{ id: "s", handCount: 0 }, { id: "o1", handCount: 1 }] };
    expect(landedBoard(g, 10, undefined).handCount).toEqual({ s: 1, o1: 0 });
  });

  it("도착 시각: 여러 장이면 마지막 카드 기준, 날릴 카드가 없으면 바로", () => {
    expect(landMs(0)).toBe(0);
    expect(landMs(2)).toBeGreaterThan(landMs(1));
  });
});
