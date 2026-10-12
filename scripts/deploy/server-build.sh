#!/usr/bin/env bash
# Runs as the ampliverify user: unpack, install, build, migrate, start/restart with pm2.
set -euo pipefail
SHA="$1"
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
R="$HOME/releases/$SHA"
rm -rf "$R"; mkdir -p "$R"
tar -xzf /tmp/av-release.tar.gz -C "$R"
cd "$R"
ln -sf "$HOME/shared/api.env" apps/api/.env
ln -sf "$HOME/shared/web.env" apps/web/.env
echo "== install"; npm ci --no-audit --no-fund 2>&1 | tail -2
echo "== prisma"; (cd apps/api && npx prisma generate >/dev/null && npx prisma migrate deploy 2>&1 | tail -1)
echo "== auth schema"; (cd apps/web && npm run auth:migrate 2>&1 | tail -1)
echo "== build api"; npm run build --workspace apps/api 2>&1 | tail -1
echo "== build web"; (set -a; . "$HOME/shared/web.env"; set +a; npm run build --workspace apps/web 2>&1 | grep -E "Compiled|error|Error" | head -5)
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
cp -r apps/web/public apps/web/.next/standalone/apps/web/public
cat > "$HOME/ecosystem.config.cjs" <<ECO
module.exports = {
  apps: [
    { name: 'ampliverify-api', cwd: '$HOME/app/apps/api', script: 'dist/main.js', node_args: '--env-file=$HOME/shared/api.env', max_memory_restart: '700M', out_file: '$HOME/logs/api.out.log', error_file: '$HOME/logs/api.err.log', time: true },
    { name: 'ampliverify-web', cwd: '$HOME/app/apps/web/.next/standalone/apps/web', script: 'server.js', node_args: '--env-file=$HOME/shared/web.env', max_memory_restart: '700M', out_file: '$HOME/logs/web.out.log', error_file: '$HOME/logs/web.err.log', time: true },
  ],
};
ECO
ln -sfn "$R" "$HOME/app"
pm2 startOrReload "$HOME/ecosystem.config.cjs" --update-env 2>&1 | tail -2
pm2 save >/dev/null
# Keep the three newest releases.
ls -1dt "$HOME"/releases/* | tail -n +4 | xargs -r rm -rf
sleep 6
pm2 ls
curl -s -o /dev/null -w "api health %{http_code}\n" http://127.0.0.1:4021/api/v1/health
curl -s -o /dev/null -w "web home %{http_code}\n" http://127.0.0.1:3021/
