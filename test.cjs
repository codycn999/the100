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
function portraitHarness(storage = new Map()) {
  class Element {
    constructor(id = '', className = '') {
      Object.assign(this, { id, className, style: {}, children: [], hidden: true, listeners: {}, open: false });
    }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    emit(type, event = {}) { for (const handler of this.listeners[type] || []) handler(event); }
    setAttribute(key, value) { this[key] = value; }
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
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
  const detail = elements.get('detail-portrait');
  detail.className = 'person-portrait';
  const tip = new Element('', 'person-portrait');
  const other = new Element('', 'person-portrait');
  const document = new Element();
  document.body = new Element();
  document.getElementById = id => elements.get(id);
  document.createElement = () => new Element();
  document.querySelectorAll = () => [detail, tip, other];
  for (const element of [...elements.values(), tip, other]) document.body.append(element);
  elements.get('portrait-menu').append(elements.get('portrait-menu-refresh'));
  const window = new Element();
  window.innerWidth = 1000;
  window.innerHeight = 700;
  const context = vm.createContext({
    document, window, URL, REGIONS: {}, hideTip() {},
    Date: { now: () => 1793664000000 },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    person: { zh: '测试人物', img: 'https://docs.suphy.top/file/test.jpg?size=small&v=source#portrait' },
    another: { zh: '另一人物', img: 'https://docs.suphy.top/file/another.jpg' },
    detail, tip, other,
  });
  const portraitCode = code.slice(code.indexOf('// Bump after replacing same-URL portraits'), code.indexOf('// TOOLTIP'));
  vm.runInContext(portraitCode, context);
  return { run: source => vm.runInContext(source, context), document, elements, detail, tip, other, storage };
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
  assert.equal(h.document.activeElement, h.elements.get('portrait-refresh'));
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
  assert.deepEqual(labels, ['自然·科学', '思想·文化', '政治·社会']);
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
