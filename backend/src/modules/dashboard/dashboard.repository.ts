import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  findWedding(weddingId: string) {
    return this.prisma.wedding.findUnique({
      where: { id: weddingId },
      select: { name: true, weddingDate: true },
    });
  }

  countTasksByStatus(weddingId: string) {
    return this.prisma.task.groupBy({
      by: ['status'],
      where: { weddingId, deletedAt: null },
      _count: { _all: true },
    });
  }

  /** Vendor + VendorPayment aggregation (Section 8.1 data source). */
  findVendorsForAggregation(weddingId: string) {
    return this.prisma.vendor.findMany({
      where: { weddingId, deletedAt: null },
      select: { totalPrice: true, payments: { select: { amount: true } } },
    });
  }

  countEvents(weddingId: string) {
    return this.prisma.event.count({ where: { weddingId, deletedAt: null } });
  }

  findNextEvent(weddingId: string) {
    return this.prisma.event.findFirst({
      where: {
        weddingId,
        deletedAt: null,
        manualStatus: null,
        eventDate: { gt: new Date() },
      },
      orderBy: { eventDate: 'asc' },
      select: { id: true, name: true, eventDate: true },
    });
  }
}
