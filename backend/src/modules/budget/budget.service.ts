import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BudgetCategory,
  PaymentMethod,
  Prisma,
  VendorCategory,
} from '@prisma/client';
import { CacheInvalidationService } from '../../cache/cache-invalidation.service';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { PaginationMeta } from '../../common/types/pagination.types';
import { BudgetRepository } from './budget.repository';
import { CreateBudgetItemDto } from './dto/create-budget-item.dto';
import { QueryBudgetItemDto } from './dto/query-budget-item.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  CATERING: 'Catering',
  DECORATION: 'Decoration',
  DRESSES: 'Dresses',
  JEWELLERY: 'Jewellery',
  PHOTOGRAPHY: 'Photography',
  VENUE: 'Venue',
  TRANSPORT: 'Transport',
  INVITATION_CARDS: 'Invitation Cards',
  SALON_MAKEUP: 'Salon & Makeup',
  GIFTS: 'Gifts',
  MISCELLANEOUS: 'Miscellaneous',
  OTHER: 'Other',
};

// Vendor and Budget categories are separate enums with different value sets
// (Module 04 vs Module 06). This is the documented "category inferred from
// Vendor.category" mapping (Section 6, Design Decision) made explicit.
const VENDOR_TO_BUDGET_CATEGORY: Record<VendorCategory, BudgetCategory> = {
  CATERING: BudgetCategory.CATERING,
  PHOTOGRAPHY: BudgetCategory.PHOTOGRAPHY,
  DECORATION: BudgetCategory.DECORATION,
  SALON: BudgetCategory.SALON_MAKEUP,
  TRANSPORT: BudgetCategory.TRANSPORT,
  BAND_DJ: BudgetCategory.MISCELLANEOUS,
  VENUE: BudgetCategory.VENUE,
  DRESS_DESIGNER: BudgetCategory.DRESSES,
  JEWELLERY: BudgetCategory.JEWELLERY,
  INVITATION_CARDS: BudgetCategory.INVITATION_CARDS,
  OTHER: BudgetCategory.OTHER,
};

export function mapVendorCategoryToBudgetCategory(
  category: VendorCategory,
): BudgetCategory {
  return VENDOR_TO_BUDGET_CATEGORY[category];
}

interface VendorPaymentSyncParams {
  weddingId: string;
  vendorId: string;
  vendorPaymentId: string;
  vendorName: string;
  vendorCategory: VendorCategory;
  amount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  recordedBy: string;
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly repository: BudgetRepository,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // --- 6.1 Get budget summary -----------------------------------------------

  async getSummary(weddingId: string) {
    const [wedding, grouped] = await Promise.all([
      this.repository.findWeddingTotalBudget(weddingId),
      this.repository.sumByCategory(weddingId),
    ]);

    const totalBudget =
      wedding?.totalBudget !== null ? Number(wedding?.totalBudget) : null;
    const byCategory = grouped.map((row) => ({
      category: row.category,
      amount: Number(row._sum.amount ?? 0),
    }));
    const totalSpent = byCategory.reduce((sum, row) => sum + row.amount, 0);
    const remaining = totalBudget !== null ? totalBudget - totalSpent : null;
    const percentUsed = totalBudget
      ? Math.round((totalSpent / totalBudget) * 100)
      : null;

    return { totalBudget, totalSpent, remaining, percentUsed, byCategory };
  }

  // --- 6.2 List budget items -------------------------------------------------

  async listItems(weddingId: string, query: QueryBudgetItemDto) {
    const { items, totalItems } = await this.repository.findManyForWedding(
      weddingId,
      {
        category: query.category,
        search: query.search,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        vendorId: query.vendorId,
      },
      {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      },
    );

    const pagination: PaginationMeta = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / query.limit)),
    };

    return { data: items, pagination };
  }

  // --- 6.3 Get budget item detail -------------------------------------------

  async getItemDetail(weddingId: string, itemId: string) {
    return this.findItemOrThrow(weddingId, itemId);
  }

  // --- 6.4 Create budget item (manual) --------------------------------------

  async createItem(
    weddingId: string,
    recordedBy: string,
    dto: CreateBudgetItemDto,
  ) {
    const item = await this.repository.createItem(weddingId, recordedBy, dto);
    await this.cacheInvalidation.invalidateDashboard(weddingId);
    return item;
  }

  // --- 6.5 Update budget item -------------------------------------------

  async updateItem(
    weddingId: string,
    itemId: string,
    dto: UpdateBudgetItemDto,
  ) {
    const item = await this.findItemOrThrow(weddingId, itemId);

    if (item.vendorId && dto.amount !== undefined) {
      throw new UnprocessableEntityException({
        code: ErrorCode.LINKED_TO_VENDOR_PAYMENT,
        message:
          'This item was auto-created from a vendor payment. Edit the amount via the Vendor module instead.',
      });
    }

    const updated = await this.repository.updateItem(itemId, dto);
    await this.cacheInvalidation.invalidateDashboard(weddingId);
    return updated;
  }

  // --- 6.6 Delete budget item -------------------------------------------

  async deleteItem(weddingId: string, itemId: string): Promise<void> {
    const item = await this.findItemOrThrow(weddingId, itemId);

    if (item.vendorId) {
      throw new UnprocessableEntityException({
        code: ErrorCode.LINKED_TO_VENDOR_PAYMENT,
        message:
          'This item was auto-created from a vendor payment. Delete the payment via the Vendor module instead.',
      });
    }

    await this.repository.softDeleteItem(itemId);
    await this.cacheInvalidation.invalidateDashboard(weddingId);
  }

  // --- 6.7 List budget categories (static reference) ------------------------

  listCategories() {
    return Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
      value,
      label,
    }));
  }

  // --- Cross-module sync (called from VendorsService, Section 4.6/4.7) ------
  // `tx` lets the caller run this as part of its own transaction so the
  // VendorPayment and its synced BudgetItem commit atomically together.

  createFromVendorPayment(
    params: VendorPaymentSyncParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.repository.createFromVendorPayment(
      {
        weddingId: params.weddingId,
        vendorId: params.vendorId,
        vendorPaymentId: params.vendorPaymentId,
        category: mapVendorCategoryToBudgetCategory(params.vendorCategory),
        title: `Payment to ${params.vendorName}`,
        amount: params.amount,
        expenseDate: params.paymentDate,
        paymentMethod: params.paymentMethod,
        recordedBy: params.recordedBy,
      },
      tx,
    );
  }

  async deleteByVendorPaymentId(
    vendorPaymentId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.repository.deleteByVendorPaymentId(vendorPaymentId, tx);
  }

  // --- Shared helpers ------------------------------------------------------

  private async findItemOrThrow(weddingId: string, itemId: string) {
    const item = await this.repository.findItemById(weddingId, itemId);
    if (!item) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Budget item not found.',
      });
    }
    return item;
  }
}
