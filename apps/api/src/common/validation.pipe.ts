import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

function collectFields(
  errors: ValidationError[],
  prefix = '',
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) fields[path] = Object.values(error.constraints);
    if (error.children?.length)
      Object.assign(fields, collectFields(error.children, path));
  }
  return fields;
}

export const apiValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      fields: collectFields(errors),
    }),
});
