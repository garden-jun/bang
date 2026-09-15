"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "@/game/types";
import { api, ApiClientError } from "@/lib/api";
import type { RoomView } from "@/shared/types";

/**
 * 방 상태 폴링. 서버가 내려주는 pollMs로 간격을 조절하고,
 * 액션 응답으로 받은 최신 뷰는 즉시 반영한다.
 */
export function useRoom(code: string, enabled: boolean) {
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<null | "notMember" | "notFound">(null);
  const versionRef = useRef<number | null>(null);
  const pollMsRef = useRef(1500);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const apply = useCallback((v: RoomView | null) => {
    if (!v) return;
    // 늦게 도착한 오래된 응답은 무시
    if (versionRef.current !== null && v.version < versionRef.current) return;
    versionRef.current = v.version;
    pollMsRef.current = v.pollMs;
    setView(v);
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return;

    const loop = async () => {
      let delay = 1500;
      try {
        const v = await api.state(code, versionRef.current);
        if (v) {
          apply(v);
          delay = v.pollMs;
        } else {
          delay = pollMsRef.current;
        }
        setError(null);
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
          setGone(e.status === 403 ? "notMember" : "notFound");
          return;
        }
        delay = 5000;
      }
      // 안 보고 있는 탭은 천천히. 끊긴 것으로 잡히지 않을 만큼은 유지한다
      // (DISCONNECT_AFTER_MS 30초 > 8초 폴링 + 12초 저장 간격).
      if (document.visibilityState === "hidden") delay = Math.max(delay, 8000);
      if (alive.current) timer.current = setTimeout(loop, delay);
    };
    void loop();

    // 돌아오면 기다리지 않고 바로 최신 상태를 받는다
    const onVisible = () => {
      if (document.visibilityState === "visible" && alive.current) {
        if (timer.current) clearTimeout(timer.current);
        void loop();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [code, enabled, apply]);

  const wrap = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (r && typeof r === "object" && "version" in r) apply(r as unknown as RoomView);
        setError(null);
        return r;
      } catch (e) {
        setError(e instanceof Error ? e.message : "요청 실패");
        return undefined;
      }
    },
    [apply],
  );

  return {
    view,
    error,
    gone,
    clearError: () => setError(null),
    act: (action: Action) => wrap(() => api.action(code, action)),
    start: () => wrap(() => api.start(code)),
    reset: () => wrap(() => api.reset(code)),
    kick: (id: string) => wrap(() => api.kick(code, id)),
    updateSettings: (s: Parameters<typeof api.settings>[1]) => wrap(() => api.settings(code, s)),
    join: (as: "player" | "spectator") => wrap(() => api.join(code, as)),
    leave: () => api.leave(code),
  };
}
