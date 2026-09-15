import type { Role } from "./types";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 7;

/** 인원수별 역할 구성 */
export function rolesFor(count: number): Role[] {
  const roles: Role[] = ["sheriff", "renegade", "outlaw", "outlaw"];
  if (count >= 5) roles.push("deputy");
  if (count >= 6) roles.push("outlaw");
  if (count >= 7) roles.push("deputy");
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new Error(`지원하지 않는 인원: ${count}`);
  }
  return roles;
}
