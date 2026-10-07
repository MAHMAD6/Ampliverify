import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EmailMessage = { to: string; subject: string; text: string; html?: string; replyTo?: string };

/**
 * Transactional email through Resend's HTTP API (RESEND_API_KEY, EMAIL_FROM).
 * Without a key, `configured` is false: callers record the delivery as
 * FAILED instead of pretending it was sent. EMAIL_LOG_ONLY=true prints
 * messages to the log for local development.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  get configured() {
    return !!this.config.get<string>('RESEND_API_KEY') || this.logOnly;
  }

  private get logOnly() {
    return this.config.get<string>('EMAIL_LOG_ONLY') === 'true';
  }

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    if (this.logOnly) {
      this.logger.log(`[email] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`);
      return { id: null };
    }
    const key = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM') ?? 'AmpliVerify <no-reply@ampliverify.com>';
    if (!key) throw new Error('Email is not configured (RESEND_API_KEY).');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: message.replyTo,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(`Email provider error ${res.status}: ${body.message ?? 'unknown'}`);
    return { id: body.id ?? null };
  }
}
