#!/bin/sh
# Takes a fresh frame from the iPhone camera (phonecam.py serve must be running)
# and saves it to photos/steps/NAME.jpg, rotated and scaled for reading.
#
#   tools/tvsnap.sh 02-settings            wait 2 s for the TV to settle
#   SETTLE=4 ROT=270 tools/tvsnap.sh name  ROT: 0, 90, 180 or 270 (phone orientation)
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
name=${1:?usage: tvsnap.sh NAME}
out="$here/photos/steps/$name.jpg"
mkdir -p "$here/photos/steps"
python3 -I "$here/tools/phonecam.py" snap "$out" --settle "${SETTLE:-2}" >/dev/null
[ "${ROT:-0}" = 0 ] || sips -r "$ROT" "$out" >/dev/null
sips -Z "${SIZE:-1400}" "$out" >/dev/null
echo "$out"
