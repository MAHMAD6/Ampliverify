/**
 * Locked user navigation (docs/design/navigation-batch1: order, page map and
 * Settings submenu). Routes follow the page map under the `/app` prefix.
 * Icons are resolved by key in the Sidebar component.
 */
export type NavChild = { label: string; href: string };
export type NavItem = { key: string; label: string; href: string; children?: NavChild[]; divider?: boolean; exact?: boolean };

export type NavGroup = { key: string; label?: string; items: NavItem[]; sellerOnly?: boolean };

/**
 * User navigation, V2 guide §2.1 (single-column sidebar): Dashboard and
 * projects, SEO Engineering, Digital Assets, Marketplace (switch into the
 * buyer / seller dashboards), Integrations, Finances (sellers only) and
 * Account. Each group collapses; the active group opens by default.
 */
export const APP_NAV_GROUPS: NavGroup[] = [
  {
    key: 'home',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
      { key: 'projects', label: 'My Projects', href: '/app/projects' },
    ],
  },
  {
    key: 'seo',
    label: 'SEO Engineering',
    items: [
      { key: 'audit', label: 'On-Page SEO Audit', href: '/app/audit' },
      { key: 'optimization', label: 'Optimization Center', href: '/app/optimize' },
      { key: 'editor', label: 'On-Page SEO Editor', href: '/app/editor' },
      { key: 'content', label: 'Content Strategy', href: '/app/content' },
      {
        key: 'keywords',
        label: 'Keyword Research',
        href: '/app/keywords',
        children: [
          { label: 'Overview', href: '/app/keywords' },
          { label: 'Keyword Explorer', href: '/app/keywords/explorer' },
          { label: 'Keyword Lists', href: '/app/keywords/lists' },
          { label: 'Keyword Clusters', href: '/app/keywords/clusters' },
          { label: 'SERP Analysis', href: '/app/keywords/serp' },
        ],
      },
      {
        key: 'geo',
        label: 'AI Search (GEO)',
        href: '/app/geo',
        children: [
          { label: 'Overview', href: '/app/geo' },
          { label: 'History', href: '/app/geo/history' },
          { label: 'Competitors', href: '/app/geo/competitors' },
          { label: 'Sources & Citations', href: '/app/geo/citations' },
        ],
      },
      { key: 'content-audit', label: 'Content Audit', href: '/app/content/audit' },
      { key: 'valuation', label: 'Website Value Calculator', href: '/website-value' },
    ],
  },
  {
    key: 'assets',
    label: 'Digital Assets',
    items: [
      { key: 'assets-dashboard', label: 'Digital Assets Dashboard', href: '/app/assets', exact: true },
      { key: 'portfolio', label: 'My Portfolio', href: '/app/assets/portfolio' },
      { key: 'asset-new', label: 'Add Digital Asset', href: '/app/assets/new' },
      { key: 'acquisitions', label: 'Acquisition Analyzer', href: '/app/assets/acquisitions' },
      { key: 'improvement', label: 'Improvement Workspace', href: '/app/assets/improvement' },
      { key: 'asset-projects', label: 'Digital Asset Projects', href: '/app/assets/projects' },
      { key: 'asset-performance', label: 'Performance & Reports', href: '/app/assets/performance' },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    items: [
      { key: 'market-buyer', label: 'Marketplace Dashboard', href: '/buyer', exact: true },
      { key: 'market-browse', label: 'Browse Digital Assets', href: '/buyer/browse' },
      { key: 'market-sell', label: 'Sell a Digital Asset', href: '/seller/listings/new' },
      { key: 'market-listings', label: 'My Listings', href: '/seller/listings' },
      { key: 'market-inquiries', label: 'My Inquiries', href: '/buyer/inquiries' },
      { key: 'market-purchases', label: 'My Purchases', href: '/buyer/purchases' },
      { key: 'market-transactions', label: 'Orders & Transactions', href: '/buyer/transactions' },
      { key: 'market-messages', label: 'Messages', href: '/buyer/messages' },
      { key: 'market-seller', label: 'Seller Tools', href: '/seller', exact: true },
    ],
  },
  {
    key: 'integrations',
    label: 'Integrations',
    items: [
      { key: 'integrations-dashboard', label: 'Integrations Dashboard', href: '/app/integrations', exact: true },
      { key: 'connected-accounts', label: 'Connected Accounts', href: '/app/integrations/accounts' },
      { key: 'data-connections', label: 'Data Connections', href: '/app/integrations/data' },
      { key: 'connection-activity', label: 'Connection Activity', href: '/app/integrations/activity' },
    ],
  },
  {
    key: 'finances',
    label: 'Finances',
    sellerOnly: true,
    items: [
      { key: 'fin-overview', label: 'Financial Overview', href: '/seller/payouts', exact: true },
      { key: 'fin-earnings', label: 'Earnings Overview', href: '/seller/payouts/earnings' },
      { key: 'fin-payouts', label: 'Payouts', href: '/seller/payouts/history' },
      { key: 'fin-methods', label: 'Payout Methods', href: '/seller/payouts/method' },
      { key: 'fin-refunds', label: 'Refunds & Disputes', href: '/seller/payouts/disputes' },
      { key: 'fin-tax', label: 'Tax & Statements', href: '/seller/payouts/statements' },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'reports', label: 'Reports', href: '/app/reports', divider: true },
      { key: 'usage', label: 'Usage & Credits', href: '/app/usage' },
      { key: 'billing', label: 'Billing & Plan', href: '/app/billing' },
      { key: 'guides', label: 'Guides', href: '/guides' },
      { key: 'support', label: 'Support', href: '/app/help' },
      {
        key: 'settings',
        label: 'Settings',
        href: '/app/settings',
        children: [
          { label: 'Account', href: '/app/settings/account' },
          { label: 'Workspace', href: '/app/settings/workspace' },
          { label: 'Project Defaults', href: '/app/settings/project-defaults' },
          { label: 'Integrations', href: '/app/settings/integrations' },
          { label: 'AI & GEO Preferences', href: '/app/settings/ai-geo' },
          { label: 'Notifications', href: '/app/settings/notifications' },
          { label: 'Billing & Plan', href: '/app/settings/billing' },
          { label: 'Data & Privacy', href: '/app/settings/privacy' },
        ],
      },
    ],
  },
];

/** Buyer Dashboard: its own compact navigation, no SEO tools, credits or upsells (V2 guide §3.1). */
export const BUYER_NAV_GROUPS: NavGroup[] = [
  {
    key: 'buyer',
    label: 'Marketplace',
    items: [
      { key: 'buyer-dashboard', label: 'Buyer Dashboard', href: '/buyer', exact: true },
      { key: 'market-browse', label: 'Browse Digital Assets', href: '/buyer/browse' },
      { key: 'saved', label: 'Saved Listings', href: '/buyer/saved' },
      { key: 'market-inquiries', label: 'My Inquiries', href: '/buyer/inquiries' },
      { key: 'offers', label: 'My Offers', href: '/buyer/offers' },
      { key: 'market-purchases', label: 'My Purchases', href: '/buyer/purchases' },
      { key: 'downloads', label: 'My Downloads', href: '/buyer/downloads' },
      { key: 'market-transactions', label: 'Transactions', href: '/buyer/transactions' },
      { key: 'market-messages', label: 'Messages', href: '/buyer/messages' },
    ],
  },
  {
    key: 'seller',
    label: 'Sell on AmpliVerify',
    sellerOnly: true,
    items: [
      { key: 'seller-dashboard', label: 'Seller Dashboard', href: '/seller', exact: true },
      { key: 'seller-profile', label: 'Seller Profile', href: '/seller/profile' },
      { key: 'verification', label: 'Verification', href: '/seller/verification' },
      { key: 'market-listings', label: 'My Listings', href: '/seller/listings', exact: true },
      { key: 'market-sell', label: 'Create Listing', href: '/seller/listings/new' },
      { key: 'seller-inquiries', label: 'Received Inquiries', href: '/seller/inquiries' },
      { key: 'offers', label: 'Offers & Negotiations', href: '/seller/offers' },
      { key: 'market-transactions', label: 'Seller Transactions', href: '/seller/transactions' },
      { key: 'fin-payouts', label: 'Payouts & Earnings', href: '/seller/payouts' },
    ],
  },
  {
    key: 'buyer-account',
    label: 'Account',
    items: [
      {
        key: 'settings',
        label: 'Settings',
        href: '/buyer/settings',
        children: [
          { label: 'My Profile', href: '/buyer/settings/profile' },
          { label: 'Security & Password', href: '/buyer/settings/security' },
          { label: 'Notifications', href: '/buyer/settings/notifications' },
          { label: 'Privacy Preferences', href: '/buyer/settings/privacy' },
        ],
      },
      { key: 'support', label: 'Support', href: '/buyer/support' },
    ],
  },
];

export const APP_NAV: NavItem[] = APP_NAV_GROUPS.flatMap((g) => g.items);

/** Breadcrumb trail for user-app secondary pages: Home › section › page. */
export function appCrumbs(...trail: { label: string; href?: string }[]) {
  return [{ label: 'Dashboard', href: '/app/dashboard', home: true }, ...trail];
}

/**
 * Super Admin navigation: collapsible groups from the admin redesign (chat
 * images 2026-10-06; docs/INPUTS.md), plus the content types added by the
 * Content Management redesign (#50) and the support inbox.
 */
export type AdminNavGroup = { key: string; label: string; href?: string; items?: { key: string; label: string; href: string }[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  { key: 'command', label: 'Command Center', href: '/admin' },
  {
    key: 'users-group',
    label: 'User Management',
    items: [
      { key: 'users', label: 'All Users', href: '/admin/users' },
      { key: 'admins', label: 'Admins', href: '/admin/admins' },
      { key: 'sub-admins', label: 'Sub-Admins', href: '/admin/sub-admins' },
      { key: 'admin-detail', label: 'Admin / Sub-Admin Detail', href: '/admin/admins/detail' },
      { key: 'roles', label: 'Roles & Permissions', href: '/admin/roles' },
      { key: 'access', label: 'Access Assignments', href: '/admin/access' },
    ],
  },
  {
    key: 'content-group',
    label: 'Content Management',
    items: [
      { key: 'content', label: 'Content Overview', href: '/admin/content' },
      { key: 'blog', label: 'Blog Posts', href: '/admin/blog' },
      { key: 'resources', label: 'Guides', href: '/admin/resources' },
      { key: 'help', label: 'Help Articles', href: '/admin/help' },
      { key: 'case-studies', label: 'Case Studies', href: '/admin/case-studies' },
      { key: 'videos', label: 'Videos', href: '/admin/videos' },
      { key: 'events', label: 'Webinars & Events', href: '/admin/events' },
      { key: 'categories', label: 'Categories & Tags', href: '/admin/categories' },
      { key: 'authors', label: 'Authors', href: '/admin/authors' },
      { key: 'media', label: 'Media Library', href: '/admin/media' },
      { key: 'comments', label: 'Comments', href: '/admin/comments' },
      { key: 'newsletter', label: 'Newsletter', href: '/admin/newsletter' },
      { key: 'careers', label: 'Careers / Job Openings', href: '/admin/careers' },
      { key: 'applications', label: 'Applications', href: '/admin/careers/applications' },
    ],
  },
  {
    key: 'valuation-group',
    label: 'Website Value Calculator',
    items: [
      { key: 'valuation-calculator', label: 'Calculator Settings', href: '/admin/valuation/calculator' },
      { key: 'valuation-engine', label: 'Valuation Engine Settings', href: '/admin/valuation' },
      { key: 'valuation-sources', label: 'Data Sources', href: '/admin/valuation/sources' },
      { key: 'valuation-limits', label: 'Usage & Limits', href: '/admin/valuation/limits' },
      { key: 'valuation-templates', label: 'Report Templates', href: '/admin/valuation/templates' },
      { key: 'valuation-history', label: 'Calculation History', href: '/admin/valuation/history' },
    ],
  },
  {
    key: 'marketplace-group',
    label: 'Marketplace Management',
    items: [
      { key: 'marketplace-overview', label: 'Marketplace Overview', href: '/admin/marketplace' },
      { key: 'marketplace-sellers', label: 'Seller Management', href: '/admin/marketplace/sellers' },
      { key: 'marketplace-verification', label: 'Seller Verification', href: '/admin/marketplace/verification' },
      { key: 'marketplace-review', label: 'Listing Review & Moderation', href: '/admin/marketplace/listings' },
      { key: 'marketplace-transactions', label: 'Transactions & Disputes', href: '/admin/marketplace/transactions' },
      { key: 'marketplace-payouts', label: 'Commissions & Payouts', href: '/admin/marketplace/payouts' },
      { key: 'marketplace-settings', label: 'Marketplace Settings', href: '/admin/marketplace/settings' },
    ],
  },
  {
    key: 'support-group',
    label: 'Support',
    items: [
      { key: 'support', label: 'Support Requests', href: '/admin/support' },
      { key: 'contact', label: 'Contact Messages', href: '/admin/support/contact' },
    ],
  },
  {
    key: 'billing-group',
    label: 'Billing & Access',
    items: [
      { key: 'plans', label: 'Plans & Pricing', href: '/admin/plans' },
      { key: 'entitlements', label: 'Feature Entitlements', href: '/admin/entitlements' },
      { key: 'subscriptions', label: 'Subscriptions', href: '/admin/subscriptions' },
      { key: 'invoices', label: 'Billing & Invoices', href: '/admin/billing' },
      { key: 'credits', label: 'Credits & Adjustments', href: '/admin/credits' },
      { key: 'margin', label: 'Revenue & Provider Cost', href: '/admin/billing/margin' },
    ],
  },
  {
    key: 'ops-group',
    label: 'System Operations',
    items: [
      { key: 'modules', label: 'Module Controls', href: '/admin/modules' },
      { key: 'flags', label: 'Feature Flags', href: '/admin/flags' },
      { key: 'usage', label: 'Usage & Costs', href: '/admin/usage' },
      { key: 'health', label: 'System Health', href: '/admin/health' },
      { key: 'activity', label: 'Admin Activity', href: '/admin/activity' },
      { key: 'security', label: 'Security & Access', href: '/admin/security' },
      { key: 'audit', label: 'Audit Logs', href: '/admin/audit-logs' },
    ],
  },
  {
    key: 'settings-group',
    label: 'Settings',
    items: [
      { key: 'settings', label: 'General', href: '/admin/settings' },
      { key: 'settings-billing', label: 'Credits & Billing', href: '/admin/settings/billing' },
      { key: 'settings-notifications', label: 'Notifications', href: '/admin/settings/notifications' },
      { key: 'settings-security', label: 'Security', href: '/admin/settings/security' },
      { key: 'settings-appearance', label: 'Appearance', href: '/admin/settings/appearance' },
    ],
  },
];
