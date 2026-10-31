// Glass Home - preview mock of the TV's installed apps (served by dev/run.js
// at /dev/mock.js, never packaged). Icons are left out (name tiles);
// on the TV each app's own icon is used where config.js allows.
(function () {
  'use strict';
  // Plain name tiles only: no imitation logos are drawn here.
  // The six apps the UI tests expect; config.js lists more, and the ones not
  // installed here are left out of the dock.
  var names = ['YouTube', 'HBO Max', 'Netflix', 'Prime Video', 'Disney+', 'Internet'];
  window.GH_MOCK = {
    apps: names.map(function (n) { return { id: 'mock.' + n.replace(/[^A-Za-z]/g, ''), name: n, iconPath: null }; })
  };
}());
