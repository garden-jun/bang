import type { CharacterName } from "./types";

export const CHARACTERS: Record<CharacterName, { hp: number }> = {
  bartCassidy: { hp: 4 },
  blackJack: { hp: 4 },
  calamityJanet: { hp: 4 },
  elGringo: { hp: 3 },
  jesseJones: { hp: 4 },
  jourdonnais: { hp: 4 },
  kitCarlson: { hp: 4 },
  luckyDuke: { hp: 4 },
  paulRegret: { hp: 3 },
  pedroRamirez: { hp: 4 },
  roseDoolan: { hp: 4 },
  sidKetchum: { hp: 4 },
  slabTheKiller: { hp: 4 },
  suzyLafayette: { hp: 4 },
  vultureSam: { hp: 4 },
  willyTheKid: { hp: 4 },
};

export const CHARACTER_NAMES = Object.keys(CHARACTERS) as CharacterName[];
