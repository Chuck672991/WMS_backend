import { Injectable } from '@nestjs/common';
import { WeddingRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateWeddingData {
  name: string;
  weddingDate?: Date;
  venueCity?: string;
  estimatedGuests?: number;
  totalBudget?: number;
}

export interface CreateInviteData {
  weddingId: string;
  email: string;
  role: WeddingRole;
  invitedBy: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class WeddingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Weddings --------------------------------------------------------------

  createWeddingWithOwner(userId: string, data: CreateWeddingData) {
    return this.prisma.$transaction(async (tx) => {
      const wedding = await tx.wedding.create({
        data: { ...data, createdBy: userId },
      });
      await tx.weddingMember.create({
        data: { weddingId: wedding.id, userId, role: WeddingRole.OWNER },
      });
      return wedding;
    });
  }

  findWeddingById(id: string) {
    return this.prisma.wedding.findFirst({ where: { id, deletedAt: null } });
  }

  updateWedding(id: string, data: Partial<CreateWeddingData>) {
    return this.prisma.wedding.update({ where: { id }, data });
  }

  softDeleteWedding(id: string) {
    return this.prisma.wedding.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  countMembers(weddingId: string) {
    return this.prisma.weddingMember.count({ where: { weddingId } });
  }

  countOwners(weddingId: string) {
    return this.prisma.weddingMember.count({
      where: { weddingId, role: WeddingRole.OWNER },
    });
  }

  // --- Members ---------------------------------------------------------------

  listMembers(weddingId: string) {
    return this.prisma.weddingMember.findMany({
      where: { weddingId },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  findMembership(weddingId: string, userId: string) {
    return this.prisma.weddingMember.findUnique({
      where: { weddingId_userId: { weddingId, userId } },
    });
  }

  createMembership(weddingId: string, userId: string, role: WeddingRole) {
    return this.prisma.weddingMember.create({
      data: { weddingId, userId, role },
    });
  }

  removeMember(weddingId: string, userId: string) {
    return this.prisma.weddingMember.delete({
      where: { weddingId_userId: { weddingId, userId } },
    });
  }

  updateMemberRole(weddingId: string, userId: string, role: WeddingRole) {
    return this.prisma.weddingMember.update({
      where: { weddingId_userId: { weddingId, userId } },
      data: { role },
    });
  }

  // --- Invites ---------------------------------------------------------------

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  createInvite(data: CreateInviteData) {
    return this.prisma.weddingInvite.create({ data });
  }

  findInviteById(id: string) {
    return this.prisma.weddingInvite.findUnique({ where: { id } });
  }

  findPendingInvites() {
    return this.prisma.weddingInvite.findMany({ where: { status: 'PENDING' } });
  }

  markInviteAccepted(id: string) {
    return this.prisma.weddingInvite.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });
  }

  markInviteRevoked(id: string) {
    return this.prisma.weddingInvite.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
  }
}
