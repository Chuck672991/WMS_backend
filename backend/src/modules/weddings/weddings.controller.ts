import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateWeddingDto } from './dto/create-wedding.dto';
import { WeddingsService } from './weddings.service';

@ApiTags('Weddings')
@ApiBearerAuth()
@Controller('weddings')
@UseGuards(JwtAuthGuard)
export class WeddingsController {
  constructor(private readonly weddingsService: WeddingsService) {}

  // 3.3 — not wedding-scoped yet (no :weddingId exists), so WeddingAccessGuard
  // does not apply here; it applies to every route in WeddingWorkspaceController.
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWeddingDto,
  ) {
    return this.weddingsService.createWedding(user.id, dto);
  }
}
