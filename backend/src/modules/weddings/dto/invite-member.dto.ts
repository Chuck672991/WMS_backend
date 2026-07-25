import { ApiProperty } from '@nestjs/swagger';
import { WeddingRole } from '@prisma/client';
import { IsEmail, IsIn } from 'class-validator';

const INVITABLE_ROLES = [
  WeddingRole.CO_OWNER,
  WeddingRole.FAMILY_MEMBER,
  WeddingRole.VIEWER,
];

export class InviteMemberDto {
  @ApiProperty({ example: 'family@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: INVITABLE_ROLES, example: WeddingRole.FAMILY_MEMBER })
  @IsIn(INVITABLE_ROLES, {
    message: 'role must be one of CO_OWNER, FAMILY_MEMBER, VIEWER.',
  })
  role: WeddingRole;
}
