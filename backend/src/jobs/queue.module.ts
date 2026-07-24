import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Registers the BullMQ connection. Individual queues (guest-invites,
 * notifications, reminders, guest-import — see Module 11) are registered
 * by their owning feature modules once implemented.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('redis.url') },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
