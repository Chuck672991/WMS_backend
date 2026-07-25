import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { WeddingWorkspaceController } from './wedding-workspace.controller';
import { WeddingsController } from './weddings.controller';
import { WeddingsRepository } from './weddings.repository';
import { WeddingsService } from './weddings.service';

@Module({
  controllers: [
    WeddingsController,
    WeddingWorkspaceController,
    InvitesController,
  ],
  providers: [WeddingsService, WeddingsRepository],
})
export class WeddingsModule {}
