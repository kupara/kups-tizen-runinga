#!/bin/sh
# Installs a logo as the Glass Home app icon (and the phone website's icons).
#
#   scripts/use-logo.sh path/to/logo.png          a square PNG, 1024 x 1024 ideally
#   ICON_SIZE=256 scripts/use-logo.sh logo.png    a different launcher-icon size
#
# Writes (all with sips, macOS's built-in image tool):
#   app/icon.png                           TV launcher icon, 128 x 128 by default
#   app/service/web/apple-touch-icon.png   phone home-screen icon, 180 x 180
#   app/service/web/favicon.png            browser tab icon, 64 x 64
#   assets/logo-current-1024.png           the source, squared, for reference
# Rebuild and reinstall the .wgt afterwards; the TV only reads the icon at install.
#
# Why 128 x 128: Samsung documents no launcher-icon size for an app installed
# in Developer Mode (its 512 x 423 icon is a Seller Office store image, not the
# config.xml icon). Tizen's TV project templates ship a 117 x 117 icon.png, and
# on a 2023 TV running Tizen 8 (an S90C) a developer reported the TV's own
# downscaling of 256 and 512 px icons looked poor, with 128 px the sharpest.
# So the icon is pre-scaled here with a good filter, close to the size the
# TV draws it. Try ICON_SIZE=117 or 256 if it looks soft on this TV.
set -eu

here=$(cd "$(dirname "$0")/.." && pwd)
src=${1:-}
size=${ICON_SIZE:-128}

if [ -z "$src" ] || [ ! -f "$src" ]; then
  echo "usage: $0 path/to/logo.png   (square PNG, 1024x1024 recommended)" >&2
  exit 64
fi
case "$size" in
  ''|*[!0-9]*) echo "ICON_SIZE must be a number of pixels" >&2; exit 64 ;;
esac
if [ "$size" -lt 64 ] || [ "$size" -gt 1024 ]; then
  echo "ICON_SIZE must be between 64 and 1024" >&2
  exit 64
fi

w=$(sips -g pixelWidth "$src" 2>/dev/null | awk '/pixelWidth/ {print $2}')
h=$(sips -g pixelHeight "$src" 2>/dev/null | awk '/pixelHeight/ {print $2}')
if [ -z "$w" ] || [ -z "$h" ]; then
  echo "not an image sips can read: $src" >&2
  exit 65
fi

tmp=$(mktemp -d "${TMPDIR:-/tmp}/use-logo.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

# Square it (centre crop) and normalise to a 1024 x 1024 PNG.
side=$w
[ "$h" -lt "$side" ] && side=$h
if [ "$w" -ne "$h" ]; then
  echo "note: $src is ${w}x${h}; using the centre ${side}x${side} square"
  sips -c "$side" "$side" "$src" --out "$tmp/square.png" >/dev/null
else
  cp "$src" "$tmp/square.png"
fi
if [ "$side" -lt 512 ]; then
  echo "warning: the logo is only ${side}px across; 1024px gives the sharpest icons" >&2
fi
sips -s format png -z 1024 1024 "$tmp/square.png" --out "$tmp/master.png" >/dev/null

mkdir -p "$here/app/service/web" "$here/assets"
sips -s format png -z "$size" "$size" "$tmp/master.png" --out "$here/app/icon.png" >/dev/null
sips -s format png -z 180 180 "$tmp/master.png" --out "$here/app/service/web/apple-touch-icon.png" >/dev/null
sips -s format png -z 64 64 "$tmp/master.png" --out "$here/app/service/web/favicon.png" >/dev/null
cp "$tmp/master.png" "$here/assets/logo-current-1024.png"

for f in app/icon.png app/service/web/apple-touch-icon.png app/service/web/favicon.png assets/logo-current-1024.png; do
  dims=$(sips -g pixelWidth -g pixelHeight "$here/$f" | awk '/pixel/ {printf "%s ", $2}')
  echo "  $f  ${dims% }" | sed 's/ \([0-9]*\)$/x\1/'
done
echo "Done. Rebuild and reinstall the app for the TV to show the new icon."
