import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthStaff } from './staff.js';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthStaff =>
    context.switchToHttp().getRequest().staff,
);
