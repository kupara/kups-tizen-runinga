#!/bin/sh
# Writes a fresh random key to app/js/local-key.js (shared by the TV app and
# its service). It is generated per checkout and never committed (.gitignore),
# so no two installs share a key. Rebuild and reinstall the .wgt afterwards.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
key=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+\$/,''))")
cat > "$here/app/js/local-key.js" <<JS
// Glass Home - shared secret between this app and its own photo service.
// The service only answers its TV-only endpoints (/local/*, and photos without
// a website sign-in) for loopback callers that present this key. The file is
// inside the installed package and is never served over the network.
// Regenerate with: dev/new-local-key.sh (then rebuild and reinstall).
window.GH_LOCAL_KEY = '$key';
JS
echo "new key written to app/js/local-key.js"
