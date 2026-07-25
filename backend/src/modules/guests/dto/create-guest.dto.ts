import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GatheringType, GuestSide } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export class CreateGuestDto {
  @ApiProperty({ example: 'Khan Family' })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 6, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  groupSize: number;

  @ApiPropertyOptional({ example: '+923001234567' })
  @IsOptional()
  @Matches(E164_REGEX, { message: 'Phone must be in E.164 format.' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: GuestSide, default: GuestSide.BOTH })
  @IsOptional()
  @IsEnum(GuestSide)
  side?: GuestSide;

  @ApiPropertyOptional({ enum: GatheringType, default: GatheringType.MIXED })
  @IsOptional()
  @IsEnum(GatheringType)
  gathering?: GatheringType;

  @ApiPropertyOptional({
    description:
      'If omitted, guest is considered invited to all wedding events.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  eventIds?: string[];
}
