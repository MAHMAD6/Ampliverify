# Input file register

Every file supplied for this project, where it lives in the repository, and how
it was used. Update this register whenever new inputs arrive. Which route
implements each screen is tracked in [SCREENS.md](./SCREENS.md).

Checksums are the first 12 hex characters of SHA-256 of the file as uploaded.

| # | File as supplied | SHA-256 | Repo location | Status / how it was used |
|---|---|---|---|---|
| 1 | AmpliVerify logo — full wordmark (PNG, 1099×271) | `a51b20d6dc81` | `assets/brand/ampliverify-logo.png` | Committed. Brand asset ("Audit • Optimize • Verify"). |
| 2 | AmpliVerify logo — "A" mark (PNG, 512×512) | `e8d70b0d1927` | `assets/brand/ampliverify-mark.png` | Committed. App icon / favicon source. |
| 3 | `AmpliVerify_Database_Architecture_Implementation_Guide.pdf` (70 pp.) | `704ca3a282d8` | `docs/AmpliVerify_Database_Architecture_Implementation_Guide.pdf` | Committed. **Source of truth** for `apps/api/prisma/schema.prisma` (all 106 catalogued tables). Deviations are listed in `docs/DATA_MODEL.md`. |
| 4 | `ampliverify_batch1-admin.zip` | `8e9cd60cd324` | `docs/design/admin-batch1/` | Committed. Super Admin mockups: Content Overview, Blog Posts, Blog Editor, Resources. |
| 5 | `ampliverify_batch2-admin.zip` | `f09f792d19a8` | `docs/design/admin-batch2/` | Committed. Media Library, Careers / Job Openings, Job Opening Editor, Plans & Pricing. Drove extra `job_openings` / `plans` columns. |
| 6 | `ampliverify_batch3-admin.zip` | `ab6d03a854d1` | `docs/design/admin-batch3/` | Committed. Feature Entitlements, Subscriptions, Billing & Invoices, Credits & Adjustments. Drove `credit_adjustments` and `workspace_entitlement_overrides`. |
| 7 | `ampliverify_batch4-admin.zip` | `ab6d03a854d1` | — | **Not committed: byte-identical duplicate of #6.** Awaiting the intended batch 4 re-upload. |
| 8 | `ampliverify_public_remaining_batch1.zip` | `46f9abc7ba0f` | `docs/design/public-batch1/` | Committed. Public site: Pricing, Integrations, About Us, Contact. |
| 9 | `ampliverify_public_remaining_batch2.zip` | `6bf193297b8c` | `docs/design/public-batch2/` | Committed. Public site: Blog landing, Blog article, Guides landing, Guide detail. |
| 10 | `ampliverify_public_remaining_batch3.zip` | `4466aeb113d4` | `docs/design/public-batch3/` | Committed. Public site: Help Center landing, Help Center article, Careers. |
| 11 | `ampliverify_user_support_batch-user-front.zip` | `d891ea6f1295` | `docs/design/user-support/` | Committed. User app: Billing & Plan, Notifications, Help & Support, Getting Started. |
| 12 | `AmpliVerify_Settings_3_Pages_Readable_1536x1024.zip` | `e7385c5f5c91` | `docs/design/user-settings/` | Committed. User Settings: Account, Notifications, Data & Privacy (PNG). |
| 13 | `AmpliVerify_Settings_3_Pages_Readable_3072x2048.zip` | `8f1fc3788472` | — | Not committed: same three screens as #12 at 2× resolution (3.4 MB). Re-add if the hi-res versions are needed. |
| 14 | `AmpliVerify_Backend_Batch1_Foundation.zip` (NestJS + TypeORM) | `077870cf2fef` | `docs/reference/backend-batch1-original/` (as supplied); ported into `apps/api/` | Committed for provenance. **Ported to Prisma** in `apps/api`; see "Backend Batch 1 port" in `docs/DATA_MODEL.md` for what changed and the bugs fixed. |
| 15 | `AAPW.xlsx` | `79411895b9af` | — | **Deliberately excluded.** Contains an admin login and passwords. Never committed, copied or used. Credentials are supplied via environment / the auth provider only. Rotate any of those passwords that are in real use, since they have been shared in a chat upload. |
| 16 | Settings → Data & Privacy (WebP render) | `6754bd20a69d` | `docs/design/user-settings/Data_Privacy_alt.webp` | Committed. Same screen as #12's `Data_Privacy.png`, different render. |
| 17 | User-app sidebar navigation, numbered 1–12 (PNG, 276×1024) | `bb293246b225` | `docs/design/user-app/sidebar-navigation.png` | Committed. Treated as the **locked user navigation order**: Dashboard, My Projects, On-Page SEO Audit, Optimization Center, On-Page SEO Editor, Content Strategy, Keyword Research ▾, AI Search (GEO) ▾, Reports, Usage & Credits, Billing & Plan, Settings ▾. The Settings mockups (#12, #16) still show an older order and logo. |
| 18 | Embroidered logo, "SEO Engineering" (WebP) | `40bac6472a00` | `assets/brand/merch/embroidered-logo-seo-engineering.webp` | Committed. Brand reference: "SEO Engineering" tagline lockup. |
| 19 | Cap mockup, "SEO Engineering" (WebP) | `938386dede0c` | `assets/brand/merch/cap-seo-engineering.webp` | Committed. Brand / merchandise reference. |
| 20 | Jacket mockup, "SEO Engineering" + `www.ampliverify.com` (WebP) | `c773a7464940` | `assets/brand/merch/jacket-seo-engineering.webp` | Committed. Brand reference. Confirms the public domain `ampliverify.com`. |
| 21 | AI Search (GEO) Monitoring screen (WebP) | `56a76d7b12fb` | `docs/design/user-app/ai-search-geo-monitoring.webp` | Committed. Implemented at `/app/geo`. Its sidebar shows an older nav order; #17 wins. |
| 22 | "A" mark (PNG, 512×512, re-encoded) | `84737ecd3528` | — | Not committed: same artwork as #2. A transparent version made from #2 is `assets/brand/ampliverify-mark-transparent.png` (used by the web app). |
| 23 | Settings → Integrations (PNG) | `f7ecbd2fea57` | `docs/design/user-settings/Integrations.png` | Committed. Implemented at `/app/settings/integrations`. |
| 24 | Keyword Research — Explorer with details drawer (WebP) | `dac6343a2791` | `docs/design/user-app/keyword-research.webp` | Committed. Implemented at `/app/keywords`. |
| 25 | Keyword Research — Explorer, alternate (WebP) | `ea267174bd1f` | `docs/design/user-app/keyword-research-alt.webp` | Committed. Header actions (Saved Keywords / Export / Search) taken from this and #26–28. |
| 26 | Keyword Research — Questions (WebP) | `046331c2457a` | `docs/design/user-app/keyword-research-questions.webp` | Committed. `/app/keywords/questions`. |
| 27 | Keyword Research — Competitor Keywords (WebP) | `249482c06d27` | `docs/design/user-app/keyword-research-competitor.webp` | Committed. `/app/keywords/competitors`. |
| 28 | Keyword Research — SERP Analysis (WebP) | `2b0d45876c28` | `docs/design/user-app/keyword-research-serp.webp` | Committed. `/app/keywords/serp`. |
| 29 | AmpliVerify wordmark, no tagline (WebP) | `e54dd8ee40b2` | `assets/brand/ampliverify-wordmark.webp` | Committed. Brand reference. |
| 30 | My Projects, early version (WebP) | `c1e553b13ea6` | `docs/design/user-app/my-projects.webp` | Committed. Superseded by #31–32. |
| 31 | My Projects — populated list with row menu (chat image) | — | — | **Shared in chat only; no file was saved.** Implemented at `/app/projects`. Please re-upload as a file to archive it. |
| 32 | My Projects — empty state (chat image) | — | — | **Shared in chat only.** Implemented at `/app/projects` (no projects). Please re-upload. |
| 33 | Settings → Notifications, hi-res (chat image) | — | — | **Shared in chat only.** Same screen as #12 `Notifications.png`. |
| 34 | On-Page SEO Editor (chat image) | — | — | **Shared in chat only.** Implemented at `/app/editor`. Please re-upload. |
| 35 | Optimization Center (chat image) | — | — | **Shared in chat only.** Implemented at `/app/optimization`. Please re-upload. |
| 36 | Keyword Research — Explorer populated with Keyword Details (chat image) | — | — | **Chat only.** Drives the results table + details panel. Please re-upload. |
| 37 | Settings → Project Defaults (chat image) | — | — | **Chat only.** `/app/settings/project-defaults`. |
| 38 | Project Overview (chat image) | — | — | **Chat only.** `/app/projects/[id]`. |
| 39 | Project Overview — annotated spec, 12 callouts (chat image) | — | — | **Chat only.** Used as the behavior spec for #38. |
| 40 | Connect Your Website / CMS Connection (chat image) | — | — | **Chat only.** `/app/integrations/cms`. Its sidebar shows a different Settings sub-menu (Profile, Team, Integrations, Notifications, Billing, API & Developers); the 8-item Settings menu from #12 is kept. |
| 41 | Keyword Research — Related Keywords, populated (chat image) | — | — | **Chat only.** `/app/keywords/related`. |
| 42 | Keyword Research — Related Keywords, empty (chat image) | — | — | **Chat only.** |
| 43 | Report History (chat image) | — | — | **Chat only.** `/app/reports`. |
| 44 | Project → Reports tab (chat image) | — | — | **Chat only.** `/app/projects/[id]/reports`. |
| 45 | Report view, "[Report Title]" template (chat image) | — | — | **Chat only.** `/app/reports/[id]`. |
| 46 | Settings → Billing & Plan (chat image) | — | — | **Chat only.** `/app/settings/billing`. The Settings sub-menu item "Billing & Plan" now points here. |
| 47 | Settings → Billing & Plan with Credits & Usage and Add Credits modal (chat image) | — | — | **Chat only.** Same route; modal in `components/app/billing/AddCreditsDialog.tsx`. |
| 48 | Settings → Integrations catalog, top-tab variant (chat image) | — | — | **Chat only.** Supersedes #23's layout at `/app/settings/integrations`. Platform/provider rows come from the registries (GEO keys `google_ai_overview`, `chatgpt`, `perplexity`, `copilot`; integration keys `wordpress`, `google_analytics`, `google_search_console`, `google_ads`, `meta_ads`). Its top-tab settings nav is not used; the 8-item side menu is kept. |
| 49 | Settings → Notifications (chat image) | — | — | **Chat only.** Same screen as #12 / #33; no change needed. |
| 50 | Admin Content Management redesign (chat image) | — | — | **Chat only.** `/admin/content`. Adds admin nav items Categories & Tags, Authors, Videos, Webinars & Events, Case Studies. |
| 51 | `Batch1_Separated_1536x1024.zip` (navigation spec, 9 PNG) | `928bb56fb8f1` | `docs/design/navigation-batch1/` | Committed. **Locked navigation spec**: sidebar order (same as #17), page map with routes, routing decisions, Settings submenu, breadcrumb pattern, URL pattern, button/link behavior. Applied app-wide (see SCREENS.md). |
| 52 | `Batch2A_Separated_1920x1080.zip` (state boards, 7 PNG) | `cb7d7bf3f3e7` | `docs/design/user-app-batch2a/` | Committed. Approved states (default, empty, loading, processing, success, error, low credits, plan restricted, permission restricted) for Dashboard, My Projects, Audit, Optimization Center, Editor, Content Strategy. Implemented by `StateView` plus per-module `loading.tsx` / `error.tsx`. |
| 53 | `Batch2A_Separated_3840x2160.zip` | `1ab0609d84ed` | — | Not committed: same boards as #52 at 2× (16 MB). |
| 54 | Settings → Workspace (PNG) | `2dabc9ba5979` | `docs/design/user-settings/Workspace.png` | Committed. `/app/settings/workspace`. Its footer note ("driven by backend… do not show sample members") is implemented as behavior. |
| 55 | Billing & Plan, plan picker with Compare Plans (WebP) | `91cc9a9d395f` | `docs/design/user-settings/Billing_Plan_Plans.webp` | Committed. `/app/billing` and inside `/app/settings/billing`. Plans, prices and features come from `/public/plans`; the mockup's prices and limits are not copied. |
| 56 | Content Strategy, first version (chat image) | — | — | **Chat only.** Superseded by #57. |
| 57 | Content Strategy, second version (chat image) | — | — | **Chat only.** `/app/content/*`. Its tabs are mapped onto the page map: Opportunities = `/content/ideas`, Drafts = `/content/briefs`. Topic Clusters (`/content/clusters`) and Optimized Content (`/content/optimized`) are design-only tabs. |
| 58 | Usage & Credits (chat image) | — | — | **Chat only.** `/app/usage`. |
| 59 | Dashboard, empty (chat image) | — | — | **Chat only.** `/app/dashboard` with no projects. |
| 60 | Dashboard, populated with interaction callouts (chat image) | — | — | **Chat only.** `/app/dashboard` with projects: row hover, right-aligned menu, delete confirmation with a clear warning. Its third bottom panel is hidden by the modal; it is implemented as "Recent Reports". |

## Not yet supplied / known gaps

- Admin batch 4 (see #7).
- Super Admin screens referenced in the navigation but not yet mocked: Command Center, All Users, Admins, Sub-Admins, Roles & Permissions, Access Assignments, Module Controls, Feature Flags, Usage & Costs, System Health, Admin Activity, Security & Access, Settings.
- User-app screens still without a design: Settings → AI & GEO Preferences; the page-map sub-pages (Keyword Overview/Clusters, GEO sub-pages, Scheduled/Shared reports, Credit History, Invoices) and the `[id]` detail pages for audit, optimize and editor.
- Sign-in / sign-up screens (needed to wire Better Auth into the web app).
- Settings → Data & Privacy (#12, #16) needs storage the guide does not define: data-export requests, per-workspace retention and public-share settings, and per-user privacy preferences (product usage data, product communications).
- The user-app nav (#17) adds an **Optimization Center**. It is backed by `optimization_tasks` / `verification_runs`; no new tables are needed.
- The public Contact page and the user Help & Support page imply contact-form and support-ticket storage. The database guide defines neither, so no tables exist for them yet.
- The admin Content Management redesign (#50) adds videos, webinars/events and case studies, and the Add Credits modal (#47) implies purchasable credit packs. The guide defines no tables for any of these; the screens show empty states until they are modelled.
- The Integrations catalog (#48) mentions a marketplace; no marketplace data exists.
- Schema gaps from this batch:
  - Workspaces have no default timezone or language (#54).
  - Plans have no "featured" / "Most Popular" flag (#55), so no plan is highlighted.
  - There is no hard-delete workflow for projects; the Dashboard delete confirmation (#60) offers Archive instead.
