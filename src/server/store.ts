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
  async get<T>(key: string) {
    return (this.live(key)?.value as T) ?? null;
  }
  async mget<T>(keys: string[]) {
    return keys.map((k) => (this.live(k)?.value as T) ?? null);
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

export function getStore(): Store {
  if (g.__bangStore) return g.__bangStore;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    g.__bangStore = new UpstashStore(new Redis({ url, token }));
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn("[store] UPSTASH_REDIS_REST_URL 미설정 — 인메모리 스토어 사용 (서버리스에서는 상태가 유지되지 않음)");
    }
    g.__bangStore = new MemoryStore();
  }
  return g.__bangStore;
}
