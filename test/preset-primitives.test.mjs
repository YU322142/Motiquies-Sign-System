/** 每款标准标识都是可编辑基础元素的预设，不向用户添加不可拆开的整牌。 */
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'crt-render']) {
  (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
}
const { SignCore: Core, SignState: S, SignRender: R, SignCRT: Catalog, SignComposition: C } = globalThis;
const measure = (text, family, weight, size) => Array.from(String(text)).length * size * 0.9;
measure.ink = (text, family, weight, size) => ({ abl: -0.05 * size,
  abr: Math.max(0, measure(text, family, weight, size) - 0.05 * size), adv: measure(text, family, weight, size) });
measure.ascent = (text, family, weight, size) => size * (family === Core.FONT_ZH ? 0.8 : family === Core.FONT_NUM ? 0.7 : 0.72);
measure.descent = (text, family, weight, size) => size * (family === Core.FONT_ZH ? 0.09 : 0.21);

function materialize(id) { return C.materialize(id, undefined, measure); }
function withTemplate(id) {
  const original = S.createSign();
  const elements = materialize(id);
  const sign = S.addTemplateRow(original, original.rows[0].id, elements);
  return { original, elements, sign, row: sign.rows.find((row) => row.elements.some((el) => el.id === elements[0].id)) };
}
function close(actual, expected, message) { assert.ok(Math.abs(actual - expected) < 1e-8, message + ': ' + actual + ' != ' + expected); }

test('全部 82 款在用标识均生成可独立选择的基础元素，实例之间不复用 ID', () => {
  assert.equal(Catalog.ALL.length, 82);
  const removed = ['first-last-train', 'interconnection-timetable', 'network-map', 'network-map-double', 'street-map', 'evacuation-map',
    'entrance-identity', 'gate-indicator', 'fare-information'];
  assert.ok(Catalog.ALL.every((template) => !removed.includes(template.id)));
  const allIds = new Set();
  for (const template of Catalog.ALL) {
    const first = materialize(template.id), second = materialize(template.id);
    assert.ok(first.length > 0 && second.length > 0, template.id);
    for (const el of first.concat(second)) {
      assert.notEqual(el.type, 'crt-sign', template.id + ' 仍然是不可拆分的整牌');
      assert.ok(S.ELEMENT_TYPES.includes(el.type), template.id + ':' + el.type);
      assert.equal(typeof el.id, 'string', template.id);
      assert.ok(el.id.length > 0 && !allIds.has(el.id), template.id + ' 元素必须有独立 ID');
      allIds.add(el.id);
    }
  }
});

test('站名、时刻表、线路图、禁止牌的每个图文部分均保留独立定位盒', () => {
  for (const id of ['station-name', 'first-last-train', 'interconnection-timetable', 'route-vertical', 'no-smoking']) {
    const elements = materialize(id);
    assert.ok(elements.length > 2, id + ' 应拆分出独立图文');
    assert.ok(elements.some((el) => ['plain-text', 'bilingual-text'].includes(el.type)), id + ' 文字应可单独编辑');
    for (const el of elements) {
      assert.ok(el.props.box, id + ':' + el.type + ' 丢失模板定位盒');
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Number.isFinite(el.props.box[key]), id + ':' + key);
      assert.ok(el.props.box.width > 0 && el.props.box.height > 0, id + ' 定位盒必须可点击');
    }
  }
});

test('复杂预设新增独立 free 行，保留已有行与参考比例', () => {
  let original = S.createSign();
  original = S.addElement(original, original.rows[0].id, S.createElement('number-line'));
  const before = JSON.stringify(original);
  for (const id of ['station-name', 'first-last-train', 'interconnection-timetable']) {
    const elements = materialize(id);
    const next = S.addTemplateRow(original, original.rows[0].id, elements);
    assert.equal(JSON.stringify(original), before, '不得原地修改现有标识牌');
    assert.equal(next.rows.length, 2, id + ' 不能覆盖已有线路行');
    assert.deepEqual(next.rows[0], original.rows[0]);
    assert.equal(next.rows[1].layout, 'free', id);
    close(next.rows[1].widthRatio, Catalog.get(id).width / Catalog.get(id).height, id + ' 行宽高比');
    assert.deepEqual(next.rows[1].elements, elements);
  }
});

test('全部标识保存恢复不丢独立图文、定位盒与 free 行布局', () => {
  for (const template of Catalog.ALL) {
    const { sign } = withTemplate(template.id);
    const restored = S.deserializeSign(S.serializeSign(sign));
    assert.deepEqual(restored, sign, template.id);
  }
});

test('站名文字可单独修改内容、颜色和定位，不改动其余图形', () => {
  const { sign, row } = withTemplate('station-name');
  const target = row.elements.find((el) => (el.type === 'plain-text' && el.props.text === '石油路') ||
    (el.type === 'bilingual-text' && el.props.textZh === '石油路'));
  assert.ok(target);
  const field = target.type === 'plain-text' ? 'text' : 'textZh';
  const before = JSON.stringify(sign);
  const box = { ...target.props.box, x: target.props.box.x + 0.02 };
  const next = S.updateElementProps(sign, target.id, { [field]: '更新站名', color: '#123456', box });
  assert.equal(JSON.stringify(sign), before);
  const changed = S.findElement(next, target.id).element;
  assert.equal(changed.props[field], '更新站名');
  assert.equal(changed.props.color, '#123456');
  assert.deepEqual(changed.props.box, box);
  for (const el of row.elements.filter((el) => el.id !== target.id)) assert.deepEqual(S.findElement(next, el.id).element, el);
  assert.deepEqual(S.deserializeSign(S.serializeSign(next)), next);
});

test('矩形与路径原语可独立编辑颜色和几何并保存', () => {
  const { sign, row } = withTemplate('station-name');
  const target = row.elements.find((el) => el.type === 'shape');
  assert.ok(target, '站名色条和站号圆章需要基础形状元素');
  const geometry = { ...target.props.geometry };
  if (target.props.shape === 'rect') geometry.width = (geometry.width || 1) * 0.8;
  const next = S.updateElementProps(sign, target.id, { fill: '#123456', stroke: '#654321', strokeWidth: 0.02, geometry });
  const changed = S.findElement(next, target.id).element;
  assert.equal(changed.props.fill, '#123456');
  assert.deepEqual(changed.props.geometry, geometry);
  assert.deepEqual(S.deserializeSign(S.serializeSign(next)), next);
});

test('free 行定位盒按整行行高换算，命中区尺寸与绘制槽位共享几何', () => {
  assert.ok(S.ELEMENT_TYPES.includes('plain-text') && S.ELEMENT_TYPES.includes('shape'));
  const text = S.createElement('plain-text', { text: '测试', font: 'zh', fontSizeRatio: 0.5,
    box: { x: 0.1, y: 0.25, width: 1, height: 0.3 } });
  const shape = S.createElement('shape', { shape: 'rect', viewBox: [0, 0, 200, 100],
    geometry: { x: 0, y: 0, width: 200, height: 100 }, fill: '#123456',
    box: { x: 0.6, y: 0.05, width: 0.5, height: 0.4 } });
  const sign = { ...S.createSign(), widthMode: 'dynamic', rowHeight: 200,
    rows: [{ ...S.createRow([text, shape]), layout: 'free', widthRatio: 1.5 }] };
  const layout = R.layoutSign(sign, measure);
  assert.equal(layout.width, 300);
  const [a, b] = layout.rows[0].elements;
  assert.deepEqual({ id: a.id, x: a.x, y: a.y, width: a.width, height: a.height },
    { id: text.id, x: 20, y: 50, width: 200, height: 60 });
  assert.deepEqual({ id: b.id, x: b.x, y: b.y, width: b.width, height: b.height },
    { id: shape.id, x: 120, y: 10, width: 100, height: 80 });
  close(b.naturalWidth, 160, '形状自然宽按 viewBox 比例计算');
  close(b.scale, 100 / 160, '超宽图形在自身定位盒中等比适配');
  for (const slot of [a, b]) {
    assert.ok(Number.isFinite(slot.scale) && slot.scale > 0 && slot.scale <= 1);
    assert.ok(Number.isFinite(slot.naturalWidth) && slot.naturalWidth > 0);
  }
});

test('单行窄竖版预设动态宽度小于行高，不添加方形空白', () => {
  const { sign, row } = withTemplate('station-name-vertical');
  assert.equal(sign.widthMode, 'dynamic');
  assert.equal(row.layout, 'free');
  const layout = R.layoutSign(sign, measure);
  close(layout.width, Math.ceil(sign.rowHeight * Catalog.get('station-name-vertical').width / Catalog.get('station-name-vertical').height), '竖牌宽度');
  assert.ok(layout.width < sign.rowHeight);
});

test('单行文字字号由自身定位盒高决定，形状保持自身 viewBox 比例', () => {
  const text = S.createElement('plain-text', { text: '站名', font: 'zh', fontSizeRatio: 0.5 });
  const mt = R.elementMetrics(text, 100, measure);
  close(mt.width, (2 * 0.9 - 0.1) * 50, '文字按实际墨区宽和定位盒字级度量');
  close(R.elementMetrics(text, 200, measure).width, mt.width * 2, '定位盒高翻倍则文字同比放大');
  const shape = S.createElement('shape', { shape: 'circle', viewBox: [0, 0, 300, 100], geometry: { cx: 150, cy: 50, r: 50 } });
  close(R.elementMetrics(shape, 80, measure).width, 240, '保留形状参考 viewBox 宽高比');
});

test('旧 flow 行忽略定位盒，原有顺序、边距和左右通道保持不变', () => {
  const elements = [S.createElement('icon', { icon: 'arrow_left' }), S.createElement('number-line'),
    S.createElement('bilingual-text', { textZh: '八公里', textEn: 'Bagongli', elementAlign: 'right' })];
  const original = { ...S.createSign(), rows: [S.createRow(elements)] };
  const withBoxes = { ...original, rows: [{ ...original.rows[0], elements: elements.map((el) => ({ ...el,
    props: { ...el.props, box: { x: 7, y: 2, width: 0.1, height: 0.1 } } })) }] };
  assert.deepEqual(R.layoutSign(withBoxes, measure), R.layoutSign(original, measure));
  const dynamic = { ...original, widthMode: 'dynamic' }, dynamicBoxes = { ...withBoxes, widthMode: 'dynamic' };
  assert.deepEqual(R.layoutSign(dynamicBoxes, measure), R.layoutSign(dynamic, measure));
});
