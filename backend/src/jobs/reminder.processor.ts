import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

/**
 * Skeleton only — implemented in Module 11 (Background Jobs).
 * Daily cron scan for upcoming task/event due dates and vendor balances due,
 * creating reminder Notifications (see Module 09).
 */
@Processor('reminders')
export class ReminderProcessor extends WorkerHost {
  async process(_job: Job): Promise<void> {
    // TODO (Module 11): scan Tasks/Events/Vendors and create reminder notifications.
  }
}
