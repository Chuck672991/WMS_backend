import { Injectable } from '@nestjs/common';
import { PaymentMethod, Prisma, VendorCategory } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateVendorData {
  name: string;
  category: VendorCategory;
  customCategory?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  totalPrice?: number;
  eventId?: string;
  notes?: string;
}

export interface CreatePaymentData {
  amount: number;
  paymentDate?: Date;
  method?: PaymentMethod;
  note?: string;
  recordedBy: string;
}

export interface VendorListFilters {
  category?: VendorCategory;
  eventId?: string;
  search?: string;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class VendorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Exposes the underlying client so services can orchestrate a
   * transaction that spans this repository and another module's (e.g.
   * BudgetRepository) in a single atomic unit. */
  get client(): PrismaService {
    return this.prisma;
  }

  findManyForWedding(weddingId: string, filters: VendorListFilters) {
    return this.prisma.vendor.findMany({
      where: {
        weddingId,
        deletedAt: null,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.eventId ? { eventId: filters.eventId } : {}),
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
                  contactName: {
                    contains: filters.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            }
          : {}),
      },
      include: { payments: { select: { amount: true } } },
    });
  }

  findVendorById(weddingId: string, vendorId: string) {
    return this.prisma.vendor.findFirst({
      where: { id: vendorId, weddingId, deletedAt: null },
      include: { payments: { orderBy: { paymentDate: 'desc' } } },
    });
  }

  createVendor(weddingId: string, createdBy: string, data: CreateVendorData) {
    return this.prisma.vendor.create({
      data: { ...data, weddingId, createdBy },
    });
  }

  updateVendor(vendorId: string, data: Partial<CreateVendorData>) {
    return this.prisma.vendor.update({ where: { id: vendorId }, data });
  }

  softDeleteVendor(vendorId: string) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { deletedAt: new Date() },
    });
  }

  createPayment(vendorId: string, data: CreatePaymentData, tx?: Tx) {
    return (tx ?? this.prisma).vendorPayment.create({
      data: { ...data, vendorId },
    });
  }

  findPaymentById(vendorId: string, paymentId: string) {
    return this.prisma.vendorPayment.findFirst({
      where: { id: paymentId, vendorId },
    });
  }

  deletePayment(paymentId: string, tx?: Tx) {
    return (tx ?? this.prisma).vendorPayment.delete({
      where: { id: paymentId },
    });
  }

  sumPayments(vendorId: string) {
    return this.prisma.vendorPayment.aggregate({
      where: { vendorId },
      _sum: { amount: true },
    });
  }
}
