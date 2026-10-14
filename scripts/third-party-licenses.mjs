// Writes public/THIRD-PARTY-LICENSES.txt: the licenses of everything the
// built app contains besides our own code (bundled libraries and fonts).
// Run with `npm run licenses` after adding or updating a dependency.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8').trim();

const MIT = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const version = (name) => JSON.parse(read(`node_modules/${name}/package.json`)).version;

const parts = [
  ['idb', version('idb'), 'ISC', read('node_modules/idb/LICENSE')],
  ['jsQR', version('jsqr'), 'Apache-2.0', read('node_modules/jsqr/LICENSE')],
  ['qrcode-generator', version('qrcode-generator'), 'MIT', MIT('2009 Kazuhiko Arase')],
  ['Fredoka (typsnitt)', '', 'SIL Open Font License 1.1', read('src/game/fonts/OFL-Fredoka.txt')],
  ['Nunito (typsnitt)', '', 'SIL Open Font License 1.1', read('src/game/fonts/OFL-Nunito.txt')],
];

const rule = '='.repeat(72);
const text = [
  'Mattedalen – licenser för ingående delar',
  '',
  'Appen själv: PolyForm Noncommercial License 1.0.0 (se LICENSE.md i källkoden).',
  'Den innehåller också följande delar, som har sina egna licenser:',
  '',
  ...parts.flatMap(([name, ver, spdx, body]) => [rule, `${name}${ver ? ` ${ver}` : ''} – ${spdx}`, rule, '', body, '']),
].join('\n');

writeFileSync('public/THIRD-PARTY-LICENSES.txt', `${text}\n`);
console.log('Wrote public/THIRD-PARTY-LICENSES.txt');
