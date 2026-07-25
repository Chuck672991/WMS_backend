import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VendorCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export class CreateVendorDto {
  @ApiProperty({ example: 'Al-Madina Caterers' })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ enum: VendorCategory, example: VendorCategory.CATERING })
  @IsEnum(VendorCategory)
  category: VendorCategory;

  @ApiPropertyOptional({ description: 'Required when category = OTHER' })
  @ValidateIf((dto: CreateVendorDto) => dto.category === VendorCategory.OTHER)
  @IsString()
  @Length(1, 50)
  customCategory?: string;

  @ApiPropertyOptional({ example: 'Imran Sahab' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: '+923001112233' })
  @IsOptional()
  @Matches(E164_REGEX, { message: 'Phone must be in E.164 format.' })
  phone?: string;

  @ApiPropertyOptional({ example: 'info@almadina.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 950000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  totalPrice?: number;

  @ApiPropertyOptional({ description: 'Optional link to a specific event' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ example: '312 heads, buffet style' })
  @IsOptional()
  @IsString()
  notes?: string;
}
