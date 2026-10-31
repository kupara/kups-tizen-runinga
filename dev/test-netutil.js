#!/usr/bin/env node
// Unit tests for app/service/netutil.js and the path splitter.
// (Only loopback can be exercised with real sockets on the Mac, so the LAN
// rules are checked here as pure functions.)
'use strict';
const path = require('path');
const n = require(path.join(__dirname, '..', 'app', 'service', 'netutil.js'));
const { splitPath } = require(path.join(__dirname, '..', 'app', 'service', 'server.js'));
let fails = 0;
let count = 0;
function eq(label, got, want) {
  count++;
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log('FAIL ' + label + ': ' + JSON.stringify(got) + ' != ' + JSON.stringify(want)); }
}

// who may connect (private LAN ranges and loopback only)
[['127.0.0.1', true], ['::1', true], ['::ffff:127.0.0.1', true], ['192.168.1.17', true], ['::ffff:192.168.1.17', true],
 ['10.1.2.3', true], ['172.16.0.1', true], ['172.31.255.254', true], ['169.254.10.10', true], ['fe80::1%wlan0', true], ['fd12:3456::1', true],
 ['172.32.0.1', false], ['172.15.0.1', false], ['8.8.8.8', false], ['::ffff:8.8.8.8', false], ['100.64.1.1', false],
 ['2001:4860:4860::8888', false], ['', false], ['garbage', false]
].forEach(([a, want]) => eq('isPrivate ' + a, n.isPrivate(a), want));

[['127.0.0.1', true], ['127.9.9.9', true], ['::1', true], ['::ffff:127.0.0.1', true], ['192.168.1.9', false], ['::ffff:192.168.1.1', false]
].forEach(([a, want]) => eq('isLoopback ' + a, n.isLoopback(a), want));

// outbound fetches (icons, YouTube): public addresses only
[['142.250.70.206', true], ['2404:6800:4006:80a::200e', true], ['192.168.1.1', false], ['127.0.0.1', false], ['10.0.0.1', false],
 ['169.254.169.254', false], ['100.100.100.100', false], ['0.0.0.0', false], ['224.0.0.251', false], ['::1', false], ['fe80::1', false],
 ['fd00::1', false], ['::ffff:192.168.1.1', false], ['2001:db8::1', false], ['198.18.0.1', false]
].forEach(([a, want]) => eq('isPublicUnicast ' + a, n.isPublicUnicast(a), want));

// IPv6: global unicast is 2000::/3 by the number in the first group, however it is written
[['2606:4700::6810:84e5', true], ['2a03:2880:f12f:83:face:b00c:0:25de', true], ['2001:4860:4860::8888', true], ['2000::1', true],
 ['3fff:1000::1', true], ['2404:6800:4006:080a:0000:0000:0000:200e', true], ['2404:6800:4006:80A::200E', true],
 ['2::1', false], ['3::1', false], ['23::1', false], ['2ab::1', false], ['3ff::1', false], ['1fff::1', false], ['4000::1', false],
 ['::', false], ['0:0:0:0:0:0:0:1', false], ['fe80::1%en0', false], ['febf::1', false], ['fec0::1', false], ['fc00::1', false],
 ['ff02::1', false], ['ff0e::fb', false], ['64:ff9b::8.8.8.8', false], ['::8.8.8.8', false], ['100::1', false],
 // documentation and IETF-protocol blocks inside 2000::/3
 ['2001:0db8:85a3::8a2e:370:7334', false], ['2001:db8:ffff::1', false], ['3fff::1', false], ['3fff:fff::1', false],
 ['2001::1', false], ['2001:0:4136:e378:8000:63bf:3fff:fdd2', false], ['2001:2::1', false], ['2001:10::1', false], ['2001:1ff::1', false],
 ['2001:200::1', true],
 // 6to4 carries an IPv4 address: judged by it
 ['2002:808:808::1', true], ['2002:c0a8:101::1', false], ['2002:a00:1::1', false], ['2002:7f00:1::', false], ['2002:a9fe:a9fe::1', false],
 // an IPv4 address written as IPv6 is judged as that IPv4 address, in every spelling
 ['::ffff:8.8.8.8', true], ['::FFFF:8.8.8.8', true], ['::ffff:808:808', true], ['0:0:0:0:0:ffff:8.8.8.8', true], ['0::ffff:0808:0808', true],
 ['::ffff:c0a8:101', false], ['::ffff:7f00:1', false], ['::ffff:a9fe:a9fe', false], ['0:0:0:0:0:ffff:192.168.1.1', false], ['::ffff:0:192.168.1.1', false],
 // not addresses
 ['2001:db8::1::1', false], ['12345::1', false], ['2404:6800:4006:80a:0:0:0:200e:1', false], ['2404:6800:4006:80a:0:0:200e', false],
 ['1::2:3:4:5:6:7:8', false], [':2404::1', false], ['2404::1:', false], ['[2404:6800::1]', false], ['g::1', false], ['::ffff:1.2.3', false],
 ['::ffff:1.2.3.256', false], ['1.2.3.4::', false], ['2404:6800::' + '1:'.repeat(30) + '1', false]
].forEach(([a, want]) => eq('isPublicUnicast ' + a, n.isPublicUnicast(a), want));
eq('parseV6 full form', n.parseV6('2001:db8:0:0:1:0:0:1'), [0x2001, 0xdb8, 0, 0, 1, 0, 0, 1]);
eq('parseV6 compressed', n.parseV6('fe80::1'), [0xfe80, 0, 0, 0, 0, 0, 0, 1]);
eq('parseV6 dotted tail', n.parseV6('::ffff:192.168.1.5'), [0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x0105]);
// mapped forms are normalised to IPv4 for every check, not just outbound fetches
[['::ffff:c0a8:105', '192.168.1.5'], ['0:0:0:0:0:ffff:192.168.1.5', '192.168.1.5'], ['::ffff:192.168.1.5', '192.168.1.5'],
 ['fe80::1%wlan0', 'fe80::1'], ['::1', '::1'], ['::ffff:0:c0a8:105', '::ffff:0:c0a8:105']
].forEach(([a, want]) => eq('normalize ' + a, n.normalize(a), want));
[['::ffff:c0a8:105', true], ['::ffff:808:808', false], ['::ffff:7f00:1', true]].forEach(([a, want]) => eq('isPrivate ' + a, n.isPrivate(a), want));
eq('isLoopback ::ffff:7f00:1', n.isLoopback('::ffff:7f00:1'), true);

// Host header (DNS-rebinding guard)
[['192.168.1.9:8090', true], ['127.0.0.1:18090', true], ['[::1]:18090', true], ['localhost:8090', true], ['tv:8090', true],
 ['samsung-tv.local:8090', true], ['tv.lan', true], ['tv.home.arpa:8090', true],
 ['evil.example.com', false], ['evil.example.com:8090', false], ['192.168.1.9.nip.io:8090', false], ['', false], ['[zz]:1', false], ['host:port', false]
].forEach(([h, want]) => eq('hostAllowed ' + h, n.hostAllowed(h), want));

// request paths: no traversal, no encoded separators, no NUL
eq('split /', splitPath('/'), ['']);
eq('split media', splitPath('/media/photos/abc.jpg'), ['media', 'photos', 'abc.jpg']);
eq('split trailing slash', splitPath('/api/photos/'), ['api', 'photos']);
['/media/photos/../state.json', '/media/photos/..%2Fstate.json', '/media/photos/%2e%2e%2fstate.json', '/media/%2e%2e/x',
 '/media/icons/..%5C..%5Cstate.json', '/a/%00/b', '/a/%zz', 'relative', '/./x'
].forEach((p) => eq('reject ' + p, splitPath(p), null));

console.log(count + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
