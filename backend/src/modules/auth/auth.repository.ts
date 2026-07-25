import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthProvider, User } from '@prisma/client';

export interface CreateUserData {
  email: string;
  fullName: string;
  phone?: string;
  passwordHash?: string;
  googleId?: string;
  authProvider: AuthProvider;
  isEmailVerified: boolean;
  profileImageUrl?: string;
}

export interface CreateRefreshTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  deviceInfo?: string;
  expiresAt: Date;
}

export interface CreatePasswordResetData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * All Prisma queries for Module 02 live here — services never call
 * `this.prisma` directly, per the documented controller/service/
 * repository/dto split (Section 4).
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Users ---------------------------------------------------------------

  findUserByEmail(email: string): Promise<User | null> {
    // Soft-deleted accounts intentionally included: register (2.1) must
    // treat them as "existing", and login (2.5 edge case) must reject them.
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findUserByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  linkGoogleAccount(userId: string, googleId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { googleId, isEmailVerified: true },
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  // --- Refresh tokens --------------------------------------------------------

  createRefreshToken(data: CreateRefreshTokenData) {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshTokenById(id: string) {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  revokeRefreshToken(id: string) {
    return this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeRefreshTokenForUser(id: string, userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllRefreshTokensForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  findActiveSessionsForUser(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Password resets ---------------------------------------------------

  invalidateUnusedPasswordResets(userId: string) {
    return this.prisma.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  createPasswordReset(data: CreatePasswordResetData) {
    return this.prisma.passwordReset.create({ data });
  }

  findRecentPasswordResetsByUserId(userId: string) {
    return this.prisma.passwordReset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  markPasswordResetUsed(id: string) {
    return this.prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
