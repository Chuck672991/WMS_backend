import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({
    enum: EventStatus,
    description:
      'Manual override for postponed/cancelled events; omit to auto-derive from eventDate.',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  manualStatus?: EventStatus;
}
