"use client";

import type { HelpText } from "@/game/help";

/**
 * 테이블과 손패 사이의 한 줄 설명. 카드·좌석에 마우스를 올리면(모바일은 첫 탭) 바뀐다.
 * 브라우저 툴팁은 1초 기다려야 뜨고 모바일에선 아예 없어서 대신 둔다.
 */
export function HelpStrip({ help, hint }: { help: HelpText | null; hint: string }) {
  if (!help) {
    return (
      <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-white/45">
        {hint}
      </div>
    );
  }
  return (
    <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-[11px] leading-snug sm:text-xs">
      <b className="text-amber-300">{help.title}</b>
      <span className="text-white/80"> — {help.body}</span>
      {help.now && (
        <span className={`ml-1 font-semibold ${help.blocked ? "text-red-300" : "text-green-300"}`}>
          · {help.now}
        </span>
      )}
    </div>
  );
}
