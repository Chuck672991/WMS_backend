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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WeddingRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CurrentWeddingRole } from '../../common/decorators/current-wedding-role.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeddingAccessGuard } from '../../common/guards/wedding-access.guard';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateWeddingDto } from './dto/update-wedding.dto';
import { WeddingsService } from './weddings.service';

/**
 * Everything scoped under /v1/weddings/:weddingId/*. Split from
 * WeddingsController (which only holds the unscoped POST /weddings) so
 * WeddingAccessGuard can be applied once at the class level (Implementation
 * Guide rule 4) instead of being repeated per-method.
 */
@ApiTags('Weddings')
@ApiBearerAuth()
@Controller('weddings/:weddingId')
@UseGuards(JwtAuthGuard, WeddingAccessGuard, RolesGuard)
export class WeddingWorkspaceController {
  constructor(private readonly weddingsService: WeddingsService) {}

  // 3.4 — any member
  @Get()
  getDetails(
    @Param('weddingId') weddingId: string,
    @CurrentWeddingRole() role: WeddingRole,
  ) {
    return this.weddingsService.getWeddingDetails(weddingId, role);
  }

  // 3.5
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Patch()
  update(@Param('weddingId') weddingId: string, @Body() dto: UpdateWeddingDto) {
    return this.weddingsService.updateWedding(weddingId, dto);
  }

  // 3.6
  @Roles(WeddingRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  async remove(@Param('weddingId') weddingId: string): Promise<void> {
    await this.weddingsService.deleteWedding(weddingId);
  }

  // 3.7 — any member
  @Get('members')
  listMembers(@Param('weddingId') weddingId: string) {
    return this.weddingsService.listMembers(weddingId);
  }

  // 3.8
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Post('invites')
  inviteMember(
    @Param('weddingId') weddingId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.weddingsService.inviteMember(weddingId, dto, user.id);
  }

  // State Management: PENDING -> REVOKED (owner/co_owner manually cancels)
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('invites/:inviteId')
  async revokeInvite(
    @Param('weddingId') weddingId: string,
    @Param('inviteId') inviteId: string,
  ): Promise<void> {
    await this.weddingsService.revokeInvite(weddingId, inviteId);
  }

  // 3.10
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('members/:userId')
  async removeMember(
    @Param('weddingId') weddingId: string,
    @Param('userId') userId: string,
    @CurrentWeddingRole() currentRole: WeddingRole,
  ): Promise<void> {
    await this.weddingsService.removeMember(weddingId, userId, currentRole);
  }

  // 3.11
  @Roles(WeddingRole.OWNER)
  @Patch('members/:userId')
  updateMemberRole(
    @Param('weddingId') weddingId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.weddingsService.updateMemberRole(weddingId, userId, dto);
  }
}
