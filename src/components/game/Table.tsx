"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ArrowEvent } from "@/hooks/useGameEvents";
import type { CardName } from "@/game/types";
import { CardIcon } from "./CardFace";

/** 좌석 i의 중심 (테이블 영역 % 좌표). 마지막(나)이 아래 중앙, 나머지는 시계 방향 */
export function seatCenter(i: number, n: number): { x: number; y: number } {
  const angle = Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
  return { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 49 };
}

const ARROW_COLOR: Record<ArrowEvent["kind"], string> = {
  bang: "#ef4444",
  gatling: "#ef4444",
  indians: "#f97316",
  duel: "#a855f7",
  panic: "#eab308",
  catBalou: "#eab308",
  jail: "#9ca3af",
};
const ARROW_CARD: Record<ArrowEvent["kind"], CardName> = {
  bang: "bang",
  gatling: "gatling",
  indians: "indians",
  duel: "duel",
  panic: "panic",
  catBalou: "catBalou",
  jail: "jail",
};

/**
 * 공격 화살표. 좌석 좌표는 %지만 SVG를 비율 무시로 늘리면 선 굵기와 화살촉이
 * 가로세로로 다르게 늘어난다. 영역 픽셀 크기를 재서 픽셀로 그린다.
 * 좌석 상자의 실제 사각형을 DOM에서 재서, 선이 상자 경계에서 나와 상대 경계 앞에서 멈춘다.
 */
function ArrowLayer({
  arrow,
  indexOf,
}: {
  arrow: ArrowEvent;
  indexOf: (id: string) => number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 좌석 상자의 실제 사각형 — 상자는 위/아래 변 기준으로 앉아 있어 seatCenter와 중심이 다르다
  const [boxes, setBoxes] = useState<{ cx: number; cy: number; hw: number; hh: number }[]>([]);
  const measure = () => {
    const el = ref.current;
    const table = el?.parentElement;
    if (!el || !table) return;
    const base = el.getBoundingClientRect();
    const out: { cx: number; cy: number; hw: number; hh: number }[] = [];
    table.querySelectorAll<HTMLElement>("[data-seat]").forEach((seat) => {
      const r = seat.getBoundingClientRect();
      out[Number(seat.dataset.seat)] = {
        cx: r.left - base.left + r.width / 2,
        cy: r.top - base.top + r.height / 2,
        hw: r.width / 2,
        hh: r.height / 2,
      };
    });
    setBoxes(out);
  };
  useLayoutEffect(measure, [arrow.key]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const color = ARROW_COLOR[arrow.kind];
  const from = boxes[indexOf(arrow.from)];
  /** 상자 중심에서 방향 (ux,uy)로 나갔을 때 상자 경계까지의 거리 */
  const exitDist = (b: { hw: number; hh: number }, ux: number, uy: number) =>
    Math.min(b.hw / Math.max(Math.abs(ux), 1e-6), b.hh / Math.max(Math.abs(uy), 1e-6));

  const paths = from
    ? arrow.to
        .map((id) => boxes[indexOf(id)])
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((to, i) => {
          const dx = to.cx - from.cx,
            dy = to.cy - from.cy;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len,
            uy = dy / len;
          // 상자 경계 조금 바깥에서 출발해 상대 경계 조금 앞에서 멈춘다
          const s0 = Math.min(len * 0.45, exitDist(from, ux, uy) + 4);
          const e0 = Math.min(len * 0.45, exitDist(to, ux, uy) + 6);
          const sx = from.cx + ux * s0,
            sy = from.cy + uy * s0;
          const ex = to.cx - ux * e0,
            ey = to.cy - uy * e0;
          // 살짝 휘어진 곡선 — 직선은 좌석 사이를 지날 때 다른 좌석을 가로지른다
          const bend = Math.min(50, len * 0.12);
          const cx = (sx + ex) / 2 - uy * bend,
            cy = (sy + ey) / 2 + ux * bend;
          // 아이콘은 곡선 위 중간점
          const mx = 0.25 * sx + 0.5 * cx + 0.25 * ex,
            my = 0.25 * sy + 0.5 * cy + 0.25 * ey;
          return { d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, mx, my, i };
        })
    : [];

  // 바깥 div는 고정(측정 기준) — key로 갈아끼우면 다음 화살표가 그려지지 않았다. 안쪽만 교체해 애니메이션을 다시 건다.
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[15]">
      <div key={arrow.key} className="absolute inset-0">
        {paths.length > 0 && (
          <svg className="h-full w-full overflow-visible">
            <defs>
              <marker
                id={`ah-${arrow.key}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            </defs>
            {paths.map((p) => (
              <path
                key={p.i}
                d={p.d}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                pathLength={1}
                markerEnd={`url(#ah-${arrow.key})`}
                className="anim-arrow"
                style={{ filter: `drop-shadow(0 0 3px ${color})` }}
              />
            ))}
          </svg>
        )}
        {paths.map((p) => (
          <div
            key={`i${p.i}`}
            className="anim-arrow-icon absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg ring-2 ring-white/70"
            style={{ left: p.mx, top: p.my, background: color, color: "#fff" }}
          >
            <CardIcon name={ARROW_CARD[arrow.kind]} className="h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Table({
  seats,
  seatIds,
  center,
  arrow,
}: {
  /** 시계 방향 순서. 마지막 원소가 나(아래 중앙) */
  seats: ReactNode[];
  /** seats와 같은 순서의 플레이어 id — 화살표의 출발/도착을 찾는 데 쓴다 */
  seatIds: string[];
  center: ReactNode;
  arrow?: ArrowEvent | null;
}) {
  const n = seats.length;
  const indexOf = (id: string) => seatIds.indexOf(id);

  return (
    <div className="relative h-full w-full">
      {/* 펠트 */}
      <div
        className="absolute inset-x-[14%] inset-y-[12%] rounded-[45%] border border-amber-950/40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, var(--felt) 0%, var(--felt-edge) 80%)",
          boxShadow:
            "inset 0 0 70px rgba(0,0,0,0.6), 0 0 0 6px rgba(120,53,15,0.25)",
        }}
      />

      {/* 덱·버림 — 작은 화면에서는 좌석이 중앙까지 차서 숨긴다 (게임판이 글자로 대신 보여준다) */}
      <div className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
        {center}
      </div>

      {arrow && <ArrowLayer arrow={arrow} indexOf={indexOf} />}

      {seats.map((seat, i) => {
        // 마지막(나)이 아래 중앙, 나머지는 시계 방향으로 균등 배치.
        // 가로 반경을 작게 잡아야 양 끝 좌석이 화면 밖으로 잘리지 않는다
        const { x, y } = seatCenter(i, n);
        // 좌석 상자를 중심이 아니라 가장자리로 앉힌다 — 화면이 낮으면(모바일) 위 좌석이
        // 타이머를, 아래 좌석이 손패를 덮었다. 위쪽 좌석은 윗변, 아래쪽은 아랫변을 기준.
        const anchor =
          y < 45
            ? "translate-y-0"
            : y > 55
              ? "-translate-y-full"
              : "-translate-y-1/2";
        return (
          <div
            key={i}
            data-seat={i}
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
