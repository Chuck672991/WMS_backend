import { Global, Module } from '@nestjs/common';
import { CacheInvalidationService } from './cache-invalidation.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, CacheInvalidationService],
  exports: [RedisService, CacheInvalidationService],
})
export class CacheModule {}
