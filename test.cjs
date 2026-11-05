// Run: node --test test.cjs (Node.js 20+)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { webcrypto } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('index.html');
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('inline JavaScript parses', () => { new vm.Script(code); });

test('local script versions match file contents (run `npm run bump` after changing them)', () => {
  const { scriptVersions } = require('./scripts/asset-version.cjs');
  for (const { file, found, current, expected } of scriptVersions(html)) {
    assert.ok(found, `index.html loads ${file}`);
    assert.equal(current, expected, `${file} version is stale`);
  }
});

test('build-data.js emits the same static labels and colors as the committed data.js', () => {
  const block = (text, name) => text.slice(text.indexOf(`const ${name} = {`), text.indexOf('\n};', text.indexOf(`const ${name} = {`)));
  const lf = text => text.replace(/\r\n/g, '\n');
  const generator = lf(read('build-data.js')), data = lf(read('data.js'));
  for (const name of ['DOMAIN_LABELS', 'ROLE_LABELS'])
    assert.equal(block(generator, name), block(data, name), `${name} drifted`);
});

test('historical periods are well-formed site data', () => {
  const { PERIODS, PERIOD_CATEGORIES } = vm.runInNewContext(read('periods.js') + ';({ PERIODS, PERIOD_CATEGORIES })');
  assert.ok(PERIODS.length >= 20);
  assert.ok(Object.isFrozen(PERIODS));
  const ids = new Set();
  for (const p of PERIODS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`); ids.add(p.id);
    assert.ok(Number.isInteger(p.start) && Number.isInteger(p.end) && p.start < p.end, `${p.id} years`);
    assert.ok(p.start >= -3200 && p.end <= 2030, `${p.id} within the timeline`);
    assert.ok(PERIOD_CATEGORIES[p.cat], `${p.id} category`);
    assert.ok(p.tier === 1 || p.tier === 2, `${p.id} tier`);
    for (const key of ['zh', 'en', 'note']) assert.ok(typeof p[key] === 'string' && p[key].trim(), `${p.id} ${key}`);
    if (p.ongoing) assert.equal(p.end, 2030, `${p.id} ongoing periods draw to the end of the timeline`);
  }
  for (const id of ['renaissance', 'ww1', 'ww2']) assert.ok(ids.has(id), `${id} is included`);
});

test('period layout packs overlaps into rows, hides tier 2 when zoomed out, and caps rows', () => {
  const start = code.indexOf('// ── Historical periods'), end = code.indexOf('// ── End historical periods');
  const context = vm.createContext({});
  vm.runInContext(code.slice(start, end), context);
  const layout = (periods, s, e, maxRows) => JSON.parse(JSON.stringify(vm.runInContext('layoutPeriods', context)(
    periods, s, e, year => (year - s) / (e - s) * 1000, maxRows)));
  const p = (id, start, end, tier = 1) => ({ id, zh: id, start, end, tier });
  const wide = layout([p('a', 0, 100), p('b', 50, 150), p('c', 200, 300), p('minor', 0, 10, 2)], -3200, 2030);
  assert.deepEqual(wide.items.map(i => [i.period.id, i.row]), [['a', 0], ['b', 1], ['c', 0]]);
  assert.equal(wide.rows, 2);
  const zoomed = layout([p('minor', 0, 10, 2)], 0, 100);
  assert.equal(zoomed.items.length, 1, 'tier 2 shows in narrow views');
  const blip = layout([p('war', 1914, 1918)], -3200, 2030).items[0];
  assert.ok(blip.x2 - blip.x1 >= 4, 'short periods keep a visible width');
  assert.equal(blip.showLabel, false, 'labels only show when they fit');
  const capped = layout([p('x', 0, 100), p('y', 0, 100), p('z', 0, 100)], 0, 100, 2);
  assert.equal(capped.rows, 2);
  assert.equal(capped.items.length, 2);
  assert.equal(layout([p('gone', 2100, 2200)], 0, 100).items.length, 0, 'out-of-range periods are skipped');
});

test('self-hosted fonts referenced by index.html exist with their licenses', () => {
  const fonts = [...html.matchAll(/url\("(fonts\/[^"]+)"\)/g)].map(m => m[1]);
  assert.ok(fonts.length >= 1);
  for (const font of fonts) assert.ok(fs.existsSync(path.join(__dirname, font)), `${font} exists`);
  assert.ok(fs.readdirSync(path.join(__dirname, 'fonts')).some(f => f.startsWith('OFL')), 'font license is included');
});

test('external dependencies are pinned to exact versions with integrity hashes', () => {
  const scripts = [...html.matchAll(/<script src="(https:[^"]+)"([^>]*)>/g)];
  assert.ok(scripts.length >= 2);
  for (const [, src, attributes] of scripts) {
    assert.match(src, /@\d+\.\d+\.\d+\//, `${src} pins an exact version`);
    assert.match(attributes, /integrity="sha384-[A-Za-z0-9+/=]+"/, `${src} has SRI`);
    assert.match(attributes, /crossorigin="anonymous"/);
  }
  for (const [url] of html.matchAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/[^"'\s)]+/g))
    assert.match(url, /@\d+\.\d+\.\d+\//, `${url} pins an exact version`);
});

test('site-owned portrait positions are valid and independent of generated data', () => {
  const positions = vm.runInNewContext(read('portrait-positions.js') + ';PORTRAIT_POSITIONS');
  assert.equal(Object.isFrozen(positions), true);
  for (const [rank, value] of Object.entries(positions)) {
    assert.ok(Number.isInteger(Number(rank)) && Number(rank) >= 1 && Number(rank) <= 100);
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 100);
  }
  assert.equal(read('build-data.js').includes('img_position'), false);
});

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

test('default reader width reserves map space; extra width overlays it', () => {
  const mapCode = code.slice(code.indexOf('function computeScale('), code.indexOf('// ── Map interaction:'));
  assert.ok(mapCode.includes('function redrawMap()'));
  const calls = [];
  const projection = {
    scale(value) { calls.push(['scale', value]); return this; },
    translate(value) { calls.push(['translate', value]); return this; },
  };
  const selection = { attr() { return this; } };
  const geoPath = () => { const path = () => ''; path.projection = () => path; return path; };
  const panel = { open: false, width: 400,
    classList: { contains() { return panel.open; } },
    getBoundingClientRect() { return { width: panel.width }; },
  };
  const context = vm.createContext({
    MAP_W_K: 0.175, MAP_H_K: 0.318, worldData: {}, projection,
    getMapDims: () => ({ W: 1200, H: 500 }),
    document: { getElementById: () => panel },
    window: { innerWidth: 1200, matchMedia: () => ({ matches: false }) },
    fitMode: 'auto', userZoom: 1, userPanX: 0, userPanY: 0,
    d3: { geoPath, geoGraticule: () => () => ({}) },
    mapSvg: { select: () => selection, selectAll: () => selection },
    PERSONS: [],
  });
  vm.runInContext(mapCode, context);
  const rendered = () => {
    calls.length = 0;
    vm.runInContext('redrawMap()', context);
    return calls.map(([key, value]) => [key, Array.isArray(value) ? Array.from(value) : value]);
  };
  assert.deepEqual(rendered(), [['scale', 159], ['translate', [600, 250]]]);
  panel.open = true;
  assert.deepEqual(rendered(), [['scale', 140], ['translate', [400, 250]]]);
  panel.width = 700;
  assert.deepEqual(rendered(), [['scale', 140], ['translate', [400, 250]]]);
  panel.width = 320;
  assert.deepEqual(rendered(), [['scale', 154], ['translate', [440, 250]]]);
  context.window.matchMedia = () => ({ matches: true });
  assert.deepEqual(rendered(), [['scale', 159], ['translate', [600, 250]]]);
});

// Exercise portrait interactions without fetching external images.
function portraitHarness(storage = new Map(), positions = {}, fetchImpl) {
  class Element {
    constructor(id = '', className = '') {
      Object.assign(this, { id, className, style: {}, children: [], hidden: true, listeners: {}, open: false, naturalWidth: 400, naturalHeight: 600 });
      const classes = new Set();
      this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
      this.pointers = new Set();
    }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    emit(type, event = {}) { for (const handler of this.listeners[type] || []) handler(event); }
    setAttribute(key, value) { this[key] = value; }
    removeAttribute(key) { delete this[key]; }
    querySelector(tag) { return this.children.find(child => child.tagName === tag) || null; }
    setPointerCapture(id) { this.pointers.add(id); }
    hasPointerCapture(id) { return this.pointers.has(id); }
    releasePointerCapture(id) { this.pointers.delete(id); }
    append(child) { child.remove(); this.children.push(child); child.parent = this; }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
      this.parent = null;
    }
    replaceChildren(...children) { for (const child of [...this.children]) child.remove(); children.forEach(child => this.append(child)); }
    contains(child) { return child === this || this.children.some(node => node.contains(child)); }
    closest(selector) {
      if (selector === '.person-portrait' && this.className.split(' ').includes('person-portrait')) return this;
      return this.parent?.closest(selector) || null;
    }
    getBoundingClientRect() { return { left: 10, bottom: 90, width: 140, height: 40 }; }
    focus() { document.activeElement = this; }
    get isConnected() { return document.body.contains(this); }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    select() { this.selected = true; }
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
  const detail = elements.get('detail-portrait');
  detail.className = 'person-portrait';
  const tip = new Element('', 'person-portrait');
  const other = new Element('', 'person-portrait');
  const document = new Element();
  document.body = new Element();
  document.getElementById = id => elements.get(id);
  document.createElement = tag => Object.assign(new Element(), { tagName: tag });
  document.querySelectorAll = () => [detail, tip, other];
  for (const element of [...elements.values(), tip, other]) document.body.append(element);
  elements.get('portrait-menu').append(elements.get('portrait-menu-refresh'));
  const window = new Element();
  window.innerWidth = 1000;
  window.innerHeight = 700;
  const clipboard = [];
  const context = vm.createContext({
    document, window, URL, REGIONS: {}, hideTip() {},
    PORTRAIT_POSITIONS: positions,
    fetch: fetchImpl,
    navigator: { clipboard: { writeText: async text => clipboard.push(text) } },
    Date: { now: () => 1793664000000 },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    person: { rank: 1, zh: '测试人物', img: 'https://docs.suphy.top/file/test.jpg?size=small&v=source#portrait' },
    another: { rank: 2, zh: '另一人物', img: 'https://docs.suphy.top/file/another.jpg' },
    detail, tip, other,
  });
  const portraitCode = code.slice(code.indexOf('// Bump after replacing same-URL portraits'), code.indexOf('// TOOLTIP'));
  vm.runInContext(portraitCode, context);
  return { run: source => vm.runInContext(source, context), document, elements, detail, tip, other, storage, clipboard };
}

test('manual refresh changes only the selected image and keeps unrelated URL parameters', () => {
  const h = portraitHarness();
  assert.equal(h.run('getPortraitURL(person).searchParams.get("v")'), 'source');
  assert.equal(h.run('getPortraitURL(another).searchParams.get("v")'), '20261102');
  const original = h.run('person.img');
  h.run('refreshPortrait(person)');
  const first = h.run('getPortraitURL(person).href');
  const url = new URL(first);
  assert.notEqual(url.searchParams.get('v'), 'source');
  assert.equal(url.searchParams.get('size'), 'small');
  assert.equal(url.hash, '#portrait');
  assert.equal(h.run('person.img'), original);
  assert.equal(h.run('getPortraitURL(another).searchParams.get("v")'), '20261102');
  h.run('refreshPortrait(person)');
  assert.notEqual(h.run('getPortraitURL(person).href'), first, 'successive clicks create different versions');
  h.run('person = { img: "https://upload.wikimedia.org/a.jpg?v=keep" }; refreshPortrait(person)');
  assert.equal(h.run('getPortraitURL(person).href'), 'https://upload.wikimedia.org/a.jpg?v=keep');
  assert.equal(h.run('getPortraitURL({img: "javascript:alert(1)"})'), null);
});

test('refresh synchronizes thumbnails and the open full image, and failed thumbnails can retry', () => {
  const h = portraitHarness();
  h.run('renderPortrait(detail, person); renderPortrait(tip, person); renderPortrait(other, another); openPortrait(person)');
  const oldImage = h.detail.children.at(-1);
  const otherURL = h.other.children.at(-1).src;
  h.elements.get('portrait-refresh').emit('click');
  const detailImage = h.detail.children.at(-1);
  assert.notEqual(detailImage.src, oldImage.src);
  assert.equal(detailImage.src, h.tip.children.at(-1).src);
  assert.equal(detailImage.src, h.elements.get('portrait-full-image').src);
  assert.equal(h.other.children.at(-1).src, otherURL);
  oldImage.onload();
  assert.equal(h.detail.disabled, true, 'late results cannot enable a replaced thumbnail');
  detailImage.onerror();
  assert.equal(h.detail.children.length, 1, 'initial remains after a load failure');
  assert.equal(h.elements.get('detail-portrait-refresh').hidden, false);
  h.elements.get('detail-portrait-refresh').emit('click');
  const retried = h.detail.children.at(-1);
  assert.notEqual(retried.src, detailImage.src);
  retried.onload();
  assert.equal(h.detail.disabled, false);
  h.detail.onclick();
  assert.equal(h.elements.get('portrait-full-image').src, retried.src);
  h.elements.get('portrait-full-image').emit('error');
  assert.equal(h.elements.get('portrait-error').hidden, false);
  h.elements.get('portrait-refresh').emit('click');
  assert.equal(h.elements.get('portrait-error').hidden, true);
  assert.equal(h.elements.get('portrait-status').textContent, '加载中…');
  h.elements.get('portrait-full-image').emit('load');
  assert.equal(h.elements.get('portrait-status').textContent, '');
  h.run('renderPortrait(detail, {img: null})');
  assert.equal(h.elements.get('detail-portrait-refresh').hidden, true);
});

test('manual versions survive page reloads but storage errors do not prevent refresh', () => {
  const storage = new Map();
  const h = portraitHarness(storage);
  h.run('refreshPortrait(person)');
  const refreshed = h.run('getPortraitURL(person).href');
  assert.equal(portraitHarness(storage).run('getPortraitURL(person).href'), refreshed);
  const blocked = portraitHarness({ get() { throw new Error('blocked'); }, set() { throw new Error('blocked'); } });
  blocked.run('refreshPortrait(person)');
  assert.notEqual(blocked.run('getPortraitURL(person).searchParams.get("v")'), 'source');
  for (const malformed of ['null', '{broken']) {
    const fresh = portraitHarness(new Map([['the100:portrait-refresh:20261102', malformed]]));
    assert.equal(fresh.run('getPortraitURL(person).searchParams.get("v")'), 'source');
  }
});

test('portrait context menu refreshes one image and Escape dismisses only the menu', () => {
  const h = portraitHarness();
  h.run('renderPortrait(detail, person)');
  h.detail.children.at(-1).onload();
  let prevented = false;
  h.document.emit('contextmenu', { target: h.detail, clientX: 990, clientY: 690, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  const menu = h.elements.get('portrait-menu');
  assert.equal(menu.hidden, false);
  assert.equal(menu.style.left, '856px');
  assert.equal(menu.style.top, '656px');
  h.elements.get('portrait-menu-refresh').emit('click');
  assert.equal(menu.hidden, true);
  assert.notEqual(new URL(h.detail.children.at(-1).src).searchParams.get('v'), 'source');
  h.run('openPortrait(person)');
  h.document.emit('contextmenu', { target: h.elements.get('portrait-full-image'), clientX: 10, clientY: 10, preventDefault() {} });
  assert.equal(menu.parent, h.elements.get('portrait-dialog'), 'menu remains above the modal');
  let stopped = false;
  h.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(menu.hidden, true);
  assert.equal(h.elements.get('portrait-dialog').open, true);
  assert.equal(h.document.activeElement, h.elements.get('portrait-crop'));
});

test('dot timeline keeps people in fixed domain lanes across ranges and color modes', () => {
  const labels = [];
  const circles = { data() { return this; }, join() { return this; }, attr() { return this; }, on() { return this; }, remove() {} };
  const svg = {
    attr() { return this; }, selectAll() { return circles; },
    append() {
      const node = { attrs: {}, attr(key, value) { this.attrs[key] = value; return this; },
        text(value) { if (this.attrs.class === 'tl-domain-label') labels.push(value); return this; } };
      return node;
    },
  };
  const scaleLinear = () => {
    let domain, range;
    const scale = value => range[0] + (value - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]);
    scale.domain = value => { domain = value; return scale; };
    scale.range = value => { range = value; return scale; };
    return scale;
  };
  const people = [
    { birth: 100, domain: 'Society', role: 'General' },
    { birth: 100, domain: 'Nature', role: 'Physicist' },
    { birth: 100, domain: 'Spirit', role: 'Philosopher' },
    { birth: 101, domain: 'Nature', role: 'Inventor' },
    { birth: 102, domain: 'Spirit', role: 'Spiritual' },
  ];
  const context = vm.createContext({
    document: { getElementById: () => ({ style: {} }) },
    d3: { select: () => svg, scaleLinear }, people, moveTip() {}, hideTip() {},
  });
  const colors = code.slice(code.indexOf('function roleColor('), code.indexOf('// REGION FILTER STATE'));
  const constants = code.slice(code.indexOf('const TL_HEIGHT_DOT'), code.indexOf('let worldData'));
  const dots = code.slice(code.indexOf('function renderDots('), code.indexOf('// ── Lifeline mode'));
  vm.runInContext(read('data.js') + read('role-colors.js') + colors + constants + dots, context);
  assert.equal(vm.runInContext('nodeColor(people[0])', context), '#d07828', 'default person color comes from their role');
  vm.runInContext('renderDots(people, 0, 2000, 800)', context);
  assert.deepEqual(labels, [], 'no domain label column takes horizontal space from the dots');
  const [society, nature, spirit, inventor, spiritual] = people;
  assert.ok(nature._tly < spirit._tly && spirit._tly < society._tly);
  assert.equal(nature._tly, inventor._tly);
  assert.equal(spirit._tly, spiritual._tly);
  assert.equal(nature._tlx, society._tlx, 'birth year determines horizontal position across domains');
  assert.ok(inventor._tlx > nature._tlx);
  const initialRows = people.map(person => person._tly);
  for (const mode of ['region', 'domain', 'role']) {
    context.mode = mode;
    vm.runInContext('colorMode = mode; renderDots(people, -500, 2500, 400)', context);
    assert.deepEqual(people.map(person => person._tly), initialRows);
  }
  vm.runInContext('renderDots(people.filter(p => p.domain === "Spirit"), 0, 2000, 800)', context);
  assert.equal(spirit._tly, initialRows[2], 'a single remaining domain keeps its original lane');
});

test('portrait positions normalize site values, preserving zero', () => {
  const h = portraitHarness();
  const cases = [[undefined, 50], [null, 50], ['', 50], ['bad', 50], [true, 50], [[], 50],
    [NaN, 50], [Infinity, 50], [0, 0], ['0', 0], [25, 25], ['75', 75], [100, 100], [-1, 0], [101, 100], [25.7, 26]];
  for (const [value, expected] of cases) {
    h.run(`globalThis.inputPosition = ${typeof value === 'number' ? String(value) : JSON.stringify(value)}`);
    assert.equal(h.run('normalizePortraitPosition(inputPosition)'), expected);
  }
});

test('portrait position preview supports drag and input without saving local overrides', async () => {
  const h = portraitHarness();
  h.run('renderPortrait(detail, person); openPortraitCrop(person)');
  const image = h.elements.get('portrait-crop-image');
  const preview = h.elements.get('portrait-crop-preview');
  const save = h.elements.get('portrait-crop-save');
  image.naturalWidth = 400;
  image.naturalHeight = 800;
  assert.equal(save.disabled, true);
  image.onload();
  assert.equal(save.disabled, false);
  assert.equal(image.style.objectPosition, '50% 50%');
  assert.equal(h.elements.get('portrait-crop-direction').textContent, '上 → 下');
  preview.emit('pointerdown', { button: 0, pointerId: 1, clientX: 10, clientY: 10, preventDefault() {} });
  preview.emit('pointermove', { pointerId: 2, clientX: 10, clientY: 80 });
  assert.equal(image.style.objectPosition, '50% 50%');
  preview.emit('pointermove', { pointerId: 1, clientX: 10, clientY: 80 });
  assert.equal(image.style.objectPosition, '0% 0%');
  preview.emit('pointerup', { pointerId: 1 });
  assert.equal(preview.hasPointerCapture(1), false);
  const slider = h.elements.get('portrait-crop-position');
  slider.value = '75';
  slider.emit('input');
  assert.equal(image.style.objectPosition, '75% 75%');
  preview.emit('keydown', { key: 'ArrowUp', preventDefault() {} });
  assert.equal(image.style.objectPosition, '76% 76%');
  const value = h.elements.get('portrait-crop-value');
  value.value = '150';
  value.emit('input');
  assert.equal(image.style.objectPosition, '100% 100%');
  await save.listeners.click[0]();
  assert.equal(h.elements.get('portrait-crop-status').textContent, '请输入管理员密钥后保存。');
  assert.equal(h.run('person.img_position'), undefined, 'preview never changes source person data');
  assert.equal(h.storage.size, 0, 'no crop override is stored in this browser');
  h.elements.get('portrait-crop-reset').emit('click');
  assert.equal(image.style.objectPosition, '50% 50%');
  h.elements.get('portrait-crop-cancel').emit('click');
  assert.equal(h.elements.get('portrait-crop-dialog').open, false);
  assert.equal(h.detail.children.at(-1).style.objectPosition, undefined);
});

test('shared image position is used by every thumbnail and survives image refresh', () => {
  const h = portraitHarness(new Map(), { 1: 0 });
  h.run('renderPortrait(detail, person); renderPortrait(tip, person)');
  h.detail.children.at(-1).onload();
  h.tip.children.at(-1).onload();
  assert.equal(h.detail.children.at(-1).style.objectPosition, '0% 0%');
  assert.equal(h.tip.children.at(-1).style.objectPosition, '0% 0%');
  h.run('openPortrait(person)');
  assert.equal(h.elements.get('portrait-full-image').style.objectPosition, undefined, 'full image remains uncropped');
  h.run('refreshPortrait(person)');
  h.detail.children.at(-1).onload();
  assert.equal(h.detail.children.at(-1).style.objectPosition, '0% 0%');
  h.run('openPortraitCrop(person)');
  const image = h.elements.get('portrait-crop-image');
  image.naturalWidth = 800;
  image.naturalHeight = 400;
  image.onload();
  assert.equal(h.elements.get('portrait-crop-position').value, 0);
  assert.equal(h.elements.get('portrait-crop-direction').textContent, '左 → 右');
  const preview = h.elements.get('portrait-crop-preview');
  preview.emit('pointerdown', { button: 0, pointerId: 1, clientX: 80, clientY: 10, preventDefault() {} });
  preview.emit('pointermove', { pointerId: 1, clientX: 10, clientY: 10 });
  assert.equal(image.style.objectPosition, '50% 50%');
  preview.emit('pointercancel', { pointerId: 1 });
  assert.equal(preview.hasPointerCapture(1), false);
});

test('database portrait API rejects unauthorized writes and returns saved rows without caching', async () => {
  const source = read('functions/api/portrait-positions.js').replaceAll('export async function', 'async function');
  const handlers = vm.runInNewContext(source + ';({ onRequestGet, onRequestPut })',
    { Request, Response, URL, TextEncoder, crypto: webcrypto });
  const rows = new Map();
  const db = { prepare(sql) {
    return {
      bind(...values) { this.values = values; return this; },
      async all() { return { results: [...rows.values()] }; },
      async run() {
        assert.match(sql, /ON CONFLICT\(rank\)/);
        const [rank, image_url, position] = this.values;
        rows.set(rank, { rank, image_url, position, updated_at: '2026-11-03 00:00:00' });
      },
      async first() { return rows.get(this.values[0]); },
    };
  } };
  const secret = 'a'.repeat(40);
  const env = { PORTRAIT_DB: db, PORTRAIT_ADMIN_TOKEN: secret };
  const url = 'https://the100.example/api/portrait-positions';
  const input = { rank: 1, image_url: 'https://example.com/a.jpg', position: 0 };
  const put = (body, token = secret, headers = {}) => handlers.onRequestPut({ env,
    request: new Request(url, { method: 'PUT', headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers,
    }, body: JSON.stringify(body) }),
  });
  assert.equal((await handlers.onRequestGet({ env: {} })).status, 503);
  assert.equal((await put(input, 'wrong')).status, 401);
  assert.equal((await put(input, secret, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await put({ ...input, position: 101 })).status, 400);
  assert.equal(rows.size, 0);
  const saved = await put(input);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).record.position, 0);
  const result = await handlers.onRequestGet({ env });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await result.json()).records.map(row => row.position), [0]);
  assert.equal((await put({ ...input, position: 100 })).status, 200);
  assert.equal(rows.get(1).position, 100);
});

test('saving a crop updates displayed portraits and new page loads use the database record', async () => {
  const records = [];
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (!options.method) return { ok: true, json: async () => ({ records: [...records] }) };
    const record = JSON.parse(options.body);
    records.splice(0, records.length, record);
    return { ok: true, json: async () => ({ record }) };
  };
  const h = portraitHarness(new Map(), {}, fetchImpl);
  h.run('renderPortrait(detail, person); renderPortrait(tip, person)');
  h.detail.children.at(-1).onload();
  h.tip.children.at(-1).onload();
  await h.run('loadPortraitPositions()');
  h.run('openPortraitCrop(person)');
  const image = h.elements.get('portrait-crop-image');
  image.onload();
  const value = h.elements.get('portrait-crop-value');
  value.value = '25';
  value.emit('input');
  h.elements.get('portrait-crop-token').value = 'admin-secret';
  await h.elements.get('portrait-crop-save').listeners.click[0]();
  assert.equal(calls.at(-1).options.method, 'PUT');
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer admin-secret');
  assert.equal(records[0].image_url, h.run('person.img'));
  assert.equal(h.detail.children.at(-1).style.objectPosition, '25% 25%');
  assert.equal(h.tip.children.at(-1).style.objectPosition, '25% 25%');
  assert.equal(h.elements.get('portrait-crop-token').value, '');
  assert.equal(h.storage.size, 0);
  const next = portraitHarness(new Map(), {}, fetchImpl);
  await next.run('loadPortraitPositions()');
  assert.equal(next.run('portraitPosition(person)'), 25);
  assert.equal(next.run('portraitPosition({...person, img: "https://example.com/new.jpg"})'), 50);
});
