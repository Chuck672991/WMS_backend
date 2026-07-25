import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UpdateProfileData {
  fullName?: string;
  phone?: string;
  profileImageUrl?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdWithMemberships(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        weddingMemberships: {
          where: { wedding: { deletedAt: null } },
          include: { wedding: { select: { id: true, name: true } } },
        },
      },
    });
  }

  findById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  updateProfile(userId: string, data: UpdateProfileData) {
    return this.prisma.user.update({ where: { id: userId }, data });
  }
}
