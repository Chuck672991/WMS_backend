import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import ms from 'ms';
import { randomUUID } from 'crypto';
import { AuthProvider, User } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { compareHash, hash } from '../../utils/hash.util';
import { generatePlainToken } from '../../utils/token.util';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function parseDurationMs(value: string): number {
  return ms(value as ms.StringValue);
}

function toPublicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
  };
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  // --- 2.1 Register --------------------------------------------------------

  async register(dto: RegisterDto, deviceInfo?: string) {
    const existing = await this.repository.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'Email is already registered.',
      });
    }

    const passwordHash = await hash(dto.password);
    const user = await this.repository.createUser({
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone,
      passwordHash,
      authProvider: AuthProvider.EMAIL,
      isEmailVerified: false,
    });

    const tokens = await this.generateTokenPair(user, deviceInfo);
    return { user: toPublicUser(user), ...tokens };
  }

  // --- 2.2 Login -------------------------------------------------------------

  async login(dto: LoginDto, deviceInfo?: string) {
    const user = await this.repository.findUserByEmail(dto.email);

    if (!user || user.deletedAt || !user.passwordHash) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'This account has been deactivated.',
      });
    }

    const passwordMatches = await compareHash(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid email or password.',
      });
    }

    const tokens = await this.generateTokenPair(user, deviceInfo);
    return { user: toPublicUser(user), ...tokens };
  }

  // --- 2.3 Google login --------------------------------------------------

  async googleLogin(dto: GoogleLoginDto, deviceInfo?: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      payload = undefined;
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid or expired Google token.',
      });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const fullName = payload.name ?? email;
    const profileImageUrl = payload.picture;

    let user = await this.repository.findUserByGoogleId(googleId);

    if (!user) {
      const existingByEmail = await this.repository.findUserByEmail(email);
      if (existingByEmail) {
        user = await this.repository.linkGoogleAccount(
          existingByEmail.id,
          googleId,
        );
      } else {
        user = await this.repository.createUser({
          email,
          fullName,
          googleId,
          profileImageUrl,
          authProvider: AuthProvider.GOOGLE,
          isEmailVerified: true,
        });
      }
    }

    if (user.deletedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid or expired Google token.',
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'This account has been deactivated.',
      });
    }

    const tokens = await this.generateTokenPair(user, deviceInfo);
    return { user: toPublicUser(user), ...tokens };
  }

  // --- 2.4 Forgot password -------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const message = 'If this email exists, a reset link has been sent.';
    const user = await this.repository.findUserByEmail(dto.email);

    if (user && !user.deletedAt && user.isActive) {
      // Only the newest token should ever be valid.
      await this.repository.invalidateUnusedPasswordResets(user.id);

      const plainToken = generatePlainToken();
      const tokenHash = await hash(plainToken);
      await this.repository.createPasswordReset({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
      });

      // TODO (Module 09/11): dispatch via email once the notifications/
      // background-jobs modules exist. Logged here as a scaffold placeholder
      // — never log the token in a real deployment.
      const resetLink = `https://app.smartwedding.app/reset-password?token=${plainToken}&email=${encodeURIComponent(dto.email)}`;
      console.log(
        `[AuthService] Password reset link for ${dto.email}: ${resetLink}`,
      );
    }

    return { message };
  }

  // --- 2.5 Reset password --------------------------------------------------

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.repository.findUserByEmail(dto.email);
    const invalidTokenError = new BadRequestException({
      code: ErrorCode.TOKEN_INVALID,
      message: 'Token is invalid or does not match.',
    });

    if (!user) {
      throw invalidTokenError;
    }

    const candidates = await this.repository.findRecentPasswordResetsByUserId(
      user.id,
    );
    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await compareHash(dto.token, candidate.tokenHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw invalidTokenError;
    }
    if (matched.usedAt) {
      throw invalidTokenError;
    }
    if (matched.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Token has expired.',
      });
    }

    const passwordHash = await hash(dto.newPassword);
    await this.repository.updatePassword(user.id, passwordHash);
    await this.repository.markPasswordResetUsed(matched.id);
    // Security best practice: force re-login everywhere after a password change.
    await this.repository.revokeAllRefreshTokensForUser(user.id);

    return { message: 'Password reset successfully.' };
  }

  // --- 2.6 Refresh token ---------------------------------------------------

  async refreshTokens(
    userId: string,
    tokenId: string,
    rawRefreshToken: string,
    deviceInfo?: string,
  ): Promise<TokenPair> {
    const record = await this.repository.findRefreshTokenById(tokenId);

    if (!record || record.revokedAt) {
      // Reuse of an already-rotated (or otherwise revoked) token — theft signal.
      await this.repository.revokeAllRefreshTokensForUser(userId);
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message:
          'Refresh token has already been used. All sessions have been revoked.',
      });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Refresh token has expired.',
      });
    }

    const matches = await compareHash(rawRefreshToken, record.tokenHash);
    if (!matches) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token is invalid.',
      });
    }

    await this.repository.revokeRefreshToken(record.id);

    const user = await this.repository.findUserById(record.userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token is invalid.',
      });
    }

    return this.generateTokenPair(
      user,
      deviceInfo ?? record.deviceInfo ?? undefined,
    );
  }

  // --- 2.7 Logout ------------------------------------------------------------

  async logout(
    userId: string,
    refreshToken: string,
  ): Promise<{ message: string }> {
    const decoded = this.jwtService.decode<{ tokenId?: string }>(refreshToken);
    if (decoded?.tokenId) {
      // Scoped to the current user so a guessed/foreign tokenId can't be used
      // to revoke someone else's session.
      await this.repository.revokeRefreshTokenForUser(decoded.tokenId, userId);
    }
    return { message: 'Logged out successfully.' };
  }

  // --- 2.8 Logout all devices -----------------------------------------------

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.repository.revokeAllRefreshTokensForUser(userId);
    return { message: 'Logged out of all devices successfully.' };
  }

  // --- 2.9 Active sessions ----------------------------------------------

  async getSessions(userId: string) {
    const sessions = await this.repository.findActiveSessionsForUser(userId);
    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  // --- Shared helpers ------------------------------------------------------

  private async generateTokenPair(
    user: User,
    deviceInfo?: string,
  ): Promise<TokenPair> {
    const accessSecret = this.configService.get<string>(
      'jwt.accessSecret',
    ) as string;
    const accessExpiry = this.configService.get<string>(
      'jwt.accessExpiry',
    ) as string;
    const refreshSecret = this.configService.get<string>(
      'jwt.refreshSecret',
    ) as string;
    const refreshExpiry = this.configService.get<string>(
      'jwt.refreshExpiry',
    ) as string;

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: accessSecret,
        expiresIn: accessExpiry as JwtSignOptions['expiresIn'],
      },
    );

    const tokenId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tokenId },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiry as JwtSignOptions['expiresIn'],
      },
    );
    const tokenHash = await hash(refreshToken);

    await this.repository.createRefreshToken({
      id: tokenId,
      userId: user.id,
      tokenHash,
      deviceInfo,
      expiresAt: new Date(Date.now() + parseDurationMs(refreshExpiry)),
    });

    return { accessToken, refreshToken };
  }
}
