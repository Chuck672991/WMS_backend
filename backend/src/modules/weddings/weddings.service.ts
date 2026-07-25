import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WeddingRole } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { compareHash, hash } from '../../utils/hash.util';
import { generatePlainToken } from '../../utils/token.util';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateWeddingDto } from './dto/create-wedding.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateWeddingDto } from './dto/update-wedding.dto';
import { WeddingsRepository } from './weddings.repository';

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LAST_OWNER_ERROR = 'You must assign a new owner before leaving.';

@Injectable()
export class WeddingsService {
  constructor(private readonly repository: WeddingsRepository) {}

  // --- 3.3 Create wedding ---------------------------------------------------

  async createWedding(userId: string, dto: CreateWeddingDto) {
    const weddingDate = dto.weddingDate ? new Date(dto.weddingDate) : undefined;

    const wedding = await this.repository.createWeddingWithOwner(userId, {
      name: dto.name,
      weddingDate,
      venueCity: dto.venueCity,
      estimatedGuests: dto.estimatedGuests,
      totalBudget: dto.totalBudget,
    });

    const isPastDate = weddingDate && weddingDate.getTime() < Date.now();

    return {
      data: { ...wedding, role: WeddingRole.OWNER },
      ...(isPastDate
        ? { warning: 'The wedding date provided is in the past.' }
        : {}),
    };
  }

  // --- 3.4 Get wedding details ---------------------------------------------

  async getWeddingDetails(weddingId: string, currentRole: WeddingRole) {
    const wedding = await this.repository.findWeddingById(weddingId);
    if (!wedding) {
      // WeddingAccessGuard already confirmed membership; this only defends
      // against a delete racing the request.
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Wedding not found.',
      });
    }
    const memberCount = await this.repository.countMembers(weddingId);
    return { ...wedding, memberCount, role: currentRole };
  }

  // --- 3.5 Update wedding settings ------------------------------------------

  async updateWedding(weddingId: string, dto: UpdateWeddingDto) {
    const wedding = await this.repository.updateWedding(weddingId, {
      ...dto,
      weddingDate: dto.weddingDate ? new Date(dto.weddingDate) : undefined,
    });
    return wedding;
  }

  // --- 3.6 Delete wedding ------------------------------------------------

  async deleteWedding(weddingId: string): Promise<void> {
    await this.repository.softDeleteWedding(weddingId);
    // TODO (Module 11): scheduled job hard-deletes weddings past the 30-day
    // soft-delete retention window.
  }

  // --- 3.7 List members --------------------------------------------------

  async listMembers(weddingId: string) {
    const members = await this.repository.listMembers(weddingId);
    return members.map((member) => ({
      userId: member.userId,
      fullName: member.user.fullName,
      email: member.user.email,
      role: member.role,
      joinedAt: member.joinedAt,
    }));
  }

  // --- 3.8 Invite member ---------------------------------------------------

  async inviteMember(
    weddingId: string,
    dto: InviteMemberDto,
    invitedByUserId: string,
  ) {
    const existingUser = await this.repository.findUserByEmail(dto.email);
    if (existingUser) {
      const existingMembership = await this.repository.findMembership(
        weddingId,
        existingUser.id,
      );
      if (existingMembership) {
        throw new ConflictException({
          code: ErrorCode.DUPLICATE_RESOURCE,
          message: 'This email is already a member of the wedding.',
        });
      }
    }

    const plainToken = generatePlainToken();
    const tokenHash = await hash(plainToken);
    const invite = await this.repository.createInvite({
      weddingId,
      email: dto.email,
      role: dto.role,
      invitedBy: invitedByUserId,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
    });

    // TODO (Module 09/11): send the invite email/deep link and, if
    // existingUser is set, an in-app MEMBER_INVITED notification. Logged here
    // as a scaffold placeholder — never log the token in a real deployment.
    const deepLink = `https://app.smartwedding.app/invite?token=${plainToken}`;
    console.log(`[WeddingsService] Invite link for ${dto.email}: ${deepLink}`);

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
    };
  }

  // --- Revoke invite (State Management, PENDING -> REVOKED) -----------------

  async revokeInvite(weddingId: string, inviteId: string): Promise<void> {
    const invite = await this.repository.findInviteById(inviteId);
    if (!invite || invite.weddingId !== weddingId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Invite not found.',
      });
    }
    await this.repository.markInviteRevoked(inviteId);
  }

  // --- 3.9 Accept invite ---------------------------------------------------

  async acceptInvite(dto: AcceptInviteDto, currentUser: CurrentUserPayload) {
    const candidates = await this.repository.findPendingInvites();

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await compareHash(dto.token, candidate.tokenHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invite token is invalid.',
      });
    }
    if (matched.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Invite token has expired.',
      });
    }
    if (matched.email !== currentUser.email) {
      throw new UnprocessableEntityException({
        code: ErrorCode.WEDDING_ACCESS_DENIED,
        message: 'This invite was not issued to your account email.',
      });
    }

    const existingMembership = await this.repository.findMembership(
      matched.weddingId,
      currentUser.id,
    );
    if (!existingMembership) {
      await this.repository.createMembership(
        matched.weddingId,
        currentUser.id,
        matched.role,
      );
    }
    await this.repository.markInviteAccepted(matched.id);

    return { weddingId: matched.weddingId, role: matched.role };
  }

  // --- 3.10 Remove member ---------------------------------------------------

  async removeMember(
    weddingId: string,
    targetUserId: string,
    currentRole: WeddingRole,
  ) {
    const target = await this.repository.findMembership(
      weddingId,
      targetUserId,
    );
    if (!target) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Member not found.',
      });
    }

    if (target.role === WeddingRole.OWNER) {
      if (currentRole !== WeddingRole.OWNER) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Only the owner can remove the owner.',
        });
      }
      const ownerCount = await this.repository.countOwners(weddingId);
      if (ownerCount <= 1) {
        throw new UnprocessableEntityException({
          code: ErrorCode.VALIDATION_ERROR,
          message: LAST_OWNER_ERROR,
        });
      }
    }

    await this.repository.removeMember(weddingId, targetUserId);
  }

  // --- 3.11 Update member role ----------------------------------------------

  async updateMemberRole(
    weddingId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const target = await this.repository.findMembership(
      weddingId,
      targetUserId,
    );
    if (!target) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Member not found.',
      });
    }

    if (target.role === WeddingRole.OWNER && dto.role !== WeddingRole.OWNER) {
      const ownerCount = await this.repository.countOwners(weddingId);
      if (ownerCount <= 1) {
        throw new UnprocessableEntityException({
          code: ErrorCode.VALIDATION_ERROR,
          message: LAST_OWNER_ERROR,
        });
      }
    }

    const updated = await this.repository.updateMemberRole(
      weddingId,
      targetUserId,
      dto.role,
    );
    return { userId: updated.userId, role: updated.role };
  }
}
