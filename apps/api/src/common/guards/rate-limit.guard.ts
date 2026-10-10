import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Request rate limiting. The web app calls the API server-side, so the
 * client IP is the web server's for most traffic: authenticated requests are
 * therefore counted per user (token subject), anonymous ones per client IP
 * (forwarded by the web app, see TRUST_PROXY). Anonymous reads of public
 * content are cached by the web app and not limited here; server-to-server
 * provisioning and the signed Stripe webhook are exempt.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as unknown as Request;
    const auth = r.headers?.authorization;
    if (auth?.startsWith('Bearer ')) {
      const sub = subjectOf(auth.slice(7).trim());
      if (sub) return `user:${sub}`;
    }
    return `ip:${r.ip ?? 'unknown'}`;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const r = context.switchToHttp().getRequest<Request>();
    const path = (r.originalUrl ?? r.url ?? '').split('?')[0];
    if (path.includes('/api/v1/internal/') || path.endsWith('/api/v1/webhooks/stripe') || path.endsWith('/api/v1/health')) return true;
    if (r.method === 'GET' && !r.headers.authorization) return true;
    return super.shouldSkip(context);
  }
}

/** Unverified JWT subject, used only as a rate-limit key (authentication happens later). */
function subjectOf(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { sub?: unknown };
    return typeof payload.sub === 'string' && payload.sub.length <= 200 ? payload.sub : null;
  } catch {
    return null;
  }
}
