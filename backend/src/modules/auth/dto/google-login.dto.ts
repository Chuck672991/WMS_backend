import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'ID token issued by the Google Sign-In mobile SDK',
  })
  @IsString()
  @MinLength(1)
  idToken: string;
}
