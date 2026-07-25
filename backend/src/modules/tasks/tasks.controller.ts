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
import { CurrentWeddingRole } from '../../common/decorators/current-wedding-role.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeddingAccessGuard } from '../../common/guards/wedding-access.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

const MEMBER_ROLES = [
  WeddingRole.OWNER,
  WeddingRole.CO_OWNER,
  WeddingRole.FAMILY_MEMBER,
];

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('weddings/:weddingId/tasks')
@UseGuards(JwtAuthGuard, WeddingAccessGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // 7.6 — any member
  @Get()
  list(@Param('weddingId') weddingId: string, @Query() query: QueryTaskDto) {
    return this.tasksService.listTasks(weddingId, query);
  }

  // 7.7
  @Roles(...MEMBER_ROLES)
  @Post()
  create(
    @Param('weddingId') weddingId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tasksService.createTask(weddingId, user.id, dto);
  }

  // 7.8 — permission nuance (self-assignee, status-only) enforced in the service
  @Roles(...MEMBER_ROLES)
  @Patch(':taskId')
  update(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentWeddingRole() role: WeddingRole,
  ) {
    return this.tasksService.updateTask(weddingId, taskId, dto, user, role);
  }

  // 7.9
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':taskId')
  async remove(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    await this.tasksService.deleteTask(weddingId, taskId);
  }
}
