import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ayesha B. Khan' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @ApiPropertyOptional({ example: '+923001234567' })
  @IsOptional()
  @Matches(E164_REGEX, { message: 'Phone must be in E.164 format.' })
  phone?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.smartwedding.app/profile/uuid.jpg',
  })
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;
}
