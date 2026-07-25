import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { WeddingsService } from './weddings.service';

@ApiTags('Weddings')
@ApiBearerAuth()
@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly weddingsService: WeddingsService) {}

  // 3.9 — not wedding-scoped by :weddingId; the invite's wedding is resolved
  // from the token itself, so WeddingAccessGuard doesn't apply here.
  @Post('accept')
  accept(
    @Body() dto: AcceptInviteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.weddingsService.acceptInvite(dto, user);
  }
}
