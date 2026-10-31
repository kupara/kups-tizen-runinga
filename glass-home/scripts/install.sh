#!/bin/sh
# Installs dist/GlassHome.wgt on the TV (Developer Mode must be on) and opens it.
# Installing over an existing copy keeps your uploaded photos and shortcuts.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
[ -f "$root/scripts/tizen-env.sh" ] || { echo "Copy scripts/tizen-env.example.sh to scripts/tizen-env.sh and fill it in first." >&2; exit 64; }
. "$root/scripts/tizen-env.sh"
command -v tizen >/dev/null || { echo "The Tizen CLI is not on PATH; see docs/INSTALL.md, step 2." >&2; exit 69; }
[ -f "$root/dist/GlassHome.wgt" ] || { echo "Run scripts/build.sh first." >&2; exit 66; }
sdb connect "$TV"
tizen install-permit -s "$TV"
tizen install -s "$TV" -n GlassHome.wgt -- "$root/dist"
tizen run -s "$TV" -p "$APP_ID"
