import { describe, expect, it } from "vitest";
import { buildDeck } from "../cards";
import { rolesFor } from "../roles";
import { createGame } from "../setup";

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` }));

describe("덱", () => {
  it("80장, 뱅! 25장, 빗나감! 12장", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(80);
    expect(deck.filter((c) => c.name === "bang")).toHaveLength(25);
    expect(deck.filter((c) => c.name === "missed")).toHaveLength(12);
    expect(new Set(deck.map((c) => c.id)).size).toBe(80);
  });
});

describe("역할", () => {
  it.each([
    [4, { sheriff: 1, deputy: 0, outlaw: 2, renegade: 1 }],
    [5, { sheriff: 1, deputy: 1, outlaw: 2, renegade: 1 }],
    [6, { sheriff: 1, deputy: 1, outlaw: 3, renegade: 1 }],
    [7, { sheriff: 1, deputy: 2, outlaw: 3, renegade: 1 }],
  ])("%d인", (n, expected) => {
    const roles = rolesFor(n);
    for (const [role, count] of Object.entries(expected)) {
      expect(roles.filter((r) => r === role)).toHaveLength(count);
    }
  });
  it("3인/8인은 거부", () => {
    expect(() => rolesFor(3)).toThrow();
    expect(() => rolesFor(8)).toThrow();
  });
});

describe("게임 시작", () => {
  it("보안관 첫 턴, 생명만큼 손패, 보안관 +1 생명", () => {
    const s = createGame(players(5), "seed", 0);
    const sheriff = s.players.find((p) => p.role === "sheriff")!;
    expect(s.turn.playerId).toBe(sheriff.id);
    expect(sheriff.roleRevealed).toBe(true);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(p.maxHp);
      if (p.role !== "sheriff") expect(p.roleRevealed).toBe(false);
    }
    const total = s.deck.length + s.players.reduce((a, p) => a + p.hand.length, 0);
    expect(total).toBe(80);
    expect(new Set(s.players.map((p) => p.character)).size).toBe(5);
  });

  it("같은 시드면 같은 결과", () => {
    const a = createGame(players(4), "x", 0);
    const b = createGame(players(4), "x", 0);
    expect(a.players.map((p) => p.role)).toEqual(b.players.map((p) => p.role));
    expect(a.deck.map((c) => c.id)).toEqual(b.deck.map((c) => c.id));
  });
});
