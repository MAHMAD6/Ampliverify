import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        if (typeof record.code === 'string') code = record.code;
        else if (status === HttpStatus.BAD_REQUEST) code = 'VALIDATION_FAILED';
        else if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
        if (typeof record.message === 'string') message = record.message;
        if (Array.isArray(record.message)) message = record.message.join('; ');
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      // A concurrent request won a unique-constraint race the service pre-checked.
      status = HttpStatus.CONFLICT;
      code = 'UNIQUE_CONSTRAINT_VIOLATION';
      message = 'A record with these values already exists.';
    } else {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : exception);
    }

    response.status(status).json({
      data: null,
      meta: {},
      error: { code, message },
    });
  }
}
