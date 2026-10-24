import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = (name) => (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
['core', 'icons', 'crt-symbols', 'crt-catalog', 'crt-render', 'state', 'render', 'composition', 'routes'].forEach(load);
const Routes = globalThis.SignRoutes;
const Render = globalThis.SignRender;
const State = globalThis.SignState;
const Core = globalThis.SignCore;
const measure = (text, font, weight, size) => Array.from(String(text)).length * size * 0.6;
measure.ink = (text, font, weight, size) => ({ abl: 0, abr: measure(text, font, weight, size), adv: measure(text, font, weight, size) });
measure.ascent = (text, font, weight, size) => size * 0.8;
measure.descent = (text, font, weight, size) => size * 0.2;
const memory = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

function example() {
  return Routes.createLine({
    nameZh: '示例九号线', nameEn: 'Example Line 9', color: '#005eb8',
    stations: [
      { id: 'west', nameZh: '西站', nameEn: 'West', code: '01', transfers: '' },
      { id: 'central', nameZh: '中心站', nameEn: 'Central', code: '02', transfers: '1号线 / 环线' },
      { id: 'east', nameZh: '东站', nameEn: 'East', code: '03', transfers: '' },
    ],
    currentStationId: 'central', direction: 'forward',
  });
}

test('新建线路与站点有独立 ID，宽容校验不修改输入且保留中文换乘', () => {
  const a = Routes.createLine(), b = Routes.createLine();
  assert.notEqual(a.id, b.id);
  assert.equal(new Set(a.stations.map((s) => s.id)).size, a.stations.length);
  assert.ok(a.stations.length > 0);
  const input = { nameZh: '线路', color: 'invalid', stations: [{ id: 'same', nameZh: '甲站' }, { id: 'same', nameZh: '乙站' }], direction: 'invalid' };
  const before = structuredClone(input);
  const line = Routes.normalizeLine(input);
  assert.deepEqual(input, before);
  assert.equal(line.color, '#005EB8');
  assert.equal(line.direction, 'forward');
  assert.equal(new Set(line.stations.map((s) => s.id)).size, 2);
  assert.equal(example().stations[1].transfers, '1号线 / 环线');
});

test('增删修改和排序站点均不可变，本站按 ID 跟随且删除后选择相邻站', () => {
  const original = example(), before = structuredClone(original);
  let line = Routes.addStation(original, { nameZh: '新增站', nameEn: 'New', code: '04' }, 1);
  assert.deepEqual(original, before);
  const added = line.stations[1];
  line = Routes.updateStation(line, added.id, { nameZh: '新城站', transfers: '3号线' });
  assert.equal(line.stations[1].nameZh, '新城站');
  assert.equal(line.stations[1].transfers, '3号线');
  line = Routes.moveStation(line, 2, 0);
  assert.equal(line.currentStationId, 'central');
  assert.equal(line.stations[0].id, 'central');
  line = Routes.removeStation(line, 'central');
  assert.ok(line.stations.some((s) => s.id === line.currentStationId));
  line.stations.slice().forEach((station) => { line = Routes.removeStation(line, station.id); });
  assert.deepEqual(line.stations, []);
  assert.equal(line.currentStationId, null);
});

test('线路名称、颜色、运行方向和本站可独立更新，不复用站点对象', () => {
  const original = example();
  const next = Routes.patchLine(original, { nameZh: '新线路名', direction: 'backward', currentStationId: 'east' });
  assert.equal(next.nameZh, '新线路名');
  assert.equal(next.direction, 'backward');
  assert.equal(next.currentStationId, 'east');
  assert.notEqual(next.stations, original.stations);
  assert.notEqual(next.stations[0], original.stations[0]);
  assert.equal(original.direction, 'forward');
});

test('独立线路 JSON 带格式版本，中文、站号、换乘和当前站往返一致', () => {
  const line = example();
  const json = Routes.serialize(line);
  const file = JSON.parse(json);
  assert.equal(file.format, 'railway-line');
  assert.equal(file.version, 1);
  assert.ok(json.includes('中心站'));
  assert.ok(json.includes('1号线 / 环线'));
  assert.deepEqual(Routes.deserialize(json), line);
  assert.deepEqual(Routes.deserialize(file), line);
});

test('导入拒绝整项目、未知版本、非字符串站名、无效颜色和重复站点 ID', () => {
  const line = example(), file = { format: 'railway-line', version: 1, line };
  for (const invalid of [
    {}, { rows: [] }, { ...file, format: 'sign-project' }, { ...file, version: 2 },
    { ...file, line: { ...line, stations: 'not-an-array' } },
    { ...file, line: { ...line, color: 'url(evil)' } },
    { ...file, line: { ...line, stations: line.stations.map((s, i) => i === 1 ? { ...s, nameZh: 123 } : s) } },
    { ...file, line: { ...line, stations: [line.stations[0], line.stations[0]] } },
    { ...file, line: { ...line, currentStationId: 'unknown' } },
  ]) assert.throws(() => Routes.deserialize(invalid));
  assert.throws(() => Routes.deserialize('{bad json'));
  assert.throws(() => Routes.deserialize({ ...file, version: '1' }), /版本/);
  assert.throws(() => Routes.deserialize({ ...file, line: { ...line, direction: 'sideways' } }), /方向/);
  assert.throws(() => Routes.deserialize({ ...file, line: { ...line, stations: line.stations.map((s, i) => i === 1 ? { ...s, transfers: [] } : s) } }), /transfers/);
});

test('本地线路库支持保存、覆盖和删除，读取副本不影响保存内容', () => {
  const storage = memory(), line = example();
  assert.deepEqual(Routes.list(storage), []);
  Routes.save(line, storage);
  const saved = Routes.list(storage);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], line);
  saved[0].stations[0].nameZh = '外部修改';
  assert.equal(Routes.list(storage)[0].stations[0].nameZh, '西站');
  Routes.save(Routes.patchLine(line, { nameZh: '更新名称' }), storage);
  assert.equal(Routes.list(storage).length, 1);
  assert.equal(Routes.list(storage)[0].nameZh, '更新名称');
  Routes.remove(line.id, storage);
  assert.deepEqual(Routes.list(storage), []);
});

test('损坏的本地库不阻止读取，其它存储异常不会伪报保存成功', () => {
  const storage = memory();
  storage.setItem(Routes.STORAGE_KEY, '{broken');
  assert.deepEqual(Routes.list(storage), []);
  assert.throws(() => Routes.save(example(), { getItem: () => null, setItem: () => { throw new Error('quota'); } }), /quota/);
});

test('横向和竖向线路图均生成可编辑基础元素，保留全部站名、编号和换乘', () => {
  const line = example(), before = structuredClone(line);
  for (const orientation of ['horizontal', 'vertical']) {
    const result = Routes.materialize(line, orientation, measure);
    assert.deepEqual(line, before);
    assert.ok(result.elements.length > line.stations.length);
    assert.ok(result.widthRatio > 0);
    assert.deepEqual(result.route, { line, orientation });
    assert.ok(result.elements.every((e) => e.type !== 'crt-sign'));
    assert.equal(new Set(result.elements.map((e) => e.id)).size, result.elements.length);
    const content = JSON.stringify(result.elements.map((e) => e.props));
    for (const text of ['示例九号线', '西站', '中心站', '东站', '01', '02', '03', '1号线 / 环线']) assert.ok(content.includes(text), text);
    for (const e of result.elements) {
      const box = e.props.box;
      assert.ok(box && Object.values(box).every(Number.isFinite));
      assert.ok(box.width > 0 && box.height > 0);
      assert.ok(box.x >= -1e-9 && box.y >= -1e-9);
      assert.ok(box.x + box.width <= result.widthRatio + 1e-9);
      assert.ok(box.y + box.height <= 1 + 1e-9);
      const mt = Render.elementMetrics(e, box.height * 1000, measure);
      assert.ok(Number.isFinite(mt.width) && mt.width >= 0);
    }
  }
});

test('本站和运行方向改变线路图，站点增多使自然比例随内容增长', () => {
  const line = example(), forward = Routes.materialize(line, 'horizontal', measure);
  const backward = Routes.materialize(Routes.patchLine(line, { direction: 'backward', currentStationId: 'east' }), 'horizontal', measure);
  assert.notDeepEqual(forward.elements.map((e) => e.props), backward.elements.map((e) => e.props));
  const longer = Routes.addStation(line, { nameZh: '加站', nameEn: 'Added', code: '04' });
  assert.ok(Routes.materialize(longer, 'horizontal', measure).widthRatio > forward.widthRatio);
  assert.ok(Routes.materialize(longer, 'vertical', measure).widthRatio < Routes.materialize(line, 'vertical', measure).widthRatio);
});

test('空站点和单站线路仍可创建、保存并生成有限几何', () => {
  for (const stations of [[], [{ nameZh: '唯一站', nameEn: 'Only', code: '01', transfers: '' }]]) {
    const line = Routes.createLine({ stations });
    assert.deepEqual(Routes.deserialize(Routes.serialize(line)), line);
    for (const orientation of ['horizontal', 'vertical']) {
      const result = Routes.materialize(line, orientation, measure);
      assert.ok(result.elements.length > 0);
      assert.ok(Number.isFinite(result.widthRatio));
    }
  }
});

test('长站名、英文与换乘内容不被截断，二十站的定位仍全部落在自然牌面内', () => {
  const stations = Array.from({ length: 20 }, (_, i) => ({
    id: 'station-' + i, nameZh: '这是需要完整保留的长站名' + i,
    nameEn: 'A deliberately long station name ' + i, code: String(i + 1).padStart(2, '0'),
    transfers: i === 8 ? '环线 / 3号线 / 市域铁路' : '',
  }));
  const line = Routes.createLine({ stations, currentStationId: 'station-8' });
  for (const orientation of ['horizontal', 'vertical']) {
    const result = Routes.materialize(line, orientation, measure);
    const content = JSON.stringify(result.elements.map((e) => e.props));
    for (const station of stations) assert.ok(content.includes(station.nameZh));
    assert.ok(content.includes('环线 / 3号线 / 市域铁路'));
    for (const e of result.elements) {
      const b = e.props.box;
      assert.ok(b.x >= 0 && b.y >= 0);
      assert.ok(b.x + b.width <= result.widthRatio + 1e-9);
      assert.ok(b.y + b.height <= 1 + 1e-9);
    }
  }
});

test('本地库只跳过损坏的线路记录，合法的独立线路仍可读取', () => {
  const storage = memory(), line = example();
  storage.setItem(Routes.STORAGE_KEY, JSON.stringify({ format: 'railway-line-library', version: 1,
    lines: [{ ...line, id: 'broken', stations: null }, line, line] }));
  assert.deepEqual(Routes.list(storage), [line]);
});

test('线路图放入牌面后完整保存布局、运行数据和基础元素，不被导入归一改变', () => {
  const line = example();
  for (const orientation of ['horizontal', 'vertical']) {
    const result = Routes.materialize(line, orientation, measure);
    const initial = State.createSign();
    const sign = State.addTemplateRow(initial, initial.rows[0].id, result.elements,
      { widthRatio: result.widthRatio, route: result.route });
    assert.deepEqual(sign.rows[0].route, { line, orientation });
    assert.deepEqual(State.deserializeSign(State.serializeSign(sign)), sign);
  }
});

test('二十至二百五十六站线路收敛自然比例，站名和换乘盒互不覆盖', () => {
  for (const count of [20, 60, 256]) {
    const stations = Array.from({ length: count }, (_, index) => ({ id: 's-' + index,
      nameZh: '车站' + index, nameEn: 'Station ' + index, code: String(index + 1), transfers: '换乘线路' }));
    const line = Routes.createLine({ stations, currentStationId: 's-8' });
    for (const orientation of ['horizontal', 'vertical']) {
      const result = Routes.materialize(line, orientation, measure);
      assert.ok(result.widthRatio >= 0.1 && result.widthRatio <= 64, orientation + ':' + count);
      const names = result.elements.filter((e) => /^车站\d+$/.test(e.props.textZh || e.props.text || ''));
      assert.equal(names.length, count);
      const transfers = result.elements.filter((e) => e.type === 'plain-text' && e.props.text === '换乘线路');
      assert.equal(transfers.length, count);
      for (let index = 0; index < count - 1; index++) {
        const a = names[index].props.box, b = names[index + 1].props.box;
        const x = transfers[index].props.box, y = transfers[index + 1].props.box;
        if (orientation === 'horizontal') {
          assert.ok(a.x + a.width <= b.x + 1e-9, orientation + ':names:' + count);
          assert.ok(x.x + x.width <= y.x + 1e-9, orientation + ':transfers:' + count);
        } else {
          const overlapping = (first, second) => Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x) > 1e-9 &&
            Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y) > 1e-9;
          assert.ok(!overlapping(a, x), orientation + ':same-station:' + count);
          assert.ok(!overlapping(x, b), orientation + ':next-station:' + count);
        }
      }
    }
  }
});

function paletteLine(id, nameZh, nameEn, color) {
  return Routes.createLine({ id, nameZh, nameEn, color, stations: [] });
}

test('虚构线路颜色精确匹配数字、中英文别名，当前线路优先且不生成 ID', () => {
  const purple = paletteLine('purple-nine', '9号线', 'Line 9', '#7542A6');
  const orange = paletteLine('orange-ten', '10号线', 'Line 10', '#E97722');
  const stale = { ...purple, color: '#AAAAAA' };
  const before = structuredClone([purple, orange, stale]);
  const uuid = Core.uuid;
  Core.uuid = () => { throw new Error('纯配色查询不得生成 ID'); };
  try {
    for (const label of ['9', '9号线', 'Line 9', ' line   9 ']) {
      assert.deepEqual(Routes.colorFor(label, [stale, orange], purple), {
        id: purple.id, line: '9', name: '9号线', nameEn: 'Line 9', bg: '#7542A6',
      });
    }
    assert.equal(Routes.colorFor('10', [purple, orange], purple).bg, '#E97722');
    for (const label of ['', '19', '99号线', 'Line 90', '9号线支线', 'Line 9 Express']) {
      assert.equal(Routes.colorFor(label, [purple, orange], purple), null, label);
    }
    assert.deepEqual([purple, orange, stale], before);
  } finally { Core.uuid = uuid; }
});

test('命名线路支持完整中文、去线后缀和英文名，不用子串误配其它线路', () => {
  const cloud = paletteLine('cloud', '云间线', 'Cloud Valley Line', '#1155CC');
  for (const label of ['云间', '云间线', 'Cloud Valley Line', ' cloud  valley LINE ']) {
    assert.equal(Routes.colorFor(label, [cloud]).line, '云间', label);
    assert.equal(Routes.colorFor(label, [cloud]).bg, '#1155CC', label);
  }
  for (const label of ['云', '间', '云间快线', 'Cloud', 'Valley']) assert.equal(Routes.colorFor(label, [cloud]), null);
});

test('我的线路色板按颜色合并名字并附通用色，当前线路覆盖同 ID 旧颜色', () => {
  const cloud = paletteLine('cloud', '云间线', 'Cloud Line', '#112233');
  const lake = paletteLine('lake', '湖畔线', 'Lake Line', '#112233');
  const black = paletteLine('black', '黑山线', 'Black Mountain Line', '#000000');
  const before = structuredClone([cloud, lake, black]);
  const swatches = Routes.swatches([{ ...cloud, color: '#ABABAB' }, lake, black], cloud);
  assert.equal(new Set(swatches.map((s) => s.bg)).size, swatches.length);
  assert.equal(swatches.some((s) => s.bg === '#ABABAB'), false);
  assert.ok(swatches.find((s) => s.bg === '#112233').name.includes('云间线'));
  assert.ok(swatches.find((s) => s.bg === '#112233').name.includes('湖畔线'));
  assert.ok(swatches.find((s) => s.bg === '#000000').name.includes('黑山线'));
  for (const color of Core.UNIVERSAL_SWATCHES) assert.ok(swatches.find((s) => s.bg === color.bg).name.includes(color.name));
  assert.deepEqual([cloud, lake, black], before);
});

test('换乘线路快照只保存需要的外线颜色，不递归复制线路及站点', () => {
  const nine = paletteLine('nine', '9号线', 'Line 9', '#7542A6');
  const ten = paletteLine('ten', '10号线', 'Line 10', '#E97722');
  const cloud = paletteLine('cloud', '云间线', 'Cloud Line', '#1166AA');
  const unused = paletteLine('unused', '未使用线', 'Unused Line', '#009988');
  const line = Routes.addStation(nine, { id: 'interchange', nameZh: '换乘站', nameEn: 'Interchange', code: '01',
    transfers: '9 / 10号线、云间，Line 10\nCloud Line; 不存在的线路' });
  const source = [nine, { ...ten, relatedLines: [cloud], stations: [{ id: 'nested' }] }, cloud, unused];
  const before = structuredClone([line, source]);
  const result = Routes.withRelatedLines(line, source);
  assert.deepEqual(result.relatedLines, [
    { id: 'ten', nameZh: '10号线', nameEn: 'Line 10', color: '#E97722' },
    { id: 'cloud', nameZh: '云间线', nameEn: 'Cloud Line', color: '#1166AA' },
  ]);
  assert.deepEqual([line, source], before);
  assert.equal(JSON.stringify(result.relatedLines).includes('nested'), false);
});

test('V1 线路文件向后兼容，换乘配色快照导入后脱离本地库仍可查色', () => {
  const legacy = example();
  assert.equal(Object.hasOwn(Routes.deserialize(Routes.serialize(legacy)), 'relatedLines'), false);
  const ten = paletteLine('ten', '10号线', 'Line 10', '#E97722');
  const line = Routes.withRelatedLines(Routes.updateStation(legacy, 'central', { transfers: '10' }), [ten]);
  const imported = Routes.deserialize(Routes.serialize(line));
  assert.deepEqual(imported, line);
  assert.equal(Routes.colorFor('Line 10', imported.relatedLines, imported).bg, '#E97722');
  assert.equal(Routes.colorFor('10', [], imported).bg, '#E97722');
  const sign = State.setProjectContext(State.createSign(), { line, stationId: 'central' });
  assert.deepEqual(State.deserializeSign(State.serializeSign(sign)), sign);
});

test('换乘变更或移站会清理过期快照，重存时用已定义线路的最新颜色', () => {
  const ten = paletteLine('ten', '10号线', 'Line 10', '#E97722');
  let line = Routes.withRelatedLines(Routes.updateStation(example(), 'central', { transfers: '10' }), [ten]);
  line = Routes.withRelatedLines(line, [{ ...ten, color: '#334455' }]);
  assert.equal(line.relatedLines[0].color, '#334455');
  assert.deepEqual(Routes.withRelatedLines(line, []).relatedLines, line.relatedLines);
  assert.deepEqual(Routes.updateStation(line, 'central', { transfers: '' }).relatedLines, []);
  assert.deepEqual(Routes.removeStation(line, 'central').relatedLines, []);
  assert.deepEqual(Routes.patchLine(line, { stations: [] }).relatedLines, []);
});

test('换乘线路快照严格验证类型、唯一 ID 和颜色，宽容入口不制造外线 ID', () => {
  const line = Routes.updateStation(example(), 'central', { transfers: '10' });
  const snapshot = { id: 'ten', nameZh: '10号线', nameEn: 'Line 10', color: '#E97722' };
  const file = (relatedLines) => ({ format: 'railway-line', version: 1, line: { ...line, relatedLines } });
  for (const value of [null, {}, ['10'], [{ ...snapshot, id: '' }], [{ ...snapshot, nameZh: 10 }],
    [{ ...snapshot, color: 'bad' }], [snapshot, snapshot]]) {
    assert.throws(() => Routes.deserialize(file(value)), /换乘线路/);
  }
  assert.deepEqual(Routes.normalizeLine({ ...line, relatedLines: [snapshot, {}, { ...snapshot, id: '' }] }).relatedLines, [snapshot]);
});
