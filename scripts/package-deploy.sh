#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/infra/lightsail/build}"
ARCHIVE_NAME="${2:-newsoft-sales-deploy.tgz}"
ARCHIVE_PATH="$OUT_DIR/$ARCHIVE_NAME"

mkdir -p "$OUT_DIR"

tar \
  --exclude='.git' \
  --exclude='.codex' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='npm-debug.log' \
  --exclude='infra/lightsail/.terraform' \
  --exclude='infra/lightsail/.terraform.lock.hcl' \
  --exclude='infra/lightsail/terraform.tfvars' \
  --exclude='infra/lightsail/tfplan' \
  --exclude='infra/lightsail/*.tfstate' \
  --exclude='infra/lightsail/*.tfstate.*' \
  --exclude='infra/lightsail/build' \
  -czf "$ARCHIVE_PATH" \
  -C "$ROOT_DIR" \
  .

sha256sum "$ARCHIVE_PATH" | awk '{print $1}' > "$ARCHIVE_PATH.sha256"

printf '%s\n' "$ARCHIVE_PATH"
