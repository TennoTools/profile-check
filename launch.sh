#!/usr/bin/env sh
# TennoTools Profile Check - quick launch (Linux / macOS).
# First time only: chmod +x launch.sh

set -u

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  printf '\nNode.js is not installed - it is required to run TennoTools Profile Check.\n\n'
  printf '  1. Download the LTS version from https://nodejs.org\n'
  printf '  2. Install it (the default options are fine)\n'
  printf '  3. Run this script again: ./launch.sh\n\n'
  if [ -z "${TENNOTOOLS_NO_BROWSER:-}" ]; then
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open https://nodejs.org/en/download >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then
      open https://nodejs.org/en/download >/dev/null 2>&1 || true
    fi
  fi
  exit 1
fi

if ! node scripts/launch.mjs; then
  printf '\nSomething went wrong - see the message above.\n'
  exit 1
fi
