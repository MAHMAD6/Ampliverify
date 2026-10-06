/**
 * Locked user navigation order (docs/design/user-app/sidebar-navigation.png).
 * Icons are resolved by key in the Sidebar component.
 */
export type NavChild = { label: string; href: string };
export type NavItem = { key: string; label: string; href: string; children?: NavChild[]; divider?: boolean };

export const APP_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/app' },
  {
    key: 'projects',
    label: 'My Projects',
    href: '/app/projects',
    children: [
      { label: 'All Projects', href: '/app/projects' },
      { label: 'Add Project', href: '/app/projects/new' },
    ],
  },
  { key: 'audit', label: 'On-Page SEO Audit', href: '/app/audit' },
  { key: 'optimization', label: 'Optimization Center', href: '/app/optimization' },
  { key: 'editor', label: 'On-Page SEO Editor', href: '/app/editor' },
  { key: 'content', label: 'Content Strategy', href: '/app/content-strategy' },
  {
    key: 'keywords',
    label: 'Keyword Research',
    href: '/app/keywords',
    children: [
      { label: 'Keyword Explorer', href: '/app/keywords' },
      { label: 'Related Keywords', href: '/app/keywords/related' },
      { label: 'Questions', href: '/app/keywords/questions' },
      { label: 'Competitor Keywords', href: '/app/keywords/competitors' },
      { label: 'SERP Analysis', href: '/app/keywords/serp' },
      { label: 'Keyword Lists', href: '/app/keywords/lists' },
    ],
  },
  {
    key: 'geo',
    label: 'AI Search (GEO)',
    href: '/app/geo',
    children: [{ label: 'Monitoring', href: '/app/geo' }],
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
      { label: 'Data & Privacy', href: '/app/settings/data-privacy' },
    ],
  },
];

/** Super Admin navigation, from the approved admin shell (docs/design/admin-batch*). */
export const ADMIN_NAV: { section?: string; items: { key: string; label: string; href: string }[] }[] = [
  { items: [{ key: 'command', label: 'Command Center', href: '/admin' }] },
  {
    section: 'User Management',
    items: [
      { key: 'users', label: 'All Users', href: '/admin/users' },
      { key: 'admins', label: 'Admins', href: '/admin/admins' },
      { key: 'sub-admins', label: 'Sub-Admins', href: '/admin/sub-admins' },
      { key: 'roles', label: 'Roles & Permissions', href: '/admin/roles' },
      { key: 'access', label: 'Access Assignments', href: '/admin/access' },
    ],
  },
  {
    section: 'Content Management',
    items: [
      { key: 'content', label: 'Content Overview', href: '/admin/content' },
      { key: 'blog', label: 'Blog Posts', href: '/admin/blog' },
      { key: 'categories', label: 'Categories & Tags', href: '/admin/categories' },
      { key: 'authors', label: 'Authors', href: '/admin/authors' },
      { key: 'videos', label: 'Videos', href: '/admin/videos' },
      { key: 'events', label: 'Webinars & Events', href: '/admin/events' },
      { key: 'resources', label: 'Resources & Downloads', href: '/admin/resources' },
      { key: 'case-studies', label: 'Case Studies', href: '/admin/case-studies' },
      { key: 'media', label: 'Media Library', href: '/admin/media' },
      { key: 'careers', label: 'Careers / Job Openings', href: '/admin/careers' },
    ],
  },
  {
    section: 'Billing & Access',
    items: [
      { key: 'plans', label: 'Plans & Pricing', href: '/admin/plans' },
      { key: 'entitlements', label: 'Feature Entitlements', href: '/admin/entitlements' },
      { key: 'subscriptions', label: 'Subscriptions', href: '/admin/subscriptions' },
      { key: 'invoices', label: 'Billing & Invoices', href: '/admin/billing' },
      { key: 'credits', label: 'Credits & Adjustments', href: '/admin/credits' },
    ],
  },
  {
    section: 'System Operations',
    items: [
      { key: 'modules', label: 'Module Controls', href: '/admin/modules' },
      { key: 'flags', label: 'Feature Flags', href: '/admin/flags' },
      { key: 'usage', label: 'Usage & Costs', href: '/admin/usage' },
      { key: 'health', label: 'System Health', href: '/admin/health' },
      { key: 'activity', label: 'Admin Activity', href: '/admin/activity' },
      { key: 'security', label: 'Security & Access', href: '/admin/security' },
      { key: 'settings', label: 'Settings', href: '/admin/settings' },
    ],
  },
];
