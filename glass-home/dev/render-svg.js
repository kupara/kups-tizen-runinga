#!/usr/bin/env node
// Renders an SVG file to a PNG at a given square size with headless Brave.
//   node dev/render-svg.js in.svg out.png [size]
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('./cdp.js');
const [inFile, outFile, sizeArg] = process.argv.slice(2);
const size = Number(sizeArg || 1024);
(async () => {
  const b = await launch();
  try {
    const p = await b.newPage({ width: size, height: size });
    const svg = fs.readFileSync(inFile, 'utf8');
    const html = '<!doctype html><html><body style="margin:0;background:#000">' +
      '<img style="display:block;width:' + size + 'px;height:' + size + 'px" src="data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') + '"></body></html>';
    await p.goto('data:text/html;base64,' + Buffer.from(html).toString('base64'), 800);
    await p.shot(outFile);
    console.log(outFile);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
