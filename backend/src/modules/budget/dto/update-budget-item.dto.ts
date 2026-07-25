import { PartialType } from '@nestjs/swagger';
import { CreateBudgetItemDto } from './create-budget-item.dto';

export class UpdateBudgetItemDto extends PartialType(CreateBudgetItemDto) {}
