import { ApiProperty } from '@nestjs/swagger';
import { RsvpStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetRsvpDto {
  @ApiProperty({ enum: RsvpStatus, example: RsvpStatus.CONFIRMED })
  @IsEnum(RsvpStatus)
  rsvpStatus: RsvpStatus;
}
