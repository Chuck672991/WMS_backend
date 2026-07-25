import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { VendorCategoriesController } from './vendor-categories.controller';
import { VendorsController } from './vendors.controller';
import { VendorsRepository } from './vendors.repository';
import { VendorsService } from './vendors.service';

@Module({
  imports: [BudgetModule],
  controllers: [VendorsController, VendorCategoriesController],
  providers: [VendorsService, VendorsRepository],
})
export class VendorsModule {}
