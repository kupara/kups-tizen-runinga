// Glass Home service - brings Glass Home back when an app opened from its dock closes.
// Node 4 to 12 API (Tizen 5.5 TVs run Node 4).
//
// Samsung TVs have no "return to the app that opened me": a closed app leaves the
// TV on Live TV with Samsung's Home bar. The TV app is paused while another app is
// in front, so this service watches instead, through the TV's local API on port
// 8001 (the one phone remotes use; it answers loopback without pairing).
//
// The watch arms once the app has been visible (TznTube, for one, is not visible
// until YouTube is up, so its debug restart never counts as closing). Once the
// app has stopped being visible for GONE_MS, Glass Home is opened again, unless
// Glass Home or another dock app is already in front, or another dock app is
// starting (the user switched apps from Samsung's Home bar). The API can't tell
// Back-to-exit from the Home button, so both return to Glass Home.
'use strict';
var http = require('http');

var POLL_MS = 500;
var GONE_MS = 1000;
var ARM_TIMEOUT_MS = 90000;   // the app never showed: stop watching

function appStatus(id, cb) {
  var done = false;
  function finish(v) { if (!done) { done = true; cb(v); } }
  var req = http.get({ host: '127.0.0.1', port: 8001, path: '/api/v2/applications/' + encodeURIComponent(id) }, function (res) {
    var body = '';
    res.setEncoding('utf8');
    res.on('data', function (c) { if (body.length < 4096) body += c; });
    res.on('end', function () {
      try {
        var j = JSON.parse(body);
        finish({ ok: res.statusCode === 200, running: j.running === true, visible: j.visible === true });
      } catch (e) { finish({ ok: false }); }
    });
  });
  req.setTimeout(2500, function () { req.abort(); });   // setTimeout: Node 4 ignores a `timeout` option
  req.on('error', function () { finish({ ok: false }); });
}

function statuses(ids, cb) {
  var out = {};
  var left = ids.length;
  if (!left) return cb(out);
  ids.forEach(function (id) {
    appStatus(id, function (s) { out[id] = s; if (--left === 0) cb(out); });
  });
}

// Ways to bring Glass Home to the front, tried in order until the TV reports it
// visible. tizen.application.launch only brought a hidden Glass Home forward on
// Runinga; on the M7 monitor, which closes Glass Home while another app runs, it may
// not start a closed one. The TV's API answers 401 to a launch from 127.0.0.1, so it
// is also asked on the TV's own LAN addresses.
function lanAddresses() {
  var out = [];
  try {
    var ifs = require('os').networkInterfaces();
    Object.keys(ifs).forEach(function (n) {
      (ifs[n] || []).forEach(function (a) { if (a.family === 'IPv4' && !a.internal) out.push(a.address); });
    });
  } catch (e) { /* none */ }
  return out;
}

function launchViaApi(host, id, cb) {
  var req = http.request({ method: 'POST', host: host, port: 8001, path: '/api/v2/applications/' + encodeURIComponent(id) }, function (res) {
    res.resume();
    cb(res.statusCode === 200 ? null : new Error('HTTP ' + res.statusCode));
  });
  req.setTimeout(5000, function () { req.abort(); });
  req.on('error', function (e) { cb(e); });
  req.end();
}

function launchMethods(id) {
  var tz = typeof tizen !== 'undefined' ? tizen : null;
  var list = [];
  if (tz && tz.application) {
    list.push({ name: 'tizen.launch', run: function (cb) {
      tz.application.launch(id, function () { cb(null); }, function (e) { cb(e || new Error('failed')); });
    } });
    if (tz.ApplicationControl) list.push({ name: 'tizen.appcontrol', run: function (cb) {
      tz.application.launchAppControl(new tz.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, null),
        id, function () { cb(null); }, function (e) { cb(e || new Error('failed')); });
    } });
  }
  lanAddresses().concat(['127.0.0.1']).forEach(function (host) {
    list.push({ name: 'api@' + host, run: function (cb) { launchViaApi(host, id, cb); } });
  });
  return list;
}

function createReturner(logFn) {
  var w = null;   // the current watch
  var history = [];   // recent lines, for the TV app's service info
  function log(m) {
    history.push(new Date().toISOString().substr(11, 8) + ' ' + m);
    if (history.length > 20) history.shift();
    logFn(m);
  }

  function stop(why) {
    if (!w) return;
    clearTimeout(w.timer);
    log('return-home: stop watching ' + w.id + ' (' + why + ')');
    w = null;
  }

  // Tries each method until the TV reports `self` visible (checked for up to 6 s after
  // each), so a launch that reports success but shows nothing falls through too.
  function bringBack(self, methods) {
    var m = methods.shift();
    if (!m) return log('return-home: could not open ' + self);
    var next = function (why) { log('return-home: ' + m.name + ' ' + why); bringBack(self, methods); };
    try {
      m.run(function (e) {
        if (e) return next('failed: ' + (e.message || e.name || e));
        var until = Date.now() + 6000;
        (function check() {
          appStatus(self, function (st) {
            if (st.ok && st.visible) return log('return-home: opened via ' + m.name);
            if (Date.now() > until) return next('reported success but nothing showed');
            setTimeout(check, 500);
          });
        })();
      });
    } catch (e) { next('threw: ' + (e.message || e)); }
  }

  function decide(cur) {
    var ids = [cur.self].concat(cur.others);
    statuses(ids, function (st) {
      if (w !== cur) return;
      if (st[cur.self] && st[cur.self].visible) return stop('Glass Home is in front');
      for (var i = 0; i < cur.others.length; i++) {
        var o = cur.others[i];
        var s = st[o];
        if (!s || !s.ok) continue;
        if (s.visible) return stop(o + ' is in front');
        if (s.running && !cur.wasRunning[o]) return stop(o + ' is starting');
      }
      log('return-home: ' + cur.id + ' closed, opening ' + cur.self);
      w = null;
      bringBack(cur.self, launchMethods(cur.self));
    });
  }

  function tick(cur) {
    statuses(cur.ids, function (st) {
      if (w !== cur) return;
      var now = Date.now();
      // The app counts as on screen if any of its IDs is (only one is known to the API).
      var visible = cur.ids.some(function (i) { return st[i] && st[i].ok && st[i].visible; });
      if (visible) {
        if (!cur.armed) {
          cur.armed = true;
          // Which other dock apps are running now, so a newly started one can be told apart.
          statuses(cur.others, function (st) {
            for (var k in st) cur.wasRunning[k] = !!(st[k] && st[k].running);
          });
        }
        cur.goneSince = 0;
      } else if (!cur.armed) {
        if (now - cur.started > ARM_TIMEOUT_MS) return stop('never shown');
      } else {
        if (!cur.goneSince) cur.goneSince = now;
        else if (now - cur.goneSince >= GONE_MS) return decide(cur);
      }
      cur.timer = setTimeout(function () { tick(cur); }, POLL_MS);
    });
  }

  // ids: the IDs the app just opened may go by; self: Glass Home's app id;
  // others: the other dock apps' IDs.
  function watch(ids, self, others) {
    ids = [].concat(ids);
    stop('a new app was opened');
    w = { id: ids[0], ids: ids, self: self, others: others.filter(function (o) { return ids.indexOf(o) < 0 && o !== self; }),
          started: Date.now(), armed: false, goneSince: 0, wasRunning: {}, timer: null };
    log('return-home: watching ' + ids.join(' / '));
    tick(w);
  }

  return { watch: watch, stop: stop, history: function () { return history.slice(); } };
}

module.exports = { createReturner: createReturner };
