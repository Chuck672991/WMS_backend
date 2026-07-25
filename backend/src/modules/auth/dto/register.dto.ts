import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).+$/;

export class RegisterDto {
  @ApiProperty({ example: 'Ayesha Khan' })
  @IsString()
  @Length(2, 100)
  fullName: string;

  @ApiProperty({ example: 'ayesha@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @Length(8, 128, { message: 'Password must be at least 8 characters.' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least one uppercase letter and one number.',
  })
  password: string;

  @ApiPropertyOptional({ example: '+923001234567' })
  @IsOptional()
  @Matches(E164_REGEX, { message: 'Phone must be in E.164 format.' })
  phone?: string;
}
