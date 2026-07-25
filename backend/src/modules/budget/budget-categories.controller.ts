import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BudgetService } from './budget.service';

// 6.7 — static reference endpoint, not wedding-scoped.
@ApiTags('Budget')
@ApiBearerAuth()
@Controller('budget')
@UseGuards(JwtAuthGuard)
export class BudgetCategoriesController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('categories')
  listCategories() {
    return this.budgetService.listCategories();
  }
}
