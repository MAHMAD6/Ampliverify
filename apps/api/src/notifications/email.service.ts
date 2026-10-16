import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export type EmailMessage = { to: string; subject: string; text: string; html?: string; replyTo?: string };

/**
 * Transactional and scheduled email through Amazon SES v2 SendEmail
 * (V1 manual §1): SES_REGION plus a verified sending identity in EMAIL_FROM.
 * Credentials come from SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY or the
 * default AWS credential chain (instance role, AWS_* variables). An optional
 * SES_CONFIGURATION_SET records delivery events. Without a region `configured`
 * is false and callers record the delivery as FAILED instead of pretending it
 * was sent. EMAIL_LOG_ONLY=true prints messages to the log for local development.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: SESv2Client | null = null;

  constructor(private readonly config: ConfigService) {}

  get configured() {
    return !!this.config.get<string>('SES_REGION') || this.logOnly;
  }

  private get logOnly() {
    return this.config.get<string>('EMAIL_LOG_ONLY') === 'true';
  }

  private ses() {
    const region = this.config.get<string>('SES_REGION');
    if (!region) throw new Error('Email is not configured (SES_REGION).');
    const accessKeyId = this.config.get<string>('SES_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('SES_SECRET_ACCESS_KEY');
    this.client ??= new SESv2Client({ region, ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) });
    return this.client;
  }

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    if (this.logOnly) {
      this.logger.log(`[email] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`);
      return { id: null };
    }
    const from = this.config.get<string>('EMAIL_FROM') ?? 'AmpliVerify <no-reply@ampliverify.com>';
    const configurationSet = this.config.get<string>('SES_CONFIGURATION_SET');
    try {
      const out = await this.ses().send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [message.to] },
          ...(message.replyTo ? { ReplyToAddresses: [message.replyTo] } : {}),
          ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: 'UTF-8' },
              Body: { Text: { Data: message.text, Charset: 'UTF-8' }, ...(message.html ? { Html: { Data: message.html, Charset: 'UTF-8' } } : {}) },
            },
          },
        }),
      );
      return { id: out.MessageId ?? null };
    } catch (err) {
      const name = (err as { name?: string }).name ?? 'Error';
      throw new Error(`Email provider error (${name}): ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}
