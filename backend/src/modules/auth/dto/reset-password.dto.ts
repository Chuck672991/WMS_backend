import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).+$/;

export class ResetPasswordDto {
  @ApiProperty({ example: 'ayesha@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Plain token from the reset email' })
  @IsString()
  @Length(1, 512)
  token: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @Length(8, 128, { message: 'Password must be at least 8 characters.' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least one uppercase letter and one number.',
  })
  newPassword: string;
}
