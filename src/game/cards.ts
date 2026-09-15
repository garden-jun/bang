import type { Card, CardName, Rank, Suit, WeaponName } from "./types";

type Spec = [CardName, Suit, Rank];

const S = "S", H = "H", D = "D", C = "C";

/** 기본판 80장의 실제 무늬/숫자 구성 */
const SPECS: Spec[] = [
  // BANG! x25
  ["bang", S, 1],
  ...([2, 3, 4, 5, 6, 7, 8, 9] as Rank[]).map<Spec>((r) => ["bang", C, r]),
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as Rank[]).map<Spec>((r) => ["bang", D, r]),
  ["bang", H, 12], ["bang", H, 13], ["bang", H, 1],
  // Missed! x12
  ...([2, 3, 4, 5, 6, 7, 8] as Rank[]).map<Spec>((r) => ["missed", S, r]),
  ...([10, 11, 12, 13, 1] as Rank[]).map<Spec>((r) => ["missed", C, r]),
  // Beer x6
  ...([6, 7, 8, 9, 10, 11] as Rank[]).map<Spec>((r) => ["beer", H, r]),
  // Panic! x4
  ["panic", H, 11], ["panic", H, 12], ["panic", H, 1], ["panic", D, 8],
  // Cat Balou x4
  ["catBalou", D, 9], ["catBalou", D, 10], ["catBalou", D, 11], ["catBalou", H, 13],
  // Stagecoach x2, Wells Fargo x1
  ["stagecoach", S, 9], ["stagecoach", S, 9],
  ["wellsFargo", H, 3],
  // General Store x2
  ["generalStore", C, 9], ["generalStore", S, 12],
  // Indians! x2
  ["indians", D, 13], ["indians", D, 1],
  // Duel x3
  ["duel", D, 12], ["duel", S, 11], ["duel", C, 8],
  // Gatling x1, Saloon x1
  ["gatling", H, 10],
  ["saloon", H, 5],
  // 장착
  ["barrel", S, 12], ["barrel", S, 13],
  ["scope", S, 1],
  ["mustang", H, 8], ["mustang", H, 9],
  ["jail", S, 10], ["jail", S, 11], ["jail", H, 4],
  ["dynamite", H, 2],
  ["volcanic", S, 10], ["volcanic", C, 10],
  ["schofield", C, 11], ["schofield", C, 12], ["schofield", S, 13],
  ["remington", C, 13],
  ["carabine", C, 1],
  ["winchester", S, 8],
];

export function buildDeck(): Card[] {
  return SPECS.map(([name, suit, rank], i) => ({
    id: `${name}-${suit}${rank}-${i}`,
    name,
    suit,
    rank,
  }));
}

export const EQUIPMENT: ReadonlySet<CardName> = new Set([
  "barrel", "scope", "mustang", "jail", "dynamite",
  "volcanic", "schofield", "remington", "carabine", "winchester",
]);

export const WEAPON_RANGE: Record<WeaponName, number> = {
  volcanic: 1,
  schofield: 2,
  remington: 3,
  carabine: 4,
  winchester: 5,
};

export function isWeapon(name: CardName): name is WeaponName {
  return name in WEAPON_RANGE;
}

export function isEquipment(name: CardName): boolean {
  return EQUIPMENT.has(name);
}

/** Barrel / Jail 판정: 하트면 성공 */
export const isHeart = (c: Card) => c.suit === "H";
/** Dynamite 판정: ♠2~9면 폭발 */
export const isDynamiteExplode = (c: Card) => c.suit === "S" && c.rank >= 2 && c.rank <= 9;
/** Black Jack: 하트/다이아면 추가 드로우 */
export const isRed = (c: Card) => c.suit === "H" || c.suit === "D";
