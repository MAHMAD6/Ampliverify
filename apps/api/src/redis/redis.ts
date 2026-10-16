import IORedis, { type Redis } from 'ioredis';
import type { ThrottlerStorage } from '@nestjs/throttler';

/**
 * Redis (REDIS_URL) backs the job queue dispatch, caches and request
 * throttling (V1 manual §1). Without REDIS_URL the API falls back to the
 * PostgreSQL queue and in-memory throttling, which suits a single instance
 * and the test suite.
 */
export function createRedis(url: string, name: string): Redis {
  return new IORedis(url, { connectionName: `ampliverify:${name}`, maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: false });
}

// Atomic hit counter with a block window, shared by every API instance.
const SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local blocked = redis.call('PTTL', KEYS[2])
if blocked <= 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blocked = tonumber(ARGV[3])
end
return { hits, ttl, blocked }
`;

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/** @nestjs/throttler storage on Redis, so limits hold across instances. */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const base = `throttle:${throttlerName}:${key}`;
    const [hits, ttlMs, blockMs] = (await this.redis.eval(SCRIPT, 2, `${base}:hits`, `${base}:block`, ttl, limit, blockDuration || ttl)) as [number, number, number];
    const isBlocked = blockMs > 0 && hits > limit;
    return { totalHits: hits, timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)), isBlocked, timeToBlockExpire: isBlocked ? Math.ceil(blockMs / 1000) : 0 };
  }
}
