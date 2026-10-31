/*
 * Glass Home - settings.
 *
 * Preview mode (a desktop browser, or ?preview=1 on the TV) uses a mock app
 * list and talks to the dev runner (node dev/run.js) instead of the TV service.
 *
 * Dock apps: each is resolved at start-up, first by the Tizen app IDs listed
 * (fast and exact), then by a case-insensitive name match over all installed
 * apps. Names are compared lower-case with "+" read as " plus" and other
 * punctuation removed, so "Disney+" is "disney plus". If the wrong app is
 * picked on the TV, put its exact Tizen app ID first in `ids`.
 */
(function () {
  'use strict';
  var q = {};
  String(location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf('=');
    try {
      q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
    } catch (e) { /* ignore malformed */ }
  });
  var preview = typeof window.tizen === 'undefined' || q.preview === '1';

  window.GH = window.GH || {};
  window.GH.query = q;
  window.GH.config = {
    preview: preview,
    // The photo/shortcut service in this package (app id <packageId>.Photos).
    serviceName: 'Photos',
    serviceBase: q.api || (preview ? 'http://127.0.0.1:18090' : 'http://127.0.0.1:8090'),
    // false: no photo website, so no + tile, shortcuts or uploaded photos; only
    // the bundled photos and the dock apps. For TVs that can't run the service
    // (2018 models have Node 4); also remove <tizen:service> and the
    // web.service feature from config.xml.
    photoService: true,

    // true on older TVs where apps won't start from the dock (on a 2018 TV
    // Netflix stayed black and Prime Video crashed): apps with a `storeId` are
    // opened through Samsung's own launcher (the TV's local API on port 8001,
    // as Smart Hub and phone remotes use), and the photos are hidden while an
    // app starts to free graphics memory. Falls back to the normal launch if
    // the launcher refuses. Off by default: not needed or tested on newer TVs.
    smartHubLaunch: false,

    // true: when an app, website or YouTube shortcut opened from the dock is
    // closed, Glass Home comes back to the front instead of Samsung's Home bar
    // over Live TV. The photo service watches the app (service/returner.js) and
    // can't tell Back-to-exit from the Home button, so both come back here.
    // Needs photoService.
    returnHome: true,

    photoIntervalMs: 45000,
    fadeMs: 1600,
    kenBurnsScale: 1.06,
    clockEveryMs: 15000,
    pollEveryMs: 20000,
    longPressMs: 700,
    // Date and time format, e.g. 'en-AU', 'en-GB', 'en-US'. Empty: the TV's own.
    locale: 'en-GB',

    // How YouTube shortcuts are handed to the YouTube app. 'uri' sends
    // https://www.youtube.com/watch?v=...; 'payload' is Samsung's Smart Hub
    // deep-link form; 'both' sends both. Switchable on the TV under + (bottom
    // row). Tested on a 2023 Samsung on Tizen 8: 'payload' only worked while
    // YouTube was already running (from a fresh start YouTube showed "Who's
    // watching?" and dropped the video); 'uri' worked in both cases.
    youtubeMode: 'uri',

    // Weather under the clock (js/weather.js), from Open-Meteo (free, no key).
    // Off until you set your location. Find coordinates with
    // https://geocoding-api.open-meteo.com/v1/search?name=YOUR+TOWN
    weather: {
      enabled: true,
      place: 'Amsterdam',        // label under the forecast, e.g. 'Springfield'
      latitude: 52.3676,
      longitude: 4.9041,
      timezone: 'Europe/Amsterdam',   // or an IANA name such as 'Europe/London'
      temperatureUnit: 'celsius',   // or 'fahrenheit'
      refreshMs: 30 * 60 * 1000
    },

    // Swahili proverbs (js/proverbs.js): under the dock and on the screensaver,
    // a new one with each wallpaper, topic by topic. Fonts: see "proverbs" in
    // css/tv.css; 1 = the TV's own font, 2 = Inter (dock), 4 = DM Serif
    // Display + DM Sans italic (screensaver).
    proverbs: { enabled: true, file: 'proverbs/proverbs.json', dockFont: '2', screensaverFont: '4' },

    // Screensaver (js/ambient.js): only the photos after this long idle.
    ambient: { enabled: true, afterMs: 3 * 60 * 1000 },

    // Evening dimming of the photos, by the TV's clock (24-hour).
    night: { enabled: true, from: '20:00', to: '06:00' },

    // The dock's apps, in order. Each is found at start-up by the Tizen app IDs
    // listed (list yours with `sdb shell 0 vd_applist` in Developer Mode), then
    // by name. Remove entries you don't have; add others the same way. The
    // RN1MCdNq8t / evKhCgZelL IDs are Netflix and Prime Video on 2017-2018 TVs.
    // `storeId`: the Samsung store ID (`app_id` in vd_applist), used only with
    // smartHubLaunch.
    // `apiIds`: the IDs the TV's local API (port 8001) knows the app by, so
    // returnHome can tell when it closes. Store apps are known there by their
    // store ID (`app_id` in vd_applist), not their Tizen ID; sideloaded apps by
    // their Tizen ID. Store IDs are the same on every TV; these were checked against
    // both Runinga's and the M7 monitor's API on 2026-10-30.
    // `icon`: a path under app/ to use your own image, or false for a plain
    // glass tile with the app's name. Some apps report a poor icon to other
    // apps (YouTube reports its Cobalt engine's pinwheel, Prime Video's may not
    // load, Samsung TV Plus is a system app), so those default to name tiles.
    // This monitor's Home row, in its order (Samsung TV Plus left out on purpose).
    apps: [
      // TznTube: a small launcher that opens TizenTube in TizenBrew directly.
      { key: 'tzntube', label: 'uTube', ids: ['TznTube000.TznTube'],
        names: ['^utube$', '^tzntube$'], icon: 'img/apps/tzntube.png' },
      { key: 'appletv', label: 'Apple TV', apiIds: ['3201807016597'], ids: ['com.samsung.tv.aria-video'],
        names: ['^apple tv$'], icon: 'img/apps/appletv.png' },
      { key: 'youtube', label: 'YouTube', storeId: '111299001912', apiIds: ['111299001912'], ids: ['9Ur5IzDKqV.TizenYouTube', 'com.samsung.tv.cobalt-yt'],
        names: ['^youtube$'], icon: 'img/apps/youtube.png' },
      { key: 'hbomax', label: 'HBO Max', apiIds: ['3202311033168', '3201601007230'], ids: ['fjpfQryJuR.HBOMaxCTV', 'cj37Ni3qXM.HBONow'],
        names: ['^hbo max$', '^max$'] },
      { key: 'netflix', label: 'Netflix', storeId: '11101200001', apiIds: ['3201907018807'], ids: ['org.tizen.netflix-app', 'RN1MCdNq8t.Netflix'],
        names: ['^netflix$', '\\bnetflix\\b'], icon: 'img/apps/netflix.png' },
      { key: 'prime', label: 'Prime Video', storeId: '3201512006785', apiIds: ['3201910019365'], ids: ['org.tizen.primevideo', 'org.tizen.ignition', 'evKhCgZelL.AmazonIgnitionLauncher2'],
        names: ['^prime video$', '^amazon prime video$', '\\bprime video\\b'], icon: 'img/apps/prime.png' },
      { key: 'disney', label: 'Disney+', storeId: '3201901017640', apiIds: ['3201901017640'], ids: ['MCmYXNxgcu.DisneyPlus'],
        names: ['^disney plus$', '\\bdisney plus\\b', '^disney$'] },
      { key: 'npostart', label: 'NPO Start', apiIds: ['3202309032263'], ids: ['iquaePhaki.npostart'],
        names: ['^npo start$'] },
      // Only on Runinga (QE75Q70T); apps a TV doesn't have are left out of its dock.
      { key: 'ziggo', label: 'Ziggo GO', apiIds: ['3202304030712'], ids: ['CU6377fENL.player'],
        names: ['^ziggo go'] },
      { key: 'videoland', label: 'Videoland', apiIds: ['3201810017074'], ids: ['ESMP8SBFDH.videoland'],
        names: ['^videoland$'] },
      { key: 'nlziet', label: 'NLZIET', apiIds: ['3202012022421'], ids: ['azFWqejcXJ.NLZiet'],
        names: ['^nlziet$'] },
      { key: 'skyshowtime', label: 'SkyShowtime', apiIds: ['3202208028071'], ids: ['skysh0WTIM.SkyShowtime'],
        names: ['^skyshowtime$'] },
      { key: 'viaplay', label: 'Viaplay', apiIds: ['11111300404'], ids: ['niYSnzL6h1.Viaplay'],
        names: ['^viaplay$'] },
      { key: 'pathe', label: 'Pathé Thuis', apiIds: ['3202207027987'], ids: ['xf4VNjoz7A.SmartTVNextGen', '0yc8StEOG6.PatheThuis'],
        names: ['^path.? thuis$'] },
      { key: 'spotify', label: 'Spotify', apiIds: ['3201606009684'], ids: ['rJeHak5zRg.Spotify'],
        names: ['^spotify'] },
      { key: 'browser', label: 'Internet', apiIds: ['3201907018784'], ids: ['org.tizen.browser'],
        names: ['^internet$', '^browser$'] },
      { key: 'tizenbrew', label: 'TizenBrew', ids: ['xvvl3S1bvH.TizenBrewStandalone'],
        names: ['^tizenbrew'] }
    ],

    // HDMI inputs on the dock, after the apps. `hdmi` is the port number; OK
    // switches the TV to it and opens Samsung's TV viewer full screen.
    // `icon`: optional, a path under app/; without it the tile shows `label`.
    // e.g. { hdmi: 1, label: 'Games console', icon: 'img/inputs/console.png' }
    inputs: []
  };
}());
