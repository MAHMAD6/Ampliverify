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

The navigation order is locked to `docs/design/user-app/sidebar-navigation.png`.

| Screen | Route | Design | Data |
|---|---|---|---|
| My Projects | `/app/projects` (`?tab=&q=&sort=&view=&page=&size=`) | user-app/my-projects (populated + empty, chat images 2026-10-06) | **Live**: list, status tabs and counts, search, sort, list/grid, pagination; pause/resume/archive via `PATCH /user/projects/:id`. Module status, page and prompt columns show "—" until those APIs exist. |
| Add Project | `/app/projects/new` | none supplied | **Live**: `POST /user/projects` (server action) |
| Project detail | `/app/projects/[id]` | none supplied | **Live**: `GET /user/projects/:id` |
| AI Search (GEO) | `/app/geo` | user-app/ai-search-geo-monitoring | Project picker live; prompts, providers, checks and credits are empty states |
| Keyword Research: Explorer / Related / Questions / Competitors / SERP / Lists | `/app/keywords`, `/app/keywords/{related,questions,competitors,serp,lists}` | user-app/keyword-research*, -questions, -competitor, -serp | Empty states; a search explains that keyword data is not available (or asks for a project). Related and Lists have no dedicated design. |
| Optimization Center | `/app/optimization` (`?category=`) | chat image 2026-10-06 | Empty states (recommendations come from the audit API) |
| On-Page SEO Editor | `/app/editor` | chat image 2026-10-06 | Works locally: outline, sections, reorder, markdown formatting, undo/redo, preview, HTML view, autosaved **draft on this device** (per project). Save/AI/analysis disabled (editor API not built). |
| Billing & Plan | `/app/billing` | user-support/01 | Empty states; View Plans → `/pricing` |
| Notification Center | `/app/notifications` | user-support/02 (lower panel) | Empty state |
| Help & Support | `/app/help` | user-support/03 | Help search links to `/help`; support request **disabled** (no ticket storage) |
| Getting Started | `/app/getting-started` | user-support/04 | Progress derived from real data (project created) |
| Settings → Account | `/app/settings/account` | user-settings/Account.png | Profile from `/user/me`; security actions disabled until Better Auth is wired |
| Settings → Integrations | `/app/settings/integrations` | user-settings/Integrations.png | **Live** provider registry; Connect disabled |
| Settings → Notifications | `/app/settings/notifications` | user-settings/Notifications.png (+ hi-res chat image) | Toggles read-only (preferences API not built) |
| Settings → Data & Privacy | `/app/settings/data-privacy` | user-settings/Data_Privacy*.png | Read-only (needs tables not in the guide; see INPUTS.md) |
| Search | `/app/search?q=` | none supplied | Searches the user's projects |

Awaiting design (neutral page with title and empty state): Dashboard `/app`, On-Page SEO Audit `/app/audit`, Content Strategy `/app/content-strategy`, Reports `/app/reports`, Usage & Credits `/app/usage`, Settings → Workspace / Project Defaults / AI & GEO Preferences.

## Super Admin (`/admin`)

| Screen | Route | Design | Data |
|---|---|---|---|
| Content Overview | `/admin/content` | admin-batch1/01 | Empty states |
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
