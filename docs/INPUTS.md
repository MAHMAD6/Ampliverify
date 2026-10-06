# Input file register

Every file supplied for this project, where it lives in the repository, and how
it was used. Update this register whenever new inputs arrive.

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

## Not yet supplied / known gaps

- Admin batch 4 (see #7).
- Super Admin screens referenced in the navigation but not yet mocked: Command Center, All Users, Admins, Sub-Admins, Roles & Permissions, Access Assignments, Module Controls, Feature Flags, Usage & Costs, System Health, Admin Activity, Security & Access, Settings.
- User-app SEO module screens (projects, audits, editor, keywords, AI Search / GEO, reports).
- Settings → Data & Privacy (#12, #16) needs storage the guide does not define: data-export requests, per-workspace retention and public-share settings, and per-user privacy preferences (product usage data, product communications).
- The user-app nav (#17) adds an **Optimization Center**. It is backed by `optimization_tasks` / `verification_runs`; no new tables are needed.
- The public Contact page and the user Help & Support page imply contact-form and support-ticket storage. The database guide defines neither, so no tables exist for them yet.
