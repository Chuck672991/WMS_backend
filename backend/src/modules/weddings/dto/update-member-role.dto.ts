import { ApiProperty } from '@nestjs/swagger';
import { WeddingRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: WeddingRole, example: WeddingRole.CO_OWNER })
  @IsEnum(WeddingRole)
  role: WeddingRole;
}
