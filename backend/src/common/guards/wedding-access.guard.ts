import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constant';
import { WeddingRole } from '../constants/roles.constant';
import { PrismaService } from '../../database/prisma.service';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';

interface RequestWithWeddingContext {
  params: Record<string, string>;
  user: CurrentUserPayload;
  weddingRole?: WeddingRole;
}

/**
 * Verifies the authenticated user (`request.user`, set by JwtAuthGuard) is a
 * member of the `:weddingId` route param, then attaches the user's role for
 * that wedding to `request.weddingRole` so RolesGuard can authorize further
 * down the chain (Section 5.7 — the single most important guard in the system).
 *
 * Returns 404 NOT_FOUND (never 403) whether the wedding doesn't exist, is
 * soft-deleted, or the user simply isn't a member — never leaking which case
 * it is (Section 3.4).
 */
@Injectable()
export class WeddingAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithWeddingContext>();
    const weddingId = request.params?.weddingId;

    const notFound = new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'Wedding not found.',
    });

    if (!weddingId) {
      throw notFound;
    }

    const membership = await this.prisma.weddingMember.findFirst({
      where: {
        weddingId,
        userId: request.user.id,
        wedding: { deletedAt: null },
      },
    });

    if (!membership) {
      throw notFound;
    }

    request.weddingRole = membership.role;
    return true;
  }
}
