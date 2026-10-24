import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

function loadState(withCatalog = true) {
  const context = vm.createContext({ crypto: globalThis.crypto });
  for (const name of withCatalog ? ['core', 'crt-catalog', 'state'] : ['core', 'state']) {
    vm.runInContext(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'), context);
  }
  return context;
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test('矩形标识转换为基础元素时保留顺序、行与其他元素，不改变旧状态', () => {
  const { SignState: S } = loadState();
  const before = S.createElement('icon');
  const signElement = S.createElement('crt-sign', { templateId: 'transfer-guide' });
  const after = S.createElement('bilingual-text');
  const row = S.createRow([before, signElement, after]);
  const otherRow = S.createRow([S.createElement('exit')]);
  const sign = { ...S.createSign(), rows: [row, otherRow] };
  const snapshot = plain(sign);
  const elements = [S.createElement('number-line'), S.createElement('bilingual-text')];
  const result = S.replaceElementWithElements(sign, signElement.id, elements);
  assert.deepEqual(plain(result.rows[0].elements.map((el) => el.id)),
    [before.id, elements[0].id, elements[1].id, after.id]);
  assert.equal(result.rows[0].id, row.id);
  assert.equal(result.rows[0].elements[0], before);
  assert.equal(result.rows[0].elements[3], after);
  assert.equal(result.rows[1], otherRow);
  assert.notEqual(result.rows[0], row);
  assert.deepEqual(plain(sign), snapshot);
  assert.equal(S.replaceElementWithElements(sign, 'missing', elements), sign);
});

test('转换后的基础元素可分别连续编辑并保存，其他元素内容不会回滚', () => {
  const { SignState: S } = loadState();
  let sign = S.createSign();
  const original = S.createElement('crt-sign', { templateId: 'transfer-guide' });
  sign = S.addElement(sign, sign.rows[0].id, original);
  const parts = [S.createElement('number-line'), S.createElement('bilingual-text')];
  sign = S.replaceElementWithElements(sign, original.id, parts);
  sign = S.updateElementProps(sign, parts[0].id, { lines: [{ number: '3', color: '#003DA5' }] });
  sign = S.updateElementProps(sign, parts[1].id, { textZh: '换乘', textEn: 'Transfer' });
  sign = S.updateElementProps(sign, parts[0].id, { textColor: '#FFFFFF' });
  const restored = S.deserializeSign(S.serializeSign(sign));
  assert.deepEqual(plain(restored), plain(sign));
  assert.equal(restored.rows[0].elements[0].props.lines[0].number, '3');
  assert.equal(restored.rows[0].elements[1].props.textZh, '换乘');
});

test('添加标识牌优先复用空行，有内容的所选行之后另起一行并保留原宽度', () => {
  const { SignState: S } = loadState();
  const initial = S.createSign();
  const elements = [S.createElement('number-line'), S.createElement('bilingual-text')];
  const first = S.addTemplateRow(initial, initial.rows[0].id, elements);
  assert.equal(first.widthMode, 'dynamic');
  assert.equal(first.rows.length, 1);
  assert.equal(first.rows[0].id, initial.rows[0].id);
  assert.equal(initial.rows[0].elements.length, 0);
  const fixed = { ...first, widthMode: 'fixed', width: 2300 };
  const secondParts = [S.createElement('crt-sign', { templateId: 'station-name' })];
  const next = S.addTemplateRow(fixed, fixed.rows[0].id, secondParts);
  assert.equal(next.rows.length, 2);
  assert.equal(next.rows[0], fixed.rows[0]);
  assert.equal(next.rows[1].elements[0], secondParts[0]);
  assert.equal(next.widthMode, 'fixed');
  assert.equal(next.width, 2300);
});

test('无选中行时使用最后空行，已有内容不会被模板覆盖', () => {
  const { SignState: S } = loadState();
  const occupied = S.createRow([S.createElement('exit')]);
  const empty = S.createRow();
  const last = S.createRow([S.createElement('icon')]);
  const sign = { ...S.createSign(), rows: [occupied, empty, last] };
  const parts = [S.createElement('number-line')];
  const next = S.addTemplateRow(sign, null, parts);
  assert.equal(next.rows.length, 3);
  assert.equal(next.rows[0], occupied);
  assert.equal(next.rows[1].id, empty.id);
  assert.equal(next.rows[1].elements[0], parts[0]);
  assert.equal(next.rows[2], last);
  assert.equal(empty.elements.length, 0);
});

test('矩形标识默认自动配色；手动改色切为自定，显式模式优先并保持其他字段', () => {
  const { SignState: S } = loadState();
  let sign = S.createSign();
  const el = S.createElement('crt-sign', { templateId: 'transfer-guide', fields: { line: '3/1' } });
  assert.equal(el.props.lineColorMode, 'auto');
  sign = S.addElement(sign, sign.rows[0].id, el);
  const fields = plain(el.props.fields);
  const manual = S.updateElementProps(sign, el.id, { lineColor: '#123456' });
  assert.equal(S.findElement(manual, el.id).element.props.lineColorMode, 'custom');
  assert.equal(el.props.lineColorMode, 'auto');
  assert.deepEqual(plain(S.findElement(manual, el.id).element.props.fields), fields);
  const auto = S.updateElementProps(manual, el.id, { lineColor: '#ABCDEF', lineColorMode: 'auto' });
  assert.equal(S.findElement(auto, el.id).element.props.lineColorMode, 'auto');
  assert.deepEqual(plain(S.deserializeSign(S.serializeSign(auto))), plain(auto));
  assert.deepEqual(plain(S.deserializeSign(S.serializeSign(manual))), plain(manual));
});

test('旧标识默认色恢复自动模式，曾修改的线路色按自定模式保留', () => {
  const { SignState: S, SignCRT: C } = loadState();
  const t = C.get('transfer-guide');
  function imported(props) {
    return S.deserializeSign({ rows: [{ id: 'r', elements: [{ id: 'e', type: 'crt-sign',
      props: { templateId: t.id, ...props } }] }] }).rows[0].elements[0].props;
  }
  assert.equal(imported({}).lineColorMode, 'auto');
  assert.equal(imported({ lineColor: t.accent.toLowerCase() }).lineColorMode, 'auto');
  assert.equal(imported({ lineColor: 'bad' }).lineColorMode, 'auto');
  const manual = imported({ lineColor: '#123456', fields: { line: '5/环' } });
  assert.equal(manual.lineColorMode, 'custom');
  assert.equal(manual.lineColor, '#123456');
  assert.equal(manual.fields.line, '5/环');
  assert.equal(imported({ lineColor: '#123456', lineColorMode: 'auto' }).lineColorMode, 'auto');
  assert.equal(imported({ lineColor: t.accent, lineColorMode: 'custom' }).lineColorMode, 'custom');
});

test('未载入目录时仍能保留标识字段、模板及自定配色并往返', () => {
  const { SignState: S } = loadState(false);
  const raw = { rows: [{ id: 'r', elements: [{ id: 'e', type: 'crt-sign', props: {
    templateId: 'transfer-guide', fields: { line: '3/1', title: '换乘' }, lineColor: '#123456',
  } }] }] };
  const sign = S.deserializeSign(raw);
  const p = sign.rows[0].elements[0].props;
  assert.equal(p.templateId, 'transfer-guide');
  assert.equal(p.lineColorMode, 'custom');
  assert.deepEqual(plain(p.fields), { line: '3/1', title: '换乘' });
  assert.deepEqual(plain(S.deserializeSign(S.serializeSign(sign))), plain(sign));
});

test('基础线路及出入口标签支持自定义文案并在导入时校验为字符串', () => {
  const { SignState: S } = loadState();
  for (const [type, labelZh, labelEn] of [
    ['number-line', '号线', 'Line'], ['entrance', '出入口', 'Entrance'], ['exit', '出口', 'Exit'],
  ]) {
    const el = S.createElement(type);
    assert.equal(el.props.labelZh, labelZh);
    assert.equal(el.props.labelEn, labelEn);
    let sign = { ...S.createSign(), rows: [S.createRow([el])] };
    sign = S.updateElementProps(sign, el.id, { labelZh: '自定义名称', labelEn: 'Custom Label' });
    assert.deepEqual(plain(S.deserializeSign(S.serializeSign(sign))), plain(sign));
    sign = S.updateElementProps(sign, el.id, { labelZh: 123, labelEn: null });
    const p = S.deserializeSign(S.serializeSign(sign)).rows[0].elements[0].props;
    assert.equal(p.labelZh, '123');
    assert.equal(p.labelEn, labelEn);
  }
});

test('自由排版标识牌保留基础形状、文字和相对行高坐标并可保存恢复', () => {
  const { SignState: S } = loadState();
  const parts = [
    S.createElement('shape', { shape: 'rect', fill: '#123456', box: { x: 0, y: 0, width: 3, height: 1 } }),
    S.createElement('plain-text', { text: '站名', font: 'zh', box: { x: 0.2, y: 0.1, width: 2, height: 0.4 } }),
  ];
  const sign = S.addTemplateRow(S.createSign(), null, parts);
  assert.equal(sign.rows[0].layout, 'free');
  assert.equal(sign.rows[0].widthRatio, 3);
  assert.equal(parts[0].props.paddingAuto, false);
  assert.equal(parts[1].props.paddingAuto, false);
  assert.deepEqual(plain(S.deserializeSign(S.serializeSign(sign))), plain(sign));
  const extra = S.createElement('icon');
  const added = S.addElement(sign, sign.rows[0].id, extra);
  const box = added.rows[0].elements.at(-1).props.box;
  assert.ok(box.x >= 0 && box.y > 0);
  assert.ok(box.width > 0 && box.height > 0);
  assert.ok(box.x + box.width <= sign.rows[0].widthRatio);
  assert.equal(added.rows[0].widthRatio, sign.rows[0].widthRatio);
  assert.equal(extra.props.box, undefined);
});

test('自由坐标和SVG几何导入过滤非法值与属性，旧flow项目结构保持兼容', () => {
  const { SignState: S } = loadState();
  const sign = S.deserializeSign({ rows: [{ id: 'free', layout: 'free', widthRatio: 'bad', elements: [
    { id: 'text', type: 'plain-text', props: { text: 123, font: 'invalid', fontSizeRatio: 'bad', box: { x: 'bad', y: -0.1, width: Infinity, height: 0.3 } } },
    { id: 'path', type: 'shape', props: { shape: 'path', viewBox: [0, 0, 100, 100], geometry: { d: 'M0 0L100 100Z', onclick: 'alert(1)' }, fill: '#abc', stroke: 'url(x)', strokeWidth: -2 } },
    { id: 'unsafe', type: 'shape', props: { shape: 'path', geometry: { d: 'M0 0 <script>', points: '0,0 1,1 bad' } } },
  ] }] });
  const [text, path, unsafe] = sign.rows[0].elements;
  assert.equal(text.props.text, '123');
  assert.equal(text.props.font, 'zh');
  assert.ok(Number.isFinite(text.props.fontSizeRatio));
  assert.ok(Object.values(text.props.box).every(Number.isFinite));
  assert.equal(path.props.geometry.onclick, undefined);
  assert.equal(path.props.geometry.d, 'M0 0L100 100Z');
  assert.equal(path.props.fill, '#AABBCC');
  assert.equal(path.props.stroke, null);
  assert.equal(path.props.strokeWidth, 0);
  assert.equal(unsafe.props.geometry.d, '');
  assert.equal(unsafe.props.geometry.points, '');
  assert.ok(Number.isFinite(sign.rows[0].widthRatio));
  const legacy = S.createSign();
  assert.deepEqual(plain(S.deserializeSign(S.serializeSign(legacy))), plain(legacy));
});

test('旧整牌拆为自由元素时单独行原位转换，混合行保留原元素并另起一行', () => {
  const { SignState: S } = loadState();
  const original = S.createElement('crt-sign');
  const parts = [S.createElement('plain-text', { box: { x: 0.1, y: 0.1, width: 0.5, height: 0.2 } })];
  const single = { ...S.createSign(), rows: [S.createRow([original])] };
  const converted = S.replaceElementWithElements(single, original.id, parts);
  assert.equal(converted.rows[0].id, single.rows[0].id);
  assert.equal(converted.rows[0].layout, 'free');
  assert.equal(single.rows[0].elements[0], original);
  const first = S.createElement('icon');
  const last = S.createElement('exit');
  const mixed = { ...S.createSign(), rows: [S.createRow([first, original, last])] };
  const next = S.replaceElementWithElements(mixed, original.id, parts);
  assert.equal(next.rows.length, 2);
  assert.deepEqual(plain(next.rows[0].elements.map((el) => el.id)), [first.id, last.id]);
  assert.equal(next.rows[1].layout, 'free');
  assert.equal(next.rows[1].elements[0], parts[0]);
  assert.equal(mixed.rows[0].elements.length, 3);
});
