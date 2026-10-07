import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ClaudeService } from '../ai/claude.service';

export type PlatformAnswer = {
  text: string;
  /** Sources the answer cited, in citation order. */
  citations: { url: string; title: string | null }[];
  model: string;
  raw: unknown;
};

export class ProviderNotConfiguredError extends Error {}

/**
 * Asks each AI search platform the tracked prompt the way an end user would
 * (web search on) and normalizes the answer + cited sources. Claude goes
 * through the Anthropic SDK; the other platforms through their public APIs.
 */
@Injectable()
export class GeoProviders {
  constructor(
    private readonly config: ConfigService,
    private readonly claude: ClaudeService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(provider: string) {
    switch (provider) {
      case 'anthropic':
        return this.claude.configured;
      case 'openai':
        return !!this.config.get('OPENAI_API_KEY');
      case 'gemini':
        return !!this.config.get('GEMINI_API_KEY');
      case 'perplexity':
        return !!this.config.get('PERPLEXITY_API_KEY');
      default:
        return false;
    }
  }

  async ask(provider: string, prompt: string, opts: { country?: string | null; usageEventId?: string | null }): Promise<PlatformAnswer> {
    if (!this.isConfigured(provider)) throw new ProviderNotConfiguredError(`${provider} is not configured`);
    switch (provider) {
      case 'anthropic': {
        const r = await this.claude.answerWithSearch(prompt, { country: opts.country ?? undefined }, { operation: 'geo.check', usageEventId: opts.usageEventId });
        const seen = new Set<string>();
        const citations = [...r.citations, ...r.sources]
          .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
          .map((c) => ({ url: c.url, title: c.title }));
        return { text: r.text, citations, model: r.model, raw: { text: r.text, citations: r.citations, sources: r.sources } };
      }
      case 'openai':
        return this.timed('openai', opts.usageEventId, () => this.openai(prompt, opts.country));
      case 'gemini':
        return this.timed('gemini', opts.usageEventId, () => this.gemini(prompt));
      case 'perplexity':
        return this.timed('perplexity', opts.usageEventId, () => this.perplexity(prompt));
      default:
        throw new ProviderNotConfiguredError(`Unknown provider ${provider}`);
    }
  }

  private async timed(provider: string, usageEventId: string | null | undefined, fn: () => Promise<PlatformAnswer & { usage?: { input?: number; output?: number } }>) {
    const started = Date.now();
    try {
      const answer = await fn();
      await this.prisma.$transaction([
        this.prisma.providerEvent.create({ data: { provider, operation: 'geo.check', status: 'ok', latencyMs: Date.now() - started } }),
        this.prisma.providerUsage.create({ data: { usageEventId: usageEventId ?? null, provider, operation: 'geo.check', inputUnits: answer.usage?.input ?? null, outputUnits: answer.usage?.output ?? null } }),
      ]);
      return answer;
    } catch (err) {
      await this.prisma.providerEvent.create({ data: { provider, operation: 'geo.check', status: 'error', latencyMs: Date.now() - started } }).catch(() => undefined);
      throw err;
    }
  }

  private async postJson(url: string, headers: Record<string, string>, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message = (json.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
      throw new Error(`Provider error: ${message}`);
    }
    return json;
  }

  /** OpenAI Responses API with the web search tool; citations from `url_citation` annotations. */
  private async openai(prompt: string, country?: string | null) {
    const model = this.config.get<string>('OPENAI_GEO_MODEL') ?? 'gpt-5';
    const json = await this.postJson(
      'https://api.openai.com/v1/responses',
      { authorization: `Bearer ${this.config.get('OPENAI_API_KEY')}` },
      { model, input: prompt, tools: [{ type: 'web_search', ...(country ? { user_location: { type: 'approximate', country } } : {}) }] },
    );
    const texts: string[] = [];
    const citations: { url: string; title: string | null }[] = [];
    for (const item of (json.output as { type: string; content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[] }[]) ?? []) {
      if (item.type !== 'message') continue;
      for (const c of item.content ?? []) {
        if (c.type !== 'output_text') continue;
        texts.push(c.text ?? '');
        for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url) citations.push({ url: a.url, title: a.title ?? null });
      }
    }
    const usage = json.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { text: texts.join('\n').trim(), citations: dedupe(citations), model: String(json.model ?? model), raw: json, usage: { input: usage?.input_tokens, output: usage?.output_tokens } };
  }

  /** Gemini generateContent with Google Search grounding; citations from grounding chunks. */
  private async gemini(prompt: string) {
    const model = this.config.get<string>('GEMINI_GEO_MODEL') ?? 'gemini-2.5-flash';
    const json = await this.postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': String(this.config.get('GEMINI_API_KEY')) },
      { contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }] },
    );
    const candidate = ((json.candidates as unknown[]) ?? [])[0] as
      | { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }
      | undefined;
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
    const citations = (candidate?.groundingMetadata?.groundingChunks ?? []).filter((c) => c.web?.uri).map((c) => ({ url: c.web!.uri!, title: c.web!.title ?? null }));
    const usage = json.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
    return { text, citations: dedupe(citations), model, raw: json, usage: { input: usage?.promptTokenCount, output: usage?.candidatesTokenCount } };
  }

  /** Perplexity Sonar (search built in); citations from `search_results` / `citations`. */
  private async perplexity(prompt: string) {
    const model = this.config.get<string>('PERPLEXITY_GEO_MODEL') ?? 'sonar';
    const json = await this.postJson(
      'https://api.perplexity.ai/chat/completions',
      { authorization: `Bearer ${this.config.get('PERPLEXITY_API_KEY')}` },
      { model, messages: [{ role: 'user', content: prompt }] },
    );
    const text = String(((json.choices as { message?: { content?: string } }[]) ?? [])[0]?.message?.content ?? '').trim();
    const results = (json.search_results as { url: string; title?: string }[] | undefined) ?? ((json.citations as string[] | undefined) ?? []).map((url) => ({ url, title: undefined }));
    const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    return { text, citations: dedupe(results.map((r) => ({ url: r.url, title: r.title ?? null }))), model: String(json.model ?? model), raw: json, usage: { input: usage?.prompt_tokens, output: usage?.completion_tokens } };
  }
}

function dedupe(list: { url: string; title: string | null }[]) {
  const seen = new Set<string>();
  return list.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}

/** Pure analysis of one answer: brand/competitor mentions, ranking, citation of the brand's domain. */
export function analyzeAnswer(
  answer: { text: string; citations: { url: string }[] },
  brand: { names: string[]; domains: string[] },
  competitors: { id: string; name: string; domain: string | null }[],
) {
  const text = answer.text;
  const lower = text.toLowerCase();
  const firstIndex = (terms: string[]) => {
    let best = -1;
    for (const term of terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2)) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'iu');
      const m = re.exec(lower);
      if (m) {
        const idx = m.index + m[1].length;
        if (best < 0 || idx < best) best = idx;
      }
    }
    return best;
  };
  const hostOf = (url: string) => {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const brandDomains = brand.domains.map((d) => d.toLowerCase().replace(/^www\./, ''));
  const brandIdx = firstIndex([...brand.names, ...brandDomains]);
  const competitorHits = competitors
    .map((c) => ({ ...c, idx: firstIndex([c.name, ...(c.domain ? [c.domain] : [])]) }))
    .filter((c) => c.idx >= 0);

  // Rank = order of first appearance among brand + competitors (1 = first).
  const ordered = [...(brandIdx >= 0 ? [{ key: 'brand', idx: brandIdx }] : []), ...competitorHits.map((c) => ({ key: c.id, idx: c.idx }))].sort((a, b) => a.idx - b.idx);
  const rankOf = (key: string) => {
    const i = ordered.findIndex((o) => o.key === key);
    return i < 0 ? null : i + 1;
  };

  const citationHosts = answer.citations.map((c) => hostOf(c.url));
  const brandCitationRank = citationHosts.findIndex((h) => brandDomains.some((d) => h === d || h.endsWith(`.${d}`)));
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => brand.names.some((n) => n && s.toLowerCase().includes(n.toLowerCase())));

  return {
    mentioned: brandIdx >= 0,
    position: rankOf('brand'),
    cited: brandCitationRank >= 0,
    citationRank: brandCitationRank >= 0 ? brandCitationRank + 1 : null,
    mentionCount: brand.names.reduce((n, name) => n + (name ? lower.split(name.toLowerCase()).length - 1 : 0), 0),
    excerpt: sentences[0]?.slice(0, 400) ?? null,
    competitors: competitorHits.map((c) => ({ id: c.id, name: c.name, position: rankOf(c.id) })),
    citationHosts,
  };
}
