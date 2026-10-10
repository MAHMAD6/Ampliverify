# Screen register

Every supplied screen design, the route that implements it, and what it is
connected to. Update this file whenever a design arrives or a screen changes.
Design files are listed in [INPUTS.md](./INPUTS.md); API routes in [API.md](./API.md).

All screens below are **live**: they read from and write to the API. Where a
third-party provider is not configured (Stripe, Resend, Anthropic, OpenAI,
Gemini, Perplexity, DataForSEO, Google OAuth, ClamAV), the dependent action is
disabled with an explanation, and nothing is simulated.

Developer notes printed inside the mockups (e.g. "Production rule: …") are implemented as behavior, not shown to end users. Admin-facing guidance panels are kept, because administrators are the intended audience.

## Public site (`(public)` and `(auth)` route groups)

Visual system: public-website-v2 (green, Plus Jakarta Sans, `components/public/site.module.css`). Placeholder content in the mockups (customer logos, testimonials, team members, contact details) is omitted rather than invented.

| Screen | Route | Design | Data |
|---|---|---|---|
| Home / Features / How It Works / About | `/`, `/features`, `/how-it-works`, `/about` | public-website-v2 | Static |
| Pricing | `/pricing` (`?interval=annual`) | public-website-v2/Pricing | `GET /public/plans`: plan cards, compare table, saving %, the admin-flagged plan badged "Most Popular" |
| Blog / Guides | `/blog`, `/guides` (`?q=&category=`) | public-website-v2/Resources | Published articles; blog posts show their featured image |
| Article | `/blog/[slug]`, `/guides/[slug]`, `/help/[slug]` | public-website-v2/Guide article | Markdown, TOC, related articles |
| Help Center | `/help` | public-website-v2/Help | Topics from published help articles |
| Case Studies | `/case-studies`, `/case-studies/[slug]` | admin content redesign (#50) | Published case studies with results |
| Webinars & Videos | `/webinars` | admin content redesign (#50) | Upcoming/past events (registration links) and videos |
| Integrations | `/integrations` | public-website-v2 | `GET /public/integrations` |
| Careers / Job Detail + Application | `/careers`, `/careers/[slug]` | public-website-v2/Careers, public-careers-application/01 | Published openings; application with résumé/cover letter upload (multipart), honeypot, consent, deadline handling |
| Application Success | `/careers/[slug]/applied?receipt=` | public-careers-application/02 | Only for a receipt the API confirms |
| Contact | `/contact` (`?topic=`) | public-website-v2/Contact | Stored in `contact_submissions`, routed to the admin inbox and staff alerts; reference shown on success |
| Legal | `/legal` | public-auth/05, public-system-pages | Section structure; policy text pending approval |
| Log In / Two-factor / Forgot / Reset / Verify | `/login`, `/login/two-factor`, `/forgot-password`, `/reset-password`, `/verify-email` | public-auth/01–04 | Better Auth: password, TOTP/backup codes, passkeys (if allowed), Google/Microsoft when configured |
| Sign Up | `/signup` (`?website=&plan=`) | public-website-v2/Sign Up | Better Auth; closed to non-invited people when sign-up is turned off |
| Invitation / Shared report | `/invite?token=`, `/r/[token]` | page map | Workspace invitation accept; public read-only report share |
| 404 / 500 / Maintenance | `not-found`, `error.tsx`, `/maintenance` | public-system-pages/03–05 | Static |

## User app (`/app`)

Navigation follows the locked spec in `docs/design/navigation-batch1/`. Renamed routes redirect permanently (see `apps/web/next.config.ts`). Page states (empty, loading, error, processing, permission/plan restricted, low credits) render through `components/ui/StateView.tsx`. In maintenance mode non-operators see a maintenance notice.

| Screen | Route | Data |
|---|---|---|
| Dashboard | `/app/dashboard` | Projects with latest audit scores, high issues, open tasks; credits; next steps |
| My Projects / Add Project / Project Overview | `/app/projects`, `/app/projects/new`, `/app/projects/[id]` | CRUD, status, project summary and settings |
| On-Page SEO Audit | `/app/audit` (`?url=&mode=&tab=`) | Runs audits (credit-charged), live progress, scores, findings by category, tasks; scheduled audits |
| Optimization Center | `/app/optimize` | Tasks from findings, status, assignment, verification re-checks |
| On-Page SEO Editor | `/app/editor`, `/app/editor/[id]` | Documents (new/import page), versioned saves, live rule-engine scoring, Claude suggestions (accept/reject), section/quick AI actions, version history, WordPress publish, device backup of unsaved work |
| Content Strategy | `/app/content/{ideas,clusters,plan,briefs,optimized}`, `/app/content/briefs/[id]` | AI topic ideas, manual ideas, keyword clusters, briefs (AI-drafted outline/questions/keywords/GEO notes) → "Write in Editor", content plans with dated items, optimized documents |
| Keyword Research | `/app/keywords/{explorer,related,questions,competitors,serp,lists,clusters}` | DataForSEO research (credit-charged), filters, CSV export, save keywords, lists, clusters |
| AI Search (GEO) | `/app/geo` (+ `history`, `citations`, `platforms`, `competitors`, `opportunities`), `/app/geo/prompts/[id]` | Prompt tracking with Add Prompt (platforms, cadence, country, tags), checks across ChatGPT/Claude/Gemini/Perplexity, visibility/citation/position/share-of-voice metrics, trends, cited sources, competitors, opportunities, prompt detail with answers, edit/duplicate/pause/archive |
| Reports | `/app/reports{,/scheduled,/shared}`, `/app/reports/[id]`, `/app/projects/[id]/reports` | Generate (HTML/PDF/CSV), schedule, share links, download |
| Usage & Credits / Credit History | `/app/usage`, `/app/usage/history` | Usage by feature, credit ledger, Add Credits (Stripe Checkout when configured) |
| Billing & Plan / Invoices | `/app/billing`, `/app/billing/invoices`, `/app/settings/billing` | Plan catalog, checkout, customer portal, cancel, invoices |
| Notifications | `/app/notifications` | Notification center, mark read |
| Help & Support | `/app/help` | Help search, support requests with staff replies |
| Getting Started | `/app/getting-started` | Checklist progress from real data (`GET /user/onboarding`) |
| Search | `/app/search?q=` | Projects, editor documents, reports, keyword lists, Help Center, guides |
| Connect Your Website | `/app/integrations/cms` | WordPress connect (application password), test, browse content |
| Settings | `/app/settings/{account,workspace,project-defaults,integrations,ai-geo,notifications,billing,privacy}` | Profile, password, MFA, passkeys, sessions; workspace, members, invitations; project defaults; Google Search Console/GA4; AI & GEO preferences; notification preferences; data export and retention |

## Super Admin (`/admin`)

Collapsible sidebar from `ADMIN_NAV` (`lib/nav.ts`). List screens share `AdminList`. Every action is authorized and audited by the API; consequential actions ask for confirmation or a written reason.

| Screen | Route | Data |
|---|---|---|
| Command Center | `/admin` | Users, content, activity |
| All Users / User Detail | `/admin/users`, `/admin/users/[id]` | Last active (auth sessions), suspend/reactivate (signs out everywhere), sign-out sessions, roles, workspaces, activity |
| Admins / Sub-Admins / Detail | `/admin/admins`, `/admin/sub-admins`, `/admin/admins/[id]` | Roster from role assignments |
| Roles & Permissions | `/admin/roles` | System roles; create custom roles (only permissions the creator holds) |
| Access Assignments | `/admin/access` | Assign/revoke roles at platform, organization or workspace scope |
| Admin Activity / Audit Logs / Event Detail | `/admin/activity`, `/admin/audit-logs`, `…/[id]` | Append-only audit log |
| Security & Access | `/admin/security` (`?tab=`) | Active sessions and devices (auth server), invitations, suspensions, security policy summary |
| Content Overview | `/admin/content` | Counts per content type, recent changes |
| Blog / Resources / Help / Case Studies | `/admin/{blog,resources,help,case-studies}` (+ `/new`, `/[id]`) | Drafts, scheduling, publish/archive, categories, authors, tags, featured image, SEO metadata, results (case studies) |
| Categories & Tags, Authors | `/admin/categories`, `/admin/authors` | CRUD (categories in use cannot be deleted) |
| Media Library | `/admin/media` | Validated image upload, alt text, delete when unused |
| Videos, Webinars & Events | `/admin/videos`, `/admin/events` | CRUD with publish status |
| Careers / Job editor / Applications | `/admin/careers`, `/admin/careers/{new,[id]}`, `/admin/careers/applications{,/[id]}` | Openings; application review, status, private notes, malware-scanned file download |
| Support Requests / Contact Messages | `/admin/support{,/[id]}`, `/admin/support/contact` | Staff replies (customer notified), statuses |
| Plans & Pricing / Plan editor | `/admin/plans`, `/admin/plans/{new,[code]}` | Plans incl. drafts, public/featured flags, append-only prices (Stripe sync) |
| Feature Entitlements | `/admin/entitlements` | Editable plan matrix, workspace overrides, feature registry |
| Subscriptions / Invoices | `/admin/subscriptions{,/[id]}`, `/admin/billing{,/invoices/[id]}` | Synced from Stripe; links to the Stripe dashboard |
| Credits & Adjustments | `/admin/credits` | Two-person reviewed adjustments and reversals |
| Module Controls / Feature Flags | `/admin/modules`, `/admin/flags{,/new,/[id]}` | Global module on/off; flags with targeting rules and history |
| Usage & Costs / System Health | `/admin/usage`, `/admin/health` | Metered usage, provider calls/costs, credits; DB/queue/provider status, dead-job retry, incidents |
| Search | `/admin/search?q=` | Users, workspaces, projects, content, jobs |
| Settings | `/admin/settings{,/billing,/notifications,/security,/appearance}` | General (platform info, workspace defaults, sign-up, maintenance, low-credit threshold); credit costs, packs, default plan, sign-up credits; staff alert recipients/events; admin MFA, passkeys, invitation expiry; approved brand (fixed) |

## Cross-cutting

- **Sign-in** is Better Auth. `/app` and `/admin` require a session; pages call the API with a short-lived JWT. First sign-in creates the user's organization and workspace (`/auth/continue`).
- **Admin access** is enforced by the API (global permissions), not by the web app.
- **Brand:** the green "A" mark with the Ampli/Verify wordmark. Tagline "AUDIT · OPTIMIZE · VERIFY" in the app, "SEO ENGINEERING" on the public site and in Super Admin.
