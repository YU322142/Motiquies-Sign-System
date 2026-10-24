import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'crt-render']) {
  (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
}
const { SignState: S, SignComposition: C, SignCRT: Catalog, SignCRTRender: CRT } = globalThis;
const measure = (text, font, weight, size) => Array.from(String(text)).length * size * 0.65;
measure.ink = (text, font, weight, size) => ({ abl: 0, abr: measure(text, font, weight, size), adv: measure(text, font, weight, size) });
measure.ascent = (text, font, weight, size) => size * 0.8;
measure.descent = (text, font, weight, size) => size * 0.2;
const rowRatio = 4370 / 350;
function example() {
  const props = Catalog.createProps('four-sided-guide');
  const fourSided = S.createFourSided(props);
  const elements = C.materialize('four-sided-guide', { ...props, fourSidedEntries: fourSided.entries }, measure);
  return S.addTemplateRow(S.createSign(), null, elements, { templateId: 'four-sided-guide', fourSided });
}
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-8, a + ' != ' + b); }

test('四方体按默认旧body建立稳定排数据，支持每排独立线路英文且不修改输入', () => {
  const props = { ...Catalog.createProps('four-sided-guide'), backgroundColor: '#112233', lineColor: '#713FAD', lineColorMode: 'custom' };
  const before = structuredClone(props), meta = S.createFourSided(props);
  assert.deepEqual(props, before);
  assert.equal(meta.entries.length, 3);
  assert.equal(meta.entries[0].leftZh, '沙坪坝方向');
  assert.equal(meta.entries[0].rightZh, '四公里方向');
  assert.equal(meta.entries[0].line, '环');
  assert.equal(meta.entries[1].lineEn, 'Line');
  assert.equal(new Set(meta.entries.map(entry => entry.id)).size, 3);
  assert.equal(meta.props.backgroundColor, '#112233');
  close(meta.referenceRowRatio, rowRatio);
  const custom = S.createFourSided({ fields: { body: '星港|Starport|9|月影|Moonshade|Fictional Line' } });
  assert.equal(custom.entries.length, 1);
  assert.equal(custom.entries[0].lineEn, 'Fictional Line');
  assert.deepEqual(S.normalizeFourSided(meta), meta);
});

test('四方体规范化限制一至十二排，修复重复ID与字段，旧项目补元数据时不重绘原图', () => {
  const malformed = { entries: Array.from({ length: 20 }, () => ({ id: 'duplicate', leftZh: 12, line: '9' })), props: { lineColor: 'bad' } };
  const meta = S.normalizeFourSided(malformed);
  assert.equal(meta.entries.length, 12);
  assert.equal(new Set(meta.entries.map(entry => entry.id)).size, 12);
  assert.ok(meta.entries.every(entry => typeof entry.leftZh === 'string' && typeof entry.rightEn === 'string'));
  assert.equal(S.normalizeFourSided({ entries: [] }).entries.length, 1);
  const sign = example(), old = structuredClone(sign);
  delete old.rows[0].fourSided;
  const beforeElements = structuredClone(old.rows[0].elements);
  const restored = S.deserializeSign(S.serializeSign(old));
  assert.equal(restored.rows[0].fourSided.entries.length, 3);
  assert.deepEqual(restored.rows[0].elements, beforeElements);
});

test('四方体添加至五排后保持逐排上下排版与单排比例，所有部分仍是基础元素', () => {
  const original = example(), before = structuredClone(original), row = original.rows[0];
  let next = S.addFourSidedEntry(original, row.id, row.fourSided.entries[0].id, measure);
  next = S.addFourSidedEntry(next, row.id, next.rows[0].fourSided.entries[1].id, measure);
  assert.deepEqual(original, before);
  const changed = next.rows[0];
  assert.equal(changed.fourSided.entries.length, 5);
  assert.equal(changed.layout, 'free');
  close(changed.widthRatio, rowRatio / 5);
  close(changed.referenceWidthRatio, rowRatio / 5);
  for (const [index, entry] of changed.fourSided.entries.entries()) {
    const elements = changed.elements.filter(element => element.props.fourSidedEntryId === entry.id);
    assert.ok(elements.length >= 5, '每排应有方向、线路及独立图形');
    assert.ok(elements.every(element => element.type !== 'crt-sign'));
    for (const element of elements) {
      const box = element.props.box;
      assert.ok(box.y >= index / 5 - 1e-8 && box.y + box.height <= (index + 1) / 5 + 1e-8);
      assert.ok(box.x >= -1e-8 && box.x + box.width <= changed.widthRatio + 1e-8);
    }
  }
});

test('四方体逐排改字与上下移动保留排ID和对应元素ID，其他行不变', () => {
  const original = example(), row = original.rows[0], entry = row.fourSided.entries[0];
  const other = S.createRow([S.createElement('bilingual-text')]);
  const initial = { ...original, rows: [row, other] };
  const target = row.elements.find(element => element.props.fourSidedEntryId === entry.id && element.props.fourSidedRole === 'left-direction');
  const changed = S.updateFourSidedEntry(initial, row.id, entry.id, { leftZh: '新城方向', leftEn: 'To New Town', line: '9', lineEn: 'Line' }, measure);
  assert.equal(changed.rows[0].fourSided.entries[0].id, entry.id);
  assert.equal(changed.rows[0].fourSided.entries[0].leftZh, '新城方向');
  assert.equal(changed.rows[0].elements.find(element => element.props.fourSidedEntryId === entry.id && element.props.fourSidedRole === 'left-direction').id, target.id);
  const moved = S.moveFourSidedEntry(changed, row.id, entry.id, 1, measure);
  assert.equal(moved.rows[0].fourSided.entries[1].id, entry.id);
  assert.equal(moved.rows[1], other);
  assert.equal(original.rows[0].fourSided.entries[0].leftZh, '沙坪坝方向');
  assert.equal(S.updateFourSidedEntry(initial, row.id, 'missing', {}, measure), initial);
});

test('四方体删除与最大排数边界明确，至少一排且最多十二排', () => {
  let sign = example(), rowId = sign.rows[0].id;
  while (sign.rows[0].fourSided.entries.length < 12) sign = S.addFourSidedEntry(sign, rowId, null, measure);
  assert.equal(S.addFourSidedEntry(sign, rowId, null, measure), sign);
  while (sign.rows[0].fourSided.entries.length > 1) sign = S.removeFourSidedEntry(sign, rowId, sign.rows[0].fourSided.entries[0].id, measure);
  assert.equal(S.removeFourSidedEntry(sign, rowId, sign.rows[0].fourSided.entries[0].id, measure), sign);
  assert.equal(S.moveFourSidedEntry(sign, rowId, sign.rows[0].fourSided.entries[0].id, -1, measure), sign);
});

test('四方体排数改变沿用用户宽高比倍率，保存与恢复保留内容和编辑数据', () => {
  let sign = example(), row = sign.rows[0];
  sign = S.setRowAspectRatio(sign, row.id, row.widthRatio * 1.5);
  sign = S.addFourSidedEntry(sign, row.id, null, measure);
  close(sign.rows[0].widthRatio, rowRatio / 4 * 1.5);
  close(sign.rows[0].referenceWidthRatio, rowRatio / 4);
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
});

test('单独修改四方体基础双语文本或单线路会回写排内容，下次重排不回滚', () => {
  let sign = example(), row = sign.rows[0], entry = row.fourSided.entries[1];
  const left = row.elements.find(element => element.props.fourSidedEntryId === entry.id && element.props.fourSidedRole === 'left-direction');
  sign = S.updateElementProps(sign, left.id, { textZh: '独立修改方向', textEn: 'Edited Direction' });
  assert.equal(sign.rows[0].fourSided.entries[1].leftZh, '独立修改方向');
  const number = sign.rows[0].elements.find(element => element.props.fourSidedEntryId === entry.id && element.type === 'number-line');
  sign = S.updateElementProps(sign, number.id, { lines: [{ number: '10', color: '#E97722' }] });
  assert.equal(sign.rows[0].fourSided.entries[1].line, '10');
  sign = S.addFourSidedEntry(sign, row.id, null, measure);
  assert.equal(sign.rows[0].fourSided.entries[1].leftZh, '独立修改方向');
  const rebuilt = sign.rows[0].elements.find(element => element.props.fourSidedEntryId === entry.id && element.type === 'number-line');
  assert.equal(rebuilt.props.lines[0].number, '10');
  assert.equal(rebuilt.props.lines[0].color, '#E97722');
});

test('legacy body按实际行数排列且第六列线路英文生效，状态重绘显式使用measurer不读App', () => {
  const props = Catalog.createProps('four-sided-guide');
  props.fields.body = Array.from({ length: 6 }, (_, index) => '左' + index + '|Left|9|右' + index + '|Right|Fictional Line').join('\n');
  const output = CRT.metrics({ props }, 1000, measure);
  close(output.width / output.height, rowRatio / 6);
  assert.equal(output.commands.filter(command => command.fourSidedRole === 'left-direction').length, 6);
  assert.ok(JSON.stringify(output.commands).includes('Fictional Line'));
  const sign = example(), row = sign.rows[0];
  Object.defineProperty(globalThis, 'App', { configurable: true, get() { throw new Error('纯状态不能读App'); } });
  try {
    assert.equal(S.updateFourSidedEntry(sign, row.id, row.fourSided.entries[0].id, { leftZh: '纯函数' }, measure).rows[0].fourSided.entries[0].leftZh, '纯函数');
  } finally { delete globalThis.App; }
});
