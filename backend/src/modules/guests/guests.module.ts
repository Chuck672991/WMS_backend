import { Module } from '@nestjs/common';
import { GuestsController } from './guests.controller';
import { GuestsRepository } from './guests.repository';
import { GuestsService } from './guests.service';
import { PublicRsvpController } from './public-rsvp.controller';

@Module({
  controllers: [GuestsController, PublicRsvpController],
  providers: [GuestsService, GuestsRepository],
})
export class GuestsModule {}
