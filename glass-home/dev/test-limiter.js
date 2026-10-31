#!/usr/bin/env node
// Unit tests for the sign-in throttle in app/service/auth.js (auth.Limiter):
// the fair check queue (a burst of wrong guesses from one address can neither
// fill the queue nor keep another address out), plus the per-address lockout
// and global slowdown it must keep. Checks are held "in flight" until the test
// lets them finish, so every case is exact. (dev/test-api.sh does the same
// over HTTP with real requests from 127.0.0.1 and ::1.)
//   node dev/test-limiter.js
'use strict';
const path = require('path');
const auth = require(path.join(__dirname, '..', 'app', 'service', 'auth.js'));

let fails = 0;
let count = 0;
function eq(label, got, want) {
  count++;
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log('FAIL ' + label + ': ' + JSON.stringify(got) + ' != ' + JSON.stringify(want)); }
}
const tick = () => new Promise((r) => setImmediate(r));

// One sign-in attempt from `ip`: queued with L.serial, it records `outcome`
// ('fail' or 'ok') when finish() is called. Tracks how many checks run at once.
let running = 0;
let maxRunning = 0;
const order = [];
function attempt(L, ip, outcome) {
  let release;
  const gate = new Promise((r) => { release = r; });
  const a = { ip, state: 'waiting', reason: null, finish: () => release() };
  a.done = L.serial(ip, () => {
    a.state = 'running';
    order.push(ip);
    running++;
    maxRunning = Math.max(maxRunning, running);
    return gate.then(() => {
      running--;
      if (outcome === 'fail') L.fail(ip);
      if (outcome === 'ok') L.success(ip);
      if (outcome === 'throw') throw new Error('boom');
      a.state = 'done';
    });
  }).catch((e) => {
    if (e && e.code === 'BUSY') { a.state = 'refused'; a.reason = e.reason; } else a.state = 'threw';
  });
  return a;
}
const states = (list) => list.map((a) => a.state);
const refusedBy = (list) => list.filter((a) => a.state === 'refused').map((a) => a.reason);

(async () => {
  { // A burst from one address takes only `perIp` places; another address still gets in.
    const L = new auth.Limiter({ maxQueue: 20 });
    const burst = Array.from({ length: 25 }, () => attempt(L, '192.168.1.66', 'fail'));
    await tick();
    eq('burst of 25 from one address: 2 queued', L.queued, 2);
    eq('burst: the other 23 refused at once as busy', refusedBy(burst), Array(23).fill('address-busy'));
    const owner = attempt(L, '192.168.1.17', 'ok');
    await tick();
    eq('the owner gets a place during the burst', owner.state !== 'refused', true);
    eq('queue holds 3 checks', L.queued, 3);
    burst[0].finish(); await tick(); await tick();
    burst[1].finish(); await tick(); await tick();
    eq('the owner is checked right after the 2 queued guesses', [owner.state, order.slice(-3)], ['running', ['192.168.1.66', '192.168.1.66', '192.168.1.17']]);
    owner.finish(); await owner.done;
    eq('every place is given back', [L.queued, L.inflight.size], [0, 0]);
    eq('one check at a time', maxRunning, 1);
  }

  { // An address never has more checks pending than tries left before a lockout.
    const L = new auth.Limiter({ failures: 5 });
    for (let i = 0; i < 4; i++) L.fail('10.0.0.5');
    const a = attempt(L, '10.0.0.5', 'fail');
    const b = attempt(L, '10.0.0.5', 'fail');
    await tick();
    eq('4 failures: one more check queued, the next refused', [a.state, b.state, b.reason], ['running', 'refused', 'address-limit']);
    a.finish(); await a.done;
    eq('fifth failure locks the address', L.status('10.0.0.5').locked, true);
    const c = attempt(L, '10.0.0.5', 'ok');
    await tick();
    eq('a locked address is refused before it takes a place', [c.state, c.reason, L.queued], ['refused', 'address-limit', 0]);
  }

  { // The last place is kept for an address with nothing queued and no recent failure.
    const L = new auth.Limiter({ maxQueue: 6, perIp: 2, reserve: 1 });
    const held = [attempt(L, 'a1', 'fail'), attempt(L, 'a1', 'fail'), attempt(L, 'a2', 'fail'), attempt(L, 'a2', 'fail'), attempt(L, 'a3', 'fail')];
    await tick();
    eq('5 of 6 places taken by 3 addresses', [L.queued, refusedBy(held)], [5, []]);
    const a3again = attempt(L, 'a3', 'fail');
    L.fail('f1');
    const failedBefore = attempt(L, 'f1', 'fail');
    await tick();
    eq('last place refused to an address already queued', [a3again.state, a3again.reason], ['refused', 'queue-reserved']);
    eq('last place refused to an address with a recent wrong password', [failedBefore.state, failedBefore.reason], ['refused', 'queue-reserved']);
    const owner = attempt(L, 'owner', 'ok');
    await tick();
    eq('last place given to a new address', [owner.state === 'refused', L.queued], [false, 6]);
    const late = attempt(L, 'other', 'ok');
    await tick();
    eq('queue full: refused', [late.state, late.reason], ['refused', 'queue-full']);
    held.concat([owner]).forEach((a) => a.finish());
    await Promise.all(held.concat([owner]).map((a) => a.done));
    eq('every place is given back', [L.queued, L.inflight.size], [0, 0]);
  }

  { // A check that throws still gives its place back.
    const L = new auth.Limiter();
    const a = attempt(L, '10.0.0.9', 'throw');
    await tick();
    a.finish(); await a.done;
    eq('a check that throws frees its place', [a.state, L.queued, L.inflight.size], ['threw', 0, 0]);
  }

  { // Lockout and global slowdown are unchanged.
    const L = new auth.Limiter({ failures: 5, lockMs: 300000, globalStepMs: 400, globalMaxMs: 8000 });
    const r = [1, 2, 3, 4, 5].map(() => L.fail('10.1.1.1'));
    eq('failures 1-4 report the tries left', r.slice(0, 4).map((x) => x.remaining), [4, 3, 2, 1]);
    eq('fifth failure locks for 5 minutes', [r[4].locked, r[4].retryAfter], [true, 300]);
    eq('status while locked', L.status('10.1.1.1').locked, true);
    eq('another address is not locked', L.status('10.1.1.2'), { locked: false, remaining: 5 });
    eq('global slowdown after 5 failures: 1.2 s', L.globalDelay(), 1200);
    for (let i = 0; i < 30; i++) L.fail('10.1.2.' + i);
    eq('global slowdown is capped at 8 s', L.globalDelay(), 8000);
    L.fail('10.1.1.3');
    L.success('10.1.1.3');
    eq('a right password clears that address', L.status('10.1.1.3'), { locked: false, remaining: 5 });
  }

  { // Addresses that never get a password wrong take no memory.
    const L = new auth.Limiter();
    for (let i = 0; i < 1000; i++) { L.status('10.2.' + (i >> 8) + '.' + (i & 255)); L.admit('10.3.' + (i >> 8) + '.' + (i & 255)); }
    eq('status()/admit() store nothing', L.byIp.size, 0);
  }

  console.log(count + ' checks, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
