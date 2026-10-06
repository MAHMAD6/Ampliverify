import { Request } from 'express';

/** Client context copied onto audit records. */
export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

export function requestMeta(request: Request): RequestMeta {
  return {
    ipAddress: request.ip,
    userAgent: request.header('user-agent') ?? undefined,
  };
}
