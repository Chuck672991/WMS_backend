import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WeddingRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeddingAccessGuard } from '../../common/guards/wedding-access.guard';
import { BudgetService } from './budget.service';
import { CreateBudgetItemDto } from './dto/create-budget-item.dto';
import { QueryBudgetItemDto } from './dto/query-budget-item.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';

@ApiTags('Budget')
@ApiBearerAuth()
@Controller('weddings/:weddingId/budget')
@UseGuards(JwtAuthGuard, WeddingAccessGuard, RolesGuard)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  // 6.1 — any member
  @Get('summary')
  getSummary(@Param('weddingId') weddingId: string) {
    return this.budgetService.getSummary(weddingId);
  }

  // 6.2 — any member
  @Get('items')
  listItems(
    @Param('weddingId') weddingId: string,
    @Query() query: QueryBudgetItemDto,
  ) {
    return this.budgetService.listItems(weddingId, query);
  }

  // 6.3 — any member
  @Get('items/:itemId')
  getItemDetail(
    @Param('weddingId') weddingId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.budgetService.getItemDetail(weddingId, itemId);
  }

  // 6.4
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Post('items')
  createItem(
    @Param('weddingId') weddingId: string,
    @Body() dto: CreateBudgetItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.budgetService.createItem(weddingId, user.id, dto);
  }

  // 6.5
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Patch('items/:itemId')
  updateItem(
    @Param('weddingId') weddingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBudgetItemDto,
  ) {
    return this.budgetService.updateItem(weddingId, itemId, dto);
  }

  // 6.6
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('items/:itemId')
  async deleteItem(
    @Param('weddingId') weddingId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.budgetService.deleteItem(weddingId, itemId);
  }
}
