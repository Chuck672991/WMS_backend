import { Injectable, NotFoundException } from '@nestjs/common';
import { VendorCategory } from '@prisma/client';
import { CacheInvalidationService } from '../../cache/cache-invalidation.service';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { PaginationMeta } from '../../common/types/pagination.types';
import { BudgetService } from '../budget/budget.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { QueryVendorDto } from './dto/query-vendor.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorStatus } from './vendor-status.enum';
import { VendorsRepository } from './vendors.repository';

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  CATERING: 'Catering',
  PHOTOGRAPHY: 'Photography',
  DECORATION: 'Decoration',
  SALON: 'Salon',
  TRANSPORT: 'Transport',
  BAND_DJ: 'Band / DJ',
  VENUE: 'Venue',
  DRESS_DESIGNER: 'Dress Designer',
  JEWELLERY: 'Jewellery',
  INVITATION_CARDS: 'Invitation Cards',
  OTHER: 'Other',
};

function computeStatus(
  totalPaid: number,
  totalPrice: number | null,
): VendorStatus {
  if (totalPaid <= 0) return VendorStatus.PENDING;
  if (totalPrice !== null && totalPaid >= totalPrice) return VendorStatus.PAID;
  return VendorStatus.ADVANCE;
}

@Injectable()
export class VendorsService {
  constructor(
    private readonly repository: VendorsRepository,
    private readonly budgetService: BudgetService,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // --- 4.1 List vendors -----------------------------------------------------

  async listVendors(weddingId: string, query: QueryVendorDto) {
    const vendors = await this.repository.findManyForWedding(weddingId, {
      category: query.category,
      eventId: query.eventId,
      search: query.search,
    });

    // Status is derived, so filtering by it happens after aggregation
    // (Section 4: Derived Status Logic).
    let summaries = vendors.map((vendor) => {
      const totalPaid = vendor.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const totalPrice =
        vendor.totalPrice !== null ? Number(vendor.totalPrice) : null;
      const status = computeStatus(totalPaid, totalPrice);
      return {
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        phone: vendor.phone,
        totalPrice: vendor.totalPrice,
        totalPaid,
        balanceDue: totalPrice !== null ? totalPrice - totalPaid : null,
        status,
        eventId: vendor.eventId,
        imageUrl: vendor.imageUrl,
        createdAt: vendor.createdAt,
        _sortName: vendor.name,
        _sortTotalPrice: totalPrice ?? 0,
      };
    });

    if (query.status) {
      summaries = summaries.filter((v) => v.status === query.status);
    }

    summaries.sort((a, b) => {
      const dir = query.sortOrder === 'asc' ? 1 : -1;
      switch (query.sortBy) {
        case 'name':
          return a._sortName.localeCompare(b._sortName) * dir;
        case 'totalPrice':
          return (a._sortTotalPrice - b._sortTotalPrice) * dir;
        case 'createdAt':
        default:
          return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
      }
    });

    const totalItems = summaries.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
    const start = (query.page - 1) * query.limit;
    const page = summaries
      .slice(start, start + query.limit)
      .map(({ _sortName, _sortTotalPrice, ...rest }) => rest);

    const pagination: PaginationMeta = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    };

    return { data: page, pagination };
  }

  // --- 4.2 Get vendor detail -------------------------------------------------

  async getVendorDetail(weddingId: string, vendorId: string) {
    const vendor = await this.findVendorOrThrow(weddingId, vendorId);
    const totalPaid = vendor.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const totalPrice =
      vendor.totalPrice !== null ? Number(vendor.totalPrice) : null;

    return {
      ...vendor,
      totalPaid,
      balanceDue: totalPrice !== null ? totalPrice - totalPaid : null,
      status: computeStatus(totalPaid, totalPrice),
    };
  }

  // --- 4.3 Create vendor ---------------------------------------------------

  async createVendor(
    weddingId: string,
    createdBy: string,
    dto: CreateVendorDto,
  ) {
    if (dto.eventId) {
      await this.assertEventBelongsToWedding(weddingId, dto.eventId);
    }
    const vendor = await this.repository.createVendor(
      weddingId,
      createdBy,
      dto,
    );
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    return vendor;
  }

  // --- 4.4 Update vendor ---------------------------------------------------

  async updateVendor(
    weddingId: string,
    vendorId: string,
    dto: UpdateVendorDto,
  ) {
    await this.findVendorOrThrow(weddingId, vendorId);
    if (dto.eventId) {
      await this.assertEventBelongsToWedding(weddingId, dto.eventId);
    }
    const vendor = await this.repository.updateVendor(vendorId, dto);
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    return vendor;
  }

  // --- 4.5 Delete vendor ----------------------------------------------------

  async deleteVendor(weddingId: string, vendorId: string): Promise<void> {
    await this.findVendorOrThrow(weddingId, vendorId);
    await this.repository.softDeleteVendor(vendorId);
    void this.cacheInvalidation.invalidateDashboard(weddingId);
  }

  // --- 4.6 Record payment ---------------------------------------------------

  async recordPayment(
    weddingId: string,
    vendorId: string,
    dto: RecordPaymentDto,
    recordedBy: string,
  ) {
    const vendor = await this.findVendorOrThrow(weddingId, vendorId);

    // Cross-module sync (Section 6, Design Decision): every vendor payment
    // auto-creates a matching BudgetItem in the *same transaction* so the
    // Budget and Vendor screens never disagree on totals without the user
    // entering data twice, and neither write can succeed without the other.
    const payment = await this.repository.client.$transaction(async (tx) => {
      const created = await this.repository.createPayment(
        vendorId,
        {
          amount: dto.amount,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
          method: dto.method,
          note: dto.note,
          recordedBy,
        },
        tx,
      );

      await this.budgetService.createFromVendorPayment(
        {
          weddingId,
          vendorId: vendor.id,
          vendorPaymentId: created.id,
          vendorName: vendor.name,
          vendorCategory: vendor.category,
          amount: created.amount.toNumber(),
          paymentDate: created.paymentDate,
          paymentMethod: created.method,
          recordedBy,
        },
        tx,
      );

      return created;
    });

    const priorTotalPaid = vendor.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const totalPaid = priorTotalPaid + dto.amount;
    const totalPrice =
      vendor.totalPrice !== null ? Number(vendor.totalPrice) : null;

    // Overpayment is allowed (real-world price renegotiations happen) — not
    // hard-blocked, just flagged so the UI can surface it.
    const warning =
      totalPrice !== null && totalPaid > totalPrice
        ? `Total paid (${totalPaid}) exceeds the agreed price (${totalPrice}).`
        : null;

    void this.cacheInvalidation.invalidateDashboard(weddingId);

    return {
      data: {
        id: payment.id,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        method: payment.method,
      },
      warning,
      vendorSummary: {
        totalPaid,
        totalPrice,
        balanceDue: totalPrice !== null ? totalPrice - totalPaid : null,
        status: computeStatus(totalPaid, totalPrice),
      },
    };
  }

  // --- 4.7 Delete payment ---------------------------------------------------

  async deletePayment(
    weddingId: string,
    vendorId: string,
    paymentId: string,
  ): Promise<void> {
    await this.findVendorOrThrow(weddingId, vendorId);
    const payment = await this.repository.findPaymentById(vendorId, paymentId);
    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Payment not found.',
      });
    }

    // Cascades the linked BudgetItem deletion in the same transaction
    // (Section 6.6 edge case).
    await this.repository.client.$transaction(async (tx) => {
      await this.repository.deletePayment(paymentId, tx);
      await this.budgetService.deleteByVendorPaymentId(paymentId, tx);
    });
    void this.cacheInvalidation.invalidateDashboard(weddingId);
  }

  // --- 4.8 List vendor categories (static reference) ------------------------

  listCategories() {
    return Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
      value,
      label,
    }));
  }

  // --- Shared helpers ------------------------------------------------------

  private async findVendorOrThrow(weddingId: string, vendorId: string) {
    const vendor = await this.repository.findVendorById(weddingId, vendorId);
    if (!vendor) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Vendor not found.',
      });
    }
    return vendor;
  }

  private async assertEventBelongsToWedding(
    weddingId: string,
    eventId: string,
  ): Promise<void> {
    const belongs = await this.repository.eventBelongsToWedding(
      weddingId,
      eventId,
    );
    if (!belongs) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'eventId does not belong to this wedding.',
      });
    }
  }
}
