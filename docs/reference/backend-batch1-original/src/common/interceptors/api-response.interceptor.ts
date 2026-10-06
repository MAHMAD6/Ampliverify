import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export type ApiEnvelope<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: null;
};

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({ data, meta: {}, error: null })),
    );
  }
}
