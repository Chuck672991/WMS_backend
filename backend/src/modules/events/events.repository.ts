import { Injectable } from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateEventData {
  name: string;
  eventDate: Date;
  startTime?: string;
  venueName?: string;
  venueAddress?: string;
  notes?: string;
}

export interface UpdateEventData extends Partial<CreateEventData> {
  manualStatus?: EventStatus | null;
}

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyForWedding(
    weddingId: string,
    pagination: {
      skip: number;
      take: number;
      orderBy: Prisma.EventOrderByWithRelationInput;
    },
  ) {
    const where: Prisma.EventWhereInput = { weddingId, deletedAt: null };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, totalItems };
  }

  /** The single nearest future event (Section 7.1: exactly one is flagged NEXT). */
  async findEarliestUpcomingEventId(weddingId: string): Promise<string | null> {
    const event = await this.prisma.event.findFirst({
      where: {
        weddingId,
        deletedAt: null,
        manualStatus: null,
        eventDate: { gt: new Date() },
      },
      orderBy: { eventDate: 'asc' },
      select: { id: true },
    });
    return event?.id ?? null;
  }

  findEventById(weddingId: string, eventId: string) {
    return this.prisma.event.findFirst({
      where: { id: eventId, weddingId, deletedAt: null },
      include: {
        _count: {
          select: {
            vendors: { where: { deletedAt: null } },
            guestInvites: true,
            tasks: { where: { deletedAt: null, status: { not: 'DONE' } } },
          },
        },
      },
    });
  }

  createEvent(weddingId: string, createdBy: string, data: CreateEventData) {
    return this.prisma.event.create({
      data: { ...data, weddingId, createdBy },
    });
  }

  updateEvent(eventId: string, data: UpdateEventData) {
    return this.prisma.event.update({ where: { id: eventId }, data });
  }

  /**
   * Soft-deletes the event and applies the documented side effects (Section
   * 7.5): unlinks vendors (SetNull equivalent), cascades guest-invite rows,
   * and unlinks tasks — all as an explicit, atomic transaction since Prisma's
   * declarative onDelete actions only fire on real deletes, not our soft-
   * delete-via-update convention.
   */
  async softDeleteEventWithCascade(eventId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id: eventId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.vendor.updateMany({
        where: { eventId },
        data: { eventId: null },
      }),
      this.prisma.guestEventInvite.deleteMany({ where: { eventId } }),
      this.prisma.task.updateMany({
        where: { eventId },
        data: { eventId: null },
      }),
    ]);
  }
}
