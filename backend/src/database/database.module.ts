import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Makes the single PrismaService instance (one DB connection pool)
 * injectable from any feature module without re-declaring it as a provider
 * in each one.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
