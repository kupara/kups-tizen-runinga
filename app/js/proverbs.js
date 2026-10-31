/*
 * Kups Home - Swahili proverbs (proverbs/proverbs.json, made by
 * tools/make-proverbs.py).
 *
 * Each new wallpaper brings the next proverb: the topics are taken in order
 * (Abuse, Altertness, Ambition, ...), and from each a random saying. The topic
 * reached is remembered, so the next launch carries on from there.
 *
 * Shown in two places: under the dock on the right (saying, translation), and
 * centred on the screensaver (saying, translation, meaning; html.ambient).
 *
 * Fonts: config.proverbs.dockFont / screensaverFont pick a pairing from
 * css/tv.css (html[data-pf] / html[data-af]). Preview: ?pf=2&af=3 overrides
 * them, ?ambient=1 shows the screensaver at once.
 */
(function () {
  'use strict';
  var GH = window.GH || {};
  var cfg = (GH.config && GH.config.proverbs) || {};
  var Q = GH.query || {};
  var html = document.documentElement;

  html.setAttribute('data-pf', Q.pf || cfg.dockFont || '1');
  html.setAttribute('data-af', Q.af || cfg.screensaverFont || '1');

  // Preview in a desktop browser: the web-font options come from Google Fonts.
  // On the TV only the chosen ones are used, bundled in app/fonts.
  if (GH.config && GH.config.preview) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,600;1,400' +
      '&family=IBM+Plex+Sans+Condensed:wght@400;600&family=Playfair+Display:ital,wght@1,500' +
      '&family=Cormorant+Garamond:ital,wght@0,500;1,600&family=DM+Serif+Display&family=DM+Sans:ital,wght@0,400;1,400&display=swap';
    document.head.appendChild(link);
  }

  var topics = [];
  var shown = false;
  var timer = null;

  function load() {
    if (cfg.enabled === false) return Promise.resolve();
    return GH.request('GET', cfg.file || 'proverbs/proverbs.json', undefined, 8000).then(function (r) {
      var d = r && r.data;
      topics = (d && d.topics || []).filter(function (t) { return t.items && t.items.length; });
    }, function () { topics = []; });
  }

  function pick() {
    if (!topics.length) return null;
    var i = (GH.ls.get('gh.proverb.topic') || 0) % topics.length;
    GH.ls.set('gh.proverb.topic', (i + 1) % topics.length);
    var items = topics[i].items;
    var it = items[Math.floor(Math.random() * items.length)];
    return { topic: topics[i].topic, sw: it[0], en: it[1], more: it[2] || '' };
  }

  function fill(id, p) {
    var box = document.getElementById(id);
    if (!box) return;
    box.querySelector('.pv-sw').textContent = p.sw;
    box.querySelector('.pv-en').textContent = p.en;
    var more = box.querySelector('.pv-more');
    if (more) more.textContent = p.more;
  }

  // Fades both out, swaps the text, fades back in.
  function next() {
    var p = pick();
    if (!p) return;
    var boxes = [document.getElementById('proverb'), document.getElementById('proverb-amb')];
    boxes.forEach(function (b) { if (b) b.classList.remove('on'); });
    clearTimeout(timer);
    timer = setTimeout(function () {
      fill('proverb', p);
      fill('proverb-amb', p);
      boxes.forEach(function (b) { if (b) b.classList.add('on'); });
    }, shown ? 700 : 0);
    shown = true;
  }

  GH.proverbs = { load: load, next: next };
}());
