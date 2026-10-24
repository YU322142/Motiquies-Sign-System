import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'routes', 'crt-render']) {
  (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
}
const { SignCore: Core, SignCRT: Catalog, SignComposition: C, SignState: S, SignRender: R, SignRoutes: Routes } = globalThis;
const measure = (text, font, weight, size) => Array.from(String(text)).length * size * 0.65;
measure.ink = (text, font, weight, size) => ({ abl: 0, abr: measure(text, font, weight, size), adv: measure(text, font, weight, size) });
measure.ascent = (text, font, weight, size) => size * 0.8;
measure.descent = (text, font, weight, size) => size * 0.2;
const text = (elements, value) => elements.find(el => el.type === 'plain-text' && el.props.text === value);
const box = element => element.props.box;

test('新增单侧站台牌保留岛式左半及白色线号块，原侧式牌仍在', () => {
  const template = Catalog.get('platform-direction-single');
  assert.equal(template.id, 'platform-direction-single');
  assert.equal(template.name, '侧式站台分向（单侧）');
  assert.equal(template.width, 2000);
  assert.equal(template.height, 320);
  assert.ok(Catalog.ALL.includes(template));
  assert.ok(Catalog.ALL.some(t => t.id === 'platform-direction'));
  assert.equal(template.fields.some(field => field.key === 'destination' || field.key === 'destinationEn' || field.key === 'lineEn'), false);
  assert.match(template.source.note, /用户|补充/);
  const island = C.materialize('platform-direction-split', undefined, measure);
  const single = C.materialize(template.id, undefined, measure);
  assert.equal(single.filter(el => el.type === 'icon').length, 1);
  assert.equal(single.find(el => el.type === 'icon').props.icon, 'arrow_left');
  assert.equal(text(single, '朝天门方向'), undefined);
  assert.equal(text(single, 'To Chaotianmen'), undefined);
  for (const value of ['璧山方向', 'To Bishan', '1']) assert.deepEqual(box(text(single, value)), box(text(island, value)), value + '沿用岛式左侧的尺寸和位置');
  const band = single.find(el => el.type === 'shape' && el.props.fill === '#FFFFFF' && box(el).height === 1);
  assert.equal(box(band).x + box(band).width, template.width / template.height, '白色线号块位于右缘');
  assert.equal(text(single, '1').props.color, '#000000');
});

test('单侧站台主题底色动态控制箭头和文字，白块线号独立保持黑色', () => {
  for (const color of ['#7B2CBF', '#F7D917']) {
    const elements = C.materialize('platform-direction-single', { lineColor: color, lineColorMode: 'custom' }, measure);
    assert.equal(elements[0].props.fill, color);
    for (const element of elements.filter(el => el.type === 'icon' || el.type === 'plain-text' && el.props.text !== '1')) {
      assert.equal(element.props.color, Core.contrastTextColor(color));
      assert.equal(element.props.contrastSourceId, elements[0].id);
      assert.equal(element.props.autoContrast, true);
    }
    let sign = S.addTemplateRow(S.createSign(), null, elements, { templateId: 'platform-direction-single', widthRatio: 6.25 });
    sign = S.updateElementProps(sign, elements[0].id, { fill: color === '#7B2CBF' ? '#F7D917' : '#7B2CBF' });
    assert.equal(text(sign.rows[0].elements, '璧山方向').props.color, Core.contrastTextColor(sign.rows[0].elements[0].props.fill));
    assert.equal(text(sign.rows[0].elements, '1').props.color, '#000000');
    assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
  }
});

test('单侧牌按虚构线路运行方向选择端点，长文字和自定比例均留在牌面内', () => {
  const template = Catalog.get('platform-direction-single');
  for (const direction of ['forward', 'backward']) {
    const line = Routes.createLine({ nameZh: '99号线', nameEn: 'Line 99', color: '#7B2CBF', direction,
      stations: [{ id: 'start', nameZh: '云间起始站', nameEn: 'Cloud Origin' }, { id: 'end', nameZh: '很长的虚构终点车站', nameEn: 'A Very Long Fictional Terminus' }] });
    const end = line.stations[direction === 'backward' ? 0 : 1];
    const props = C.contextOverrides(template, { line, stationId: line.stations[0].id });
    assert.equal(props.fields.title, end.nameZh + '方向');
    assert.equal(props.fields.subtitle, 'To ' + end.nameEn);
    assert.equal(props.fields.destination, undefined);
    for (const widthRatio of [2, 6.25, 12]) {
      const elements = C.materialize(template.id, { ...props, widthRatio }, measure);
      assert.ok(text(elements, end.nameZh + '方向'));
      assert.equal(elements[0].props.fill, line.color);
      for (const element of elements) {
        const b = box(element);
        assert.ok(b && b.x >= -1e-8 && b.y >= -1e-8 && b.x + b.width <= widthRatio + 1e-8 && b.y + b.height <= 1 + 1e-8, JSON.stringify(element));
      }
      const sign = S.addTemplateRow(S.createSign(), null, elements, { templateId: template.id, widthRatio });
      assert.ok(R.layoutSign(sign, measure).width > 0);
      assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
    }
  }
});
