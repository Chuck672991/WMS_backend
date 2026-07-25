import { Injectable } from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateTaskData {
  title: string;
  description?: string;
  assignedTo?: string;
  dueDate?: Date;
  priority?: TaskPriority;
  eventId?: string;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  status?: TaskStatus;
}

export interface TaskListFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  eventId?: string;
  search?: string;
}

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isWeddingMember(weddingId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.weddingMember.count({
      where: { weddingId, userId },
    });
    return count > 0;
  }

  async eventBelongsToWedding(
    weddingId: string,
    eventId: string,
  ): Promise<boolean> {
    const count = await this.prisma.event.count({
      where: { id: eventId, weddingId, deletedAt: null },
    });
    return count > 0;
  }

  /** Of the given userIds, returns the subset still an active member of the wedding. */
  async findActiveMemberIds(
    weddingId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const members = await this.prisma.weddingMember.findMany({
      where: { weddingId, userId: { in: userIds } },
      select: { userId: true },
    });
    return new Set(members.map((m) => m.userId));
  }

  private buildListWhere(
    weddingId: string,
    filters: TaskListFilters,
  ): Prisma.TaskWhereInput {
    return {
      weddingId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                title: {
                  contains: filters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };
  }

  async findManyForWedding(
    weddingId: string,
    filters: TaskListFilters,
    pagination: {
      skip: number;
      take: number;
      orderBy: Prisma.TaskOrderByWithRelationInput;
    },
  ) {
    const where = this.buildListWhere(weddingId, filters);
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, totalItems };
  }

  findTaskById(weddingId: string, taskId: string) {
    return this.prisma.task.findFirst({
      where: { id: taskId, weddingId, deletedAt: null },
    });
  }

  createTask(weddingId: string, createdBy: string, data: CreateTaskData) {
    return this.prisma.task.create({ data: { ...data, weddingId, createdBy } });
  }

  updateTask(taskId: string, data: UpdateTaskData) {
    return this.prisma.task.update({ where: { id: taskId }, data });
  }

  softDeleteTask(taskId: string) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  }
}
