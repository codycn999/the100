// Run: npm run check:build  (requires OBSIDIAN_VAULT or THE100_DIR / PEOPLE_DIR / REGION_DIR)
// Regenerates data.js and content.js into a temporary directory and reports
// whether they match the committed files. Never overwrites committed data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('./asset-version.cjs');

const normalize = text => text.replace(/\r\n/g, '\n');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'the100-check-'));
let exitCode = 0;
try {
  const outputs = { 'data.js': path.join(dir, 'data.js'), 'content.js': path.join(dir, 'content.js') };
  const env = { ...process.env, OUT_DATA: outputs['data.js'], OUT_CONTENT: outputs['content.js'] };
  delete env.FORCE;
  for (const script of ['build-data.js', 'build-content.js']) {
    const result = spawnSync(process.execPath, [path.join(ROOT, script)], { env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${script} failed (exit ${result.status})`);
  }
  for (const [file, generated] of Object.entries(outputs)) {
    const same = normalize(fs.readFileSync(generated, 'utf8')) === normalize(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    console.log(`${file}: ${same ? 'matches the committed file' : 'DIFFERS from the committed file'}`);
    if (!same) exitCode = 1;
  }
  if (exitCode) console.log('Review the differences, then regenerate with build-data.js / build-content.js and run `npm run bump`.');
} catch (error) {
  console.error(error.message);
  exitCode = 2;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(exitCode);
