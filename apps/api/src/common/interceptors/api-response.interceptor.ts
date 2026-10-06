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

/** BigInt is not JSON-serializable; money/size columns are emitted as strings. */
function toJsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<unknown>>
{
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<unknown>> {
    return next.handle().pipe(
      map((data) => ({ data: data === undefined ? null : toJsonSafe(data), meta: {}, error: null })),
    );
  }
}
