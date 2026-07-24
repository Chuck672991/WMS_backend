import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Populated by JwtAuthGuard (Module 02) once the auth strategy is implemented.
 */
export interface CurrentUserPayload {
  id: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: CurrentUserPayload }>();
    return request.user;
  },
);
