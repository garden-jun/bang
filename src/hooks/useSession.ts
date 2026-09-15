"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError, clearSession, getSavedNickname, getToken } from "@/lib/api";
import type { SessionInfo } from "@/shared/types";

export type SessionStatus = "loading" | "none" | "ready";

/**
 * localStorage의 토큰으로 세션을 복구한다.
 * 토큰이 없거나 만료되면 status가 'none' — 닉네임 입력이 필요.
 */
export function useSession() {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [savedNickname, setSavedNickname] = useState("");

  const refresh = useCallback(async () => {
    setSavedNickname(getSavedNickname());
    if (!getToken()) {
      setStatus("none");
      return;
    }
    try {
      const s = await api.session();
      setInfo(s);
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) clearSession();
      setInfo(null);
      setStatus("none");
    }
  }, []);

  useEffect(() => {
    // 마운트 후 비동기로 복구 (렌더 중 동기 setState 방지)
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const login = useCallback(async (nickname: string) => {
    const r = await api.createSession(nickname);
    setInfo({ playerId: r.playerId, nickname: r.nickname });
    setStatus("ready");
    return r;
  }, []);

  return { status, info, savedNickname, login, refresh };
}
