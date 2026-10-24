import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = (p) => (0, eval)(readFileSync(new URL(p, import.meta.url), 'utf8'));
load('../js/core.js');
load('../js/state.js');
const S = globalThis.SignState;

test('整块重庆矩形标识可保存、恢复并继续编辑', () => {
  let sign = S.createSign();
  const el = S.createElement('crt-sign', {
    templateId: 'station-name', widthRatio: 4,
    fields: { title: '重庆北站南广场', subtitle: 'Chongqing North Station South Square' },
  });
  sign = S.addElement(sign, sign.rows[0].id, el);
  const restored = S.deserializeSign(S.serializeSign(sign));
  assert.deepEqual(restored.rows[0].elements[0], el);
  const edited = S.updateElementProps(restored, el.id, {
    fields: { ...el.props.fields, title: '沙坪坝' },
  });
  assert.equal(edited.rows[0].elements[0].props.fields.title, '沙坪坝');
  assert.equal(restored.rows[0].elements[0].props.fields.title, '重庆北站南广场');
});

test('整块标识的比例和内容在导入边界得到修复', () => {
  const raw = S.createSign();
  raw.rows[0].elements = [{ id: 'crt', type: 'crt-sign', props: {
    templateId: {}, fields: [], widthRatio: 'bad', lineColor: 'url(https://example.com)',
    direction: 'unknown', paddingAuto: true,
  } }];
  const p = S.deserializeSign(raw).rows[0].elements[0].props;
  assert.equal(p.templateId, 'station-name');
  assert.equal(typeof p.fields, 'object');
  assert.equal(Array.isArray(p.fields), false);
  assert.ok(Number.isFinite(p.widthRatio) && p.widthRatio > 0);
  assert.equal(p.lineColor, '#E4002B');
  assert.equal(p.direction, 'left');
  assert.equal(p.paddingAuto, false);
  assert.deepEqual(p.padding, { top: 0, right: 0, bottom: 0, left: 0 });
});

test('矩形牌面与相邻元素组合时保留牌面完整宽度', () => {
  let sign = S.createSign();
  const el = S.createElement('crt-sign');
  sign.rows[0].elements = [S.createElement('icon'), el, S.createElement('exit')];
  const next = S.applyPaddingAuto(sign);
  assert.equal(next.rows[0].elements[1], el);
  assert.equal(el.props.paddingAuto, false);
  assert.equal(el.props.padding.left, 0);
});
