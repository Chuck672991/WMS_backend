import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeddingAccessGuard } from '../../common/guards/wedding-access.guard';
import { DashboardService } from './dashboard.service';

// 8.2 (Recent Activity Feed) is explicitly flagged in the doc as an optional,
// not-MVP enhancement requiring an AuditLog table (Module 12, out of scope) —
// intentionally not implemented here.

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('weddings/:weddingId/dashboard')
@UseGuards(JwtAuthGuard, WeddingAccessGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // 8.1 — any member
  @Get()
  getSummary(@Param('weddingId') weddingId: string) {
    return this.dashboardService.getDashboardSummary(weddingId);
  }
}
