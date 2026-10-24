import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'routes', 'crt-render']) {
  (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
}
const { SignCore: Core, SignCRT: Catalog, SignComposition: C, SignState: S, SignRender: R } = globalThis;
const measure = (text, font, weight, size) => Array.from(String(text)).length * size * 0.65;
measure.ink = (text, font, weight, size) => ({ abl: 0, abr: measure(text, font, weight, size), adv: measure(text, font, weight, size) });
measure.ascent = (text, font, weight, size) => size * 0.8;
measure.descent = (text, font, weight, size) => size * 0.2;
const text = (elements, value) => elements.find(el => el.type === 'plain-text' && el.props.text === value);
const at = el => el.props.box;

test('图4.1.10-1用全高白色中心带黑色大线号，两侧主题色与自动黑白方向', () => {
  const elements = C.materialize('platform-direction-split', undefined, measure);
  const ratio = Catalog.get('platform-direction-split').width / Catalog.get('platform-direction-split').height;
  const band = elements.find(el => el.type === 'shape' && el.props.fill === '#FFFFFF' && at(el).height === 1);
  assert.ok(band, '中央应为全高白带，不能是彩色徽块');
  assert.ok(Math.abs(at(band).x + at(band).width / 2 - ratio / 2) < 1e-8);
  const number = text(elements, '1');
  assert.equal(number.props.color, '#000000');
  assert.ok(at(number).height > .5);
  assert.ok(!text(elements, 'Line 1'), '中间只保留线路编号');
  for (const [label, arrowId] of [['璧山方向', 'arrow_left'], ['朝天门方向', 'arrow_right']]) {
    assert.equal(text(elements, label).props.color, '#FFFFFF');
    assert.equal(elements.find(el => el.type === 'icon' && el.props.icon === arrowId).props.color, '#FFFFFF');
  }
  assert.ok(at(text(elements, '璧山方向')).x < at(band).x);
  assert.ok(at(text(elements, '朝天门方向')).x > at(band).x + at(band).width);
});

test('岛式牌的明暗线路主题色同时决定底色、箭头和文字，中央始终白底黑字', () => {
  for (const [color, expected] of [['#7B2CBF', '#FFFFFF'], ['#F7D917', '#000000']]) {
    const elements = C.materialize('platform-direction-split', { lineColor: color, lineColorMode: 'custom' }, measure);
    assert.ok(elements.some(el => el.type === 'shape' && el.props.fill === color && at(el).x === 0));
    assert.equal(text(elements, '璧山方向').props.color, expected);
    assert.equal(text(elements, 'To Chaotianmen').props.color, expected);
    assert.equal(elements.find(el => el.type === 'icon' && el.props.icon === 'arrow_left').props.color, expected);
    assert.equal(text(elements, '1').props.color, '#000000');
  }
});

test('岛式牌外侧文字和箭头关联主题底色，中央线号保持独立', () => {
  const elements = C.materialize('platform-direction-split', undefined, measure);
  const background = elements[0];
  for (const el of elements.filter(el => el.type === 'icon' || el.type === 'plain-text' && el.props.text !== '1')) {
    assert.equal(el.props.contrastSourceId, background.id);
    assert.notEqual(el.props.autoContrast, false);
  }
  assert.equal(text(elements, '1').props.contrastSourceId, undefined);
  let sign = S.createSign();
  sign = S.addTemplateRow(sign, sign.rows[0].id, elements);
  sign = S.deserializeSign(S.serializeSign(sign));
  const recolored = S.updateElementProps(sign, background.id, { fill: '#F7D917' });
  assert.equal(text(recolored.rows[0].elements, '璧山方向').props.color, '#000000');
  assert.equal(text(recolored.rows[0].elements, '1').props.color, '#000000');
  assert.ok(recolored.rows[0].elements.filter(el => el.type === 'icon').every(el => el.props.color === '#000000'));
});

test('图4.1.10-2分别放两侧线路，不将环/5合并在中央；环向小标题与大方向独立可编辑', () => {
  const elements = C.materialize('platform-direction-multiline', undefined, measure);
  const loop = text(elements, '环'), five = text(elements, '5');
  assert.ok(loop && five, '两条线路各自有可编辑大字');
  assert.ok(!text(elements, '环/5'));
  const left = text(elements, '沙坪坝方向'), right = text(elements, '大石坝方向');
  assert.ok(at(loop).x < at(left).x && at(left).x < at(right).x && at(right).x < at(five).x);
  const qualifier = text(elements, '内环');
  assert.ok(qualifier && at(qualifier).y < at(left).y);
  assert.ok(at(qualifier).height < at(left).height);
  assert.ok(elements.some(el => el.type === 'shape' && el.props.fill === Core.lineColorFor('环', 'chongqing').bg));
  assert.ok(elements.some(el => el.type === 'shape' && el.props.fill === Core.lineColorFor('5', 'chongqing').bg));
  for (const arrowId of ['arrow_left', 'arrow_right']) {
    assert.equal(elements.find(el => el.type === 'icon' && el.props.icon === arrowId).props.color, '#000000');
  }
});

test('两种分向预设的长虚构线路与方向仍使用自身颜色，所有图文留在定位牌面内并可保存恢复', () => {
  for (const id of ['platform-direction-split', 'platform-direction-multiline']) {
    const elements = C.materialize(id, { linePalette: [
      { id: 'cloud', nameZh: '云间线', nameEn: 'Cloud Line', color: '#7B2CBF' },
      { id: 'ninety-nine', nameZh: '99号线', nameEn: 'Line 99', color: '#EA8800' },
    ], fields: { line: '云间线/99', lineEn: 'Cloud Line / Line 99',
      title: '很长的虚构起始车站方向', subtitle: 'To A Very Long Fictional Terminus',
      destination: '很长的虚构终点车站方向', destinationEn: 'To Another Very Long Fictional Terminus' } }, measure);
    const template = Catalog.get(id), ratio = template.width / template.height;
    for (const el of elements) {
      const b = at(el);
      assert.ok(b && b.x >= -1e-8 && b.y >= -1e-8 && b.x + b.width <= ratio + 1e-8 && b.y + b.height <= 1 + 1e-8, id + ':' + JSON.stringify(el));
      assert.notEqual(el.type, 'crt-sign');
    }
    if (id.endsWith('multiline')) {
      assert.ok(elements.some(el => el.type === 'shape' && el.props.fill === '#7B2CBF'));
      assert.ok(elements.some(el => el.type === 'shape' && el.props.fill === '#EA8800'));
    }
    let sign = S.createSign();
    sign = S.addTemplateRow(sign, sign.rows[0].id, elements, template);
    assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
    assert.ok(R.layoutSign(sign, measure).width > 0);
  }
});
