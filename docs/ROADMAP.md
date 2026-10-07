# Build roadmap

Plan for taking AmpliVerify from today's state (every screen routed, schema complete,
foundation APIs live) to a working product. Status per screen is in
[SCREENS.md](./SCREENS.md); inputs in [INPUTS.md](./INPUTS.md).

## Where things stand

| Layer | Done | Missing |
|---|---|---|
| Schema (`apps/api/prisma`) | 110 models from the database guide, migrations, integrity constraints | Gaps listed in INPUTS.md (workspace timezone/language, featured plan flag, contact/support tickets, videos/events/case studies, credit packs, privacy preferences) |
| API (`apps/api/src`) | Auth sync + JWKS, users, orgs/workspaces, projects, RBAC, audit log, public content, admin read endpoints | Every write path below, plus jobs, billing and external providers |
| Web (`apps/web`) | All public, user-app and admin routes from the designs; sign-in via Better Auth | Screens marked "Empty states" / "disabled" in SCREENS.md wait on the APIs below |
| Infra | Postgres via docker-compose | Redis + BullMQ workers, object storage, email provider, payment provider, CI, deployment |

## Principles

- One batch = schema check → API module + tests → wire the existing screen → update SCREENS.md.
- No simulated data. A screen goes "Live" only when its API exists.
- Every write is permission-checked server-side and writes an audit event.
- Credit-consuming actions go through the credit ledger before calling any paid provider.

## Batches

### Batch A — Platform infrastructure (prerequisite for everything)

- Redis + BullMQ worker app (`apps/worker`) sharing the Prisma client.
- S3-compatible storage service (extend `storage/`) with private buckets and signed URLs.
- Email provider (Amazon SES or Resend) in `apps/web/src/lib/auth-email.ts` and an API notifications sender.
- CI: lint, typecheck, unit + DB tests for `apps/api` and `apps/web` build.
- Done when: verification/reset emails send; a test job runs on the worker; files upload and download through signed URLs.

### Batch B — Credits, entitlements, billing

- Credit wallet + append-only ledger service; usage events; reservations and reversals.
- Entitlement resolver (plan entitlements + workspace overrides) used as a guard by every module.
- Payment provider (Stripe recommended): checkout, customer portal, webhooks → subscriptions, invoices, credit purchases.
- Screens: `/app/usage`, `/app/usage/history`, `/app/billing*`, `/app/settings/billing`, Add Credits dialog; admin subscriptions, billing/invoices, credits & adjustments, plan editor save.
- Unlocks the Plan Restricted / Low Credits page states.

### Batch C — Workspace, account, settings writes

- Members and invitations, role changes, workspace settings (add timezone/language columns).
- Account security (password change, sessions/devices, MFA via Better Auth plugins).
- Notification preferences + in-app notifications feed.
- Project defaults, Data & Privacy (export requests, retention; new tables per INPUTS gaps), AI & GEO preferences API.
- Screens: all `/app/settings/*`, `/app/notifications`.

### Batch D — SEO audit engine (core product)

- Crawler worker (fetch, robots.txt, sitemap, rate limits, page snapshots).
- Issue catalogue from `AmpliVerify_SEO_Audit_Guide.pdf` → `seo_issues` seed; check implementations → issue instances.
- Audit runs (QUEUED → RUNNING → COMPLETED/FAILED/CANCELED), scores, per-page results.
- Screens: `/app/audit`, project overview module data, dashboard metrics.

### Batch E — Optimization Center and verification loop

- Recommendations generated from audit findings; task states; actions history (before/after).
- Re-audit + verification runs comparing previous condition.
- Screens: `/app/optimize`, audit/optimize `[id]` detail pages.

### Batch F — On-Page SEO Editor and CMS publishing

- Pages API, editor documents and versions, AI suggestions (Claude API) metered through credits.
- WordPress connector (application passwords / OAuth), encrypted credentials, publish + sync.
- Screens: `/app/editor`, `/app/editor/[id]`, `/app/integrations/cms`, Publish Connector.

### Batch G — Keyword research

- Provider abstraction (e.g. DataForSEO) with normalized snapshots and caching.
- Explorer, related, questions, competitor keywords, SERP analysis; lists, saved keywords, clusters.
- Screens: all `/app/keywords/*`.

### Batch H — Content strategy

- Topic ideas, clusters, content plan, briefs, optimized content, linked to keywords and editor.
- Screens: `/app/content/*`.

### Batch I — AI Search (GEO)

- Prompts, schedules, runs per platform (OpenAI, Gemini, Perplexity, Claude…), mentions, citations, sources, competitors, visibility snapshots, opportunities.
- Rules adopted from planning: "last checked" separate from reporting range; no trends before two checks; opportunities must be actionable.
- Screens: `/app/geo/*`, prompt detail.

### Batch J — Reports

- Report generation worker (PDF/HTML), versions, schedules, share tokens.
- Screens: `/app/reports*`, `/app/projects/[id]/reports`.

### Batch K — Admin CMS and careers

- Admin CRUD for blog/guides/help/resources, categories, authors, media library (uses storage), videos/events/case studies (new tables).
- Job openings editor save/publish; public job applications with résumé upload, validation and malware scanning.
- Contact form and support tickets (new tables).
- Screens: `/admin/{content,blog,resources,careers,media,categories,authors,videos,events,case-studies}`, `/careers/[slug]`, `/contact`, `/app/help`.

### Batch L — Admin operations

- Feature flag and module control writes, platform settings, security settings, appearance.
- Usage & costs (provider cost records), system health (job/queue/provider checks), admin search.
- Screens: remaining admin read-only/empty screens.

### Batch M — Launch hardening

- Rate limiting, CSP, CSRF review, secrets management, backups, monitoring/alerting.
- Load test the crawler and GEO workers; security review; legal text approval.
- Production deployment (web, API, worker, Postgres, Redis, storage).

## Suggested order

A → B → C → D → E → G → I → F → H → J → K → L → M

D, E, G and I are the product; B must precede them because they consume credits.
K can run in parallel with D–J if a second developer is available.

## Decisions needed before starting

1. Payment provider (Stripe assumed).
2. Email provider (SES or Resend).
3. Keyword/SERP data provider and budget.
4. AI platforms to monitor for GEO, and which model powers editor suggestions.
5. Hosting target (e.g. Vercel + Fly/Render, or AWS).
6. Credit cost per action (planning mentions a "1000 credits" definition).
