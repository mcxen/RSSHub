#!/bin/zsh
set -euo pipefail

REPO_PATH="${RSSHUB_REPO_PATH:-$(cd "$(dirname "$0")/../.." && pwd)}"
LOG_DIR="${HOME}/Library/Logs/RSSHub"

mkdir -p "${LOG_DIR}"
cd "${REPO_PATH}"

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp ".env.example" ".env"
fi

if [ ! -f "dist/index.mjs" ]; then
    pnpm build
fi

exec node dist/index.mjs
