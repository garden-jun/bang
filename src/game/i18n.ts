import type { Card, CardName, CharacterName, Role, Suit } from "./types";

export const CARD_KO: Record<CardName, { name: string; desc: string }> = {
  bang: { name: "뱅!", desc: "사거리 안의 한 명에게 피해 1. 턴당 1장." },
  missed: { name: "빗나감!", desc: "뱅!을 무효로 만든다." },
  beer: { name: "맥주", desc: "생명 1 회복. 2명만 남으면 효과 없음." },
  panic: { name: "패닉!", desc: "거리 1의 플레이어에게서 카드 1장을 가져온다." },
  catBalou: { name: "캣 발루", desc: "아무 플레이어의 카드 1장을 버리게 한다." },
  stagecoach: { name: "역마차", desc: "카드 2장을 뽑는다." },
  wellsFargo: { name: "웰스 파고", desc: "카드 3장을 뽑는다." },
  generalStore: { name: "잡화점", desc: "인원수만큼 공개하고 순서대로 1장씩 가져간다." },
  indians: { name: "인디언!", desc: "다른 모두는 뱅!을 내거나 피해 1." },
  duel: { name: "결투", desc: "대상과 번갈아 뱅!을 낸다. 못 내면 피해 1." },
  gatling: { name: "개틀링", desc: "다른 모두에게 뱅!." },
  saloon: { name: "술집", desc: "모두 생명 1 회복." },
  barrel: { name: "술통", desc: "뱅!을 맞을 때 판정, 하트면 무효." },
  scope: { name: "조준경", desc: "남을 볼 때 거리 -1." },
  mustang: { name: "머스탱", desc: "남이 나를 볼 때 거리 +1." },
  jail: { name: "감옥", desc: "턴 시작 시 판정, 하트가 아니면 턴을 건너뛴다." },
  dynamite: { name: "다이너마이트", desc: "턴 시작 시 판정, ♠2~9면 피해 3. 아니면 왼쪽으로 넘어간다." },
  volcanic: { name: "볼캐닉", desc: "사거리 1, 뱅! 무제한." },
  schofield: { name: "스코필드", desc: "사거리 2." },
  remington: { name: "레밍턴", desc: "사거리 3." },
  carabine: { name: "카빈", desc: "사거리 4." },
  winchester: { name: "윈체스터", desc: "사거리 5." },
};

export const CHARACTER_KO: Record<CharacterName, { name: string; desc: string }> = {
  bartCassidy: { name: "바트 캐시디", desc: "피해 1당 카드 1장을 뽑는다." },
  blackJack: { name: "블랙 잭", desc: "드로우 2번째 카드를 공개하고, 빨간색이면 1장 더 뽑는다." },
  calamityJanet: { name: "캘러미티 재닛", desc: "뱅!과 빗나감!을 서로 대신 쓸 수 있다." },
  elGringo: { name: "엘 그링고", desc: "피해를 입힌 플레이어의 손패에서 1장 가져온다." },
  jesseJones: { name: "제시 존스", desc: "드로우 첫 장을 다른 플레이어 손패에서 가져올 수 있다." },
  jourdonnais: { name: "주르도네", desc: "술통을 항상 가진 것으로 취급한다." },
  kitCarlson: { name: "킷 칼슨", desc: "드로우 시 3장을 보고 2장을 고른다." },
  luckyDuke: { name: "럭키 듀크", desc: "판정 시 2장을 뽑아 유리한 쪽을 고른다." },
  paulRegret: { name: "폴 리그렛", desc: "머스탱을 항상 가진 것으로 취급한다." },
  pedroRamirez: { name: "페드로 라미레즈", desc: "드로우 첫 장을 버림 더미에서 가져올 수 있다." },
  roseDoolan: { name: "로즈 둘런", desc: "조준경을 항상 가진 것으로 취급한다." },
  sidKetchum: { name: "시드 케첨", desc: "카드 2장을 버리고 생명 1을 회복한다." },
  slabTheKiller: { name: "슬랩 더 킬러", desc: "그의 뱅!을 막으려면 빗나감! 2장이 필요하다." },
  suzyLafayette: { name: "수지 라파예트", desc: "손패가 없어지면 즉시 1장 뽑는다." },
  vultureSam: { name: "벌처 샘", desc: "죽은 플레이어의 카드를 모두 가져온다." },
  willyTheKid: { name: "윌리 더 키드", desc: "뱅!을 무제한으로 쓸 수 있다." },
};

export const ROLE_KO: Record<Role, string> = {
  sheriff: "보안관",
  deputy: "부관",
  outlaw: "무법자",
  renegade: "배신자",
};

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

const RANK_LABEL: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

export function cardLabel(c: Card): string {
  return `${CARD_KO[c.name].name} ${SUIT_SYMBOL[c.suit]}${RANK_LABEL[c.rank] ?? c.rank}`;
}
