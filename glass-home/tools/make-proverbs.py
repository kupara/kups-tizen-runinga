#!/usr/bin/env python3
"""Turns a Swahili proverbs JSON file into app/proverbs/proverbs.json.

  python3 -I tools/make-proverbs.py ~/Downloads/swahili_proverbs_cleaned.json

Input: a list of {topic, number, swahili_saying, description}. Output: the
topics in their original order, each with its proverbs as
[swahili, translation, meaning] (meaning may be ""):

  {"topics": [{"topic": "Abuse", "items": [["Achekaye ...", "One who ...", "A warning ..."], ...]}, ...]}

The home screen shows the saying and its translation on one line each under
the dock; the screensaver also shows the meaning.

Cleaning: source references after a saying ("KS jino.", "EM j22.", "B 4.68;")
are removed; the English is the first sentence of the description (the
translation), plus the explanation that follows when the two together stay
short; word glosses ("Lawama: reproach, ...") are left out. Proverbs whose
text is still too long for one or two lines on the TV are skipped.
"""
import json
import re
import sys

MAX_SW = 90      # characters: one line under the dock
MAX_EN = 110     # the translation: one line under the dock
MAX_MORE = 170   # the meaning, screensaver only

# A citation starts after the saying's last punctuation: an all-caps source
# code (KS, EM, AL, NESTOR, B, F...) or "al", then anything.
CITATION = re.compile(r"(?<=[.!?,;])\s+(?:[A-Z]{1,7}(?=[\s\d,;.]|$)|al\s)[\s\S]*$")
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[\"'\[(]?[A-Z])")
GLOSS = re.compile(r"^[\w'-]+(?:\s*\([^)]*\))?\s*:")
# A sentence that is a reference, not text: digits ("p.79", "1973", "MARA 3")
# or a semicolon list ("Humpona; MARA 3.").
REFERENCE = re.compile(r"\d|;")


def clean_swahili(s):
    s = " ".join(s.split())
    s = CITATION.sub("", s).strip()
    # Drop trailing reference sentences ("Kiswahili March 1973, p.79.").
    parts = SENTENCE.split(s)
    while len(parts) > 1 and REFERENCE.search(parts[-1]):
        parts.pop()
    s = " ".join(parts)
    s = re.sub(r"[,;]+$", "", s)
    s = re.sub(r"\.{2,}$", ".", s)
    if s and s[-1] not in ".!?":
        s += "."
    return s


# Source codes in descriptions: "NGU.", "SPK.", "- JKP", "MARA 3".
CODE = re.compile(r"\b(?!I\b|A\b)[A-Z]{2,}\b")


def clean_english(s):
    parts = [p.strip() for p in SENTENCE.split(" ".join(s.split())) if p.strip()]
    keep = []
    i = 0
    while i < len(parts):
        p = parts[i]
        nxt = parts[i + 1] if i + 1 < len(parts) else ""
        # "Kipofu haulizwi njia. NGU." is a Swahili variant and its source.
        if re.match(r"^[A-Z]{2,}\s*\.?$", nxt):
            i += 2
            continue
        p = re.sub(r"\s*-\s*[A-Z]{2,}\s*\.?$", ".", p)       # quote attribution
        p = re.sub(r'^"(.*)"\.?$', r"\1", p).replace('"', "")
        p = re.sub(r"\.{2,}$", ".", p).strip()
        if GLOSS.match(p) or REFERENCE.search(p) or CODE.search(p):
            if keep:
                break
            i += 1
            continue
        keep.append(p)
        i += 1
    if not keep:
        return "", ""
    # A one-word first "sentence" is a gloss heading, not a translation.
    if len(keep[0]) < 15 and len(keep) > 1:
        keep = keep[1:]
    more = ""
    for p in keep[1:]:
        if len(more) + 1 + len(p) > MAX_MORE:
            break
        more = (more + " " + p).strip()
    more = re.sub(r"\s*Cf\.$", "", more)
    return dot(keep[0]), dot(more) if more else ""


def dot(s):
    return s if not s or s[-1] in ".!?" else s + "."


def main(src, dest):
    data = json.load(open(src, encoding="utf-8"))
    topics, order = {}, []
    kept = skipped = 0
    for it in data:
        sw = clean_swahili(it.get("swahili_saying", ""))
        en, more = clean_english(it.get("description", ""))
        # Digits or source codes left in a saying are OCR noise ("matak0",
        # "KS cha."): skip it rather than show it.
        if (not sw or not en or len(sw) > MAX_SW or len(en) > MAX_EN
                or re.search(r"\d", sw) or CODE.search(sw)):
            skipped += 1
            continue
        t = " ".join(it.get("topic", "").split()) or "Other"
        if t not in topics:
            topics[t] = []
            order.append(t)
        topics[t].append([sw, en, more])
        kept += 1
    out = {"source": src.rsplit("/", 1)[-1],
           "topics": [{"topic": t, "items": topics[t]} for t in order]}
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("%d proverbs in %d topics (%d skipped as too long or empty) -> %s"
          % (kept, len(order), skipped, dest))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    import os
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(root, "app", "proverbs"), exist_ok=True)
    main(sys.argv[1], os.path.join(root, "app", "proverbs", "proverbs.json"))
