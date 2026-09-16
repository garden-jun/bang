import { Redis } from "@upstash/redis";

/**
 * 서버가 쓰는 최소한의 KV 인터페이스.
 * 배포 환경은 Upstash Redis, 로컬에 환경변수가 없으면 인메모리로 동작한다.
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** 없을 때만 set. 성공하면 true */
  setNx(key: string, value: unknown, ttlMs: number): Promise<boolean>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, member: string): Promise<void>;
  /** score 내림차순 */
  zrangeDesc(key: string, limit: number): Promise<string[]>;
}

class UpstashStore implements Store {
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }
  async mget<T>(keys: string[]) {
    if (keys.length === 0) return [];
    return (await this.redis.mget<(T | null)[]>(...keys)).map((v) => v ?? null);
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    await this.redis.set(key, value, ttlSec ? { ex: ttlSec } : undefined);
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async setNx(key: string, value: unknown, ttlMs: number) {
    const r = await this.redis.set(key, value, { nx: true, px: ttlMs });
    return r === "OK";
  }
  async zadd(key: string, score: number, member: string) {
    await this.redis.zadd(key, { score, member });
  }
  async zrem(key: string, member: string) {
    await this.redis.zrem(key, member);
  }
  async zrangeDesc(key: string, limit: number) {
    return this.redis.zrange<string[]>(key, 0, limit - 1, { rev: true });
  }
}

class MemoryStore implements Store {
  private kv = new Map<string, { value: unknown; expires?: number }>();
  private z = new Map<string, Map<string, number>>();

  private live(key: string) {
    const e = this.kv.get(key);
    if (!e) return null;
    if (e.expires && e.expires < Date.now()) {
      this.kv.delete(key);
      return null;
    }
    return e;
  }
  // 실제 Upstash는 요청마다 새 JSON을 돌려준다. 참조를 그대로 주면 호출자들이
  // 같은 객체를 공유해, 한쪽의 수정이 다른 쪽에 새어 들어간다.
  async get<T>(key: string) {
    const v = this.live(key)?.value;
    return v === undefined ? null : (structuredClone(v) as T);
  }
  async mget<T>(keys: string[]) {
    return keys.map((k) => {
      const v = this.live(k)?.value;
      return v === undefined ? null : (structuredClone(v) as T);
    });
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    this.kv.set(key, { value: structuredClone(value), expires: ttlSec ? Date.now() + ttlSec * 1000 : undefined });
  }
  async del(key: string) {
    this.kv.delete(key);
  }
  async setNx(key: string, value: unknown, ttlMs: number) {
    if (this.live(key)) return false;
    this.kv.set(key, { value, expires: Date.now() + ttlMs });
    return true;
  }
  async zadd(key: string, score: number, member: string) {
    if (!this.z.has(key)) this.z.set(key, new Map());
    this.z.get(key)!.set(member, score);
  }
  async zrem(key: string, member: string) {
    this.z.get(key)?.delete(member);
  }
  async zrangeDesc(key: string, limit: number) {
    return [...(this.z.get(key) ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([m]) => m);
  }
}

// dev 서버 HMR에도 인메모리 상태가 유지되도록 globalThis에 붙여둔다
const g = globalThis as unknown as { __bangStore?: Store };

/**
 * Redis 접속 정보. Vercel Marketplace의 Upstash 연동은 기본 접두사가 KV_ 라서
 * (KV_REST_API_URL / KV_REST_API_TOKEN) 두 이름을 모두 받는다.
 */
function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** 배포 확인용 (/api/health) */
export function storeKind(): "upstash" | "memory" {
  return redisEnv() ? "upstash" : "memory";
}

export function getStore(): Store {
  if (g.__bangStore) return g.__bangStore;
  const env = redisEnv();
  if (env) {
    g.__bangStore = new UpstashStore(new Redis(env));
  } else {
    // 서버리스에서 인메모리는 요청마다 다른 인스턴스에 떨어져 "방금 만든 방이 없다"가 된다.
    // 조용히 굴러가면 원인을 찾기 어려우므로 배포 환경에서는 바로 실패시킨다.
    if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
      throw new Error("Redis 미설정: Vercel 프로젝트에 UPSTASH_REDIS_REST_URL/TOKEN 또는 KV_REST_API_URL/TOKEN 환경변수가 필요합니다.");
    }
    g.__bangStore = new MemoryStore();
  }
  return g.__bangStore;
}
