import { Injectable, NotFoundException } from '@nestjs/common';
import { Event } from '@prisma/client';
import { CacheInvalidationService } from '../../cache/cache-invalidation.service';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { PaginationMeta } from '../../common/types/pagination.types';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsRepository } from './events.repository';

type ComputedStatus = 'UPCOMING' | 'DONE' | 'CANCELLED' | 'POSTPONED' | 'NEXT';

function computeStatus(event: Event, isNext: boolean): ComputedStatus {
  if (event.manualStatus) return event.manualStatus;
  const isUpcoming = event.eventDate.getTime() > Date.now();
  if (!isUpcoming) return 'DONE';
  return isNext ? 'NEXT' : 'UPCOMING';
}

@Injectable()
export class EventsService {
  constructor(
    private readonly repository: EventsRepository,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // --- 7.1 List events (timeline view) --------------------------------------

  async listEvents(weddingId: string, query: QueryEventDto) {
    const [{ items, totalItems }, nextEventId] = await Promise.all([
      this.repository.findManyForWedding(weddingId, {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      this.repository.findEarliestUpcomingEventId(weddingId),
    ]);

    const data = items.map((event) => ({
      id: event.id,
      name: event.name,
      eventDate: event.eventDate,
      venueName: event.venueName,
      computedStatus: computeStatus(event, event.id === nextEventId),
    }));

    const pagination: PaginationMeta = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / query.limit)),
    };

    return { data, pagination };
  }

  // --- 7.2 Get event detail --------------------------------------------------

  async getEventDetail(weddingId: string, eventId: string) {
    const event = await this.findEventOrThrow(weddingId, eventId);
    const nextEventId =
      await this.repository.findEarliestUpcomingEventId(weddingId);

    return {
      id: event.id,
      weddingId: event.weddingId,
      name: event.name,
      eventDate: event.eventDate,
      startTime: event.startTime,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      notes: event.notes,
      manualStatus: event.manualStatus,
      computedStatus: computeStatus(event, event.id === nextEventId),
      linkedVendorsCount: event._count.vendors,
      // Counts guests explicitly invited to this event only — guests with no
      // eventIds set (implicitly invited to all events, per Module 05) are
      // not included in this count.
      invitedGuestsCount: event._count.guestInvites,
      openTasksCount: event._count.tasks,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  // --- 7.3 Create event -----------------------------------------------------

  async createEvent(weddingId: string, createdBy: string, dto: CreateEventDto) {
    const event = await this.repository.createEvent(weddingId, createdBy, {
      name: dto.name,
      eventDate: new Date(dto.eventDate),
      startTime: dto.startTime,
      venueName: dto.venueName,
      venueAddress: dto.venueAddress,
      notes: dto.notes,
    });
    await this.cacheInvalidation.invalidateDashboard(weddingId);
    return event;
  }

  // --- 7.4 Update event -------------------------------------------------

  async updateEvent(weddingId: string, eventId: string, dto: UpdateEventDto) {
    await this.findEventOrThrow(weddingId, eventId);
    const event = await this.repository.updateEvent(eventId, {
      ...dto,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
    });
    await this.cacheInvalidation.invalidateDashboard(weddingId);
    return event;
  }

  // --- 7.5 Delete event -------------------------------------------------

  async deleteEvent(weddingId: string, eventId: string): Promise<void> {
    await this.findEventOrThrow(weddingId, eventId);
    await this.repository.softDeleteEventWithCascade(eventId);
    await this.cacheInvalidation.invalidateDashboard(weddingId);
  }

  // --- Shared helpers ------------------------------------------------------

  private async findEventOrThrow(weddingId: string, eventId: string) {
    const event = await this.repository.findEventById(weddingId, eventId);
    if (!event) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Event not found.',
      });
    }
    return event;
  }
}
