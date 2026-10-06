# Screen register

Every supplied screen design, the route that implements it, and what it is
connected to. Update this file whenever a design arrives or a screen gets new
backend support. Design files are listed in [INPUTS.md](./INPUTS.md).

**Data** column:
- **Live**: reads from (and, where noted, writes to) the API today.
- **Empty states**: renders the design's backend-derived empty states. The API for that data does not exist yet, so actions that would need it are disabled. Nothing is simulated.

Developer notes printed inside the mockups (e.g. "Production rule: …") are implemented as behavior, not shown to end users. Admin-facing guidance panels are kept, because administrators are the intended audience.

## Public site (`(public)` and `(auth)` route groups)

Visual system: public-website-v2 (green, Plus Jakarta Sans, `components/public/site.module.css`). Placeholder content in the mockups is omitted rather than invented. That covers customer logos, testimonials, team members, contact details, legal text and "Most Popular" badges.

| Screen | Route | Design | Data |
|---|---|---|---|
| Home | `/` | public-website-v2 (Home ×2) | Static |
| Features | `/features` | public-website-v2 | Static |
| How It Works | `/how-it-works` | public-website-v2 (incl. loop diagram) | Static |
| Pricing | `/pricing` (`?interval=annual`) | public-website-v2/Pricing | **Live**: `GET /public/plans`. Plan cards, a compare table grouped by module and the saving %, all derived from real prices. FAQ. |
| Blog / Guides | `/blog`, `/guides` (`?q=&category=`) | public-website-v2/Resources | **Live** (`ArticleIndex`) |
| Article | `/blog/[slug]`, `/guides/[slug]`, `/help/[slug]` | public-website-v2/Guide article | **Live** markdown, TOC and related articles |
| Help Center | `/help` | public-website-v2/Help | **Live**: topics from real articles |
| About / Integrations | `/about`, `/integrations` | public-website-v2 | Static / **Live** `GET /public/integrations` |
| Careers | `/careers` | public-website-v2/Careers | **Live** published openings |
| Job Detail + Application | `/careers/[slug]` | public-careers-application/01 | **Live** job record (location, type, arrangement, description, compensation, deadline). The application form honors `requireResume` and `requireCoverLetter`. **Submit disabled**, because the applications endpoint is not built. Past-deadline roles say so. |
| Application Success | `/careers/[slug]/applied?receipt=` | public-careers-application/02 | Renders only for a receipt the API confirms. Today it always returns 404, so success is never faked. Makes no promise about interviews or response times. |
| Contact | `/contact` | public-website-v2/Contact | Form; **send disabled** (no storage) |
| Legal | `/legal` (`/legal/{privacy,terms,cookies}` redirect to anchors) | public-auth/05, public-system-pages/01–02, public-website-v2/Legal | Section structure; policy text pending approval |
| Log In / Forgot / Reset / Verify Email | `/login`, `/forgot-password`, `/reset-password`, `/verify-email` | public-auth/01–04 | Forms; submit disabled until Better Auth is wired into the web app |
| Sign Up | `/signup` (`?website=&plan=`) | public-website-v2/Sign Up | Plans from the API; submit disabled |
| 404 / 500 / Maintenance | `not-found`, `error.tsx`, `/maintenance` | public-system-pages/03–05 | Static |

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
| On-Page SEO Audit | `/app/audit` (`?url=&mode=seo|geo|both&tab=`) | chat redesign 2026-10-06; batch2a/03 | URL bar, prefilled from the project domain, with Run Audit disabled (audit API not built). "Analyze for" toggle (SEO / GEO / Both). Four score rings show "—" (Not analyzed yet). Seven tabs. Overview has Page Overview rows, a Top Opportunities empty state, Content Strategy links and four analysis cards. Other tabs show "appear after an audit" empty states. |
| Optimization Center | `/app/optimize` (`?category=`) | chat image; batch2a/04 | Empty states (recommendations come from audits) |
| On-Page SEO Editor | `/app/editor` | chat image; batch2a/05 | Works locally (outline, formatting, undo/redo, preview, HTML, per-device draft). Save and AI are disabled. `/editor/[id]` awaits the pages API. |
| Content Strategy | `/app/content` → `/app/content/{ideas,clusters,plan,briefs,optimized}` | chat image 2026-10-06 (second version); batch2a/06 | Tabs Opportunities (Topic Ideas), Topic Clusters, Content Plan, Drafts (Content Briefs), Optimized Content. Feature cards, empty state with Run SEO Audit, "What happens next?". No project selected → Select a Project. With a project, Opportunities also shows the Website Domain panel (project domain, Generate Strategy disabled). |
| Keyword Research: Overview | `/app/keywords` | page map (no design) | Tool hub and recent-research empty state |
| Keyword Explorer / Related / Questions / Competitors / SERP | `/app/keywords/{explorer,related,questions,competitors,serp}` | keyword-research-v2/01–05 (readability set); user-app/keyword-research* | Empty states; the populated states render from `components/app/keywords/source.ts` once the keyword API exists |
| Keyword Lists / Saved Keywords / Clusters | `/app/keywords/lists`, `/app/keywords/lists?saved=true`, `/app/keywords/clusters` | keyword-research-v2/06; page map | Shared keyword tab bar, search, Create New List/Cluster (disabled), "Organize your keywords" empty state. Saved Keywords is Keyword Lists filtered by `saved=true`, as the spec decides; there is no separate page. |
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
| Settings → Billing & Plan | `/app/settings/billing` (`?interval=annual`) | chat images incl. 2026-10-06 redesign; Billing_Plan_Plans.webp | Plan, credits and Add Credits dialog. Then the live plan catalog, then a categorized **Compare Features** table (union of plan entitlements grouped by module, ✓/✗/limits), a facts strip, payment method and invoices. The redesign's topbar "Credits" pill is not shown, because there is no wallet API. |
| Settings → Data & Privacy | `/app/settings/privacy` | user-settings/Data_Privacy*.png | Read-only |

| Settings → AI & GEO Preferences | `/app/settings/ai-geo` | user-settings/AI_GEO_Preferences_overview.webp + AI_GEO_Preferences.webp | Four collapsible groups (AI Provider Settings → Integrations; Default AI Behavior; GEO Monitoring; Usage & Credit), each opening its detailed form. Platforms from the GEO registry with a select-platforms popover; location/language, frequency, citations, competitors, analysis and credit controls are all interactive. There is no preferences API, so Save is disabled and the page says changes are not stored. |

## Super Admin (`/admin`)

Collapsible sidebar, with groups defined in `ADMIN_NAV` (`lib/nav.ts`). List screens share `AdminList`: header, About panel, metrics, `?tab=` tabs, filters, table, empty state and footnote. Admin designs: admin-batch1–3, admin-final-batch1–3, and the chat redesign images of 2026-10-06, which win where they overlap.

| Screen | Route | Data |
|---|---|---|
| Command Center | `/admin` | **Live** user, content, careers and audit counts; billing/monitoring metrics "—" |
| All Users | `/admin/users` | **Live** `GET /admin/users` |
| Admins / Sub-Admins | `/admin/admins`, `/admin/sub-admins` | **Live** roster from access assignments |
| Admin / Sub-Admin Detail | `/admin/admins/[id]`, `/admin/admins/detail` | **Live** user + assignments |
| Roles & Permissions | `/admin/roles` | **Live** `GET /admin/roles` |
| Access Assignments | `/admin/access` | **Live** `GET /admin/access-assignments` |
| Admin Activity / Audit Logs | `/admin/activity`, `/admin/audit-logs` | **Live** `GET /admin/audit-logs` |
| Event Detail | `/admin/{activity,audit-logs}/[id]` | **Live** audit event |
| Security & Access | `/admin/security` | Tabs, Security Controls (read-only) |
| Content Overview, Blog Posts, Resources, Careers | `/admin/{content,blog,resources,careers}` | Empty states (admin CMS API not built) |
| Blog / Resource editor | `/admin/blog/new` (`?type=guide`) | Markdown Write/Preview, content blocks, live categories, SEO & GEO panel; Save/Publish disabled |
| Job Opening editor | `/admin/careers/new` | Section blocks; Save/Publish disabled |
| Media Library | `/admin/media` | Empty; upload disabled |
| Categories, Authors, Videos, Events, Case Studies | `/admin/{categories,authors,videos,events,case-studies}` | Pending pages |
| Plans & Pricing | `/admin/plans` | **Live** `GET /public/plans` |
| Plan editor | `/admin/plans/new`, `/admin/plans/[code]` | Read-only; Save disabled |
| Feature Entitlements | `/admin/entitlements` | **Live** matrix by module key |
| Subscriptions / detail | `/admin/subscriptions`, `/admin/subscriptions/[id]` | Empty / template |
| Billing & Invoices / Invoice detail | `/admin/billing`, `/admin/billing/invoices/[id]` | Empty / template |
| Credits & Adjustments | `/admin/credits` | Empty; adjustments disabled |
| Module Controls | `/admin/modules` | **Live** `GET /admin/module-controls` |
| Feature Flags / new | `/admin/flags`, `/admin/flags/new` | **Live** `GET /admin/feature-flags`; editor read-only |
| Usage & Costs, System Health | `/admin/usage`, `/admin/health` | Empty states |
| Platform Settings | `/admin/settings{,/notifications,/security,/appearance}` | Settings cards; Edit disabled. Appearance shows the locked approved logo/favicon (Change disabled) and a header Preview. |
| Search | `/admin/search?q=` | Empty state (admin search API not built) |

## Cross-cutting

- **Sign-in is not wired.** `apps/web/src/lib/session.ts` returns no token, so authenticated pages show their signed-out and empty states. Sign-in screens exist (public-auth) but submit is disabled. Connecting Better Auth there makes every "Live" screen above work end to end.
- **Admin access** is enforced by the API (global permissions), not by the web app.
- **Brand:** the green "A" mark, made transparent (`assets/brand/ampliverify-mark-transparent.png`), with the Ampli/Verify wordmark. The tagline is "AUDIT · OPTIMIZE · VERIFY" in the app and "SEO ENGINEERING" on the public site and in Super Admin.
