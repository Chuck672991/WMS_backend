import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper around a single ioredis client — the generic key/value layer
 * that CacheInvalidationService (and any future read-through cache) builds
 * on top of. Kept separate from the BullMQ connection in jobs/queue.module.ts,
 * which is queue-specific.
 *
 * Caching is an optimization, not a correctness requirement: every method
 * here swallows its own errors (logging a warning) instead of throwing, so a
 * Redis outage or misconfiguration degrades to "cache disabled" rather than
 * taking down every create/update/delete endpoint across the app that calls
 * CacheInvalidationService.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.client = new Redis(
      this.configService.get<string>('redis.url') as string,
      {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => Math.min(times * 200, 2000),
      },
    );
    this.client.on('error', (error) =>
      this.logger.warn(
        `Redis connection error (cache disabled until reconnected): ${error.message}`,
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(
        `GET ${key} failed, treating as cache miss: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `SET ${key} failed, continuing without cache: ${(error as Error).message}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `DEL ${key} failed, continuing: ${(error as Error).message}`,
      );
    }
  }
}
