import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constant';

/**
 * Skeleton only — implemented fully in Module 03 (Users & Wedding Workspace).
 *
 * Responsibility (per Section 5.7 of the backend documentation): verify the
 * authenticated user (`request.user`, set by JwtAuthGuard) is a member of the
 * `:weddingId` route param, then attach the user's role for that wedding to
 * `request.weddingRole` so RolesGuard can authorize further down the chain.
 *
 * Must return 404 NOT_FOUND (never 403) when the wedding doesn't exist or the
 * user isn't a member, to avoid leaking wedding existence to non-members.
 */
@Injectable()
export class WeddingAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ params: Record<string, string> }>();
    const weddingId = request.params?.weddingId;

    if (!weddingId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Wedding not found.',
      });
    }

    // TODO (Module 03): query WeddingMember by (weddingId, request.user.id),
    // throw 404 NOT_FOUND if no membership row exists, else set
    // request.weddingRole = membership.role and return true.
    return true;
  }
}
