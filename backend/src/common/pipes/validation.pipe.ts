import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constant';

function flattenErrors(
  errors: ValidationError[],
  parentPath = '',
): Array<{ field: string; message: string }> {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map(
      (message) => ({
        field,
        message,
      }),
    );
    const childMessages = error.children?.length
      ? flattenErrors(error.children, field)
      : [];
    return [...ownMessages, ...childMessages];
  });
}

/**
 * Global request-body validation pipe (Section 12 / Implementation Guide, rule 7):
 * strips unknown fields, rejects unexpected fields, and formats failures into
 * the standard VALIDATION_ERROR shape used by HttpExceptionFilter.
 */
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed.',
          details: flattenErrors(errors),
        }),
    });
  }
}
