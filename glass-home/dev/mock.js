// Glass Home - preview mock of the TV's installed apps (served by dev/run.js
// at /dev/mock.js, never packaged). Icons are left out (name tiles);
// on the TV each app's own icon is used where config.js allows.
(function () {
  'use strict';
  // Plain name tiles only: no imitation logos are drawn here.
  var names = ['TizenBrewNextGeneration', 'Apple TV', 'YouTube', 'HBO Max', 'Netflix', 'Prime Video', 'Samsung TV Plus',
    'Disney+', 'NPO Start', 'Spotify - Music and Podcasts', 'Internet'];
  window.GH_MOCK = {
    apps: names.map(function (n) { return { id: 'mock.' + n.replace(/[^A-Za-z]/g, ''), name: n, iconPath: null }; })
  };
}());
