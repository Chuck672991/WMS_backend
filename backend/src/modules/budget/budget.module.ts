import { Module } from '@nestjs/common';
import { BudgetCategoriesController } from './budget-categories.controller';
import { BudgetController } from './budget.controller';
import { BudgetRepository } from './budget.repository';
import { BudgetService } from './budget.service';

@Module({
  controllers: [BudgetController, BudgetCategoriesController],
  providers: [BudgetService, BudgetRepository],
  // Exported so VendorsService can call BudgetService.createFromVendorPayment()
  // / deleteByVendorPaymentId() — the documented cross-module sync (Section
  // 6, Design Decision).
  exports: [BudgetService],
})
export class BudgetModule {}
