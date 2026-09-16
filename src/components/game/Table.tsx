"use client";

import type { ReactNode } from "react";

/**
 * 좌석을 타원으로 돌려 앉힌다.
 *
 * 격자로 늘어놓으면 누가 누구 옆인지가 사라지는데, BANG!은 거리가 규칙의
 * 중심이라 그게 곧 게임을 못 읽게 만든다. 내 자리는 항상 아래 중앙이고
 * 나머지는 시계 방향 순서 그대로 앉는다.
 */
export function Table({
  seats,
  center,
}: {
  /** 시계 방향 순서. 마지막 원소가 나(아래 중앙) */
  seats: ReactNode[];
  center: ReactNode;
}) {
  const n = seats.length;

  return (
    <div className="relative h-full w-full">
      {/* 펠트 */}
      <div
        className="absolute inset-x-[14%] inset-y-[12%] rounded-[45%] border border-amber-950/40"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, var(--felt) 0%, var(--felt-edge) 80%)",
          boxShadow: "inset 0 0 70px rgba(0,0,0,0.6), 0 0 0 6px rgba(120,53,15,0.25)",
        }}
      />

      {/* 덱·버림 — 작은 화면에서는 좌석이 중앙까지 차서 숨긴다 (게임판이 글자로 대신 보여준다) */}
      <div className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 sm:block">{center}</div>

      {seats.map((seat, i) => {
        // 마지막(나)이 아래 중앙(90°), 나머지는 시계 방향으로 균등 배치
        const angle = (Math.PI / 2) + ((i + 1) / n) * Math.PI * 2;
        // 가로 반경을 작게 잡아야 양 끝 좌석이 화면 밖으로 잘리지 않는다
        const x = 50 + Math.cos(angle) * 34;
        const y = 50 + Math.sin(angle) * 49;
        // 좌석 상자를 중심이 아니라 가장자리로 앉힌다 — 화면이 낮으면(모바일) 위 좌석이
        // 타이머를, 아래 좌석이 손패를 덮었다. 위쪽 좌석은 윗변, 아래쪽은 아랫변을 기준.
        const anchor = y < 45 ? "translate-y-0" : y > 55 ? "-translate-y-full" : "-translate-y-1/2";
        return (
          <div
            key={i}
            className={`absolute z-20 w-[30%] min-w-0 max-w-[10rem] -translate-x-1/2 ${anchor}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {seat}
          </div>
        );
      })}
    </div>
  );
}
