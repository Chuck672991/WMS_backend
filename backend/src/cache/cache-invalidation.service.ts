import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Section 8.1's "one place where modules know about the dashboard cache":
 * every mutating service method across Vendors, Guests, Budget, Events, and
 * Tasks calls invalidateDashboard(weddingId) after a write so the next
 * dashboard read recomputes rather than serving stale cached data.
 */
@Injectable()
export class CacheInvalidationService {
  constructor(private readonly redis: RedisService) {}

  async invalidateDashboard(weddingId: string): Promise<void> {
    await this.redis.del(`dashboard:${weddingId}`);
  }
}
