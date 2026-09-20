import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

// Every error leaves the API in the same shape: { code, message, fields }.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      } satisfies ApiError);
      return;
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    const payload =
      typeof body === 'string'
        ? { message: body }
        : (body as Record<string, any>);

    res.status(status).json({
      code: payload.code ?? HttpStatus[status] ?? 'ERROR',
      message: payload.message ?? exception.message,
      ...(payload.fields ? { fields: payload.fields } : {}),
    } satisfies ApiError);
  }
}
