import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../constants/error-codes.constant';
import { WeddingRole } from '../constants/roles.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Compares @Roles(...) metadata against the wedding-scoped role that
 * WeddingAccessGuard attaches to the request (request.weddingRole).
 * Must run after WeddingAccessGuard in the guard chain.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WeddingRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ weddingRole?: WeddingRole }>();
    const role = request.weddingRole;

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException({
        code: ErrorCode.WEDDING_ACCESS_DENIED,
        message: 'You do not have permission to perform this action.',
      });
    }

    return true;
  }
}
