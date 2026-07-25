import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationChannel } from '../notification-channel.enum';

export class SendInviteDto {
  @ApiPropertyOptional({
    enum: NotificationChannel,
    default: NotificationChannel.WHATSAPP,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
