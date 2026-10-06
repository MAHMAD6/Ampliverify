/**
 * Locked user navigation (docs/design/navigation-batch1: order, page map and
 * Settings submenu). Routes follow the page map under the `/app` prefix.
 * Icons are resolved by key in the Sidebar component.
 */
export type NavChild = { label: string; href: string };
export type NavItem = { key: string; label: string; href: string; children?: NavChild[]; divider?: boolean };

export const APP_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
  { key: 'projects', label: 'My Projects', href: '/app/projects' },
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
  { key: 'reports', label: 'Reports', href: '/app/reports' },
  { key: 'usage', label: 'Usage & Credits', href: '/app/usage', divider: true },
  { key: 'billing', label: 'Billing & Plan', href: '/app/billing' },
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
];

/** Breadcrumb trail for user-app secondary pages: Home › section › page. */
export function appCrumbs(...trail: { label: string; href?: string }[]) {
  return [{ label: 'Dashboard', href: '/app/dashboard', home: true }, ...trail];
}

/**
 * Super Admin navigation: collapsible groups from the admin redesign (chat
 * images 2026-10-06; docs/INPUTS.md). Older content items (categories,
 * authors, videos, events, case studies) remain routable but are not listed.
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
      { key: 'resources', label: 'Resources', href: '/admin/resources' },
      { key: 'media', label: 'Media Library', href: '/admin/media' },
      { key: 'careers', label: 'Careers / Job Openings', href: '/admin/careers' },
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
      { key: 'settings-notifications', label: 'Notifications', href: '/admin/settings/notifications' },
      { key: 'settings-security', label: 'Security', href: '/admin/settings/security' },
      { key: 'settings-appearance', label: 'Appearance', href: '/admin/settings/appearance' },
    ],
  },
];
