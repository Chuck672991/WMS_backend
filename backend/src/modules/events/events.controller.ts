import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WeddingRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeddingAccessGuard } from '../../common/guards/wedding-access.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('weddings/:weddingId/events')
@UseGuards(JwtAuthGuard, WeddingAccessGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // 7.1 — any member
  @Get()
  list(@Param('weddingId') weddingId: string, @Query() query: QueryEventDto) {
    return this.eventsService.listEvents(weddingId, query);
  }

  // 7.2 — any member
  @Get(':eventId')
  getDetail(
    @Param('weddingId') weddingId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.getEventDetail(weddingId, eventId);
  }

  // 7.3 — owner, co_owner, family_member (propose)
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER, WeddingRole.FAMILY_MEMBER)
  @Post()
  create(
    @Param('weddingId') weddingId: string,
    @Body() dto: CreateEventDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.eventsService.createEvent(weddingId, user.id, dto);
  }

  // 7.4
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Patch(':eventId')
  update(
    @Param('weddingId') weddingId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(weddingId, eventId, dto);
  }

  // 7.5
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':eventId')
  async remove(
    @Param('weddingId') weddingId: string,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    await this.eventsService.deleteEvent(weddingId, eventId);
  }
}
