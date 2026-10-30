// Run: node --test test.cjs (Node.js 20+)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('index.html');
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('inline JavaScript parses', () => { new vm.Script(code); });

test('enriching data keeps every role color available', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'the100-test-'));
  try {
    for (const f of ['enrich-data.js', 'data.js', 'country-ref.js', 'role-colors.js'])
      fs.copyFileSync(path.join(__dirname, f), path.join(dir, f));
    const result = spawnSync(process.execPath, [path.join(dir, 'enrich-data.js')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const context = vm.createContext({});
    vm.runInContext(read('role-colors.js') + fs.readFileSync(path.join(dir, 'data.js'), 'utf8') +
      ';globalThis.result = { count: PERSONS.length, covered: PERSONS.every(p => ROLE_COLORS[p.role]) };', context);
    assert.equal(context.result.count, 100);
    assert.equal(context.result.covered, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('both timeline modes restore filters and keyboard behavior after rendering', () => {
  const render = code.slice(code.indexOf('function renderTimeline()'), code.indexOf('// ── Dot mode'));
  for (const lifeline of [false, true]) {
    const calls = [];
    const context = vm.createContext({
      tlState: { start: 0, end: 100 },
      PERSONS: [{ birth: -20, death: 10 }, { birth: 200, death: 300 }],
      isLifelineMode: () => lifeline,
      document: { getElementById: () => ({ parentElement: { clientWidth: 500 } }) },
      window: { innerWidth: 500 },
      renderLifeline: persons => calls.push(['lifeline', persons.length]),
      renderDots: persons => calls.push(['dots', persons.length]),
      applyAllFilters: () => calls.push('filters'),
      enablePersonKeyboard: () => calls.push('keyboard'),
    });
    vm.runInContext(render + ';renderTimeline();', context);
    assert.deepEqual(calls, [[lifeline ? 'lifeline' : 'dots', 1], 'filters', 'keyboard']);
  }
});
