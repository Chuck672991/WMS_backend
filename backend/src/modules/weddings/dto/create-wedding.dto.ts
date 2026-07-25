import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class CreateWeddingDto {
  @ApiProperty({ example: "Ayesha & Bilal's Wedding" })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiPropertyOptional({ example: '2026-11-29' })
  @IsOptional()
  @IsDateString()
  weddingDate?: string;

  @ApiPropertyOptional({ example: 'Lahore' })
  @IsOptional()
  @IsString()
  venueCity?: string;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  estimatedGuests?: number;

  @ApiPropertyOptional({ example: 3200000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  totalBudget?: number;
}
