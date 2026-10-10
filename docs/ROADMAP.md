# Build roadmap

Status of the product build. Per-screen detail is in [SCREENS.md](./SCREENS.md),
routes in [API.md](./API.md), inputs and gaps in [INPUTS.md](./INPUTS.md).

## Where things stand

| Layer | Done | Remaining |
|---|---|---|
| Schema (`apps/api/prisma`) | Models from the database guide plus the INPUTS gaps (workspace timezone/language, featured plan, contact/support tickets, videos/events/case studies, credit packs, privacy), migrations, integrity constraints | — |
| API (`apps/api/src`) | All modules below, unit + DB integration tests | Load testing |
| Web (`apps/web`) | Every public, user-app and admin screen wired to the API | Visual QA against each design at all breakpoints |
| Infra | Postgres (docker), Postgres-backed job queue with worker in the API process, local/S3 storage, Resend email, Stripe, ClamAV | CI pipeline, production deployment, backups, monitoring/alerting |

## Batches

| Batch | Status | Notes |
|---|---|---|
| A — Platform infrastructure | Done | Job queue on `background_jobs` (`FOR UPDATE SKIP LOCKED`, retries, periodic jobs; `JOBS_WORKER=off` to disable) instead of Redis/BullMQ; S3-compatible storage (`STORAGE_DRIVER=s3`) with local fallback; Resend email |
| B — Credits, entitlements, billing | Done | Append-only credit ledger, charges/refunds, entitlement resolver (plan + overrides + default plan), Stripe checkout/portal/cancel/webhooks, credit packs, two-person credit adjustments |
| C — Workspace, account, settings | Done | Members/invitations/roles, MFA (TOTP), passkeys, sessions, notification preferences + feed, project defaults, data export and retention, AI & GEO preferences |
| D — SEO audit engine | Done | Crawler (SSRF-safe, robots.txt), rule catalogue from the SEO Audit Guide, scoring, scheduled audits |
| E — Optimization & verification | Done | Tasks from findings, statuses, assignment, verification re-checks |
| F — Editor & CMS publishing | Done | Versioned documents, page import, live scoring, Claude suggestions, WordPress publish (encrypted credentials) |
| G — Keyword research | Done | DataForSEO explorer/related/questions/competitors/SERP, lists, saved keywords, clusters |
| H — Content strategy | Done | AI ideas and briefs, plans, clusters, optimized content, brief → editor |
| I — AI Search (GEO) | Done | Prompts, schedules, checks on ChatGPT/Claude/Gemini/Perplexity, mentions, citations, competitors, snapshots, opportunities |
| J — Reports | Done | HTML/PDF/CSV generation, schedules, share links |
| K — Admin CMS & careers | Done | Blog/guides/help/case studies, categories, authors, media, videos, events; jobs, applications with scanned uploads; contact and support inbox |
| L — Admin operations | Done | Module controls, feature flags with rules, platform settings that take effect (maintenance mode, sign-up gate, admin MFA, passkeys, invitation expiry, workspace defaults, staff alerts), usage & costs, system health, incidents, admin search, sessions/devices |
| M — Launch hardening | Open | CI (typecheck, tests, build), deployment (web, API + worker, Postgres, storage), backups, monitoring and alerting, CSP review, load tests for crawler and GEO checks, legal text approval |

## Decisions taken

1. Payments: Stripe. 2. Email: Resend. 3. Keyword/SERP data: DataForSEO. 4. GEO platforms: ChatGPT (OpenAI Responses + web search), Claude (web search), Gemini (Google Search grounding), Perplexity (Sonar); editor/content AI: Claude. 5. Credit costs, packs, default plan and sign-up credits are set by admins in Settings → Credits & Billing (no hard-coded prices).

## Decisions still needed

1. Hosting target (e.g. Vercel + Fly/Render, or AWS).
2. Approved legal text (privacy, terms, cookies).
3. Production values for credit costs and packs.
