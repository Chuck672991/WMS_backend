import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { GuestsModule } from '../guests/guests.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [BudgetModule, GuestsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
