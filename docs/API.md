# API surface

Generated from the NestJS controllers (`apps/api/src/**/*.controller.ts`). All routes are under `/api/v1`. Every route requires a Better Auth bearer JWT unless marked **public**; `internal/*` routes require the `X-Auth-Sync-Secret` header. Permissions are checked in the services (RBAC: global, organization, workspace and project scopes) and every state change is written to the append-only audit log.

## Response envelope

```json
{ "data": {}, "meta": {}, "error": null }
```

```json
{ "data": null, "meta": {}, "error": { "code": "PERMISSION_DENIED", "message": "You do not have permission to perform this action." } }
```

`BigInt` values (money in minor units, byte sizes) are serialized as strings. Validation is strict: unknown body fields are rejected (400).

## Cross-cutting rules

- **Maintenance mode** (Super Admin → Settings → General): `/user/*` requests return 503 `MAINTENANCE` except for platform operators.
- **Admin MFA** (Settings → Security): `/admin/*` requests return 403 `MFA_REQUIRED` when the token's `twoFactorEnabled` claim is false.
- **Module controls** turn product modules off globally; **entitlements** (plan + workspace overrides) gate features and usage limits; metered actions charge credits per `credits.costs`.
- **Rate limits**: public contact (5/hour per IP) and job applications (5/hour per email). The web app forwards the visitor IP; `TRUST_PROXY` decides which proxies are trusted.
- **Outbound fetches** (audits, page import, WordPress) go through the SSRF-safe fetcher (public addresses only, ports 80/443, manual redirects).


## Health

| Method | Route | Access |
|---|---|---|
| GET | `/health` | public |

## AI Search (GEO)

| Method | Route | Access |
|---|---|---|
| GET | `/public/geo-platforms/status` | public |
| DELETE | `/user/geo/competitors/:id` | user |
| PATCH | `/user/geo/opportunities/:id` | user |
| GET | `/user/geo/prompts/:id` | user |
| PATCH | `/user/geo/prompts/:id` | user |
| POST | `/user/geo/prompts/:id/duplicate` | user |
| POST | `/user/geo/prompts/:id/run` | user |
| GET | `/user/projects/:projectId/geo/citations` | user |
| GET | `/user/projects/:projectId/geo/competitors` | user |
| POST | `/user/projects/:projectId/geo/competitors` | user |
| GET | `/user/projects/:projectId/geo/history` | user |
| GET | `/user/projects/:projectId/geo/opportunities` | user |
| GET | `/user/projects/:projectId/geo/overview` | user |
| GET | `/user/projects/:projectId/geo/prompts` | user |
| POST | `/user/projects/:projectId/geo/prompts` | user |

## Auth provisioning (server-to-server)

| Method | Route | Access |
|---|---|---|
| POST | `/internal/auth/users/sync` | internal |

## Billing, credits and Stripe webhooks

| Method | Route | Access |
|---|---|---|
| GET | `/user/workspaces/:workspaceId/billing` | user |
| POST | `/user/workspaces/:workspaceId/billing/cancel` | user |
| POST | `/user/workspaces/:workspaceId/billing/checkout` | user |
| POST | `/user/workspaces/:workspaceId/billing/portal` | user |
| POST | `/user/workspaces/:workspaceId/credits/checkout` | user |
| GET | `/user/workspaces/:workspaceId/credits/ledger` | user |
| GET | `/user/workspaces/:workspaceId/invoices` | user |
| GET | `/user/workspaces/:workspaceId/usage` | user |
| POST | `/webhooks/stripe` | public |

## CMS and careers

| Method | Route | Access |
|---|---|---|
| GET | `/admin/applicant-files/:id` | admin |
| POST | `/admin/applicant-files/:id/rescan` | admin |
| GET | `/admin/applications` | admin |
| GET | `/admin/applications/:id` | admin |
| PATCH | `/admin/applications/:id` | admin |
| POST | `/admin/applications/:id/notes` | admin |
| GET | `/admin/authors` | admin |
| POST | `/admin/authors` | admin |
| PATCH | `/admin/authors/:id` | admin |
| DELETE | `/admin/authors/:id` | admin |
| GET | `/admin/categories` | admin |
| POST | `/admin/categories` | admin |
| PATCH | `/admin/categories/:id` | admin |
| DELETE | `/admin/categories/:id` | admin |
| GET | `/admin/content/:kind` | admin |
| POST | `/admin/content/:kind` | admin |
| GET | `/admin/content/:kind/:id` | admin |
| PATCH | `/admin/content/:kind/:id` | admin |
| DELETE | `/admin/content/:kind/:id` | admin |
| GET | `/admin/content/overview` | admin |
| GET | `/admin/events` | admin |
| POST | `/admin/events` | admin |
| PATCH | `/admin/events/:id` | admin |
| DELETE | `/admin/events/:id` | admin |
| GET | `/admin/jobs` | admin |
| POST | `/admin/jobs` | admin |
| GET | `/admin/jobs/:id` | admin |
| PATCH | `/admin/jobs/:id` | admin |
| DELETE | `/admin/jobs/:id` | admin |
| GET | `/admin/media` | admin |
| POST | `/admin/media` | admin |
| PATCH | `/admin/media/:id` | admin |
| DELETE | `/admin/media/:id` | admin |
| GET | `/admin/tags` | admin |
| GET | `/admin/videos` | admin |
| POST | `/admin/videos` | admin |
| PATCH | `/admin/videos/:id` | admin |
| DELETE | `/admin/videos/:id` | admin |
| GET | `/public/careers/:slug/applications/:receipt` | public |
| POST | `/public/careers/:slug/apply` | public |
| GET | `/public/media/:id` | public |

## Contact and support inbox

| Method | Route | Access |
|---|---|---|
| GET | `/admin/contact-submissions` | admin |
| PATCH | `/admin/contact-submissions/:id` | admin |
| GET | `/admin/support-tickets` | admin |
| GET | `/admin/support-tickets/:id` | admin |
| PATCH | `/admin/support-tickets/:id` | admin |
| POST | `/admin/support-tickets/:id/messages` | admin |
| POST | `/public/contact` | public |

## Content strategy

| Method | Route | Access |
|---|---|---|
| GET | `/user/content/briefs/:id` | user |
| PATCH | `/user/content/briefs/:id` | user |
| POST | `/user/content/briefs/:id/generate` | user |
| PATCH | `/user/content/ideas/:id` | user |
| PATCH | `/user/content/plan-items/:id` | user |
| DELETE | `/user/content/plan-items/:id` | user |
| PATCH | `/user/content/plans/:id` | user |
| POST | `/user/content/plans/:id/items` | user |
| GET | `/user/projects/:projectId/content/briefs` | user |
| POST | `/user/projects/:projectId/content/briefs` | user |
| GET | `/user/projects/:projectId/content/ideas` | user |
| POST | `/user/projects/:projectId/content/ideas` | user |
| POST | `/user/projects/:projectId/content/ideas/generate` | user |
| GET | `/user/projects/:projectId/content/optimized` | user |
| GET | `/user/projects/:projectId/content/plans` | user |
| POST | `/user/projects/:projectId/content/plans` | user |
| GET | `/user/projects/:projectId/content/summary` | user |

## Current user

| Method | Route | Access |
|---|---|---|
| GET | `/user/me` | user |

## Dashboard and project insights

| Method | Route | Access |
|---|---|---|
| GET | `/user/dashboard` | user |
| GET | `/user/onboarding` | user |
| GET | `/user/projects/:projectId/settings` | user |
| PUT | `/user/projects/:projectId/settings` | user |
| GET | `/user/projects/:projectId/summary` | user |

## Integrations (WordPress, Google)

| Method | Route | Access |
|---|---|---|
| DELETE | `/user/data-sources/:id` | user |
| POST | `/user/editor/documents/:id/publish` | user |
| DELETE | `/user/integrations/:id` | user |
| GET | `/user/integrations/:id/properties` | user |
| POST | `/user/integrations/:id/test` | user |
| GET | `/user/integrations/:id/wordpress/content` | user |
| POST | `/user/integrations/google/callback` | user |
| GET | `/user/projects/:projectId/analytics` | user |
| GET | `/user/projects/:projectId/data-sources` | user |
| POST | `/user/projects/:projectId/data-sources` | user |
| GET | `/user/projects/:projectId/search-performance` | user |
| GET | `/user/workspaces/:id/integrations` | user |
| POST | `/user/workspaces/:id/integrations/google/start` | user |
| POST | `/user/workspaces/:id/integrations/shopify` | user |
| POST | `/user/workspaces/:id/integrations/webflow` | user |
| POST | `/user/workspaces/:id/integrations/webhook` | user |
| POST | `/user/workspaces/:id/integrations/wordpress` | user |

## Keyword research

| Method | Route | Access |
|---|---|---|
| DELETE | `/user/keyword-clusters/:id` | user |
| GET | `/user/keyword-lists/:id` | user |
| PATCH | `/user/keyword-lists/:id` | user |
| DELETE | `/user/keyword-lists/:id` | user |
| POST | `/user/keyword-lists/:id/keywords` | user |
| POST | `/user/keyword-lists/:id/keywords/remove` | user |
| GET | `/user/keywords/research/:id` | user |
| GET | `/user/keywords/status` | user |
| GET | `/user/projects/:projectId/keyword-clusters` | user |
| POST | `/user/projects/:projectId/keyword-clusters` | user |
| GET | `/user/projects/:projectId/keyword-lists` | user |
| POST | `/user/projects/:projectId/keyword-lists` | user |
| GET | `/user/projects/:projectId/keywords/research` | user |
| POST | `/user/projects/:projectId/keywords/research` | user |
| POST | `/user/projects/:projectId/saved-keywords` | user |

## Notifications

| Method | Route | Access |
|---|---|---|
| GET | `/user/notification-preferences` | user |
| PUT | `/user/notification-preferences` | user |
| GET | `/user/notifications` | user |
| POST | `/user/notifications/:id/read` | user |
| POST | `/user/notifications/read-all` | user |
| GET | `/user/notifications/unread-count` | user |

## On-Page SEO Editor

| Method | Route | Access |
|---|---|---|
| GET | `/user/editor/documents/:id` | user |
| PATCH | `/user/editor/documents/:id` | user |
| POST | `/user/editor/documents/:id/analyze` | user |
| PUT | `/user/editor/documents/:id/content` | user |
| GET | `/user/editor/documents/:id/history` | user |
| POST | `/user/editor/documents/:id/suggestions` | user |
| GET | `/user/editor/documents/:id/versions/:versionNo` | user |
| PATCH | `/user/editor/suggestions/:id` | user |
| GET | `/user/projects/:projectId/editor/documents` | user |
| POST | `/user/projects/:projectId/editor/documents` | user |
| POST | `/user/projects/:projectId/editor/import` | user |

## Optimization Center

| Method | Route | Access |
|---|---|---|
| POST | `/user/projects/:projectId/reanalyze` | user |
| GET | `/user/projects/:projectId/recommendations` | user |
| GET | `/user/projects/:projectId/tasks` | user |
| POST | `/user/projects/:projectId/tasks` | user |
| GET | `/user/tasks/:id` | user |
| PATCH | `/user/tasks/:id` | user |
| POST | `/user/tasks/:id/verify` | user |

## Organizations

| Method | Route | Access |
|---|---|---|
| GET | `/user/organizations` | user |
| POST | `/user/organizations` | user |
| GET | `/user/workspaces` | user |
| POST | `/user/workspaces` | user |

## Platform settings (public info, sign-up gate)

| Method | Route | Access |
|---|---|---|
| POST | `/internal/auth/users/can-register` | internal |
| GET | `/public/platform` | public |

## Projects

| Method | Route | Access |
|---|---|---|
| GET | `/user/projects` | user |
| POST | `/user/projects` | user |
| GET | `/user/projects/:id` | user |
| PATCH | `/user/projects/:id` | user |
| DELETE | `/user/projects/:id` | user |

## Public content

| Method | Route | Access |
|---|---|---|
| GET | `/public/blog` | public |
| GET | `/public/blog/:slug` | public |
| GET | `/public/careers` | public |
| GET | `/public/careers/:slug` | public |
| GET | `/public/case-studies` | public |
| GET | `/public/case-studies/:slug` | public |
| GET | `/public/categories` | public |
| GET | `/public/events` | public |
| GET | `/public/geo-platforms` | public |
| GET | `/public/guides` | public |
| GET | `/public/guides/:slug` | public |
| GET | `/public/help` | public |
| GET | `/public/help/:slug` | public |
| GET | `/public/integrations` | public |
| GET | `/public/plans` | public |
| GET | `/public/videos` | public |

## Reports

| Method | Route | Access |
|---|---|---|
| GET | `/public/reports/:token` | public |
| POST | `/user/projects/:projectId/report-schedules` | user |
| POST | `/user/projects/:projectId/reports` | user |
| GET | `/user/report-schedules` | user |
| PATCH | `/user/report-schedules/:id` | user |
| DELETE | `/user/report-schedules/:id` | user |
| POST | `/user/report-shares/:id/revoke` | user |
| GET | `/user/reports` | user |
| GET | `/user/reports/:id` | user |
| DELETE | `/user/reports/:id` | user |
| GET | `/user/reports/:id/download/:format` | user |
| POST | `/user/reports/:id/shares` | user |
| GET | `/user/reports/shared` | user |

## SEO / GEO audits

| Method | Route | Access |
|---|---|---|
| GET | `/user/audit-rules` | user |
| GET | `/user/audits/:id` | user |
| POST | `/user/audits/:id/cancel` | user |
| PATCH | `/user/findings/:id` | user |
| GET | `/user/projects/:projectId/audits` | user |
| POST | `/user/projects/:projectId/audits` | user |
| GET | `/user/projects/:projectId/audits/latest` | user |

## Super Admin

| Method | Route | Access |
|---|---|---|
| GET | `/admin/access-assignments` | admin |
| POST | `/admin/access-assignments` | admin |
| POST | `/admin/access-assignments/:id/revoke` | admin |
| GET | `/admin/audit-logs` | admin |
| GET | `/admin/credit-adjustments` | admin |
| POST | `/admin/credit-adjustments` | admin |
| POST | `/admin/credit-adjustments/:id/reverse` | admin |
| POST | `/admin/credit-adjustments/:id/review` | admin |
| GET | `/admin/entitlement-overrides` | admin |
| GET | `/admin/feature-flags` | admin |
| POST | `/admin/feature-flags` | admin |
| GET | `/admin/feature-flags/:id` | admin |
| PATCH | `/admin/feature-flags/:id` | admin |
| GET | `/admin/features` | admin |
| POST | `/admin/features` | admin |
| GET | `/admin/health` | admin |
| POST | `/admin/incidents` | admin |
| PATCH | `/admin/incidents/:id` | admin |
| GET | `/admin/invitations` | admin |
| GET | `/admin/invoices` | admin |
| GET | `/admin/invoices/:id` | admin |
| POST | `/admin/jobs/:id/retry` | admin |
| GET | `/admin/me` | admin |
| GET | `/admin/module-controls` | admin |
| PUT | `/admin/module-controls/:key` | admin |
| GET | `/admin/plans` | admin |
| POST | `/admin/plans` | admin |
| GET | `/admin/plans/:code` | admin |
| PATCH | `/admin/plans/:code` | admin |
| PUT | `/admin/plans/:code/entitlements` | admin |
| POST | `/admin/plans/:code/prices` | admin |
| GET | `/admin/roles` | admin |
| POST | `/admin/roles` | admin |
| GET | `/admin/search` | admin |
| GET | `/admin/settings` | admin |
| PUT | `/admin/settings/:key` | admin |
| GET | `/admin/subscriptions` | admin |
| GET | `/admin/subscriptions/:id` | admin |
| GET | `/admin/suspensions` | admin |
| GET | `/admin/usage` | admin |
| GET | `/admin/users` | admin |
| GET | `/admin/users/:id` | admin |
| GET | `/admin/users/:id/detail` | admin |
| POST | `/admin/users/:id/sessions/revoke` | admin |
| POST | `/admin/users/:id/status` | admin |
| GET | `/admin/workspaces` | admin |
| POST | `/admin/workspaces/:id/entitlement-overrides` | admin |

## Workspaces, members, invitations, exports, privacy, support

| Method | Route | Access |
|---|---|---|
| GET | `/public/invitations/:token` | public |
| GET | `/user/exports/:id/download` | user |
| POST | `/user/invitations/:id/revoke` | user |
| POST | `/user/invitations/accept` | user |
| PATCH | `/user/me` | user |
| GET | `/user/me/privacy` | user |
| PUT | `/user/me/privacy` | user |
| GET | `/user/support-tickets` | user |
| POST | `/user/support-tickets` | user |
| GET | `/user/support-tickets/:id` | user |
| POST | `/user/support-tickets/:id/messages` | user |
| GET | `/user/workspaces/:id` | user |
| PATCH | `/user/workspaces/:id` | user |
| GET | `/user/workspaces/:id/exports` | user |
| POST | `/user/workspaces/:id/exports` | user |
| GET | `/user/workspaces/:id/invitations` | user |
| POST | `/user/workspaces/:id/invitations` | user |
| GET | `/user/workspaces/:id/members` | user |
| DELETE | `/user/workspaces/:id/members/:userId` | user |
| PUT | `/user/workspaces/:id/members/:userId/role` | user |
