import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Plain invite token from the invite email/deep link',
  })
  @IsString()
  @MinLength(1)
  token: string;
}
