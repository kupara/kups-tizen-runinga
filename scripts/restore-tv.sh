#!/bin/sh
# Puts the Samsung M7 back the way it was before 2026-10-29 (see
# backup/CHANGES.md), or Runinga (TV_IP=192.168.178.228) the way it was
# before 2026-10-30 (backup/runinga/CHANGES.md). Drives the monitor's remote-control API, photographs each
# screen with the iPhone camera (tools/phonecam.py serve must be running and
# the phone pointed at the monitor), and asks before every change is saved.
#
#   scripts/restore-tv.sh            undo everything that can be undone remotely
#   scripts/restore-tv.sh --dry-run  walk every step, then cancel instead of saving
#   STEPS="dns" scripts/restore-tv.sh   only some steps: dns privacy glasshome
#   TV_IP=192.168.178.228 scripts/restore-tv.sh   Runinga (Kups Home and DNS only)
#
# Start with the monitor showing Smart Hub (press Home on the remote).
# The rest (TV Plus consent, TV Plus tile, the advertising ID) is printed at
# the end as remote-control steps: those screens are too different from
# visit to visit to drive blind.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
export TV_IP="${TV_IP:-192.168.178.95}"
SDB="${SDB:-$HOME/tizen-sdb/sdb}"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
# Runinga's privacy boxes were already off, and its General menu has one more
# entry above Network.
if [ "$TV_IP" = 192.168.178.228 ]; then
  STEPS="${STEPS:-glasshome dns}"; NET_DOWN=3
else
  STEPS="${STEPS:-glasshome dns privacy}"; NET_DOWN=2
fi

key() { python3 -I "$here/tools/tvremote.py" --note "restore" key "$@" >/dev/null; }
snap() { SETTLE="${2:-1.5}" "$here/tools/tvsnap.sh" "restore-$1"; }

# Shows the photo of the screen about to be saved, then saves (ENTER) on a
# "y", or backs out without saving otherwise (and always in --dry-run).
commit() {
  photo=$(snap "$1")
  open "$photo" 2>/dev/null || true
  printf '%s\n  Photo: %s\n' "$2" "$photo"
  if [ "$DRY" = 1 ]; then
    echo "  (dry run: backing out)"; key RETURN; sleep 1; key EXIT; sleep 1.5; return
  fi
  printf '  Save this? [y/N] '
  read -r answer
  case "$answer" in
    y|Y) key ENTER; sleep 3; snap "$1-after" >/dev/null; echo "  saved" ;;
    *) echo "  skipped"; key RETURN; sleep 1; key EXIT; sleep 1.5 ;;
  esac
}

has() { case " $STEPS " in *" $1 "*) return 0 ;; esac; return 1; }

if has glasshome; then
  echo "== Kups Home (package GlassHome1): uninstall, which also deletes its uploaded photos"
  if "$SDB" connect "$TV_IP:26101" >/dev/null 2>&1 && \
     "$SDB" -s "$TV_IP:26101" shell 0 applist 2>/dev/null | grep -q GlassHome1; then
    if [ "$DRY" = 1 ]; then echo "  (dry run: would uninstall GlassHome1.GlassHome)"
    else
      printf '  Uninstall Kups Home? [y/N] '; read -r answer
      case "$answer" in
        y|Y) "$HOME/tizen-studio/tools/ide/bin/tizen" uninstall -s "$TV_IP:26101" -p GlassHome1.GlassHome ;;
        *) echo "  skipped" ;;
      esac
    fi
  else
    echo "  not installed (or Developer Mode is off: Apps > App Settings > Kups Home > Delete)"
  fi
fi

if has dns; then
  echo "== DNS: back to Get automatically (the ISP's DNS)"
  key MENU; sleep 2.5
  key 'DOWN*3' RIGHT; sleep 1.5           # General
  key "DOWN*$NET_DOWN" ENTER; sleep 1.5    # Network
  key ENTER; sleep 6                      # Network Status (runs a test)
  key 'LEFT*2' ENTER; sleep 2             # IP Settings
  key DOWN ENTER; sleep 1                 # DNS setting
  key UP ENTER; sleep 1                   # Get automatically
  key 'DOWN*2'; sleep 1                   # OK
  commit dns "Check: DNS setting says 'Get automatically' and OK is highlighted."
  [ "$DRY" = 1 ] || { key ENTER; sleep 1.5; key EXIT; sleep 1.5; }   # close Network Status
fi

if has privacy; then
  echo "== Privacy: tick Viewing Information Services and interest-based ads again"
  key MENU; sleep 2.5
  key 'DOWN*5' RIGHT; sleep 1.5           # Terms & Privacy
  key ENTER; sleep 6                      # Privacy Choices
  key ENTER; sleep 5                      # Terms & Conditions, Privacy Policy
  key ENTER; sleep 1                      # "Ik ga akkoord met alles" ticks both
  key DOWN; sleep 1                       # OK
  commit privacy "Check: both boxes ticked and OK is highlighted."
  [ "$DRY" = 1 ] || { key EXIT; sleep 1.5; }
fi

if [ "$TV_IP" = 192.168.178.228 ]; then
  echo
  echo "== Runinga, by hand (remote), if you want them back too"
  echo "- TV Plus tracking: Settings > Terms & Privacy > Privacy Choices >"
  echo "  Samsung TV Plus Privacy Settings > Configure > Allow All."
  echo "- Advertising ID (PSID): can't be restored; nothing depends on the old one."
  echo "- Developer Mode: Apps > 1 2 3 4 5 > Developer mode Off, restart."
  exit 0
fi

cat <<'EOF'

== By hand (remote), if you want them back too
- TV Plus tracking: Settings > Terms & Privacy > Privacy Choices >
  Samsung TV Plus Privacy Settings > Configure > Allow All.
- TV Plus on the Home row: open Samsung TV Plus (Source button, or the Apps
  tab), then highlight it on the Home row's left and Add to Home.
- Advertising ID (PSID): can't be restored; nothing depends on the old one.
- Kups Home's Home-row tile goes away with the app. Nothing else to undo:
  Autorun Smart Hub was already off and Autorun Last App already on before.
- Developer Mode: Apps > App Settings > 1 2 3 4 5 > Developer mode Off, restart.
EOF
