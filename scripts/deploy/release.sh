#!/usr/bin/env bash
# Ships the committed HEAD to the production server and builds it there.
# Usage: scripts/deploy/release.sh [ssh-target]   (default root@69.48.207.227)
# Needs the server's deploy key loaded (ssh-agent or ~/.ssh/config).
set -euo pipefail
TARGET="${1:-root@69.48.207.227}"
SHA=$(git rev-parse --short HEAD)
[ -z "$(git status --porcelain)" ] || { echo "Commit or stash your changes first (only committed code is released)."; exit 1; }
TMP=$(mktemp -d)
git archive --format=tar.gz -o "$TMP/release.tar.gz" HEAD
scp "$TMP/release.tar.gz" "$TARGET:/tmp/av-release.tar.gz"
scp "$(dirname "$0")/server-build.sh" "$TARGET:/tmp/av-build.sh"
ssh "$TARGET" "chmod 644 /tmp/av-release.tar.gz && chmod 755 /tmp/av-build.sh && sudo -iu ampliverify bash /tmp/av-build.sh $SHA && rm -f /tmp/av-release.tar.gz /tmp/av-build.sh"
rm -rf "$TMP"
echo "Released $SHA"
