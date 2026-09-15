"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/game/types";

/**
 * 회색 텍스트 20줄이 쌓여 있으면 "방금 무슨 일이 있었는지"를 읽을 수 없다.
 * 턴 경계로 묶고, 피해·사망만 색을 준다.
 */
export function LogFeed({ log }: { log: LogEntry[] }) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [log.length]);

  return (
    <div className="h-full overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2.5 text-[11px] lg:max-h-full">
      <h3 className="mb-1.5 text-xs font-bold text-amber-400">기록</h3>
      <ul className="space-y-0.5">
        {log.map((l) => (
          <li key={l.t} className={lineClass(l.msg)}>
            {l.msg}
          </li>
        ))}
      </ul>
      <div ref={bottom} />
    </div>
  );
}

function lineClass(msg: string): string {
  // 턴 구분선
  if (msg.startsWith("—")) return "mt-2 border-t border-white/10 pt-1.5 font-bold text-amber-300/80";
  if (msg.includes("사망") || msg.includes("탈락") || msg.includes("승리")) return "font-bold text-red-300";
  if (msg.includes("피해")) return "text-red-300/80";
  if (msg.includes("회복")) return "text-green-300/80";
  if (msg.includes("빗나감")) return "text-sky-300/80";
  return "text-white/60";
}
