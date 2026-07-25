import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  // --- 3.1 Get current user profile ---------------------------------------

  async getMe(userId: string) {
    const user = await this.repository.findByIdWithMemberships(userId);
    if (!user) {
      // Authenticated but no longer exists (deleted mid-session) — defensive.
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'User not found.',
      });
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      profileImageUrl: user.profileImageUrl,
      weddings: user.weddingMemberships.map((membership) => ({
        id: membership.wedding.id,
        name: membership.wedding.name,
        role: membership.role,
      })),
    };
  }

  // --- 3.2 Update profile ---------------------------------------------------

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.repository.updateProfile(userId, dto);
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      profileImageUrl: user.profileImageUrl,
    };
  }
}
