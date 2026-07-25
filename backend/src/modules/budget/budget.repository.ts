import { Injectable } from '@nestjs/common';
import { BudgetCategory, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateBudgetItemData {
  category: BudgetCategory;
  customCategory?: string;
  title: string;
  amount: number;
  expenseDate?: Date;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface CreateFromVendorPaymentData {
  weddingId: string;
  vendorId: string;
  vendorPaymentId: string;
  category: BudgetCategory;
  title: string;
  amount: number;
  expenseDate: Date;
  paymentMethod: PaymentMethod;
  recordedBy: string;
}

export interface BudgetItemListFilters {
  category?: BudgetCategory;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  vendorId?: string;
}

@Injectable()
export class BudgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  findWeddingTotalBudget(weddingId: string) {
    return this.prisma.wedding.findUnique({
      where: { id: weddingId },
      select: { totalBudget: true },
    });
  }

  sumByCategory(weddingId: string) {
    return this.prisma.budgetItem.groupBy({
      by: ['category'],
      where: { weddingId, deletedAt: null },
      _sum: { amount: true },
    });
  }

  private buildListWhere(
    weddingId: string,
    filters: BudgetItemListFilters,
  ): Prisma.BudgetItemWhereInput {
    return {
      weddingId,
      deletedAt: null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            expenseDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                title: {
                  contains: filters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                notes: {
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
    filters: BudgetItemListFilters,
    pagination: {
      skip: number;
      take: number;
      orderBy: Prisma.BudgetItemOrderByWithRelationInput;
    },
  ) {
    const where = this.buildListWhere(weddingId, filters);
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.budgetItem.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      this.prisma.budgetItem.count({ where }),
    ]);
    return { items, totalItems };
  }

  findItemById(weddingId: string, itemId: string) {
    return this.prisma.budgetItem.findFirst({
      where: { id: itemId, weddingId, deletedAt: null },
    });
  }

  createItem(
    weddingId: string,
    recordedBy: string,
    data: CreateBudgetItemData,
  ) {
    return this.prisma.budgetItem.create({
      data: { ...data, weddingId, recordedBy },
    });
  }

  createFromVendorPayment(
    data: CreateFromVendorPaymentData,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).budgetItem.create({ data });
  }

  updateItem(itemId: string, data: Partial<CreateBudgetItemData>) {
    return this.prisma.budgetItem.update({ where: { id: itemId }, data });
  }

  softDeleteItem(itemId: string) {
    return this.prisma.budgetItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });
  }

  deleteByVendorPaymentId(
    vendorPaymentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).budgetItem.deleteMany({
      where: { vendorPaymentId },
    });
  }
}
