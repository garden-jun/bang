import type { Candidate } from "@/game/bot";
import type { GameView } from "@/game/view";
import { CARD_KO, CHARACTER_KO, ROLE_KO } from "@/game/i18n";

const MODEL = "gpt-4o-mini";
/** 이 안에 답이 안 오면 기다리지 않고 기본 수를 둔다 */
const TIMEOUT_MS = 2500;

/**
 * 후보 중 하나를 고른다. **어떤 경우에도 유효한 인덱스를 돌려준다.**
 *
 * 속도가 우선이라 LLM은 선택이 실제로 갈릴 때만 부르고, 늦으면 버린다.
 * 키가 없거나 호출이 실패해도 게임은 그대로 굴러간다 (0번 = 무난한 기본값).
 */
export async function chooseCandidate(view: GameView, me: string, candidates: Candidate[]): Promise<number> {
  if (candidates.length <= 1) return 0;

  const key = process.env.OPENAI_API_KEY;
  if (!key) return 0;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      signal: ac.signal,
      body: JSON.stringify({
        model: MODEL,
        // 번호 하나만 받으면 되므로 최대한 짧게 — 지연의 대부분이 출력 토큰이다
        max_tokens: 4,
        temperature: 0.9,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt(view, me, candidates) },
        ],
      }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const n = Number.parseInt(raw.match(/\d+/)?.[0] ?? "", 10);
    return Number.isInteger(n) && n >= 0 && n < candidates.length ? n : 0;
  } catch {
    // 타임아웃·네트워크 오류 — 기다리지 않는다
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM =
  "너는 카드게임 BANG!의 플레이어다. 주어진 선택지 중 하나를 골라 **번호만** 출력한다. " +
  "설명하지 마라. 숫자 하나만.";

/**
 * 프롬프트는 **봇에게 보이는 뷰**로만 만든다 — 서버는 전체 상태를 알지만
 * 그걸 넣으면 봇이 남의 손패를 보고 두게 된다.
 */
function prompt(view: GameView, me: string, candidates: Candidate[]): string {
  const self = view.players.find((p) => p.id === me);
  const nick = (id: string) => view.names[id] ?? id;
  const lines: string[] = [];

  if (self) {
    lines.push(
      `나: ${nick(me)} / ${CHARACTER_KO[self.character].name} / 생명 ${self.hp}·${self.maxHp}` +
        (self.role ? ` / 역할 ${ROLE_KO[self.role]}` : ""),
    );
  }
  lines.push(
    "다른 사람: " +
      view.players
        .filter((p) => p.id !== me)
        .map(
          (p) =>
            `${nick(p.id)}(${p.alive ? `생명 ${p.hp}` : "사망"}, 손패 ${p.handCount}장` +
            (p.role ? `, ${ROLE_KO[p.role]}` : "") +
            ")",
        )
        .join(", "),
  );
  if (self?.hand?.length) {
    lines.push("내 손패: " + self.hand.map((c) => CARD_KO[c.name].name).join(", "));
  }
  const recent = view.log.slice(-6).map((l) => l.msg);
  if (recent.length) lines.push("최근 상황:\n" + recent.join("\n"));

  lines.push("\n선택지:");
  candidates.forEach((c, i) => lines.push(`${i}) ${c.label}`));
  lines.push("\n번호만 출력:");
  return lines.join("\n");
}
