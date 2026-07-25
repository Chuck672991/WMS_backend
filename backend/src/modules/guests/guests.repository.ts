import { Injectable } from '@nestjs/common';
import { GatheringType, GuestSide, Prisma, RsvpStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateGuestData {
  name: string;
  groupSize: number;
  phone?: string;
  email?: string;
  side?: GuestSide;
  gathering?: GatheringType;
}

export interface GuestListFilters {
  rsvpStatus?: RsvpStatus;
  side?: GuestSide;
  gathering?: GatheringType;
  eventId?: string;
  search?: string;
}

@Injectable()
export class GuestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildListWhere(
    weddingId: string,
    filters: GuestListFilters,
  ): Prisma.GuestWhereInput {
    return {
      weddingId,
      deletedAt: null,
      ...(filters.rsvpStatus ? { rsvpStatus: filters.rsvpStatus } : {}),
      ...(filters.side ? { side: filters.side } : {}),
      ...(filters.gathering ? { gathering: filters.gathering } : {}),
      ...(filters.eventId
        ? { eventInvites: { some: { eventId: filters.eventId } } }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                phone: {
                  contains: filters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };
  }

  async findManyForWedding(
    weddingId: string,
    filters: GuestListFilters,
    pagination: {
      skip: number;
      take: number;
      orderBy: Prisma.GuestOrderByWithRelationInput;
    },
  ) {
    const where = this.buildListWhere(weddingId, filters);
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.guest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      this.prisma.guest.count({ where }),
    ]);
    return { items, totalItems };
  }

  async summaryForWedding(weddingId: string) {
    const grouped = await this.prisma.guest.groupBy({
      by: ['rsvpStatus'],
      where: { weddingId, deletedAt: null },
      _sum: { groupSize: true },
      _count: { _all: true },
    });
    return grouped;
  }

  findGuestById(weddingId: string, guestId: string) {
    return this.prisma.guest.findFirst({
      where: { id: guestId, weddingId, deletedAt: null },
      include: { eventInvites: true },
    });
  }

  findGuestsByIds(weddingId: string, guestIds: string[]) {
    return this.prisma.guest.findMany({
      where: { id: { in: guestIds }, weddingId, deletedAt: null },
    });
  }

  findGuestByToken(rsvpToken: string) {
    return this.prisma.guest.findFirst({
      where: { rsvpToken, deletedAt: null },
      include: {
        wedding: { select: { name: true, weddingDate: true, deletedAt: true } },
      },
    });
  }

  async createGuestWithEventInvites(
    weddingId: string,
    createdBy: string,
    data: CreateGuestData,
    eventIds?: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.create({
        data: { ...data, weddingId, createdBy },
      });
      if (eventIds?.length) {
        await tx.guestEventInvite.createMany({
          data: eventIds.map((eventId) => ({ guestId: guest.id, eventId })),
        });
      }
      return guest;
    });
  }

  async bulkCreateGuests(
    weddingId: string,
    createdBy: string,
    rows: CreateGuestData[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await this.prisma.guest.createMany({
      data: rows.map((row) => ({ ...row, weddingId, createdBy })),
    });
    return result.count;
  }

  async updateGuestWithEventInvites(
    guestId: string,
    data: Partial<CreateGuestData>,
    eventIds?: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.update({ where: { id: guestId }, data });
      if (eventIds !== undefined) {
        // Fully replaces existing links (diff-and-sync per Section 5.5).
        await tx.guestEventInvite.deleteMany({ where: { guestId } });
        if (eventIds.length) {
          await tx.guestEventInvite.createMany({
            data: eventIds.map((eventId) => ({ guestId, eventId })),
          });
        }
      }
      return guest;
    });
  }

  setRsvpStatus(guestId: string, rsvpStatus: RsvpStatus) {
    return this.prisma.guest.update({
      where: { id: guestId },
      data: { rsvpStatus },
    });
  }

  submitPublicRsvp(
    guestId: string,
    rsvpStatus: RsvpStatus,
    confirmedCount?: number,
  ) {
    return this.prisma.guest.update({
      where: { id: guestId },
      data: {
        rsvpStatus,
        ...(confirmedCount !== undefined ? { confirmedCount } : {}),
      },
    });
  }

  softDeleteGuest(guestId: string) {
    return this.prisma.guest.update({
      where: { id: guestId },
      data: { deletedAt: new Date() },
    });
  }

  updateLastInvitedAt(guestId: string) {
    return this.prisma.guest.update({
      where: { id: guestId },
      data: { lastInvitedAt: new Date() },
    });
  }
}
