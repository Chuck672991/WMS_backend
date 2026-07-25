import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetCategory, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxDate,
  ValidateIf,
} from 'class-validator';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export class CreateBudgetItemDto {
  @ApiProperty({ enum: BudgetCategory, example: BudgetCategory.TRANSPORT })
  @IsEnum(BudgetCategory)
  category: BudgetCategory;

  @ApiPropertyOptional({ description: 'Required when category = OTHER' })
  @ValidateIf(
    (dto: CreateBudgetItemDto) => dto.category === BudgetCategory.OTHER,
  )
  @IsString()
  @Length(1, 50)
  customCategory?: string;

  @ApiProperty({ example: 'Baraat car decoration + fuel' })
  @IsString()
  @Length(2, 150)
  title: string;

  @ApiProperty({ example: 35000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    example: '2026-07-15',
    description: 'Defaults to now',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MaxDate(() => new Date(Date.now() + ONE_YEAR_MS), {
    message: 'expenseDate cannot be more than 1 year in the future.',
  })
  expenseDate?: Date;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Paid to driver directly' })
  @IsOptional()
  @IsString()
  notes?: string;
}
