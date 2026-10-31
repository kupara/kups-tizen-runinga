# Copy to scripts/tizen-env.sh (git-ignored) and fill in the first block.
# The build and install scripts read it; you can also `source` it in a shell.

# ---- your setup ------------------------------------------------------------
export TV_IP=192.168.1.50                 # your TV's address on the home network
export PROFILE=GlassHome                  # name for your Samsung signing profile
export SKILLS="$HOME/tizen-agent-skills/tizen-sdk-skills"   # git clone of Samsung/tizen-agent-skills
export DUID=                              # your TV's device ID (docs/INSTALL.md, step 5)

# ---- usually left as is ----------------------------------------------------
export TIZEN_HOME="$HOME/tizen-studio"
if [ -f "$TIZEN_HOME/sdk.info" ]; then
  TIZEN_DATA="$(sed -n 's/^TIZEN_SDK_DATA_PATH=//p' "$TIZEN_HOME/sdk.info")"
  export TIZEN_DATA
fi
export TIZEN_DATA="${TIZEN_DATA:-$HOME/tizen-studio-data}"
export PATH="$TIZEN_HOME/tools:$TIZEN_HOME/tools/ide/bin:$PATH"
export TV="$TV_IP:26101"
export CERTCLI="$SKILLS/common/lib/cli/cert-manager-cli.js"
export CA_DIR="$SKILLS/common/assets/samsung-tv-ca"
export CERT_DIR="$TIZEN_DATA/keystore/samsung/$PROFILE"
export APP_ID=GlassHome1.GlassHome
