import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

/**
 * Skeleton only — implemented in Module 09/11 (Notifications, Background Jobs).
 * Delivers a persisted Notification row via push/email/SMS.
 */
@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  async process(_job: Job): Promise<void> {
    // TODO (Module 09): dispatch push/email/SMS for the given notification.
  }
}
