import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubmitRsvpDto } from './dto/submit-rsvp.dto';
import { GuestsService } from './guests.service';

// Public, unauthenticated endpoints (Section 5.10/5.11) — the rsvpToken
// itself is the credential. Rate-limited per Module 12's security table
// (10/min/IP) since this is a public, abuse-prone surface.
const PUBLIC_RSVP_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Public RSVP')
@Controller('public/rsvp')
export class PublicRsvpController {
  constructor(private readonly guestsService: GuestsService) {}

  // 5.10
  @Throttle(PUBLIC_RSVP_THROTTLE)
  @Get(':rsvpToken')
  getInvite(@Param('rsvpToken') rsvpToken: string) {
    return this.guestsService.getPublicInvite(rsvpToken);
  }

  // 5.11
  @Throttle(PUBLIC_RSVP_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post(':rsvpToken')
  async submit(
    @Param('rsvpToken') rsvpToken: string,
    @Body() dto: SubmitRsvpDto,
  ) {
    await this.guestsService.submitPublicRsvp(rsvpToken, dto);
    return { message: 'RSVP recorded successfully.' };
  }
}
