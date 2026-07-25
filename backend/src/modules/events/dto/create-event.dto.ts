import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateEventDto {
  @ApiProperty({ example: 'Mehndi' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: '2026-03-28' })
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({
    example: '18:00',
    description: 'HH:mm 24-hour format',
  })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:mm format.' })
  startTime?: string;

  @ApiPropertyOptional({ example: 'Pearl Hall' })
  @IsOptional()
  @IsString()
  venueName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venueAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
