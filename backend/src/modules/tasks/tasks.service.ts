import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WeddingRole } from '@prisma/client';
import { CacheInvalidationService } from '../../cache/cache-invalidation.service';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PaginationMeta } from '../../common/types/pagination.types';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // --- 7.6 List tasks ------------------------------------------------------

  async listTasks(weddingId: string, query: QueryTaskDto) {
    const { items, totalItems } = await this.repository.findManyForWedding(
      weddingId,
      {
        status: query.status,
        priority: query.priority,
        assignedTo: query.assignedTo,
        eventId: query.eventId,
        search: query.search,
      },
      {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      },
    );

    // Edge case (Section 7, both parts): a task's assignee may have since
    // left the wedding — assignedTo is retained as a historical record, but
    // surfaced here so the UI can label it "unassigned member".
    const assigneeIds = [
      ...new Set(
        items.map((t) => t.assignedTo).filter((id): id is string => !!id),
      ),
    ];
    const activeMemberIds = await this.repository.findActiveMemberIds(
      weddingId,
      assigneeIds,
    );

    const data = items.map((task) => ({
      ...task,
      assigneeIsActiveMember: task.assignedTo
        ? activeMemberIds.has(task.assignedTo)
        : null,
    }));

    const pagination: PaginationMeta = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / query.limit)),
    };

    return { data, pagination };
  }

  // --- 7.7 Create task -----------------------------------------------------

  async createTask(weddingId: string, createdBy: string, dto: CreateTaskDto) {
    if (dto.assignedTo) {
      const isMember = await this.repository.isWeddingMember(
        weddingId,
        dto.assignedTo,
      );
      if (!isMember) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'assignedTo must be a member of this wedding.',
        });
      }
    }
    if (dto.eventId) {
      const belongs = await this.repository.eventBelongsToWedding(
        weddingId,
        dto.eventId,
      );
      if (!belongs) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'eventId does not belong to this wedding.',
        });
      }
    }

    const task = await this.repository.createTask(weddingId, createdBy, {
      title: dto.title,
      description: dto.description,
      assignedTo: dto.assignedTo,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      priority: dto.priority,
      eventId: dto.eventId,
    });
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    return task;
  }

  // --- 7.8 Update task -------------------------------------------------

  async updateTask(
    weddingId: string,
    taskId: string,
    dto: UpdateTaskDto,
    currentUser: CurrentUserPayload,
    currentRole: WeddingRole,
  ) {
    const task = await this.findTaskOrThrow(weddingId, taskId);

    const isPrivileged =
      currentRole === WeddingRole.OWNER || currentRole === WeddingRole.CO_OWNER;
    if (!isPrivileged) {
      // Permission nuance (Section 7.8): a non-privileged member may only
      // update the `status` field, and only on a task assigned to themselves.
      const otherFieldsProvided = [
        dto.title,
        dto.description,
        dto.assignedTo,
        dto.dueDate,
        dto.priority,
        dto.eventId,
      ].some((v) => v !== undefined);
      const isSelfAssignee = task.assignedTo === currentUser.id;

      if (!isSelfAssignee || otherFieldsProvided || dto.status === undefined) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'You can only update the status of tasks assigned to you.',
        });
      }

      const updated = await this.repository.updateTask(taskId, {
        status: dto.status,
      });
      void this.cacheInvalidation.invalidateDashboard(weddingId);
      return updated;
    }

    if (dto.assignedTo) {
      const isMember = await this.repository.isWeddingMember(
        weddingId,
        dto.assignedTo,
      );
      if (!isMember) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'assignedTo must be a member of this wedding.',
        });
      }
    }
    if (dto.eventId) {
      const belongs = await this.repository.eventBelongsToWedding(
        weddingId,
        dto.eventId,
      );
      if (!belongs) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'eventId does not belong to this wedding.',
        });
      }
    }

    const updated = await this.repository.updateTask(taskId, {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
    void this.cacheInvalidation.invalidateDashboard(weddingId);
    return updated;
  }

  // --- 7.9 Delete task -------------------------------------------------

  async deleteTask(weddingId: string, taskId: string): Promise<void> {
    await this.findTaskOrThrow(weddingId, taskId);
    await this.repository.softDeleteTask(taskId);
    void this.cacheInvalidation.invalidateDashboard(weddingId);
  }

  // --- Shared helpers ------------------------------------------------------

  private async findTaskOrThrow(weddingId: string, taskId: string) {
    const task = await this.repository.findTaskById(weddingId, taskId);
    if (!task) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Task not found.',
      });
    }
    return task;
  }
}
