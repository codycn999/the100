// Run: npm run bump
// Updates the ?v= parameters of local scripts in index.html to match their
// current content. Run after changing data.js, content.js, role-colors.js or
// portrait-positions.js; `npm test` fails if a version is stale.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, scriptVersions } = require('./asset-version.cjs');

const file = path.join(ROOT, 'index.html');
let html = fs.readFileSync(file, 'utf8');
let changed = 0;
for (const { file: asset, found, current, expected } of scriptVersions(html)) {
  if (!found) throw new Error(`index.html has no <script src="${asset}"> tag`);
  if (current === expected) continue;
  const escaped = asset.replace(/[.]/g, '\\.');
  html = html.replace(new RegExp(`<script src="${escaped}(?:\\?v=[^"]*)?"></script>`),
    `<script src="${asset}?v=${expected}"></script>`);
  console.log(`${asset}: ${current ?? '(none)'} -> ${expected}`);
  changed++;
}
if (changed) fs.writeFileSync(file, html, 'utf8');
console.log(changed ? `Updated ${changed} version(s) in index.html.` : 'All script versions are current.');
