// Cache-busting versions for local scripts loaded by index.html.
// A version is the first 7 hex digits of the file's git blob hash with line
// endings normalized to LF, so it equals `git hash-object <file>` and does not
// depend on core.autocrlf or the operating system.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const VERSIONED_ASSETS = ['role-colors.js', 'data.js', 'portrait-positions.js', 'content.js'];

function assetVersion(file) {
  const text = fs.readFileSync(path.join(ROOT, file)).toString('utf8').replace(/\r\n/g, '\n');
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body]))
    .digest('hex').slice(0, 7);
}

// Returns [{ file, current, expected }] for each versioned script tag in html.
function scriptVersions(html) {
  return VERSIONED_ASSETS.map(file => {
    const escaped = file.replace(/[.]/g, '\\.');
    const match = new RegExp(`<script src="${escaped}(?:\\?v=([^"]*))?"></script>`).exec(html);
    return { file, found: Boolean(match), current: match?.[1] ?? null, expected: assetVersion(file) };
  });
}

module.exports = { ROOT, VERSIONED_ASSETS, assetVersion, scriptVersions };
