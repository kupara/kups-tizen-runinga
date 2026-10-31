#!/usr/bin/env node
// Unit tests for the service code that reads untrusted bytes from websites:
//   app/service/imageutil.js  sniff()      is a downloaded icon an SVG?
//   app/service/fetcher.js    parsePage()  a page's <title> and <link> icons
// Checks what they find, and that hostile input cannot make them slow. The
// service is a single thread, so a slow parse freezes the phone website and
// the TV app's channel with it. Every timing case runs in its own child
// process that is killed after 10 s, so a regression fails here instead of
// hanging the run.
//   node dev/test-parsers.js
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const SERVICE = path.join(__dirname, '..', 'app', 'service');
const img = require(path.join(SERVICE, 'imageutil.js'));
const fetcher = require(path.join(SERVICE, 'fetcher.js'));

const BASE = 'https://www.example.com/news/today';
const LIMIT_MS = 100;                 // a hostile input must be read well within this
const KILL_MS = 10000;

// Inputs that made the old regular expressions crawl (times measured on this
// Mac with the old code), and other worst cases for the new scanners.
const HOSTILE = {
  'svg: 26 empty comments (old: 2.9 s)': () => img.sniff(Buffer.from('<!---->'.repeat(26) + 'x')),
  'svg: 512-byte window of empty comments (old: years)': () => img.sniff(Buffer.from('<!---->'.repeat(80))),
  'svg: xml declaration, then 70 comments': () => img.sniff(Buffer.from('<?xml version="1.0"?>' + '<!-- -->'.repeat(70))),
  'svg: unclosed comment full of dashes': () => img.sniff(Buffer.from('<!--' + '-'.repeat(600))),
  'svg: "<!---" repeated': () => img.sniff(Buffer.from('<!---'.repeat(110))),
  'page: 66,666 "<link " without ">" (old: 12 s)': () => fetcher.parsePage('<link '.repeat(66666), BASE),
  'page: one 400 KB <link> of letters (old: over 30 s)': () => fetcher.parsePage('<link ' + 'a'.repeat(399990) + '>', BASE),
  'page: one 400 KB <link> of "a-" (old: over 30 s)': () => fetcher.parsePage('<link ' + 'a-'.repeat(199990) + '>', BASE),
  'page: one 400 KB <link> of "a="': () => fetcher.parsePage('<link ' + 'a='.repeat(199990) + '>', BASE),
  'page: one <link> with 400 KB of spaces': () => fetcher.parsePage('<link a' + ' '.repeat(399990) + '>', BASE),
  'page: 66,666 "<title" without ">" (old: 16 s)': () => fetcher.parsePage('<title'.repeat(66666), BASE),
  'page: 57,142 "<title>" without "</title>"': () => fetcher.parsePage('<title>'.repeat(57142), BASE),
  'page: 40,000 unclosed quoted hrefs': () => fetcher.parsePage('<link href="'.repeat(40000), BASE),
  'page: 200 link tags of 2 KB each': () => fetcher.parsePage(('<link rel=icon ' + 'a '.repeat(1000) + 'href=/x.png>').repeat(200), BASE),
  'page: 15,000 complete icon links': () => fetcher.parsePage('<link rel="icon" href="/favicon.ico">'.repeat(15000), BASE)
};

if (process.argv[2] === '--time') {             // child: run one case, print its time
  const fn = HOSTILE[process.argv[3]];
  const t0 = process.hrtime();
  fn();
  const d = process.hrtime(t0);
  process.stdout.write(String(d[0] * 1e3 + d[1] / 1e6));
  process.exit(0);
}

let fails = 0;
let count = 0;
function eq(label, got, want) {
  count++;
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log('FAIL ' + label + ': ' + JSON.stringify(got) + ' != ' + JSON.stringify(want)); }
}

// ---------- SVG detection ----------
const svg = (s) => { const r = img.sniff(Buffer.from(s)); return !!r && r.ext === 'svg'; };
[
  ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>', true],
  ['<svg>', true],
  ['<SVG\n  width="10">', true],
  ['  \n<svg >', true],
  ['﻿<svg>', true],
  ['<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape -->\n\n<svg width="1">', true],
  ['<?xml version="1.0"?><!-- Generator: Adobe Illustrator --><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "svg11.dtd"><svg version="1.1">', true],
  ['<!-- a --> <!-- b --><svg>', true],
  ['<!----><!----><svg>', true],
  ['<!DOCTYPE svg><!-- after the doctype --><svg>', true],
  ['<svgx>', false],
  ['<svg', false],
  ['<!doctype html><html><svg>', false],
  ['<html><body><svg></svg></body></html>', false],
  ['<!-- never closed <svg>', false],
  ['<?xml version="1.0"?><html>', false],
  ['<?xml <svg>', false],
  ['<!-- ' + 'x'.repeat(600) + ' --><svg>', false],     // only the first 512 bytes are looked at
  ['plain text', false]
].forEach(([s, want]) => eq('svg ' + JSON.stringify(s.slice(0, 50)), svg(s), want));
eq('PNG is still a PNG', (img.sniff(Buffer.from('89504e470d0a1a0a0000000d49484452000000200000002008060000', 'hex')) || {}).ext, 'png');

// ---------- page title and icon links ----------
function page(html) { return fetcher.parsePage(html, BASE); }
let p = page('<!doctype html><html><head><meta charset="utf-8"><title>News &amp; Weather</title>' +
  '<link rel="stylesheet" href="/s.css"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">' +
  '<link rel="icon" sizes="192x192" href="/android-chrome-192.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">' +
  '<link rel="manifest" href="/site.webmanifest"><link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5"></head></html>');
eq('typical page: title', p.title, 'News & Weather');
eq('typical page: icons', p.icons, [
  { url: 'https://www.example.com/favicon-32x32.png', size: 32 },
  { url: 'https://www.example.com/android-chrome-192.png', size: 192 },
  { url: 'https://www.example.com/apple-touch-icon.png', size: 180 }]);
eq('typical page: manifest', p.manifests, ['https://www.example.com/site.webmanifest']);
p = page('<HTML><HEAD><TITLE>\n  Shouty   Site\n</TITLE><LINK REL="SHORTCUT ICON" HREF="/FAVICON.ICO"><LINK REL=apple-touch-icon HREF=/touch.png></HEAD>');
eq('upper case tags and bare values', [p.title, p.icons.map((i) => i.url)], ['Shouty Site', ['https://www.example.com/FAVICON.ICO', 'https://www.example.com/touch.png']]);
p = page("<link rel='icon' href='https://cdn.example.net/i.svg?v=2&amp;x=1'/><link href=\"/a.png\" rel=\"icon\" sizes=\"any\"><link rel=icon href=//static.example.org/f.ico>");
eq('quotes, entities, self-closing, attribute order, protocol-relative', p.icons, [
  { url: 'https://cdn.example.net/i.svg?v=2&x=1', size: 170 },
  { url: 'https://www.example.com/a.png', size: 170 },
  { url: 'https://static.example.org/f.ico', size: 16 }]);
eq('newlines and tabs between attributes', page('<link rel="icon"\nhref="/nl.png"\n><link\trel="icon"\thref="/tab.png">').icons.map((i) => i.url),
  ['https://www.example.com/nl.png', 'https://www.example.com/tab.png']);
eq('a ">" inside a quoted value does not end the tag', page('<link rel="icon" href="/a>b.png">').icons.map((i) => i.url), ['https://www.example.com/a%3Eb.png']);
eq('the first of a repeated attribute wins', page('<link rel="icon" href="/first.png" href="/second.png" rel="manifest">').icons.map((i) => i.url), ['https://www.example.com/first.png']);
eq('<linkx> and <link-y> are not links', page('<linkx rel=icon href=/x.png><link-y rel=icon href=/y.png>').icons, []);
eq('largest size in a sizes list', page('<link rel="icon" href="/i.png" sizes="16x16 32x32 64x64">').icons[0].size, 64);
eq('a link tag over 2 KB is skipped, the next one read', page('<link rel=icon href=/long.png ' + 'x'.repeat(2100) + '><link rel=icon href=/short.png>').icons.map((i) => i.url),
  ['https://www.example.com/short.png']);
eq('only the first 200 link tags are read', page('<link rel=preload href=/p.js>'.repeat(200) + '<link rel=icon href=/late.png>').icons, []);
eq('the 200th link tag is still read', page('<link rel=preload href=/p.js>'.repeat(199) + '<link rel=icon href=/late.png>').icons.length, 1);
eq('a link tag inside a quoted value is not a tag', page('<meta content="<link rel=icon href=/fake.png>"><link rel=icon href=/real.png>').icons.length, 2);
eq('empty title skipped, next title used', page('<title></title><title>Second</title>').title, 'Second');
eq('title over 200 characters skipped', page('<title>' + 't'.repeat(201) + '</title>').title, null);
eq('title of exactly 200 characters kept', page('<title>' + 't'.repeat(200) + '</title>').title, 't'.repeat(200));
eq('title with markup inside skipped', page('<title>a <b>b</b></title>').title, null);
eq('<titlebar> is not a title', page('<titlebar>No</titlebar><title>Yes</title>').title, 'Yes');
eq('no title', page('<p>hello</p>').title, null);
const t = fetcher.readTag('<link a=1 B="2" c=\'3\' d e = 5 =f/>', 5, 100);
eq('readTag attributes', Object.assign({}, t.attrs), { a: '1', b: '2', c: '3', d: '', e: '5', '=f': '' });
eq('readTag end', t.end, 33);
eq('readTag gives up at the limit', fetcher.readTag('<link a="' + 'x'.repeat(50) + '">', 5, 30), null);
eq('readTag keeps at most 32 attributes', Object.keys(fetcher.readTag('<link ' + Array.from({ length: 40 }, (_, i) => 'a' + i).join(' ') + '>', 5, 2048).attrs).length, 32);

// ---------- hostile inputs: time-bounded ----------
for (const name of Object.keys(HOSTILE)) {
  count++;
  const r = spawnSync(process.execPath, [__filename, '--time', name], { timeout: KILL_MS, encoding: 'utf8' });
  const ms = Number(r.stdout);
  if (r.error || r.signal || r.status !== 0 || !(ms >= 0)) {
    fails++;
    console.log('FAIL ' + name + ': ' + (r.signal ? 'still running after ' + KILL_MS / 1000 + ' s' : (r.stderr || r.error || 'no result').toString().trim()));
  } else if (ms >= LIMIT_MS) {
    fails++;
    console.log('FAIL ' + name + ': ' + ms.toFixed(1) + ' ms (limit ' + LIMIT_MS + ' ms)');
  } else {
    console.log('  ' + (ms.toFixed(1) + ' ms').padStart(9) + '  ' + name);
  }
}

console.log(count + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
