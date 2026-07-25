import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WeddingRole } from '../constants/roles.constant';

/**
 * Populated by WeddingAccessGuard (common/guards/wedding-access.guard.ts) —
 * only usable on routes guarded by it (i.e. under /weddings/:weddingId/*).
 */
export const CurrentWeddingRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WeddingRole => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ weddingRole: WeddingRole }>();
    return request.weddingRole;
  },
);
