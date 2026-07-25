import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse, PaginationMeta } from '../types/pagination.types';

interface RawHandlerResult {
  data?: unknown;
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

/**
 * Global interceptor — wraps every successful controller return value in the
 * standard success envelope documented in Section 5.2. Controllers should
 * return either a plain payload, or `{ data, pagination }` for list endpoints.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((result) => {
        const isEnvelopeShaped =
          result !== null &&
          typeof result === 'object' &&
          'data' in (result as RawHandlerResult);

        // Any key besides `data` on an envelope-shaped result (e.g.
        // `pagination`, or a one-off `warning` per Section 3.3's past-date
        // edge case) is passed through into `meta` as-is.
        const { data, ...extraMeta } = isEnvelopeShaped
          ? (result as RawHandlerResult)
          : { data: result };

        return {
          success: true,
          data: data as T,
          meta: {
            timestamp: new Date().toISOString(),
            requestId:
              (request as unknown as { requestId?: string }).requestId ?? '',
            ...extraMeta,
          },
        };
      }),
    );
  }
}
