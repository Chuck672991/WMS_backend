import { Module } from '@nestjs/common';
import { GuestsController } from './guests.controller';
import { GuestsRepository } from './guests.repository';
import { GuestsService } from './guests.service';
import { PublicRsvpController } from './public-rsvp.controller';

@Module({
  controllers: [GuestsController, PublicRsvpController],
  providers: [GuestsService, GuestsRepository],
  // Exported so DashboardModule can reuse getSummary() (Section 8.1: "guests.*
  // reuses Module 05, endpoint 5.2 logic internally").
  exports: [GuestsService],
})
export class GuestsModule {}
