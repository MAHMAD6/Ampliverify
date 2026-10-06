import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = exception instanceof HttpException ? exception.getResponse() : null;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (typeof body === 'string') {
      message = body;
    } else if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (typeof record.code === 'string') code = record.code;
      if (typeof record.message === 'string') message = record.message;
      if (Array.isArray(record.message)) message = record.message.join('; ');
    }

    response.status(status).json({
      data: null,
      meta: {},
      error: { code, message },
    });
  }
}
