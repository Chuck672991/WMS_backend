import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { RedisService } from '../../cache/redis.service';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { BudgetService } from '../budget/budget.service';
import { GuestsService } from '../guests/guests.service';
import { DashboardRepository } from './dashboard.repository';

const CACHE_TTL_SECONDS = 60;

interface ProgressInputs {
  tasksCompleted: number;
  tasksTotal: number;
  vendorsBookedCount: number;
  vendorsTotalCount: number;
  guestsRespondedCount: number;
  guestsTotalCount: number;
  hasBudgetSet: boolean;
}

/**
 * Weighted composite of four rates (Section 8: "Overall progress percentage").
 * Flagged in the doc as a documented assumption pending product-owner
 * confirmation — kept isolated here so it can be tuned later without
 * touching the controller or any other module.
 */
function calculateProgress(inputs: ProgressInputs): number {
  const tasksCompletionRate =
    inputs.tasksTotal > 0 ? inputs.tasksCompleted / inputs.tasksTotal : 0;
  const vendorsBookedRate =
    inputs.vendorsTotalCount > 0
      ? inputs.vendorsBookedCount / inputs.vendorsTotalCount
      : 0;
  const guestRsvpRate =
    inputs.guestsTotalCount > 0
      ? inputs.guestsRespondedCount / inputs.guestsTotalCount
      : 0;
  const budgetPlanningRate = inputs.hasBudgetSet ? 1 : 0;

  const average =
    (tasksCompletionRate +
      vendorsBookedRate +
      guestRsvpRate +
      budgetPlanningRate) /
    4;
  return Math.round(average * 100);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly budgetService: BudgetService,
    private readonly guestsService: GuestsService,
    private readonly redis: RedisService,
  ) {}

  // --- 8.1 Get dashboard summary ---------------------------------------

  async getDashboardSummary(weddingId: string) {
    const cacheKey = `dashboard:${weddingId}`;
    const cached = await this.redis.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const wedding = await this.repository.findWedding(weddingId);
    if (!wedding) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Wedding not found.',
      });
    }

    const [
      taskGroups,
      vendors,
      eventsTotalCount,
      nextEvent,
      budgetSummary,
      guestSummary,
    ] = await Promise.all([
      this.repository.countTasksByStatus(weddingId),
      this.repository.findVendorsForAggregation(weddingId),
      this.repository.countEvents(weddingId),
      this.repository.findNextEvent(weddingId),
      // Service-to-service reuse, not HTTP (Section 8.1 data sources).
      this.budgetService.getSummary(weddingId),
      this.guestsService.getSummary(weddingId),
    ]);

    const tasksTotal = taskGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );
    const tasksCompleted =
      taskGroups.find((group) => group.status === TaskStatus.DONE)?._count
        ._all ?? 0;

    const vendorsTotalCount = vendors.length;
    let vendorsBookedCount = 0;
    let vendorsFullyPaidCount = 0;
    for (const vendor of vendors) {
      const totalPaid = vendor.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      if (totalPaid > 0) vendorsBookedCount += 1;
      if (
        vendor.totalPrice !== null &&
        totalPaid >= Number(vendor.totalPrice)
      ) {
        vendorsFullyPaidCount += 1;
      }
    }

    const daysUntilWedding = wedding.weddingDate
      ? Math.floor(
          (wedding.weddingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null;

    const overallProgress = calculateProgress({
      tasksCompleted,
      tasksTotal,
      vendorsBookedCount,
      vendorsTotalCount,
      guestsRespondedCount:
        guestSummary.confirmedHeads + guestSummary.declinedHeads,
      guestsTotalCount: guestSummary.totalGuests,
      hasBudgetSet: budgetSummary.totalBudget !== null,
    });

    const result = {
      weddingName: wedding.name,
      daysUntilWedding,
      overallProgress,
      tasksCompleted,
      tasksTotal,
      budget: {
        totalBudget: budgetSummary.totalBudget,
        totalSpent: budgetSummary.totalSpent,
        percentUsed: budgetSummary.percentUsed,
      },
      guests: {
        total: guestSummary.totalGuests,
        confirmed: guestSummary.confirmedHeads,
      },
      vendors: {
        totalCount: vendorsTotalCount,
        fullyPaidCount: vendorsFullyPaidCount,
      },
      events: {
        totalCount: eventsTotalCount,
        nextEvent: nextEvent
          ? {
              id: nextEvent.id,
              name: nextEvent.name,
              eventDate: nextEvent.eventDate,
            }
          : null,
      },
    };

    await this.redis.set(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }
}
