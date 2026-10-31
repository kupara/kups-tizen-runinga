#!/bin/sh
# Adds this Mac's own macOS wallpapers to the TV's wallpaper rotation.
#
#   tools/add-mac-wallpapers.sh                 the aerial (video) wallpapers you downloaded
#   tools/add-mac-wallpapers.sh --stills        ...plus the still wallpapers built into macOS
#   tools/add-mac-wallpapers.sh Golden Sonoma   only names containing one of these words
#   tools/add-mac-wallpapers.sh --list          show what is available, change nothing
#   tools/add-mac-wallpapers.sh --remove        take them all out again
#
# Aerials download when you pick them once in System Settings > Wallpaper;
# run this again afterwards. Each aerial becomes a SECONDS-long (default 60)
# 1920x1080 H.264 clip, macos-<name>.mp4, with a poster frame macos-<name>.jpg;
# a still becomes a 1920x1080 JPEG (centre crop). All are listed in
# app/wallpapers/manifest.json, mixed in with the bundled photos.
# They are Apple's images: fine on your own TV, but keep them out of anything
# you share (the files are git-ignored). Rebuild and reinstall afterwards.
# Needs ffmpeg for the aerials (brew install ffmpeg).
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
dest="$here/app/wallpapers"
manifest="$dest/manifest.json"
aerials="$HOME/Library/Application Support/com.apple.wallpaper/aerials"
SECONDS_LONG="${SECONDS_LONG:-60}"

stills=0; list=0; remove=0
for a in "$@"; do
  case "$a" in
    --stills) stills=1 ;; --list) list=1 ;; --remove) remove=1 ;;
  esac
done
words=""
for a in "$@"; do case "$a" in --*) ;; *) words="$words$a
" ;; esac; done

wanted() {   # name -> 0 if no words were given or the name contains one
  [ -z "$words" ] && return 0
  printf '%s' "$words" | while IFS= read -r w; do
    case "$1" in *"$w"*) exit 3 ;; esac
  done
  [ $? = 3 ]
}

slug() { printf '%s' "$1" | tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//'; }

# "path<TAB>name" for each downloaded aerial video, named from Apple's manifest.
aerial_list() {
  [ -d "$aerials/videos" ] || return 0
  python3 -I - "$aerials/manifest/entries.json" "$aerials/videos" <<'PY'
import json, os, sys
names = {}
try:
    for a in json.load(open(sys.argv[1])).get("assets", []):
        names[a.get("id", "").upper()] = a.get("accessibilityLabel") or a.get("id")
except Exception:
    pass
for f in sorted(os.listdir(sys.argv[2])):
    if f.lower().endswith(".mov"):
        print("%s\t%s" % (os.path.join(sys.argv[2], f), names.get(f[:-4].upper(), f[:-4])))
PY
}

still_list() {
  { find "/System/Library/Desktop Pictures" -maxdepth 3 -name '*.heic' \
      ! -path '*/.thumbnails/*' ! -name '*Thumbnail*' 2>/dev/null
    find /System/Library/AssetsV2 -path '*DesktopPicture*' -name '*.heic' 2>/dev/null
  } | sort -u | while IFS= read -r f; do printf '%s\t%s\n' "$f" "$(basename "$f" .heic)"; done
}

update_manifest() {   # $1: file with "file<TAB>title<TAB>poster<TAB>seconds" lines
  python3 -I - "$manifest" "$1" <<'PY'
import json, sys
path, added = sys.argv[1], sys.argv[2]
items = [w for w in json.load(open(path)) if not w.get("file", "").startswith("macos-")]
for line in open(added):
    f, title, poster, secs = line.rstrip("\n").split("\t")
    w = {"file": f, "title": title, "author": "Apple", "licence": "macOS wallpaper", "source": "this Mac"}
    if poster:
        w.update({"video": True, "poster": poster, "seconds": int(secs)})
    items.append(w)
with open(path, "w") as out:
    json.dump(items, out, indent=2, ensure_ascii=False)
    out.write("\n")
PY
}

if [ "$remove" = 1 ]; then
  rm -f "$dest"/macos-*.jpg "$dest"/macos-*.mp4
  empty=$(mktemp); update_manifest "$empty"; rm -f "$empty"
  echo "Removed the macOS wallpapers."; exit 0
fi

if [ "$list" = 1 ]; then
  echo "Aerials (downloaded):"; aerial_list | while IFS="$(printf '\t')" read -r f n; do
    printf '  %-28s %s s\n' "$n" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" | cut -d. -f1)"; done
  echo "Stills (built in, used with --stills):"; still_list | while IFS="$(printf '\t')" read -r f n; do printf '  %s\n' "$n"; done
  exit 0
fi

added=$(mktemp)
trap 'rm -f "$added"' EXIT
rm -f "$dest"/macos-*.jpg "$dest"/macos-*.mp4

if aerial_list | grep -q .; then command -v ffmpeg >/dev/null || { echo "ffmpeg is needed for the aerials: brew install ffmpeg" >&2; exit 69; }; fi
aerial_list | while IFS="$(printf '\t')" read -r f name; do
  wanted "$name" || continue
  s=$(slug "$name")
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" | cut -d. -f1)
  len=$SECONDS_LONG; [ "$dur" -lt "$len" ] && len=$dur
  start=$(( (dur - len) * 3 / 10 ))                     # a third of the way in
  ffmpeg -v error -y -nostdin -ss "$start" -t "$len" -i "$f" -an \
    -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p" \
    -c:v libx264 -profile:v high -level 4.1 -preset slow -crf 23 -maxrate 6M -bufsize 12M \
    -movflags +faststart "$dest/macos-$s.mp4"
  ffmpeg -v error -y -nostdin -i "$dest/macos-$s.mp4" -frames:v 1 -q:v 3 "$dest/macos-$s.jpg"
  printf 'macos-%s.mp4\t%s\tmacos-%s.jpg\t%s\n' "$s" "$name" "$s" "$len" >> "$added"
  echo "  aerial: $name ($len s, $(du -h "$dest/macos-$s.mp4" | cut -f1))"
done

if [ "$stills" = 1 ]; then
  still_list | while IFS="$(printf '\t')" read -r f name; do
    wanted "$name" || continue
    w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/ {print $2}')
    [ "${w:-0}" -ge 1920 ] || continue
    s=$(slug "$name")
    out="$dest/macos-$s.jpg"
    sips -s format jpeg -s formatOptions 85 --resampleWidth 1920 "$f" --out "$out" >/dev/null
    h=$(sips -g pixelHeight "$out" | awk '/pixelHeight/ {print $2}')
    [ "$h" -gt 1080 ] && sips -c 1080 1920 "$out" >/dev/null
    printf 'macos-%s.jpg\t%s\t\t0\n' "$s" "$name" >> "$added"
    echo "  still: $name"
  done
fi

update_manifest "$added"
echo "Added $(wc -l < "$added" | tr -d ' ') macOS wallpapers. Rebuild and reinstall to see them on the TV."
