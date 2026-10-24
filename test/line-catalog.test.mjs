import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = (name) => (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
['core', 'routes', 'line-catalog'].forEach(load);
const Catalog = globalThis.SignLineCatalog;
const Routes = globalThis.SignRoutes;
const file = (lines = [], extras = {}) => ({ format: 'railway-line-catalog', version: 1, lines, ...extras });
const line = (id = 'line-2', nameZh = '2号线') => Routes.createLine({ id, nameZh, nameEn: 'Line 2', color: '#1dbcbf' });
const response = (value) => ({ ok: true, status: 200, text: async () => JSON.stringify(value) });

test('初始公共目录为空，不填造服务器线路，缺省更新时间返回null', () => {
  const parsed = Catalog.parse(readFileSync(new URL('../data/lines.json', import.meta.url), 'utf8'));
  assert.deepEqual(parsed, { lines: [], updatedAt: null, warnings: [] });
});

test('公共目录逐条校验并返回独立完整线路，同名不同ID均保留', () => {
  const a = line('a'), b = line('b'), raw = file([a, b], { updatedAt: '2026-10-24T12:00:00Z' });
  const before = structuredClone(raw);
  const parsed = Catalog.parse('\uFEFF' + JSON.stringify(raw));
  assert.deepEqual(parsed.lines.map((item) => item.id), ['a', 'b']);
  assert.equal(parsed.lines[0].color, '#1DBCBF');
  assert.equal(parsed.lines[0].stations.length, 3);
  assert.equal(parsed.updatedAt, raw.updatedAt);
  assert.deepEqual(parsed.warnings, []);
  parsed.lines[0].stations[0].nameZh = '仅修改公共结果';
  assert.deepEqual(raw, before);
});

test('顶层格式、版本、数组与更新时间类型损坏明确拒绝，不假装空目录', () => {
  for (const raw of [null, [], 'invalid JSON', file([], { format: 'railway-line' }),
    file([], { version: 2 }), file(null), file([], { updatedAt: 24 })]) {
    assert.throws(() => Catalog.parse(raw), /公共线路目录/);
  }
});

test('默认跳过坏线路和重复ID并报告索引，不能按名称覆盖另一线路', () => {
  const first = line('first'), second = line('second');
  const parsed = Catalog.parse(file([first, { ...line('bad'), color: 'invalid' }, { ...first, nameZh: '重复ID' }, second]));
  assert.deepEqual(parsed.lines.map((item) => item.id), ['first', 'second']);
  assert.equal(parsed.warnings.length, 2);
  assert.match(parsed.warnings[0], /第 2 条/);
  assert.match(parsed.warnings[1], /第 3 条.*ID/);
  const stations = line('bad-stations'); stations.stations[1].id = stations.stations[0].id;
  assert.equal(Catalog.parse(file([stations])).lines.length, 0);
});

test('严格模式拒绝任一坏线路与重复ID，供管理员发布前检查', () => {
  assert.throws(() => Catalog.parse(file([{ ...line(), color: 'bad' }]), { strict: true }), /公共线路目录/);
  const duplicate = line();
  assert.throws(() => Catalog.parse(file([duplicate, duplicate]), { strict: true }), /ID/);
});

test('管理员导出完整线路目录可往返，保留外线配色且不修改源线路', () => {
  const a = line('a'), transfer = line('b', '云间线');
  a.stations[0].transfers = transfer.nameZh;
  const populated = Routes.withRelatedLines(a, [transfer]), before = structuredClone(populated);
  const exported = Catalog.serialize([populated, transfer], { updatedAt: '2026-10-24' });
  assert.ok(exported.endsWith('\n'));
  const parsed = Catalog.parse(exported, { strict: true });
  assert.deepEqual(parsed.lines, [populated, transfer]);
  assert.equal(parsed.lines[0].relatedLines[0].id, transfer.id);
  assert.deepEqual(populated, before);
  assert.equal(JSON.parse(Catalog.serialize([])).updatedAt, undefined);
});

test('管理员导出拒绝非法列表、坏线路、重复ID和非法更新时间', () => {
  for (const entries of [null, {}, [line(), line()], [{ ...line(), currentStationId: 'missing' }]]) {
    assert.throws(() => Catalog.serialize(entries), /公共线路目录/);
  }
  assert.throws(() => Catalog.serialize([], { updatedAt: 24 }), /公共线路目录/);
});

test('加载从站点baseURL解析相对目录并禁用缓存，不读写App或本地库', async () => {
  const oldApp = Object.getOwnPropertyDescriptor(globalThis, 'App');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'App', { configurable: true, get() { throw new Error('不能读取App'); } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('不能读取本地库'); } });
  try {
    let request;
    const result = await Catalog.load({ baseURL: 'https://sign.motiquies.yuchan.moe/editor/index.html',
      fetch: async (url, options) => { request = { url, options }; return response(file([line()])); } });
    assert.equal(request.url, 'https://sign.motiquies.yuchan.moe/editor/data/lines.json');
    assert.equal(request.options.cache, 'no-store');
    assert.equal(result.lines[0].id, 'line-2');
  } finally {
    if (oldApp) Object.defineProperty(globalThis, 'App', oldApp); else delete globalThis.App;
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage;
  }
});

test('加载可指定目录URL，HTTP失败、网络失败和非JSON内容均拒绝', async () => {
  let requested;
  await Catalog.load({ url: 'https://example.com/railways.json',
    fetch: async (url) => { requested = url; return response(file()); } });
  assert.equal(requested, 'https://example.com/railways.json');
  await assert.rejects(Catalog.load({ fetch: async () => ({ ok: false, status: 404 }) }), /404/);
  await assert.rejects(Catalog.load({ fetch: async () => { throw new Error('网络断开'); } }), /网络断开/);
  await assert.rejects(Catalog.load({ fetch: async () => ({ ok: true, text: async () => '<html>404</html>' }) }), /公共线路目录/);
});

test('加载超时会拒绝并中止请求，即使fetch未主动响应中止', async () => {
  let signal;
  await assert.rejects(Catalog.load({ timeoutMs: 5, fetch: (_url, options) => {
    signal = options.signal; return new Promise(() => {});
  } }), /超时/);
  assert.equal(signal.aborted, true);
});

test('并发加载独立返回，不缓存也不把较迟响应写入任何共享状态', async () => {
  const pending = [];
  const fetch = () => new Promise((resolve) => pending.push(resolve));
  const first = Catalog.load({ fetch }), second = Catalog.load({ fetch });
  await Promise.resolve();
  assert.equal(pending.length, 2);
  pending[1](response(file([line('newer')])));
  assert.equal((await second).lines[0].id, 'newer');
  pending[0](response(file([line('older')])));
  assert.equal((await first).lines[0].id, 'older');
});
