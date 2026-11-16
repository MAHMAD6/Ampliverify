import { promises as fs } from 'fs';
import { join } from 'path';
import { NextResponse, type NextRequest } from 'next/server';
import { getAppContext } from '@/lib/project';
import { publicOrigin } from '@/lib/public-origin';
import { getSession } from '@/lib/session';

/**
 * SEO Editor Studio: serves the approved V13.3 editor (public/seo-editor,
 * unchanged files) for the signed-in user. The page receives only
 * non-secret context (origin, workspace, article key); its API calls go to
 * the same-origin /api/workspaces proxy, which attaches the user's session
 * token server-side, so no token ever reaches the browser.
 */
let template: string | null = null;

async function loadTemplate() {
  if (template && process.env.NODE_ENV === 'production') return template;
  for (const base of [join(process.cwd(), 'public'), join(process.cwd(), 'apps', 'web', 'public')]) {
    try {
      template = await fs.readFile(join(base, 'seo-editor', 'index.html'), 'utf8');
      return template;
    } catch {
      // try the next location
    }
  }
  throw new Error('SEO editor files are missing (public/seo-editor).');
}

const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request.url);
  if (!(await getSession())) {
    const login = new URL('/login', origin);
    login.searchParams.set('next', '/app/seo-editor');
    return NextResponse.redirect(login);
  }
  const ctx = await getAppContext();
  const wanted = request.nextUrl.searchParams.get('workspace');
  const workspace = ctx.workspaces.find((w) => w.id === wanted) ?? ctx.workspaces.find((w) => w.id === ctx.workspaceId) ?? ctx.workspaces[0];
  if (!workspace) return NextResponse.redirect(new URL('/app/getting-started', origin));
  const article = request.nextUrl.searchParams.get('article');
  const articleKey = article && /^[a-zA-Z0-9_-]{3,100}$/.test(article) ? article : null;

  const context = {
    apiBaseUrl: origin,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaces: ctx.workspaces.map((w) => ({ id: w.id, name: w.name })),
    articleKey,
    // The browser never holds the API token: the same-origin proxy adds it. This marker only tells the editor it is signed in.
    accessToken: 'session',
    production: true,
    appUrl: origin,
  };

  let html = await loadTemplate();
  // Asset paths point at the unchanged editor files; images become absolute so articles stay portable.
  html = html.replace(/(href|src)="(?!https?:|\/|#|data:|mailto:)([^"]+\.(?:css|js))"/g, '$1="/seo-editor/$2"');
  html = html.replace(/(src|href)="assets\//g, `$1="${origin}/seo-editor/assets/`);
  html = html.replace(/<title>[^<]*<\/title>/, '<title>SEO Editor · AmpliVerify</title>');
  html = html.replace('<head>', `<head>\n  <link rel="icon" href="/seo-editor/assets/ampliverify-approved-icon.png">\n  <script>globalThis.AMPLIVERIFY_CONTEXT=${json(context)};</script>`);
  html = html.replace('</body>', '<script src="/seo-editor/studio-host.js"></script>\n</body>');

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' },
  });
}
