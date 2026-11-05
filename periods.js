// Site-owned auxiliary historical periods shown on the timeline (not generated
// from source notes). Periods may overlap and need not cover every year.
//
// Years follow data.js: negative = BC (e.g. -551 = 551 BC).
// approx:  conventional boundaries of a movement or age, shown as “约”.
// ongoing: still continuing; `end` is only the drawing limit, shown as “至今”.
// tier 1:  shown at every zoom level; tier 2: shown when the view spans ≤ 2500 years.
// cat:     a key of PERIOD_CATEGORIES (color family on the timeline).
const PERIOD_CATEGORIES = Object.freeze({
  civ:     { zh: '文明与王朝', color: '#8fa8ff' },
  thought: { zh: '思想与文化', color: '#e6c27a' },
  science: { zh: '科技与经济', color: '#4fd1c5' },
  war:     { zh: '战争与变局', color: '#ef7d7d' },
});

const PERIODS = Object.freeze([
  // ── Ancient ──
  { id: 'egypt-old-kingdom', zh: '古埃及古王国', en: 'Old Kingdom of Egypt', start: -2686, end: -2181, cat: 'civ', tier: 2, approx: true,
    note: '金字塔时代，吉萨大金字塔建于此期。' },
  { id: 'axial-age', zh: '轴心时代', en: 'Axial Age', start: -800, end: -200, cat: 'thought', tier: 1, approx: true,
    note: '雅斯贝尔斯提出的概念：中国、印度、希腊等地几乎同时出现奠基性的思想家。' },
  { id: 'eastern-zhou', zh: '春秋战国', en: 'Spring and Autumn & Warring States', start: -770, end: -221, cat: 'civ', tier: 2,
    note: '自周平王东迁至秦统一六国，诸子百家争鸣。' },
  { id: 'achaemenid', zh: '波斯阿契美尼德帝国', en: 'Achaemenid Empire', start: -550, end: -330, cat: 'civ', tier: 2,
    note: '居鲁士大帝建立，后为亚历山大所灭。' },
  { id: 'roman-republic', zh: '罗马共和国', en: 'Roman Republic', start: -509, end: -27, cat: 'civ', tier: 2,
    note: '自驱逐末代国王至屋大维称“奥古斯都”。' },
  { id: 'classical-greece', zh: '古典希腊', en: 'Classical Greece', start: -510, end: -323, cat: 'civ', tier: 2, approx: true,
    note: '雅典民主与哲学的黄金期，止于亚历山大之死。' },
  { id: 'hellenistic', zh: '希腊化时代', en: 'Hellenistic Period', start: -323, end: -31, cat: 'civ', tier: 2,
    note: '亚历山大死后希腊文化向地中海与西亚传播，止于亚克兴海战。' },
  { id: 'maurya', zh: '孔雀王朝', en: 'Maurya Empire', start: -322, end: -185, cat: 'civ', tier: 2, approx: true,
    note: '首个统一印度次大陆大部的王朝，阿育王推广佛教。' },
  { id: 'han', zh: '汉朝', en: 'Han Dynasty', start: -202, end: 220, cat: 'civ', tier: 1,
    note: '奠定中华帝国制度与文化的长期王朝，丝绸之路开通。' },
  { id: 'roman-empire', zh: '罗马帝国', en: 'Roman Empire', start: -27, end: 476, cat: 'civ', tier: 1,
    note: '自奥古斯都至西罗马帝国灭亡。' },

  // ── Medieval ──
  { id: 'byzantine', zh: '拜占庭帝国', en: 'Byzantine Empire', start: 330, end: 1453, cat: 'civ', tier: 2,
    note: '自君士坦丁堡建都至其被奥斯曼攻陷。' },
  { id: 'tang', zh: '唐朝', en: 'Tang Dynasty', start: 618, end: 907, cat: 'civ', tier: 2,
    note: '中国古代的鼎盛王朝之一，诗歌与对外交流繁荣。' },
  { id: 'islamic-golden-age', zh: '伊斯兰黄金时代', en: 'Islamic Golden Age', start: 750, end: 1258, cat: 'thought', tier: 1, approx: true,
    note: '阿拔斯王朝时期，巴格达的翻译运动与科学、哲学繁荣，止于蒙古攻陷巴格达。' },
  { id: 'song', zh: '宋朝', en: 'Song Dynasty', start: 960, end: 1279, cat: 'civ', tier: 2,
    note: '活字印刷、火药、指南针得到广泛应用，商业与城市高度发达。' },
  { id: 'crusades', zh: '十字军东征', en: 'The Crusades', start: 1096, end: 1291, cat: 'war', tier: 2,
    note: '西欧对地中海东岸的一系列宗教战争，止于阿卡陷落。' },
  { id: 'mongol-empire', zh: '蒙古帝国', en: 'Mongol Empire', start: 1206, end: 1368, cat: 'civ', tier: 1,
    note: '成吉思汗建国，后分裂为诸汗国，至元朝退出中原。' },
  { id: 'black-death', zh: '黑死病', en: 'Black Death', start: 1346, end: 1353, cat: 'war', tier: 2,
    note: '鼠疫大流行，欧洲约三分之一人口死亡。' },
  { id: 'ming', zh: '明朝', en: 'Ming Dynasty', start: 1368, end: 1644, cat: 'civ', tier: 2,
    note: '郑和下西洋，王阳明心学兴起。' },

  // ── Early modern ──
  { id: 'renaissance', zh: '文艺复兴', en: 'Renaissance', start: 1350, end: 1600, cat: 'thought', tier: 1, approx: true,
    note: '起于意大利的人文主义与艺术、学术复兴，约 14–16 世纪。' },
  { id: 'age-of-discovery', zh: '大航海时代', en: 'Age of Discovery', start: 1415, end: 1600, cat: 'civ', tier: 1, approx: true,
    note: '欧洲远洋探索开辟新航路，连接美洲、非洲与亚洲。' },
  { id: 'reformation', zh: '宗教改革', en: 'Protestant Reformation', start: 1517, end: 1648, cat: 'thought', tier: 1,
    note: '自路德发表《九十五条论纲》至威斯特伐利亚和约。' },
  { id: 'scientific-revolution', zh: '科学革命', en: 'Scientific Revolution', start: 1543, end: 1687, cat: 'science', tier: 1, approx: true,
    note: '常以哥白尼《天体运行论》与牛顿《自然哲学的数学原理》为界。' },
  { id: 'thirty-years-war', zh: '三十年战争', en: "Thirty Years' War", start: 1618, end: 1648, cat: 'war', tier: 2,
    note: '欧洲宗教与强权战争，以威斯特伐利亚和约结束。' },
  { id: 'qing', zh: '清朝', en: 'Qing Dynasty', start: 1644, end: 1912, cat: 'civ', tier: 2,
    note: '中国最后一个帝制王朝。' },
  { id: 'enlightenment', zh: '启蒙运动', en: 'Age of Enlightenment', start: 1687, end: 1789, cat: 'thought', tier: 1, approx: true,
    note: '理性、自由与科学的思想运动，常以牛顿《原理》至法国大革命为界。' },
  { id: 'industrial-revolution', zh: '工业革命', en: 'Industrial Revolution', start: 1760, end: 1840, cat: 'science', tier: 1, approx: true,
    note: '始于英国，蒸汽动力与机器生产改变经济与社会。' },
  { id: 'american-revolution', zh: '美国独立战争', en: 'American Revolutionary War', start: 1775, end: 1783, cat: 'war', tier: 2,
    note: '北美殖民地脱离英国独立，以巴黎和约结束。' },
  { id: 'french-revolution', zh: '法国大革命', en: 'French Revolution', start: 1789, end: 1799, cat: 'war', tier: 1,
    note: '自攻占巴士底狱至拿破仑雾月政变。' },
  { id: 'napoleonic-wars', zh: '拿破仑战争', en: 'Napoleonic Wars', start: 1803, end: 1815, cat: 'war', tier: 2,
    note: '止于滑铁卢战役。' },

  // ── Modern ──
  { id: 'opium-war', zh: '第一次鸦片战争', en: 'First Opium War', start: 1839, end: 1842, cat: 'war', tier: 2,
    note: '以《南京条约》结束，常被视为中国近代史的开端。' },
  { id: 'american-civil-war', zh: '美国南北战争', en: 'American Civil War', start: 1861, end: 1865, cat: 'war', tier: 2,
    note: '联邦胜利，废除奴隶制。' },
  { id: 'meiji', zh: '明治时代', en: 'Meiji Era', start: 1868, end: 1912, cat: 'civ', tier: 2,
    note: '明治维新开启日本的现代化。' },
  { id: 'second-industrial-revolution', zh: '第二次工业革命', en: 'Second Industrial Revolution', start: 1870, end: 1914, cat: 'science', tier: 2, approx: true,
    note: '电力、钢铁、化工与内燃机推动大规模工业化。' },
  { id: 'ww1', zh: '第一次世界大战', en: 'World War I', start: 1914, end: 1918, cat: 'war', tier: 1,
    note: '以协约国胜利告终，四大帝国瓦解。' },
  { id: 'russian-revolution', zh: '俄国革命', en: 'Russian Revolution', start: 1917, end: 1922, cat: 'war', tier: 2,
    note: '自二月革命、十月革命经内战至苏联成立。' },
  { id: 'great-depression', zh: '大萧条', en: 'Great Depression', start: 1929, end: 1939, cat: 'science', tier: 2, approx: true,
    note: '始于美国股市崩盘的全球经济危机。' },
  { id: 'ww2', zh: '第二次世界大战', en: 'World War II', start: 1939, end: 1945, cat: 'war', tier: 1,
    note: '人类历史上规模最大的战争，战后联合国成立。' },
  { id: 'cold-war', zh: '冷战', en: 'Cold War', start: 1947, end: 1991, cat: 'war', tier: 1,
    note: '美苏两大阵营的长期对峙，止于苏联解体。' },
  { id: 'space-race', zh: '太空竞赛', en: 'Space Race', start: 1957, end: 1975, cat: 'science', tier: 2,
    note: '自“斯普特尼克 1 号”至阿波罗—联盟号对接。' },
  { id: 'information-age', zh: '信息时代', en: 'Information Age', start: 1970, end: 2030, cat: 'science', tier: 2, approx: true, ongoing: true,
    note: '个人计算机、互联网与移动通信重塑社会。' },
]);
