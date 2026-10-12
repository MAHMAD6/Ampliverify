# Production deployment

AmpliVerify runs on the same server as amplivanta.com (`69.48.207.227`, Ubuntu 24.04), next to the other sites, without Docker.

| Piece | Where |
|---|---|
| Linux user | `ampliverify` (Node 22 via nvm, pm2) |
| Web (Next.js standalone) | `127.0.0.1:3021`, pm2 app `ampliverify-web` |
| API + job worker (NestJS) | `127.0.0.1:4021`, pm2 app `ampliverify-api` |
| Databases | PostgreSQL 16 on the host: `ampliverify` (app) and `ampliverify_auth` (Better Auth), role `ampliverify` |
| Config / secrets | `/home/ampliverify/shared/api.env`, `/home/ampliverify/shared/web.env` (mode 600; generated on first setup) |
| Uploaded files | `/home/ampliverify/shared/storage` |
| Releases | `/home/ampliverify/releases/<sha>`; `/home/ampliverify/app` points at the live one (three kept) |
| Logs | `/home/ampliverify/logs/*.log`, `pm2 logs` as the `ampliverify` user |
| Start on boot | `pm2-ampliverify.service` |
| HTTPS | Caddy (`/etc/caddy/Caddyfile`): `ampliverify.com` → web; `/api/v1/webhooks/stripe` → API; `www.ampliverify.com` redirects |

## DNS

In Cloudflare (the domain's nameservers), add `A ampliverify.com → 69.48.207.227` and `A www → 69.48.207.227`. Caddy obtains the certificates automatically once they resolve. With the Cloudflare proxy on, set SSL/TLS to **Full (strict)**.

## Releasing

From a clean checkout of the commit to release:

```bash
scripts/deploy/release.sh
```

It uploads `git archive HEAD`, then on the server installs dependencies, applies Prisma and Better Auth migrations, builds, switches `app` to the new release and reloads pm2 with zero downtime, and checks `/api/v1/health` and the home page.

## Provider keys

Fill the empty keys in the two env files (Resend, Stripe, Anthropic/OpenAI/Gemini/Perplexity, DataForSEO, PageSpeed, Google OAuth), then as the `ampliverify` user run `pm2 restart all --update-env`. Without `RESEND_API_KEY` no verification email is sent, so nobody can finish signing up.

## First Super Admin

After the first account is verified, run `apps/api/scripts/bootstrap-super-admin.sql` against the `ampliverify` database with that account's Better Auth user id (see README).
