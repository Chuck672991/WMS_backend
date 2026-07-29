import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GatheringType, GuestSide, RsvpStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { CacheInvalidationService } from '../../cache/cache-invalidation.service';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { PaginationMeta } from '../../common/types/pagination.types';
import { CreateGuestDto } from './dto/create-guest.dto';
import { QueryGuestDto } from './dto/query-guest.dto';
import { SendInviteDto } from './dto/send-invite.dto';
import { SubmitRsvpDto } from './dto/submit-rsvp.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { CreateGuestData, GuestsRepository } from './guests.repository';

const INVITE_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h, Section 5.8
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMPORT_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export interface ImportFailure {
  row: number;
  reason: string;
}

/** Safely stringifies a parsed CSV/XLSX cell (string | number | boolean | undefined). */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

@Injectable()
export class GuestsService {
  constructor(
    private readonly repository: GuestsRepository,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // --- 5.1 List guests --------------------------------------------------

  async listGuests(weddingId: string, query: QueryGuestDto) {
    const { items, totalItems } = await this.repository.findManyForWedding(
      weddingId,
      {
        rsvpStatus: query.rsvpStatus,
        side: query.side,
        gathering: query.gathering,
        eventId: query.eventId,
        search: query.search,
      },
      {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      },
    );

    const data = items.map((guest) => ({
      id: guest.id,
      name: guest.name,
      groupSize: guest.groupSize,
      phone: guest.phone,
      side: guest.side,
      gathering: guest.gathering,
      rsvpStatus: guest.rsvpStatus,
      tableNumber: guest.tableNumber,
    }));

    const pagination: PaginationMeta = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / query.limit)),
    };

    return { data, pagination };
  }

  // --- 5.2 Guest summary counts ----------------------------------------

  async getSummary(weddingId: string) {
    const grouped = await this.repository.summaryForWedding(weddingId);

    const heads: Record<RsvpStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      DECLINED: 0,
    };
    let totalGroups = 0;
    for (const row of grouped) {
      heads[row.rsvpStatus] = row._sum.groupSize ?? 0;
      totalGroups += row._count._all;
    }

    return {
      totalGuests: heads.PENDING + heads.CONFIRMED + heads.DECLINED,
      confirmedHeads: heads.CONFIRMED,
      pendingHeads: heads.PENDING,
      declinedHeads: heads.DECLINED,
      totalGroups,
    };
  }

  // --- 5.3 Create guest -----------------------------------------------

  async createGuest(weddingId: string, createdBy: string, dto: CreateGuestDto) {
    if (dto.eventIds?.length) {
      await this.assertEventsBelongToWedding(weddingId, dto.eventIds);
    }
    const guest = await this.repository.createGuestWithEventInvites(
      weddingId,
      createdBy,
      {
        name: dto.name,
        groupSize: dto.groupSize,
        phone: dto.phone,
        email: dto.email,
        side: dto.side,
        gathering: dto.gathering,
      },
      dto.eventIds,
    );
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    return guest;
  }

  // --- 5.4 Bulk import guests (CSV/XLSX) --------------------------------

  async bulkImport(
    weddingId: string,
    createdBy: string,
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'A file is required.',
      });
    }
    if (!ALLOWED_IMPORT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'File must be CSV or Excel (.xlsx/.xls).',
      });
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'File must not exceed 5MB.',
      });
    }

    const rawRows = this.parseImportFile(file);

    const validRows: CreateGuestData[] = [];
    const failures: ImportFailure[] = [];

    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2; // header is row 1
      const result = this.validateImportRow(raw);
      if ('reason' in result) {
        failures.push({ row: rowNumber, reason: result.reason });
      } else {
        validRows.push(result.data);
      }
    });

    if (validRows.length === 0) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'No valid rows found in the uploaded file.',
      });
    }

    const importedCount = await this.repository.bulkCreateGuests(
      weddingId,
      createdBy,
      validRows,
    );
    void this.cacheInvalidation.invalidateDashboard(weddingId);

    return { importedCount, failedCount: failures.length, failures };
  }

  // --- 5.5 Update guest -----------------------------------------------

  async updateGuest(weddingId: string, guestId: string, dto: UpdateGuestDto) {
    await this.findGuestOrThrow(weddingId, guestId);
    if (dto.eventIds?.length) {
      await this.assertEventsBelongToWedding(weddingId, dto.eventIds);
    }
    const guest = await this.repository.updateGuestWithEventInvites(
      guestId,
      {
        name: dto.name,
        groupSize: dto.groupSize,
        phone: dto.phone,
        email: dto.email,
        side: dto.side,
        gathering: dto.gathering,
      },
      dto.eventIds,
    );
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    return guest;
  }

  // --- 5.6 Manually set RSVP status -------------------------------------

  async setRsvpStatus(
    weddingId: string,
    guestId: string,
    rsvpStatus: RsvpStatus,
  ) {
    await this.findGuestOrThrow(weddingId, guestId);
    const guest = await this.repository.setRsvpStatus(guestId, rsvpStatus);
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    return guest;
  }

  // --- 5.7 Delete guest -------------------------------------------------

  async deleteGuest(weddingId: string, guestId: string): Promise<void> {
    await this.findGuestOrThrow(weddingId, guestId);
    await this.repository.softDeleteGuest(guestId);
    void this.cacheInvalidation.invalidateDashboard(weddingId);
  }

  // --- 5.8 Send digital invite ------------------------------------------

  async sendInvite(
    weddingId: string,
    guestId: string,
    dto: SendInviteDto,
  ): Promise<void> {
    const guest = await this.findGuestOrThrow(weddingId, guestId);

    if (!dto.force && guest.lastInvitedAt) {
      const elapsed = Date.now() - guest.lastInvitedAt.getTime();
      if (elapsed < INVITE_RESEND_COOLDOWN_MS) {
        throw new BadRequestException({
          code: ErrorCode.RATE_LIMITED,
          message:
            'An invite was already sent to this guest in the last 24 hours.',
        });
      }
    }

    await this.repository.updateLastInvitedAt(guestId);
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    // TODO (Module 11): enqueue the `guest-invites` BullMQ job to actually
    // dispatch SMS/WhatsApp/email. Logged here as a scaffold placeholder.
    const rsvpLink = `https://app.smartwedding.app/rsvp/${guest.rsvpToken}`;
    console.log(
      `[GuestsService] Queued ${dto.channel ?? 'WHATSAPP'} invite for guest ${guest.id}: ${rsvpLink}`,
    );
  }

  // --- 5.9 Bulk send invites ---------------------------------------------

  async bulkSendInvites(
    weddingId: string,
    guestIds: string[],
    channel: SendInviteDto['channel'],
  ): Promise<void> {
    const guests = await this.repository.findGuestsByIds(weddingId, guestIds);
    // TODO (Module 11): enqueue one `guest-invites` job per guest instead of
    // sending inline — matches the documented "avoids one giant blocking
    // request" design, deferred here to a scaffold placeholder.
    for (const guest of guests) {
      await this.repository.updateLastInvitedAt(guest.id);
      const rsvpLink = `https://app.smartwedding.app/rsvp/${guest.rsvpToken}`;
      console.log(
        `[GuestsService] Queued ${channel ?? 'WHATSAPP'} invite for guest ${guest.id}: ${rsvpLink}`,
      );
    }
    if (guests.length > 0) {
      void this.cacheInvalidation.invalidateDashboard(weddingId);
    }
  }

  // --- 5.10 Public: get RSVP invite details ------------------------------

  async getPublicInvite(rsvpToken: string) {
    const guest = await this.repository.findGuestByToken(rsvpToken);
    if (!guest || guest.wedding.deletedAt) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Invite not found.',
      });
    }
    return {
      weddingName: guest.wedding.name,
      weddingDate: guest.wedding.weddingDate,
      guestName: guest.name,
      currentStatus: guest.rsvpStatus,
    };
  }

  // --- 5.11 Public: submit RSVP response ---------------------------------

  async submitPublicRsvp(rsvpToken: string, dto: SubmitRsvpDto): Promise<void> {
    const guest = await this.repository.findGuestByToken(rsvpToken);
    if (!guest || guest.wedding.deletedAt) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Invite not found.',
      });
    }

    if (
      dto.attendingCount !== undefined &&
      dto.attendingCount > guest.groupSize
    ) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `attendingCount cannot exceed the group size (${guest.groupSize}).`,
      });
    }

    await this.repository.submitPublicRsvp(
      guest.id,
      dto.response,
      dto.attendingCount,
    );
    void this.cacheInvalidation.invalidateDashboard(guest.weddingId);
    // TODO (Module 09): trigger an in-app RSVP_RECEIVED notification to
    // wedding owners/co-owners.
  }

  // --- Shared helpers ------------------------------------------------------

  private async findGuestOrThrow(weddingId: string, guestId: string) {
    const guest = await this.repository.findGuestById(weddingId, guestId);
    if (!guest) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Guest not found.',
      });
    }
    return guest;
  }

  private async assertEventsBelongToWedding(
    weddingId: string,
    eventIds: string[],
  ): Promise<void> {
    const allBelong = await this.repository.eventsBelongToWedding(
      weddingId,
      eventIds,
    );
    if (!allBelong) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'One or more eventIds do not belong to this wedding.',
      });
    }
  }

  private parseImportFile(
    file: Express.Multer.File,
  ): Record<string, unknown>[] {
    if (file.mimetype === 'text/csv') {
      return parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    }
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  }

  private validateImportRow(
    raw: Record<string, unknown>,
  ): { data: CreateGuestData } | { reason: string } {
    const name = cellToString(raw.name).trim();
    if (!name || name.length < 2) {
      return { reason: 'name is required and must be at least 2 characters' };
    }

    const groupSizeRaw = raw.groupSize;
    const groupSize = Number(groupSizeRaw);
    if (
      groupSizeRaw === undefined ||
      groupSizeRaw === '' ||
      !Number.isInteger(groupSize)
    ) {
      return { reason: 'groupSize must be a number' };
    }
    if (groupSize < 1 || groupSize > 50) {
      return { reason: 'groupSize must be between 1 and 50' };
    }

    const phone = raw.phone ? cellToString(raw.phone).trim() : undefined;

    const sideRaw = raw.side
      ? cellToString(raw.side).trim().toUpperCase()
      : undefined;
    if (sideRaw && !Object.values(GuestSide).includes(sideRaw as GuestSide)) {
      return {
        reason: `side must be one of ${Object.values(GuestSide).join(', ')}`,
      };
    }

    const gatheringRaw = raw.gathering
      ? cellToString(raw.gathering).trim().toUpperCase()
      : undefined;
    if (
      gatheringRaw &&
      !Object.values(GatheringType).includes(gatheringRaw as GatheringType)
    ) {
      return {
        reason: `gathering must be one of ${Object.values(GatheringType).join(', ')}`,
      };
    }

    return {
      data: {
        name,
        groupSize,
        phone: phone || undefined,
        side: sideRaw as GuestSide | undefined,
        gathering: gatheringRaw as GatheringType | undefined,
      },
    };
  }
}
