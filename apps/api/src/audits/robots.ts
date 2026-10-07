/**
 * Minimal robots.txt evaluation (RFC 9309): the group for our user agent,
 * falling back to `*`; the longest matching Allow/Disallow rule wins and
 * Allow wins ties. `*` and `$` wildcards are supported.
 */

export type RobotsRules = { groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[]; sitemaps: string[] };

export function parseRobots(text: string): RobotsRules {
  const groups: RobotsRules['groups'] = [];
  const sitemaps: string[] = [];
  let current: RobotsRules['groups'][number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === 'sitemap') {
      sitemaps.push(value);
    } else if ((field === 'allow' || field === 'disallow') && current) {
      if (field === 'disallow' && value === '') continue;
      current.rules.push({ allow: field === 'allow', path: value });
    }
  }
  return { groups, sitemaps };
}

function toRegex(pattern: string) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function isAllowed(rules: RobotsRules, url: URL, userAgent = 'ampliverifybot') {
  const agent = userAgent.toLowerCase();
  const group =
    rules.groups.find((g) => g.agents.some((a) => a !== '*' && agent.includes(a))) ??
    rules.groups.find((g) => g.agents.includes('*'));
  if (!group) return true;

  const path = `${url.pathname}${url.search}`;
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of group.rules) {
    if (!toRegex(rule.path).test(path)) continue;
    const length = rule.path.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { allow: rule.allow, length };
    }
  }
  return best ? best.allow : true;
}
