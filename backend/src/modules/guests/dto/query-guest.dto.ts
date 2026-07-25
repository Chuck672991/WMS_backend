import { ApiPropertyOptional } from '@nestjs/swagger';
import { GatheringType, GuestSide, RsvpStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const SORTABLE_FIELDS = ['name', 'createdAt', 'groupSize'] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

export class QueryGuestDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy: SortableField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Matches name, phone' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: RsvpStatus })
  @IsOptional()
  @IsEnum(RsvpStatus)
  rsvpStatus?: RsvpStatus;

  @ApiPropertyOptional({ enum: GuestSide })
  @IsOptional()
  @IsEnum(GuestSide)
  side?: GuestSide;

  @ApiPropertyOptional({ enum: GatheringType })
  @IsOptional()
  @IsEnum(GatheringType)
  gathering?: GatheringType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  eventId?: string;
}
