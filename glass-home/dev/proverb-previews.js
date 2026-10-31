#!/usr/bin/env node
// Kups Home - screenshots of the proverb font options at 1920 x 1080.
// Needs the dev runner (node dev/run.js). Writes photos/previews/*.png:
//   dock-pf<N>.png          home screen, dock font N
//   screensaver-af<N>.png   screensaver, screensaver font N
//
//   node dev/proverb-previews.js [wallpaper file, e.g. nature-03.jpg]
'use strict';
const path = require('path');
const fs = require('fs');
const { launch } = require('./cdp');

const BASE = 'http://127.0.0.1:18091/index.html?preview=1&still=1';
const OUT = path.join(__dirname, '..', 'photos', 'previews');
const BG = process.argv[2] || 'nature-03.jpg';
// One proverb for every shot, so only the fonts differ.
const P = ['Iliyopita si ndwele, ganga ijayo.', 'That which has passed is not a disease [anymore], cure what is coming.',
  'Stop meditating on past troubles, try to prevent their repetition.'];

const fix = `(() => {
  const p = ${JSON.stringify(P)};
  for (const id of ['proverb', 'proverb-amb']) {
    const b = document.getElementById(id);
    b.querySelector('.pv-sw').textContent = p[0];
    b.querySelector('.pv-en').textContent = p[1];
    const m = b.querySelector('.pv-more'); if (m) m.textContent = p[2];
    b.classList.add('on');
  }
  return document.fonts ? document.fonts.ready.then(() => true) : true;
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  try {
    const page = await browser.newPage({ width: 1920, height: 1080 });
    for (const pf of (process.env.PF || '1,2,3').split(',')) {
      await page.goto(`${BASE}&bg=${BG}&pf=${pf}`, 3500);
      await page.eval(fix);
      await new Promise((r) => setTimeout(r, 900));
      console.log(await page.shot(path.join(OUT, `dock-pf${pf}.png`)));
    }
    for (const af of (process.env.AF || '1,2,3,4').split(',')) {
      await page.goto(`${BASE}&bg=${BG}&af=${af}&idle=800`, 3500);
      await page.eval(fix);
      await new Promise((r) => setTimeout(r, 2600));
      console.log(await page.shot(path.join(OUT, `screensaver-af${af}.png`)));
    }
    if (page.errors.length) console.log('page errors:', page.errors);
  } finally {
    await browser.close();
  }
})();
