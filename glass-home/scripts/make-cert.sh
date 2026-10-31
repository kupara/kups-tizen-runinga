#!/bin/sh
# One-time setup of the free Samsung certificate for this TV (docs/INSTALL.md,
# steps 3 and 6). Opens a Samsung account sign-in in your browser and waits up
# to 5 minutes for it; the second certificate reuses that sign-in.
#
# Writes:
#   ~/.glass-home-secrets/cert-password.env       random certificate password (0600)
#   ~/tizen-studio-data/keystore/samsung/GlassHome/  author.p12, distributor.p12
#   macOS Keychain: two "certificate-manager" items
# Back up author.p12 and the password file: updates must be signed with them.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
. "$root/scripts/tizen-env.sh"

echo "== Pointing Samsung's certificate tool at ~/tizen-studio"
node "$SKILLS/common/lib/cli/sdk-init-cli.js" "$TIZEN_HOME"

secrets="$HOME/.glass-home-secrets"
mkdir -p "$secrets" && chmod 700 "$secrets"
if [ ! -f "$secrets/cert-password.env" ]; then
  (umask 077; printf 'TIZEN_CERTIFICATE_PASSWORD=%sAa1\n' \
    "$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-20)" > "$secrets/cert-password.env")
fi

# The author certificate is made once and kept: every later install, on any
# TV, must be signed with the same one or the TV refuses it as an update.
if [ -f "$CERT_DIR/author.p12" ]; then
  echo "== Keeping the existing author certificate"
else
  echo "== Author certificate: sign in to your Samsung account in the browser that opens"
  node "$CERTCLI" generate-samsung-author --profile-name "$PROFILE" --identity "Glass Home" \
    --country NL --password-file "$secrets/cert-password.env"
fi

echo "== Distributor certificate for these TVs ($DUID): sign in again if asked"
# The tool never overwrites a certificate: move the old one aside first.
if [ -f "$CERT_DIR/distributor.p12" ]; then
  old="$root/backup/distributor-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$old"
  mv "$CERT_DIR"/distributor.* "$old"/; echo "   (old one moved to $old)"
fi
node "$CERTCLI" generate-samsung-distributor --profile-name "$PROFILE" --duid-list "$DUID" \
  --privilege Public --password-file "$secrets/cert-password.env"

echo "== Registering the profile with the tizen command"
cp "$CA_DIR/vd_tizen_dev_public2.crt" "$CERT_DIR/"
PW="$(sed -n 's/^TIZEN_CERTIFICATE_PASSWORD=//p' "$secrets/cert-password.env")"
tizen security-profiles remove -n "$PROFILE" >/dev/null 2>&1 || true
tizen security-profiles add -n "$PROFILE" -A -a "$CERT_DIR/author.p12" -p "$PW" \
  -d "$CERT_DIR/distributor.p12" -dp "$PW" -dc "$CERT_DIR/vd_tizen_dev_public2.crt"
unset PW
tizen cli-config "profiles.path=$TIZEN_DATA/profile/profiles.xml"
tizen security-profiles list
echo "Done. Certificates are in $CERT_DIR"
