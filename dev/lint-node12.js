#!/usr/bin/env node
// Checks that the code the TV's service runtime loads stays within Node 12 /
// ES2017-era syntax and APIs. The tested 2023 TV (Tizen 8) runs Node 16.17;
// older Tizen TVs run older Node, so the code keeps to the Node 12 API. Strings and comments are blanked out
// first, so only real code is checked.
//   node dev/lint-node12.js
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'app');
const files = fs.readdirSync(path.join(root, 'service')).filter((f) => f.endsWith('.js')).map((f) => path.join(root, 'service', f));
files.push(path.join(root, 'js', 'ytparse.js'));

// Replace string, template and regex-free comment contents with spaces.
function codeOnly(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      out += q; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += '  '; i += 2; continue; } out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += q; i++;
      continue;
    }
    out += c; i++;
  }
  return out;
}

const rules = [
  [/\?\.[A-Za-z_$[(]/, 'optional chaining ?.'],
  [/\?\?/, 'nullish coalescing ??'],
  [/(\|\||&&|\?\?)=/, 'logical assignment'],
  [/\bcatch\s*\{/, 'optional catch binding'],
  [/\d_\d/, 'numeric separator'],
  [/\{\s*\.\.\.|,\s*\.\.\.[A-Za-z_$][\w$]*\s*[,}]/, 'object spread/rest'],
  // (preceded by line start, a space or '.', so '&#x(' inside a regex does not count)
  [/(^|[\s.])#[A-Za-z_$][\w$]*\s*[=;(]/, 'private class member'],
  [/\bstatic\s+[A-Za-z_$][\w$]*\s*=/, 'static class field'],
  [/\.replaceAll\s*\(/, 'String#replaceAll (Node 15)'],
  [/\.at\s*\(/, 'Array#at (Node 16.6)'],
  [/\.flat(Map)?\s*\(/, 'Array#flat/flatMap'],
  [/Object\.fromEntries|Object\.hasOwn/, 'Object.fromEntries/hasOwn'],
  [/\.matchAll\s*\(/, 'String#matchAll'],
  [/\bglobalThis\b/, 'globalThis'],
  [/\bqueueMicrotask\b|\bstructuredClone\b|\bAbortController\b|\bAbortSignal\b/, 'newer global'],
  [/(^|[^.\w])fetch\s*\(/, 'global fetch'],
  [/\brmSync\b|\bcpSync\b|\bstatfs/, 'fs API newer than Node 12'],
  [/\brandomUUID\b|\bwebcrypto\b/, 'crypto API newer than Node 12'],
  [/\.finally\s*\(/, 'Promise#finally (avoided for Escargot)'],
  [/\basync\s+(function|\(|[A-Za-z_$][\w$]*\s*=>)|\bawait\s/, 'async/await (avoided for Escargot)'],
  [/\bfor\s+await\b/, 'for await'],
  [/\bBigInt\b|\d+n\b/, 'BigInt']
];
const stringRules = [
  [/require\(\s*['"]node:/, "'node:' import"],
  [/require\(\s*['"]fs\/promises['"]/, 'fs/promises'],
  [/['"]base64url['"]/, "Buffer 'base64url' encoding (Node 15.7)"]
];

let problems = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const code = codeOnly(src);
  const lines = code.split('\n');
  const raw = src.split('\n');
  lines.forEach((line, i) => {
    rules.forEach(([re, what]) => {
      if (re.test(line)) { problems++; console.log(path.relative(root, f) + ':' + (i + 1) + '  ' + what + '  |  ' + raw[i].trim()); }
    });
  });
  raw.forEach((line, i) => {
    if (/^\s*\/\//.test(line)) return;
    stringRules.forEach(([re, what]) => {
      if (re.test(line)) { problems++; console.log(path.relative(root, f) + ':' + (i + 1) + '  ' + what + '  |  ' + line.trim()); }
    });
  });
}
console.log(files.length + ' files checked, ' + problems + ' problem(s)');
process.exit(problems ? 1 : 0);
