import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

export const CLAUDE_MODEL = 'claude-opus-5-5';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type SearchCitation = { url: string; title: string | null; citedText: string };
export type SearchAnswer = { text: string; citations: SearchCitation[]; sources: { url: string; title: string | null }[]; model: string };

type UsageContext = { usageEventId?: string | null; operation: string };

/**
 * Claude (Anthropic Messages API) for AmpliVerify's AI features: editor
 * suggestions, content ideas and briefs (structured JSON outputs) and the
 * Claude platform in AI Search (GEO) checks (web search with citations).
 *
 * Every call uses adaptive thinking, the server-side refusal fallback, and
 * records token usage in `provider_usage` / latency in `provider_events`.
 */
@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get configured() {
    return !!this.config.get<string>('ANTHROPIC_API_KEY');
  }

  get model() {
    return this.config.get<string>('ANTHROPIC_MODEL') ?? CLAUDE_MODEL;
  }

  private sdk() {
    if (!this.configured) {
      throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'AI features are not available yet.' });
    }
    this.client ??= new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') });
    return this.client;
  }

  /** Structured JSON generation validated against `schema` by the API. */
  async generateJson<T>(input: { system: string; prompt: string; schema: Record<string, unknown>; effort?: Effort; maxTokens?: number }, usage: UsageContext): Promise<T> {
    const started = Date.now();
    try {
      const response = await this.sdk().beta.messages.create({
        model: this.model,
        max_tokens: input.maxTokens ?? 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: input.effort ?? 'medium', format: { type: 'json_schema', schema: input.schema } },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
      });
      await this.record(usage, response, Date.now() - started, 'ok');
      this.assertUsable(response);
      const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
      return JSON.parse(text) as T;
    } catch (err) {
      throw await this.mapError(err, usage, started);
    }
  }

  /**
   * Answers a question the way Claude would for an end user, using web search,
   * and returns the answer text plus the sources it cited. Used for GEO checks.
   */
  async answerWithSearch(prompt: string, opts: { country?: string } = {}, usage: UsageContext): Promise<SearchAnswer> {
    const started = Date.now();
    const tools: Anthropic.Beta.BetaToolUnion[] = [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: 5,
        ...(opts.country && /^[A-Z]{2}$/.test(opts.country) ? { user_location: { type: 'approximate' as const, country: opts.country } } : {}),
      },
    ];
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }];
    try {
      let response: Anthropic.Beta.BetaMessage | null = null;
      // Server tools may pause a long turn; continue it a few times.
      for (let i = 0; i < 3; i++) {
        response = await this.sdk().beta.messages.create({
          model: this.model,
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'low' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          tools,
          messages,
        });
        await this.record(usage, response, Date.now() - started, 'ok');
        if (response.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: response.content });
      }
      this.assertUsable(response!);

      const textParts: string[] = [];
      const citations: SearchCitation[] = [];
      const sources = new Map<string, string | null>();
      for (const block of response!.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
          for (const c of block.citations ?? []) {
            if (c.type === 'web_search_result_location') citations.push({ url: c.url, title: c.title, citedText: c.cited_text });
          }
        } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const r of block.content) if (r.type === 'web_search_result') sources.set(r.url, r.title);
        }
      }
      return {
        text: textParts.join('').trim(),
        citations,
        sources: [...sources.entries()].map(([url, title]) => ({ url, title })),
        model: response!.model,
      };
    } catch (err) {
      throw await this.mapError(err, usage, started);
    }
  }

  private assertUsable(response: Anthropic.Beta.BetaMessage) {
    if (response.stop_reason === 'refusal') {
      throw new HttpException({ code: 'AI_REFUSED', message: 'The AI could not help with this request.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new HttpException({ code: 'AI_OUTPUT_TRUNCATED', message: 'The AI response was too long. Try a shorter input.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  private async record(usage: UsageContext, response: Anthropic.Beta.BetaMessage, latencyMs: number, status: string) {
    try {
      await this.prisma.$transaction([
        this.prisma.providerUsage.create({
          data: {
            usageEventId: usage.usageEventId ?? null,
            provider: 'anthropic',
            operation: usage.operation,
            inputUnits: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0),
            outputUnits: response.usage.output_tokens,
          },
        }),
        this.prisma.providerEvent.create({ data: { provider: 'anthropic', operation: usage.operation, status, requestId: response.id, latencyMs } }),
      ]);
    } catch (err) {
      this.logger.warn(`Could not record provider usage: ${err}`);
    }
  }

  private async mapError(err: unknown, usage: UsageContext, started: number) {
    if (err instanceof HttpException) return err;
    const status =
      err instanceof Anthropic.RateLimitError ? 'rate_limited'
      : err instanceof Anthropic.AuthenticationError ? 'auth_error'
      : err instanceof Anthropic.BadRequestError ? 'bad_request'
      : err instanceof Anthropic.APIError ? `api_error_${err.status ?? 'unknown'}`
      : 'network_error';
    await this.prisma.providerEvent
      .create({ data: { provider: 'anthropic', operation: usage.operation, status, latencyMs: Date.now() - started } })
      .catch(() => undefined);
    this.logger.error(`Claude ${usage.operation} failed (${status}): ${err instanceof Error ? err.message : err}`);
    if (err instanceof Anthropic.RateLimitError) {
      return new ServiceUnavailableException({ code: 'AI_BUSY', message: 'The AI service is busy. Please try again shortly.' });
    }
    return new ServiceUnavailableException({ code: 'AI_UNAVAILABLE', message: 'The AI service is unavailable. Please try again.' });
  }
}
