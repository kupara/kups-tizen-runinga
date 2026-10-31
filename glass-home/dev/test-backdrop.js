#!/usr/bin/env node
// Unit tests for the photo rotation logic in app/js/backdrop.js (no browser:
// the DOM bits are stubbed, only the choice of the next photo is tested).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'backdrop.js'), 'utf8');
let fails = 0;
let count = 0;
function ok(label, cond, detail) { count++; if (!cond) { fails++; console.log('FAIL ' + label + (detail !== undefined ? ' ' + JSON.stringify(detail) : '')); } }

function load(store) {
  const window = { GH: { ls: { get: (k) => store[k] || null, set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); } } } };
  const ctx = vm.createContext({ window, Math, Date, JSON, setTimeout: () => 0, clearTimeout: () => {}, Promise, Image: function () {}, requestAnimationFrame: () => 0 });
  vm.runInContext(src, ctx);
  return window.GH.Backdrop;
}

function items(n, prefix, extra) { return Array.from({ length: n }, (_, i) => Object.assign({ key: prefix + i, url: prefix + i + '.jpg', credit: '' }, extra || {})); }
function walk(b, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const it = b._pick(); out.push(it && it.key); b.current = it; if (it) b._markSeen(it.key); }
  return out;
}

{ // same order all day, every photo once before any repeats
  const store = {};
  const B = load(store);
  const b = new B({}, {}, {});
  b.setPhotos(items(12, 'w:'));
  const seq = walk(b, 12);
  ok('12 picks cover all 12 photos', new Set(seq).size === 12, seq);
  const b2 = new (load({}))({}, {}, {});
  b2.seed = b.seed;
  b2.setPhotos(items(12, 'w:').reverse());
  ok('order does not depend on list order (same launch seed)', JSON.stringify(walk(b2, 12)) === JSON.stringify(seq));
  const firsts = new Set();
  for (let i = 0; i < 20; i++) {
    const bi = new (load({}))({}, {}, {});
    bi.setPhotos(items(12, 'w:'));
    firsts.add(bi._pick().key);
  }
  ok('each launch starts on a random photo', firsts.size > 3, [...firsts]);
  const next = walk(b, 12);
  ok('the next cycle shows all 12 again, never the same photo twice in a row', next[0] !== seq[11] && new Set(next).size === 12, next);
}

{ // the cycle continues across an app restart on the same day
  const store = {};
  const B = load(store);
  const b = new B({}, {}, {});
  b.setPhotos(items(10, 'w:'));
  const first = walk(b, 4);
  const b2 = new (load(store))({}, {}, {});
  b2.setPhotos(items(10, 'w:'));
  const rest = walk(b2, 6);
  ok('after a restart the remaining photos come next', new Set(first.concat(rest)).size === 10, { first, rest });
}

{ // new uploads jump the queue
  const B = load({});
  const b = new B({}, {}, {});
  b.setPhotos(items(8, 'w:').concat(items(3, 'u:', { user: true })));
  walk(b, 2);
  b.setPhotos(items(8, 'w:').concat(items(3, 'u:', { user: true })).concat([{ key: 'u:new', url: 'n.jpg', user: true, fresh: true }]));
  ok('a fresh upload is shown next', b._pick().key === 'u:new');
  b.setPhotos(items(8, 'w:').concat(items(3, 'u:', { user: true })).concat([{ key: 'u:new', url: 'n.jpg', user: true, fresh: true }]));
  ok('a fresh upload is not queued twice', b.fresh.indexOf('u:new') < 0);
}

{ // failures are skipped, then retried after 10 minutes
  const B = load({});
  const b = new B({}, {}, {});
  b.setPhotos(items(3, 'w:'));
  b._ensureOrder();
  const victim = b.order[0];
  b.bad[victim] = Date.now();
  ok('a failed photo is skipped', b._pick().key !== victim);
  b.bad[victim] = Date.now() - 11 * 60 * 1000;
  ok('and retried after 10 minutes', b._isBad(victim) === false);
}

{ // one photo only: nothing else to pick
  const B = load({});
  const b = new B({}, {}, {});
  b.setPhotos(items(1, 'w:'));
  const a = b._pick();
  b.current = a; b._markSeen(a.key);
  ok('with a single photo there is no next photo', b._pick() === null);
}

console.log(count + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
