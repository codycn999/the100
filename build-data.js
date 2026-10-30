// node build-data.js
// Merges obsidianA/wiki/_work/THE100 chapters + _people/_region YAML into data.js.
// Source repository and setup: see GUIDE.md and README.md.

const fs   = require('fs');
const path = require('path');
const { requireVault } = require('./source-config.js');
const COUNTRY_REF = require('./country-ref.js');  // complete country↔region reference

const THE100_DIR = process.env.THE100_DIR || path.join(requireVault(), '_work', 'THE100');
const PEOPLE_DIR = process.env.PEOPLE_DIR || path.join(requireVault(), '_people');
const REGION_DIR = process.env.REGION_DIR || path.join(requireVault(), '_region');
const OUT_FILE    = path.join(__dirname, 'data.js');

// Region buckets are now derived purely from the _region hierarchy
// (representative country → subregion || continent) — see deriveRegion below.

// Keep existing coordinates from current data.js (not in _people files)
const COORDS = {
  1:{lat:21.4,lng:38.8}, 2:{lat:52.8,lng:-0.6},  3:{lat:31.7,lng:35.2},
  4:{lat:27.5,lng:83.3}, 5:{lat:35.6,lng:117.0}, 6:{lat:36.9,lng:34.9},
  7:{lat:26.0,lng:112.0},8:{lat:50.0,lng:8.3},   9:{lat:44.4,lng:8.9},
  10:{lat:48.4,lng:10.0},11:{lat:47.1,lng:5.5},  12:{lat:43.7,lng:10.4},
  13:{lat:40.5,lng:23.7},14:{lat:31.2,lng:29.9}, 15:{lat:30.1,lng:31.2},
  16:{lat:52.7,lng:-2.8},17:{lat:34.4,lng:113.7},18:{lat:41.9,lng:12.5},
  19:{lat:53.0,lng:18.6},20:{lat:48.9,lng:2.3},  21:{lat:43.3,lng:21.9},
  22:{lat:55.9,lng:-4.8},23:{lat:51.5,lng:-0.1}, 24:{lat:55.9,lng:-3.2},
  25:{lat:51.5,lng:11.5},26:{lat:38.3,lng:-77.5},27:{lat:49.8,lng:6.6},
  28:{lat:39.8,lng:-84.2},29:{lat:48.0,lng:105.0},30:{lat:56.1,lng:-3.2},
  31:{lat:52.2,lng:-1.7},32:{lat:54.7,lng:-3.3}, 33:{lat:40.8,lng:22.5},
  34:{lat:41.9,lng:8.7}, 35:{lat:41.4,lng:-82.4},36:{lat:52.0,lng:4.4},
  37:{lat:42.0,lng:-71.3},38:{lat:44.5,lng:11.3},39:{lat:48.3,lng:13.0},
  40:{lat:37.9,lng:23.7},41:{lat:52.3,lng:-0.2}, 42:{lat:55.9,lng:-3.2},
  43:{lat:55.6,lng:-4.3},44:{lat:51.3,lng:-2.8}, 45:{lat:50.7,lng:7.1},
  46:{lat:49.8,lng:9.9}, 47:{lat:49.2,lng:0.4},  48:{lat:10.5,lng:-66.9},
  49:{lat:46.7,lng:0.8}, 50:{lat:43.6,lng:11.9}, 51:{lat:49.0,lng:3.0},
  52:{lat:21.5,lng:39.9},53:{lat:25.4,lng:81.9}, 54:{lat:36.2,lng:8.1},
  55:{lat:51.1,lng:1.2}, 56:{lat:-41.3,lng:173.2},57:{lat:49.6,lng:3.0},
  58:{lat:49.7,lng:17.9},59:{lat:54.3,lng:10.1}, 60:{lat:51.6,lng:0.1},
  61:{lat:50.7,lng:7.8}, 62:{lat:39.5,lng:-6.1}, 63:{lat:38.9,lng:-6.2},
  64:{lat:38.0,lng:-78.5},65:{lat:40.7,lng:-4.7},66:{lat:41.9,lng:44.1},
  67:{lat:41.9,lng:12.5},68:{lat:48.9,lng:-0.2}, 69:{lat:49.7,lng:18.2},
  70:{lat:51.7,lng:-2.5},71:{lat:51.2,lng:7.2},  72:{lat:51.0,lng:10.3},
  73:{lat:34.0,lng:114.0},74:{lat:48.9,lng:2.3}, 75:{lat:48.8,lng:8.9},
  76:{lat:41.9,lng:12.5},77:{lat:47.6,lng:7.6},  78:{lat:46.2,lng:6.1},
  79:{lat:43.8,lng:11.2},80:{lat:51.2,lng:-0.3}, 81:{lat:42.3,lng:-71.1},
  82:{lat:40.7,lng:-74.0},83:{lat:32.5,lng:44.5},84:{lat:54.3,lng:48.4},
  85:{lat:34.3,lng:108.9},86:{lat:37.9,lng:-8.9},87:{lat:30.2,lng:52.0},
  88:{lat:55.8,lng:37.6},89:{lat:27.9,lng:112.5},90:{lat:51.5,lng:-0.1},
  91:{lat:42.3,lng:-83.2},92:{lat:35.4,lng:117.1},93:{lat:35.7,lng:51.4},
  94:{lat:51.5,lng:0.0}, 95:{lat:45.1,lng:41.9}, 96:{lat:26.0,lng:32.5},
  97:{lat:50.6,lng:5.6}, 98:{lat:38.5,lng:27.0}, 99:{lat:41.9,lng:22.4},
  100:{lat:25.1,lng:85.5},
};

// ── Parse YAML frontmatter (simple key-value + arrays) ────────────────
function parseYaml(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const obj = {};
  const lines = m[1].split(/\r?\n/);
  let currentKey = null;
  for (const line of lines) {
    const kvMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim().replace(/^["']|["']$/g, '');
      obj[currentKey] = val || null;
      continue;
    }
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      if (!Array.isArray(obj[currentKey])) obj[currentKey] = [];
      obj[currentKey].push(listMatch[1].trim());
    }
  }
  // Parse numeric fields
  for (const k of ['birth', 'death', 'rank']) {
    if (obj[k] !== null && obj[k] !== undefined) {
      const n = parseInt(obj[k], 10);
      if (!isNaN(n)) obj[k] = n;
    }
  }
  return obj;
}

// ── Extract country ISO code ──────────────────────────────────────────
// Handles both "SA沙特阿拉伯" and "[[wiki/_region/SA沙特阿拉伯]]" formats
function isoCode(regionStr) {
  const s = regionStr.replace(/^["']|["']$/g, ''); // strip surrounding quotes
  const pathMatch = s.match(/\/([A-Z]{2})[^/]/);   // from wiki link path
  if (pathMatch) return pathMatch[1];
  const directMatch = s.match(/^([A-Z]{2})/);       // plain "DE德国" format
  return directMatch ? directMatch[1] : null;
}

// ── Read _people files → keyed by filename stem ──────────────────────
const peopleData = {};
const peopleFiles = fs.readdirSync(PEOPLE_DIR).filter(f => f.endsWith('.md'));
for (const f of peopleFiles) {
  const stem = f.replace(/\.md$/, '');
  const txt  = fs.readFileSync(path.join(PEOPLE_DIR, f), 'utf8');
  peopleData[stem] = parseYaml(txt);
}
const peopleStems = Object.keys(peopleData);

// ── Map rank → _people stem ───────────────────────────────────────────
// Resolve the person from the filename `THE100-NNN {zh} {en}.md` rather than
// the chapter's rank/about frontmatter. _people files often
// use a shorter name (法拉第 vs 迈克尔·法拉第), so fall back to matching where
// the chapter's zh/en ends with the _people stem's zh/en.
const the100Files = fs.readdirSync(THE100_DIR).filter(f => f.endsWith('.md')).sort();
const rankToAbout = {};   // rank → _people filename stem

function resolvePeopleStem(zh, en) {
  let s = peopleStems.find(st => st === `${zh} ${en}`);
  if (s) return s;
  s = peopleStems.find(st => {
    const m = st.match(/^(\S+)\s+(.+)$/);
    return m && zh.endsWith(m[1]) && en.endsWith(m[2]);
  });
  if (s) return s;
  return peopleStems.find(st => {
    const m = st.match(/^(\S+)\s+(.+)$/);
    return m && en.endsWith(m[2]);
  }) || null;
}

for (const f of the100Files) {
  const m = f.match(/^THE100-(\d{3}) (.+?) ([A-Z].+?)\.md$/);
  if (!m) continue;
  const rank = parseInt(m[1], 10);
  const stem = resolvePeopleStem(m[2].trim(), m[3].trim());
  if (stem) rankToAbout[rank] = stem;
}

// ── Build merged person list ──────────────────────────────────────────
const persons = [];

for (let rank = 1; rank <= 100; rank++) {
  const aboutStem = rankToAbout[rank];
  const p = aboutStem ? (peopleData[aboutStem] || {}) : {};

  // Names: use short display names from THE100 filename as primary (e.g. "牛顿" not "艾萨克·牛顿")
  // Fall back to _people name if filename parse fails
  const the100File = the100Files.find(f => f.startsWith(`THE100-${String(rank).padStart(3,'0')} `));
  let zh = '';
  let en = '';
  if (the100File) {
    const m = the100File.match(/THE100-\d{3} (.+?) ([A-Z].+?)\.md$/);
    if (m) { zh = m[1]; en = m[2]; }
  }
  zh = zh || p.name || '';
  en = en || p.name_en || '';

  // Tags analysis
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const domainTag  = tags[0] || '';  // e.g. role/Nature/Science/Physicist
  const parts      = domainTag.split('/');
  const domain     = parts[1] || '';     // Nature | Spirit | Society
  const category   = parts[2] || '';     // Science | Humanities | Governance …
  const role       = parts[3] || '';     // Physicist | Philosopher …

  // Countries (ISO list; element 0 = the representative country).
  // `region` is assigned later, once the _region hierarchy is loaded.
  const regionArr  = Array.isArray(p.region) ? p.region : [];
  const countries  = regionArr.map(isoCode).filter(Boolean);

  const coords = COORDS[rank] || { lat: 0, lng: 0 };

  persons.push({
    rank,
    zh,
    en,
    birth:     p.birth  ?? null,
    death:     p.death  ?? null,
    birth_lat: coords.lat,
    birth_lng: coords.lng,
    region:    '',
    countries,
    tags,
    domain,
    category,
    role,
    img:       p.img || null,
  });
}

// ── Collect all unique tags for TAGS export ───────────────────────────
const allTagsSet = new Set();
persons.forEach(p => p.tags.forEach(t => allTagsSet.add(t)));
const allTags = [...allTagsSet].sort();

// ── Read _region files → COUNTRIES + CONTINENTS ───────────────────────
// Vault uses a 3-tier chain linked by `master`: country → subregion → continent
// (some countries hang straight off a continent, e.g. US → NorthAmerica北美洲).
// Filenames: ISO+中文 for countries (DE德国); CamelCase+中文 for subregions /
// continents (WestEurope西欧, Europe欧洲). `master` links are bare: "[[WestEurope西欧]]".
const countries  = {};   // { GB: { zh, en, lat, lon, subregion, continent, flag } }
const continents = {};   // { 欧洲: { zh, en, lat, lon } }
const subregions = {};   // { 西欧: { zh, en, continent } }

// Pass 1: index every region entry by filename stem (= the wikilink target)
const regionByStem = {};
function masterStem(yaml) {
  const m = (yaml.master || '').match(/\[\[(?:wiki\/_region\/)?([^\]|]+?)(?:\|[^\]]*)?\]\]/);
  return m ? m[1].trim() : null;
}
for (const f of fs.readdirSync(REGION_DIR).filter(x => x.endsWith('.md'))) {
  const yaml = parseYaml(fs.readFileSync(path.join(REGION_DIR, f), 'utf8'));
  if (!yaml.type) continue;
  const stem = f.replace(/\.md$/, '');
  const isoMatch = stem.match(/^([A-Z]{2})(?:[^A-Za-z]|$)/);
  regionByStem[stem] = {
    stem,
    type:    yaml.type,
    name:    yaml.name    || '',
    name_en: yaml.name_en || '',
    lat:     yaml.lat != null ? parseFloat(yaml.lat) : null,
    lon:     yaml.lon != null ? parseFloat(yaml.lon) : null,
    master:  masterStem(yaml),
    iso:     yaml.type === 'country' && isoMatch ? isoMatch[1] : null,
    flag:    yaml.img || null,
  };
}

// Walk the master chain to the nearest ancestor of a given type
function ancestorOfType(entry, type) {
  const seen = new Set();
  let cur = entry.master ? regionByStem[entry.master] : null;
  while (cur && !seen.has(cur.stem)) {
    if (cur.type === type) return cur;
    seen.add(cur.stem);
    cur = cur.master ? regionByStem[cur.master] : null;
  }
  return null;
}

// Pass 2: emit continents (keyed by 中文 name) and countries (keyed by ISO)
for (const stem in regionByStem) {
  const e = regionByStem[stem];
  if (e.type === 'continent') {
    continents[e.name] = { zh: e.name, en: e.name_en, lat: e.lat ?? 0, lon: e.lon ?? 0 };
  } else if (e.type === 'subregion') {
    const cont = ancestorOfType(e, 'continent');
    subregions[e.name] = { zh: e.name, en: e.name_en, continent: cont ? cont.name : '' };
  } else if (e.type === 'country' && e.iso) {
    const cont = ancestorOfType(e, 'continent');
    const sub  = ancestorOfType(e, 'subregion');
    countries[e.iso] = {
      zh:        e.name,
      en:        e.name_en,
      lat:       e.lat ?? 0,
      lon:       e.lon ?? 0,
      subregion: sub  ? sub.name  : '',
      continent: cont ? cont.name : '',
      flag:      e.flag || `https://flagcdn.com/w320/${e.iso.toLowerCase()}.png`,
    };
  }
  // 'region' (cultural-geographic) entries are not emitted standalone
}

// ── Merge in the complete country reference ───────────────────────────
// The notes only define ~27 countries; fill in the rest of the world so the
// map can attribute every polygon to a region. Note-derived values win.
let refAdded = 0, refFilled = 0;
for (const [iso, rc] of Object.entries(COUNTRY_REF.COUNTRIES)) {
  if (!countries[iso]) {
    countries[iso] = { ...rc };
    refAdded++;
  } else {
    for (const k of ['zh', 'en', 'lat', 'lon', 'subregion', 'continent', 'flag']) {
      const v = countries[iso][k];
      if (v === '' || v === null || v === undefined) { countries[iso][k] = rc[k]; refFilled++; }
    }
  }
}

// ── Assign each person's region = representative country's subregion (||continent) ──
function deriveRegion(isoList) {
  for (const iso of isoList) {
    const c = countries[iso];
    if (c && (c.subregion || c.continent)) return c.subregion || c.continent;
  }
  return '';
}
persons.forEach(p => { p.region = deriveRegion(p.countries); });

// ── Build color buckets (REGIONS) for the subregions/continents actually used ──
// Palette grouped by continent: Europe=cool, Asia=warm, Africa=earth, Americas=purple/pink, Oceania=green.
const REGION_COLOR = {
  '西欧':'#4a90d9', '南欧':'#38b2a8', '北欧':'#2f4b8f', '东欧':'#7a6fd0', '欧洲':'#4a90d9',
  '西亚':'#e8a838', '南亚':'#e0673a', '东亚':'#e05252', '亚洲':'#e8a838',
  '北非':'#a0522d', '非洲':'#a0522d',
  '北美洲':'#b8569e', '中美洲':'#c86fa0', '加勒比':'#c060a0', '南美':'#d77fb0', '拉丁美洲':'#d77fb0',
  '澳新':'#2ecc71', '大洋洲':'#27ae60',
};
const REGION_ORDER = [
  '西欧','南欧','北欧','东欧','欧洲',
  '西亚','南亚','东亚','亚洲',
  '北非','非洲',
  '北美洲','中美洲','加勒比','南美','拉丁美洲',
  '澳新','大洋洲',
];
function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
const usedRegions = new Set(persons.map(p => p.region).filter(Boolean));
// Every region that can be picked in the filter dropdown needs a color: the
// regions the people span, plus any subregion defined in the notes (e.g.
// 加勒比/中美洲, which currently have no people but are still selectable).
const colorRegions = new Set([...usedRegions, ...Object.keys(subregions)]);
const orderedRegions = [
  ...REGION_ORDER.filter(k => colorRegions.has(k)),
  ...[...colorRegions].filter(k => !REGION_ORDER.includes(k)),
];
const regions = {};
for (const key of [...new Set(orderedRegions)]) {
  const color = REGION_COLOR[key] || '#888888';
  regions[key] = { label: key, color, bg: hexToRgba(color, 0.15) };
}

// ── Write data.js ─────────────────────────────────────────────────────
const js = `// Auto-generated by build-data.js — do not edit manually
const PERSONS = ${JSON.stringify(persons, null, 2)};

// Countries keyed by ISO code — _region/ notes merged with country-ref.js (complete)
const COUNTRIES = ${JSON.stringify(countries, null, 2)};

// Continents keyed by Chinese name — read from _region/
const CONTINENTS = ${JSON.stringify(continents, null, 2)};

// Subregions keyed by Chinese name — read from _region/ (each linked to its continent)
const SUBREGIONS = ${JSON.stringify(subregions, null, 2)};

// Color buckets — one per subregion (||continent) actually used by the 100 people
const REGIONS = ${JSON.stringify(regions, null, 2)};

const DOMAIN_LABELS = {
  Nature:  { label:"自然·科学", color:"#52a8e0" },
  Spirit:  { label:"思想·文化", color:"#e0a840" },
  Society: { label:"政治·社会", color:"#e05270" },
};

const ROLE_LABELS = {
  Physicist:      "物理学家",
  Mathematician:  "数学家",
  Biologist:      "生物学家",
  Chemist:        "化学家",
  Astronomer:     "天文学家",
  Doctor:         "医学家",
  MedResearcher:  "医学研究者",
  Inventor:       "发明家",
  Industrialist:  "实业家",
  Philosopher:    "哲学家",
  SocialScientist:"社会科学家",
  Artist:         "艺术家",
  Author:         "作家",
  Composer:       "作曲家",
  Spiritual:      "宗教创始人",
  Clergy:         "宗教领袖",
  Theologian:     "神学家",
  Politician:     "政治家",
  General:        "军事家",
  Conqueror:      "征服者",
  Explorer:       "探险家",
};

const ALL_TAGS = ${JSON.stringify(allTags, null, 2)};
`;

// Safety guard: refuse to overwrite data.js with degraded data. If the vault
// notes aren't fully readable (e.g. unavailable files, unmatched person
// filenames, or missing region metadata) the person data collapses — abort instead of
// clobbering the good data.js. Set FORCE=1 to override.
const withRegion = persons.filter(p => p.region).length;
const outPath = process.env.OUT_DATA || OUT_FILE;
if (withRegion < 95 && !process.env.FORCE) {
  console.error(`ABORT: only ${withRegion}/100 persons resolved a region — vault notes look incomplete.`);
  console.error('data.js was NOT modified. Fix the source notes, or run enrich-data.js to merge countries into the existing data.js.');
  process.exit(1);
}

fs.writeFileSync(outPath, js, 'utf8');
console.log(`${path.basename(outPath)} written — ${persons.length} persons (${withRegion} with region), ${allTags.length} unique tags`);
console.log(`countries: ${Object.keys(countries).length} (ref added ${refAdded}, filled ${refFilled} fields), regions: ${Object.keys(regions).length}`);
console.log('\nSample (rank 1):');
console.log(JSON.stringify(persons[0], null, 2));
console.log('\nSample (rank 5):');
console.log(JSON.stringify(persons[4], null, 2));
