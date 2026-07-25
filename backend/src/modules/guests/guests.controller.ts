import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { WeddingRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeddingAccessGuard } from '../../common/guards/wedding-access.guard';
import { BulkSendInvitesDto } from './dto/bulk-send-invites.dto';
import { CreateGuestDto } from './dto/create-guest.dto';
import { QueryGuestDto } from './dto/query-guest.dto';
import { SendInviteDto } from './dto/send-invite.dto';
import { SetRsvpDto } from './dto/set-rsvp.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsService } from './guests.service';

const MEMBER_ROLES = [
  WeddingRole.OWNER,
  WeddingRole.CO_OWNER,
  WeddingRole.FAMILY_MEMBER,
];

@ApiTags('Guests')
@ApiBearerAuth()
@Controller('weddings/:weddingId/guests')
@UseGuards(JwtAuthGuard, WeddingAccessGuard, RolesGuard)
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  // 5.1 — any member
  @Get()
  list(@Param('weddingId') weddingId: string, @Query() query: QueryGuestDto) {
    return this.guestsService.listGuests(weddingId, query);
  }

  // 5.2 — any member
  @Get('summary')
  getSummary(@Param('weddingId') weddingId: string) {
    return this.guestsService.getSummary(weddingId);
  }

  // 5.3
  @Roles(...MEMBER_ROLES)
  @Post()
  create(
    @Param('weddingId') weddingId: string,
    @Body() dto: CreateGuestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.guestsService.createGuest(weddingId, user.id, dto);
  }

  // 5.4
  @Roles(...MEMBER_ROLES)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @Post('bulk-import')
  bulkImport(
    @Param('weddingId') weddingId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.guestsService.bulkImport(weddingId, user.id, file);
  }

  // 5.9 — owner/co_owner only, declared before ':guestId' routes to avoid
  // being shadowed by them.
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.OK)
  @Post('bulk-send-invites')
  bulkSendInvites(
    @Param('weddingId') weddingId: string,
    @Body() dto: BulkSendInvitesDto,
  ) {
    return this.guestsService
      .bulkSendInvites(weddingId, dto.guestIds, dto.channel)
      .then(() => ({ message: 'Invites queued for delivery.' }));
  }

  // 5.5
  @Roles(...MEMBER_ROLES)
  @Patch(':guestId')
  update(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestsService.updateGuest(weddingId, guestId, dto);
  }

  // 5.6
  @Roles(...MEMBER_ROLES)
  @Patch(':guestId/rsvp')
  setRsvp(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @Body() dto: SetRsvpDto,
  ) {
    return this.guestsService.setRsvpStatus(weddingId, guestId, dto.rsvpStatus);
  }

  // 5.7
  @Roles(...MEMBER_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':guestId')
  async remove(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
  ): Promise<void> {
    await this.guestsService.deleteGuest(weddingId, guestId);
  }

  // 5.8
  @Roles(...MEMBER_ROLES)
  @HttpCode(HttpStatus.ACCEPTED)
  @Post(':guestId/send-invite')
  async sendInvite(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @Body() dto: SendInviteDto,
  ) {
    await this.guestsService.sendInvite(weddingId, guestId, dto);
    return { message: 'Invite queued for delivery.' };
  }
}
