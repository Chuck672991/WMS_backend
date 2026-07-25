import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ErrorCode } from '../../../common/constants/error-codes.constant';

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

export interface ValidatedRefreshToken extends RefreshTokenPayload {
  rawToken: string;
}

function extractRefreshTokenFromBody(req: Request): string | null {
  const body = req.body as { refreshToken?: unknown } | undefined;
  return typeof body?.refreshToken === 'string' ? body.refreshToken : null;
}

/**
 * Validates the refresh token's signature and expiry (submitted in the
 * request body, not the Authorization header) before AuthService performs
 * the DB-backed rotation / reuse-detection in Section 2.6's business logic.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshTokenFromBody]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') as string,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): ValidatedRefreshToken {
    // Guaranteed non-null here: passport-jwt already extracted a token via
    // this same extractor before invoking validate().
    const rawToken = extractRefreshTokenFromBody(req) as string;
    return { ...payload, rawToken };
  }
}

/**
 * Maps passport-jwt's generic failures to the documented error codes:
 * 401 TOKEN_EXPIRED vs 401 TOKEN_INVALID (Section 2.6 Error Responses).
 */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: { name?: string } | Error | undefined,
    _context: ExecutionContext,
  ): TUser {
    if (info?.name === 'TokenExpiredError') {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Refresh token has expired.',
      });
    }
    if (err || !user) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token is invalid.',
      });
    }
    return user;
  }
}
