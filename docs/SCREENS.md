# Screen register

Every supplied screen design, the route that implements it, and what it is
connected to. Update this file whenever a design arrives or a screen gets new
backend support. Design files are listed in [INPUTS.md](./INPUTS.md).

**Data** column:
- **Live**: reads from (and, where noted, writes to) the API today.
- **Empty states**: renders the design's backend-derived empty states. The API for that data does not exist yet, so actions that would need it are disabled. Nothing is simulated.

Developer notes printed inside the mockups (e.g. "Production rule: …") are implemented as behavior, not shown to end users. Admin-facing guidance panels are kept, because administrators are the intended audience.

## Public site (`(public)` route group)

| Screen | Route | Design | Data |
|---|---|---|---|
| Home | `/` | none supplied; built from the public shell + About copy | Static |
| Pricing | `/pricing` (`?interval=annual`) | public-batch1/01 | **Live**: `GET /public/plans` (active, public plans with active prices and entitlements) |
| Integrations | `/integrations` | public-batch1/02 | **Live**: `GET /public/integrations` |
| About Us | `/about` | public-batch1/03 | Static |
| Contact | `/contact` | public-batch1/04 | Form rendered; **submit disabled** (no contact-message storage in the guide) |
| Blog | `/blog` (`?q=&category=`) | public-batch2/01 | **Live**: `GET /public/blog`, `/public/categories?type=BLOG` |
| Blog article | `/blog/[slug]` | public-batch2/02 | **Live**: `GET /public/blog/:slug` (markdown body from storage) |
| Guides | `/guides` | public-batch2/03 | **Live** |
| Guide detail | `/guides/[slug]` | public-batch2/04 | **Live** |
| Help Center | `/help` (`?q=&category=`) | public-batch3/01 | **Live** |
| Help article | `/help/[slug]` | public-batch3/02 | **Live** |
| Careers | `/careers` | public-batch3/03 | **Live**: published, visible, pre-deadline openings only |
| Job detail | `/careers/[slug]` | none supplied (follows the careers design) | **Live**; **Apply disabled** (application endpoint not built) |
| Legal | `/legal/{privacy,terms,cookies}` | none supplied | Empty state until approved policy text exists |

## User app (`/app`)

Navigation follows the locked spec in `docs/design/navigation-batch1/`: sidebar order, page map, Settings submenu, breadcrumbs, URL pattern and button/link behavior. Page-map routes are served under the `/app` prefix, which stands in for `app.ampliverify.com`. Renamed routes redirect permanently (see `apps/web/next.config.ts`):
- `/app/optimization` → `/app/optimize`
- `/app/content-strategy` → `/app/content`
- `/app/settings/data-privacy` → `/app/settings/privacy`

`/app` redirects to `/app/dashboard`. Secondary pages show a breadcrumb trail that starts with a home icon.

**Page states** (`docs/design/user-app-batch2a/`) render through one component, `components/ui/StateView.tsx`:

| State | How it is triggered |
|---|---|
| Empty | The data is absent. |
| Loading | Per-module `loading.tsx`. |
| Error with Try Again | Per-module `error.tsx`. |
| Processing / Success | Shown during and after real actions (today: creating a project). |
| Permission Restricted | The API answers 403. |
| Plan Restricted / Low Credits | Components are ready. They are shown only once the entitlement and credit APIs report those conditions, so nothing is simulated. |

| Screen | Route | Design | Data |
|---|---|---|---|
| Dashboard | `/app/dashboard` (`?period=`) | chat images 2026-10-06 (empty + populated with callouts); batch2a/01 | **Live**: total/active project counts and the Project Performance table, with Open and the row menu (manage, pause/resume, archive, delete confirmation). Delete shows the full warning, but permanent deletion is disabled and the dialog offers Archive instead (the API archives, never deletes). Next Steps completion comes from data, with "Hide completed". Audit/content/GEO counts, usage, activity, insights, opportunities, reports and GEO panels show "—" or empty states. |
| My Projects | `/app/projects` (`?tab=&q=&sort=&view=&page=&size=`) | user-app/my-projects (populated + empty); batch2a/02 | **Live**: list, status tabs and counts, search, sort, list/grid, pagination; pause/resume/archive via `PATCH /user/projects/:id`; delete confirmation as on the Dashboard. |
| Add Project (wizard) | `/app/projects/new` | user-app/add-project.webp; batch2a/02 states | **Live** 4-step wizard: Project Details (name, domain with live validation, primary goal) → Website Setup → Analysis Setup → Review & Create, plus a live Project Summary. Creates via `POST /user/projects` with domain and goal. Integrations are connected after creation, and analysis tools say "Not available yet" rather than collecting ignored choices. Processing / Success / Error / Permission states. |
| Project Overview | `/app/projects/[id]` | chat images (screen + annotated spec) | **Live** project facts and status controls; module data "Not analyzed". |
| Project Reports tab | `/app/projects/[id]/reports` | chat image | Empty states |
| On-Page SEO Audit | `/app/audit` | batch2a/03; setup panel from add-project.webp | With a project: "Back to Projects / project" line and the Page URL panel. Run Audit is disabled (audit API not built). Audit History is empty. `/audit/[id]` awaits the API. |
| Optimization Center | `/app/optimize` (`?category=`) | chat image; batch2a/04 | Empty states (recommendations come from audits) |
| On-Page SEO Editor | `/app/editor` | chat image; batch2a/05 | Works locally (outline, formatting, undo/redo, preview, HTML, per-device draft). Save and AI are disabled. `/editor/[id]` awaits the pages API. |
| Content Strategy | `/app/content` → `/app/content/{ideas,clusters,plan,briefs,optimized}` | chat image 2026-10-06 (second version); batch2a/06 | Tabs Opportunities (Topic Ideas), Topic Clusters, Content Plan, Drafts (Content Briefs), Optimized Content. Feature cards, empty state with Run SEO Audit, "What happens next?". No project selected → Select a Project. With a project, Opportunities also shows the Website Domain panel (project domain, Generate Strategy disabled). |
| Keyword Research: Overview | `/app/keywords` | page map (no design) | Tool hub and recent-research empty state |
| Keyword Explorer / Related / Questions / Competitors / SERP | `/app/keywords/{explorer,related,questions,competitors,serp}` | user-app/keyword-research* (incl. -v2), chat images | Empty states; the populated states render from `components/app/keywords/source.ts` once the keyword API exists |
| Keyword Lists / Saved Keywords / Clusters | `/app/keywords/lists`, `/app/keywords/lists?saved=true`, `/app/keywords/clusters` | page map | Empty tables. Saved Keywords is Keyword Lists filtered by `saved=true`, as the spec decides; there is no separate page. |
| AI Search (GEO) Overview = Prompt Tracking | `/app/geo` (`?period=`; `/app/geo/prompts` redirects here) | user-app/ai-search-geo-v2.webp | Shared GEO header (period, Add Prompt disabled), four metrics ("—"), tab bar. Prompt filters (platform options from the GEO registry) and table are empty/disabled until the GEO API exists. Tracked Domain / Prompts setup panel when a project is selected. Credits notice and feature strip. |
| GEO tabs: Visibility Trends / Citations / Platforms / Competitors / Opportunities | `/app/geo/{history,citations,platforms,competitors,opportunities}` | ai-search-geo-v2.webp (tabs); page map | Each tab is its own page with the shared header. Platforms lists every registry platform with "—" values; the others show empty tables. |
| GEO Prompt Detail | `/app/geo/prompts/[id]` (`?tab=`) | user-app/geo-prompt-detail.webp | Template with six tabs, metrics, trend, platform results (from the prompt's platforms), citations and opportunities; Run Check, Edit, Duplicate and Pause are disabled. Resolves to 404 until the GEO prompts API exists. Crumb: AI Search (GEO) › History › Prompt Detail, as designed. |
| Reports: All / Scheduled / Shared | `/app/reports`, `/app/reports/scheduled`, `/app/reports/shared` | chat image (Report History); page map | Filters live (project list); tables empty |
| Report view | `/app/reports/[id]` | chat image | Template; 404 until the reports API exists |
| Usage & Credits | `/app/usage` | chat image 2026-10-06 | Every value "—". Buy More Credits opens the Add Credits dialog (no packs, checkout disabled). Auto top-up and spend cap are disabled. |
| Credit History | `/app/usage/history` | page map | Empty ledger table |
| Billing & Plan: Plans | `/app/billing` (`?interval=annual`) | user-settings/Billing_Plan_Plans.webp | **Live** plan cards and Compare Plans table from `GET /public/plans`; "Save up to N%" computed from real prices. Plan changes are disabled (no checkout). No plan is marked current (no subscription API). A plan with no price is "Custom" with Contact Sales. |
| Billing & Plan: Invoices | `/app/billing/invoices` | page map | Empty invoices; payment method disabled |
| Notification Center | `/app/notifications` | user-support/02 | Empty state |
| Help & Support | `/app/help` | user-support/03 | Help search → `/help`; support request disabled |
| Getting Started | `/app/getting-started` | user-support/04 | Progress derived from real data |
| Search | `/app/search?q=` | none | Searches the user's projects |
| Connect Your Website (CMS) | `/app/integrations/cms` | chat image | WordPress flow UI; Connect/Test disabled |
| Settings → Account | `/app/settings/account` | user-settings/Account.png, Account_v2.png | Profile from `/user/me`; security actions disabled |
| Settings → Workspace | `/app/settings/workspace` | user-settings/Workspace.png | **Live** workspace name and ID (`/user/workspaces`, matching the selected project). Timezone/language show "—" because the schema has no such fields. Members, roles, Edit and Invite are empty or disabled. |
| Settings → Project Defaults | `/app/settings/project-defaults` | chat image | Empty states |
| Settings → Integrations | `/app/settings/integrations` | catalog redesign (chat image) | **Live** registries (`/public/geo-platforms`, `/public/integrations`) |
| Settings → Notifications | `/app/settings/notifications` | user-settings/Notifications.png | Read-only toggles |
| Settings → Billing & Plan | `/app/settings/billing` (`?interval=annual`) | chat images; Billing_Plan_Plans.webp | Plan, credits and Add Credits dialog, then the same live plan catalog as `/app/billing`, then payment method and invoices |
| Settings → Data & Privacy | `/app/settings/privacy` | user-settings/Data_Privacy*.png | Read-only |

| Settings → AI & GEO Preferences | `/app/settings/ai-geo` | user-settings/AI_GEO_Preferences_overview.webp + AI_GEO_Preferences.webp | Four collapsible groups (AI Provider Settings → Integrations; Default AI Behavior; GEO Monitoring; Usage & Credit), each opening its detailed form. Platforms from the GEO registry with a select-platforms popover; location/language, frequency, citations, competitors, analysis and credit controls are all interactive. There is no preferences API, so Save is disabled and the page says changes are not stored. |

## Super Admin (`/admin`)

| Screen | Route | Design | Data |
|---|---|---|---|
| Content Management | `/admin/content` | admin-batch1/01; redesign (chat image 2026-10-06) | Empty states: six content counters show "—", module cards link to each content area, quick actions link to the editors, recent activity says "No activity yet". |
| Categories & Tags, Authors, Videos, Webinars & Events, Case Studies | `/admin/{categories,authors,videos,events,case-studies}` | nav from the Content Management redesign; no page designs | Neutral pending pages. Videos, webinars/events and case studies have no tables in the guide. |
| Blog Posts | `/admin/blog` | admin-batch1/02 | Empty states |
| Blog editor | `/admin/blog/new` (`?type=guide` for resources) | admin-batch1/03 | Title→slug, markdown toolbar work; Save/Publish disabled (admin CMS API not built) |
| Resources | `/admin/resources` | admin-batch1/04 | Empty states (resources are `guides`) |
| Media Library | `/admin/media` | admin-batch2/01 | Empty states; upload disabled |
| Careers / Job Openings | `/admin/careers` | admin-batch2/02 | Empty states |
| Job Opening editor | `/admin/careers/new` | admin-batch2/03 | Form maps 1:1 to `job_openings`; Save/Publish disabled |
| Plans & Pricing | `/admin/plans` | admin-batch2/04 | Empty states |
| Feature Entitlements | `/admin/entitlements` | admin-batch3/01 | Feature rows = seeded registry; plan columns from `/public/plans` |
| Subscriptions | `/admin/subscriptions` | admin-batch3/02 | Empty states |
| Billing & Invoices | `/admin/billing` | admin-batch3/03 | Empty states |
| Credits & Adjustments | `/admin/credits` | admin-batch3/04 | Form disabled (adjustment API not built) |

Awaiting design: Command Center, All Users, Admins, Sub-Admins, Roles & Permissions, Access Assignments, Module Controls, Feature Flags, Usage & Costs, System Health, Admin Activity, Security & Access, Settings, Search. The API already serves users, roles, access assignments and audit logs for the first five; they can be connected as soon as designs arrive.

## Cross-cutting

- **Sign-in is not wired.** `apps/web/src/lib/session.ts` returns no token, so authenticated pages show their signed-out and empty states. No sign-in or sign-up screens have been supplied. Connecting Better Auth there makes every "Live" screen above work end to end.
- **Admin access** is enforced by the API (global permissions), not by the web app.
- **Brand:** the green "A" mark, made transparent (`assets/brand/ampliverify-mark-transparent.png`), with the Ampli/Verify wordmark. The tagline is "AUDIT · OPTIMIZE · VERIFY" in the app and "SEO ENGINEERING" on the public site and in Super Admin.
