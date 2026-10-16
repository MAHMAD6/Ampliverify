import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Default model; override with OPENAI_MODEL (choose a model the OpenAI project supports). */
export const OPENAI_DEFAULT_MODEL = 'gpt-5';

export type Effort = 'low' | 'medium' | 'high';

/** `providerUsageIds` collects the rows written, so a caller can link them to the usage event created when its credit reservation settles. */
export type UsageContext = { usageEventId?: string | null; operation: string; providerUsageIds?: string[] };

type ResponseBody = {
  id?: string;
  model?: string;
  status?: 'completed' | 'incomplete' | 'failed' | 'in_progress' | 'cancelled' | 'queued';
  incomplete_details?: { reason?: string } | null;
  error?: { code?: string; message?: string } | null;
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?<!\w)(?:\+?\d[\d ().-]{8,}\d)(?!\w)/g;

/** PII minimization: email addresses and phone numbers never reach the model. */
export function redactPii(text: string) {
  return text.replace(EMAIL, '[email]').replace(PHONE, '[phone]');
}

/**
 * OpenAI Responses API for AmpliVerify's AI features (V1 manual §4.2): editor
 * suggestions, content ideas and briefs, and GEO recommendations. Prompts are
 * bounded and redacted; output always uses Structured Outputs (strict JSON
 * schema) and is validated again by the caller. Token usage is recorded in
 * `provider_usage`, latency and status in `provider_events`.
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get configured() {
    return !!this.config.get<string>('OPENAI_API_KEY');
  }

  get model() {
    return this.config.get<string>('OPENAI_MODEL') || OPENAI_DEFAULT_MODEL;
  }

  /** Structured JSON generation; the API enforces `schema` (strict mode). */
  async generateJson<T>(input: { system: string; prompt: string; schema: Record<string, unknown>; name?: string; effort?: Effort; maxTokens?: number }, usage: UsageContext): Promise<T> {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'AI features are not available yet.' });
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${(this.config.get<string>('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          model: this.model,
          instructions: input.system,
          input: redactPii(input.prompt).slice(0, 120_000),
          max_output_tokens: input.maxTokens ?? 8000,
          reasoning: { effort: input.effort ?? 'medium' },
          store: false,
          text: { format: { type: 'json_schema', name: input.name ?? usage.operation.replace(/[^a-zA-Z0-9_-]/g, '_'), schema: input.schema, strict: true } },
        }),
      });
    } catch (err) {
      await this.event(usage, 'network_error', Date.now() - started);
      this.logger.error(`OpenAI ${usage.operation} failed (network): ${err instanceof Error ? err.message : err}`);
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE', message: 'The AI service is unavailable. Please try again.' });
    }
    const body = (await res.json().catch(() => ({}))) as ResponseBody;
    const latency = Date.now() - started;
    if (!res.ok) {
      const status = res.status === 429 ? 'rate_limited' : res.status === 401 ? 'auth_error' : res.status === 400 ? 'bad_request' : `api_error_${res.status}`;
      await this.event(usage, status, latency);
      this.logger.error(`OpenAI ${usage.operation} failed (${status}): ${body.error?.message ?? 'unknown'}`);
      if (res.status === 429) throw new ServiceUnavailableException({ code: 'AI_BUSY', message: 'The AI service is busy. Please try again shortly.' });
      throw new HttpException({ code: 'AI_PROVIDER_FAILED', message: 'The AI service could not complete the request.' }, HttpStatus.BAD_GATEWAY);
    }
    await this.record(usage, body, latency);
    if (body.status === 'incomplete') {
      throw new HttpException({ code: 'AI_OUTPUT_TRUNCATED', message: 'The AI response was too long. Try a shorter input.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const content = (body.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
    if (content.some((c) => c.type === 'refusal')) {
      throw new HttpException({ code: 'AI_REFUSED', message: 'The AI could not help with this request.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const text = content.find((c) => c.type === 'output_text')?.text ?? '';
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new HttpException({ code: 'AI_INVALID_OUTPUT', message: 'The AI returned an invalid response. Please try again.' }, HttpStatus.BAD_GATEWAY);
    }
  }

  private async record(usage: UsageContext, body: ResponseBody, latencyMs: number) {
    try {
      const [row] = await this.prisma.$transaction([
        this.prisma.providerUsage.create({ data: { usageEventId: usage.usageEventId ?? null, provider: 'openai', operation: usage.operation, inputUnits: body.usage?.input_tokens ?? 0, outputUnits: body.usage?.output_tokens ?? 0 } }),
        this.prisma.providerEvent.create({ data: { provider: 'openai', operation: usage.operation, status: 'ok', requestId: body.id ?? null, latencyMs } }),
      ]);
      usage.providerUsageIds?.push(row.id);
    } catch (err) {
      this.logger.warn(`Could not record provider usage: ${err}`);
    }
  }

  private event(usage: UsageContext, status: string, latencyMs: number) {
    return this.prisma.providerEvent.create({ data: { provider: 'openai', operation: usage.operation, status, latencyMs } }).catch(() => undefined);
  }
}
