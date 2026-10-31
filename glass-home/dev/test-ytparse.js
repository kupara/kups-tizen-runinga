#!/usr/bin/env node
// Unit tests for app/js/ytparse.js.  Run: node dev/test-ytparse.js
'use strict';
var path = require('path');
var yt = require(path.join(__dirname, '..', 'app', 'js', 'ytparse.js'));

var ID = 'dQw4w9WgXcQ';
var PL = 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI';
var cases = [
  // [input, videoId, playlistId, start]
  [ID, ID, null, 0],
  ['https://www.youtube.com/watch?v=' + ID, ID, null, 0],
  ['https://www.youtube.com/watch?v=' + ID + '&t=90', ID, null, 90],
  ['https://www.youtube.com/watch?v=' + ID + '&t=90s', ID, null, 90],
  ['https://www.youtube.com/watch?v=' + ID + '&t=1m30s', ID, null, 90],
  ['https://www.youtube.com/watch?v=' + ID + '&t=1h2m3s', ID, null, 3723],
  ['https://www.youtube.com/watch?v=' + ID + '&t=2:03', ID, null, 123],
  ['youtube.com/watch?v=' + ID, ID, null, 0],
  ['www.youtube.com/watch?app=desktop&v=' + ID, ID, null, 0],
  ['https://m.youtube.com/watch?v=' + ID + '&feature=share', ID, null, 0],
  ['https://youtu.be/' + ID, ID, null, 0],
  ['https://youtu.be/' + ID + '?si=AbCdEfGh123&t=42', ID, null, 42],
  ['youtu.be/' + ID, ID, null, 0],
  ['https://www.youtube.com/shorts/' + ID, ID, null, 0],
  ['https://youtube.com/shorts/' + ID + '?si=xyz', ID, null, 0],
  ['https://www.youtube.com/live/' + ID + '?si=xyz', ID, null, 0],
  ['https://www.youtube.com/embed/' + ID + '?start=30', ID, null, 30],
  ['https://www.youtube-nocookie.com/embed/' + ID, ID, null, 0],
  ['https://www.youtube.com/v/' + ID, ID, null, 0],
  ['https://www.youtube.com/e/' + ID, ID, null, 0],
  ['https://www.youtube.com/tv#/watch?v=' + ID, ID, null, 0],
  ['https://www.youtube.com/#!v=' + ID, ID, null, 0],
  ['https://www.youtube.com/attribution_link?a=x&u=%2Fwatch%3Fv%3D' + ID + '%26feature%3Dshare', ID, null, 0],
  ['https://www.youtube.com/watch?v=' + ID + '&list=' + PL, ID, PL, 0],
  ['https://www.youtube.com/watch?v=' + ID + '&list=' + PL + '&index=3&t=15', ID, PL, 15],
  ['https://www.youtube.com/playlist?list=' + PL, null, PL, 0],
  ['https://www.youtube.com/embed/videoseries?list=' + PL, null, PL, 0],
  ['https://music.youtube.com/watch?v=' + ID + '&list=RDAMVM' + ID, ID, 'RDAMVM' + ID, 0],
  ['https://music.youtube.com/playlist?list=OLAK5uy_kXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', null, 'OLAK5uy_kXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 0],
  [PL, null, PL, 0],
  ['  https://youtu.be/' + ID + '  ', ID, null, 0],
  ['http://www.youtube.com/watch?v=' + ID + '#t=1m', ID, null, 60],
  // Not YouTube videos: website shortcuts instead.
  ['https://www.youtube.com/@SomeChannel', null, null, null],
  ['https://www.youtube.com/channel/UC1234567890abcdefghij', null, null, null],
  ['https://www.youtube.com/results?search_query=cats', null, null, null],
  ['https://vimeo.com/123456789', null, null, null],
  ['https://notyoutube.com/watch?v=' + ID, null, null, null],
  ['https://www.youtube.com/watch?v=short', null, null, null],
  ['https://youtube.com.evil.example/watch?v=' + ID, null, null, null],
  ['', null, null, null],
  ['javascript:alert(1)', null, null, null],
  ['https://www.youtube.com/watch?constructor=1&v=' + ID, ID, null, 0]
];

var fails = 0;
cases.forEach(function (c, i) {
  var got = yt.parse(c[0]);
  var ok;
  if (c[1] === null && c[2] === null) ok = got === null;
  else ok = got && got.videoId === c[1] && got.playlistId === c[2] && got.start === c[3];
  if (!ok) {
    fails++;
    console.log('FAIL #' + i + ' ' + JSON.stringify(c[0]) + ' -> ' + JSON.stringify(got));
  }
});

// launchValue / canonicalUrl / formatStart
function eq(a, b, label) {
  if (a !== b) { fails++; console.log('FAIL ' + label + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
}
eq(yt.launchValue({ videoId: ID, playlistId: null, start: 0 }), 'v=' + ID, 'launchValue video');
eq(yt.launchValue({ videoId: ID, playlistId: PL, start: 90 }), 'v=' + ID + '&list=' + PL + '&t=90', 'launchValue full');
eq(yt.launchValue({ videoId: null, playlistId: PL, start: 0 }), 'list=' + PL, 'launchValue list');
eq(yt.canonicalUrl({ videoId: ID, playlistId: null, start: 42 }), 'https://www.youtube.com/watch?v=' + ID + '&t=42s', 'canonical video');
eq(yt.canonicalUrl({ videoId: null, playlistId: PL, start: 0 }), 'https://www.youtube.com/playlist?list=' + PL, 'canonical list');
eq(yt.formatStart(90), '1:30', 'formatStart 90');
eq(yt.formatStart(3723), '1:02:03', 'formatStart 3723');

console.log((cases.length + 7) + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
