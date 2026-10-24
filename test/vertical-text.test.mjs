import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'crt-render']) {
  (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
}
const { SignState: S, SignRender: R, SignComposition: C, SignCRT: Catalog } = globalThis;
const measure = (text, family, weight, size) => Array.from(String(text)).length * size * 0.9;
measure.ink = (text, family, weight, size) => ({ abl: -0.05 * size, abr: (Array.from(String(text)).length * 0.9 - 0.05) * size, adv: measure(text, family, weight, size) });
measure.ascent = (text, family, weight, size) => size * 0.8;
measure.descent = (text, family, weight, size) => size * 0.12;

test('竖排站名保留一个完整文字元素，改名不再逐字选中', () => {
  for (const template of Catalog.ALL.filter(t => t.id === 'station-name-vertical' || t.variant === 'security-portrait' || /protection/.test(t.id) && t.height > t.width * 3)) {
    const title = '云间中央站';
    const parts = C.materialize(template.id, { fields: { title } }, measure);
    const names = parts.filter(el => el.type === 'plain-text' && el.props.text === title);
    assert.equal(names.length, 1, template.id + ' 应保留整段标题');
    assert.equal(names[0].props.writingMode, 'vertical');
    assert.equal(parts.filter(el => el.type === 'plain-text' && Array.from(title).includes(el.props.text)).length, 0, '无逐字元素');
    let sign = S.addTemplateRow(S.createSign(), null, parts, { templateId: template.id });
    sign = S.updateElementProps(sign, names[0].id, { text: '新云间中央站' });
    assert.equal(S.findElement(sign, names[0].id).element.props.text, '新云间中央站');
    assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
  }
});

test('竖排文字metrics为完整文本提供逐字墨区坐标，整体不越出高度', () => {
  const props = { text: '云A间𠀀站', writingMode: 'vertical', letterSpacingRatio: 0.2, fontSizeRatio: 1, bold: true };
  const mt = R.plainTextMetrics(S.createElement('plain-text', props), 256, measure);
  assert.equal(mt.text, props.text);
  assert.equal(mt.writingMode, 'vertical');
  assert.equal(mt.glyphs.map(glyph => glyph.text).join(''), props.text, '不拆坏Unicode字符');
  assert.ok(mt.inkHeight <= 256 + 1e-8);
  let bottom = -Infinity;
  for (const glyph of mt.glyphs) {
    assert.ok(glyph.base - glyph.ascent >= bottom - 1e-8, '相邻文字墨区不重叠');
    assert.ok(glyph.x - glyph.abl >= -1e-8);
    assert.ok(glyph.x + glyph.abr <= mt.width + 1e-8);
    bottom = glyph.base + glyph.descent;
  }
  assert.ok(bottom <= 256 + 1e-8);
  assert.deepEqual(R.measureFragment('plain-text', props, 256, measure).metrics, mt);
});

test('竖排属性可保存，非法排列值与字距安全归一', () => {
  const initial = S.createSign();
  const sign = S.addElement(initial, initial.rows[0].id, S.createElement('plain-text', { text: '云间', writingMode: 'vertical', letterSpacingRatio: 0.3 }));
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
  const raw = JSON.parse(S.serializeSign(sign));
  raw.sign.rows[0].elements[0].props.writingMode = 'diagonal';
  raw.sign.rows[0].elements[0].props.letterSpacingRatio = -7;
  const props = S.deserializeSign(JSON.stringify(raw)).rows[0].elements[0].props;
  assert.equal(props.writingMode, 'horizontal');
  assert.equal(props.letterSpacingRatio, 0);
});
