import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SubmitRsvpDto {
  @ApiProperty({ enum: ['CONFIRMED', 'DECLINED'] })
  @IsIn(['CONFIRMED', 'DECLINED'])
  response: 'CONFIRMED' | 'DECLINED';

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attendingCount?: number;

  @ApiPropertyOptional({ example: 'Excited to be there!' })
  @IsOptional()
  @IsString()
  message?: string;
}
