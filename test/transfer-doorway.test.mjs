import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'crt-render', 'routes']) {
  (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
}
const { SignCore: Core, SignState: S, SignCRT: Catalog, SignCRTRender: CRT, SignComposition: Composition } = globalThis;
const measure = (text, family, weight, size) => Array.from(String(text)).length * size * 0.65;
measure.ink = (text, family, weight, size) => ({ abl: 0, abr: measure(text, family, weight, size), adv: measure(text, family, weight, size) });
measure.ascent = (text, family, weight, size) => size * 0.8;
measure.descent = (text, family, weight, size) => size * 0.2;
function props(id, patch = {}) {
  const original = Catalog.createProps(id);
  return { ...original, ...patch, fields: { ...original.fields, ...patch.fields } };
}
function recipe(id, patch = {}, height = 2320) {
  return CRT.metrics({ type: 'crt-sign', props: props(id, patch) }, height, measure);
}
function badgeFor(output, label) {
  const text = output.commands.find(command => command.tag === 'text' && command.text === label && command.contrastOf);
  assert.ok(text, label + '应位于绑定色块的独立文字内');
  const background = output.commands.find(command => command.contrastKey === text.contrastOf);
  assert.ok(background, label + '缺少色块');
  const x = text.attrs.x, y = text.attrs.y, size = text.attrs['font-size'];
  assert.ok(x >= background.attrs.x - 1e-8);
  assert.ok(x + measure(text.text, Core.FONT_NUM, 400, size) <= background.attrs.x + background.attrs.width + 1e-8);
  assert.ok(y - measure.ascent(text.text, Core.FONT_NUM, 400, size) >= background.attrs.y - 1e-8);
  assert.ok(y + measure.descent(text.text, Core.FONT_NUM, 400, size) <= background.attrs.y + background.attrs.height + 1e-8);
  return { text, background };
}

test('新增换乘通道门套横梁与原有两款立柱分别保留入口，来源注明实物补充', () => {
  const horizontal = Catalog.get('transfer-doorhead');
  assert.equal(horizontal.id, 'transfer-doorhead');
  assert.ok(Catalog.ALL.includes(horizontal));
  assert.equal(Composition.sectionFor(horizontal), 'horizontal');
  assert.match(horizontal.name, /换乘通道.*横梁/);
  assert.match(horizontal.source.note, /实物/);
  assert.match(horizontal.source.note, /编辑.*比例/);
  assert.equal(horizontal.source.section, '4.3.6');
  assert.equal(horizontal.directional, false);
  for (const id of ['transfer-doorpost', 'transfer-doorpost-multiline']) {
    const vertical = Catalog.get(id);
    assert.equal(Composition.sectionFor(vertical), 'vertical');
    assert.match(vertical.name, /立柱/);
    assert.ok(Catalog.ALL.includes(vertical));
  }
});

test('单线门套立柱有30%浅线路底色、整块线路色白号和色块下方号线标签', () => {
  const output = recipe('transfer-doorpost', { lineColorMode: 'custom', lineColor: '#005EB8', fields: { line: '5', lineEn: 'Line' } });
  assert.equal(output.commands[0].attrs.fill, '#B3CFEA');
  const { text, background } = badgeFor(output, '5');
  assert.equal(background.attrs.fill, '#005EB8');
  assert.equal(background.attrs.x, 0);
  assert.equal(background.attrs.width, output.width);
  assert.equal(text.attrs.fill, '#FFFFFF');
  assert.ok(output.commands.some(command => command.tag === 'element' && command.element.type === 'icon' && command.element.props.icon === 'arrow_up'));
  const label = output.commands.find(command => command.tag === 'text' && command.text === '号线');
  assert.ok(label && label.attrs.y > background.attrs.y + background.attrs.height);
});

test('横梁横排换乘、线路色块及号线，图文可分别编辑且没有方向箭头', () => {
  const output = recipe('transfer-doorhead', { lineColorMode: 'custom', lineColor: '#005EB8' }, 400);
  const { background } = badgeFor(output, '5');
  const transfer = output.commands.find(command => command.tag === 'text' && command.text === '换乘');
  const label = output.commands.find(command => command.tag === 'text' && command.text === '号线');
  assert.ok(transfer && transfer.attrs.x < background.attrs.x);
  assert.ok(label && label.attrs.x >= background.attrs.x + background.attrs.width);
  assert.equal(output.commands.some(command => command.tag === 'element' && command.element.type === 'icon'), false);
  const parts = Composition.materialize('transfer-doorhead', { lineColorMode: 'custom', lineColor: '#005EB8' }, measure);
  assert.ok(parts.every(element => element.type !== 'crt-sign'));
  for (const word of ['换乘', 'Transfer', '5', '号线', 'Line']) {
    assert.ok(parts.some(element => element.type === 'plain-text' && element.props.text === word), word);
  }
});

test('多线门套各用虚构线路自己的完整色块，明色黑号且色块按序上下排列', () => {
  const linePalette = [
    { id: 'nine', nameZh: '9号线', nameEn: 'Line 9', color: '#713FAD' },
    { id: 'ten', nameZh: '10号线', nameEn: 'Line 10', color: '#E97722' },
    { id: 'cloud', nameZh: '云间线', nameEn: 'Cloud Line', color: '#FFE400' },
  ];
  const output = recipe('transfer-doorpost-multiline', { linePalette, fields: { line: '9/10/云间', lineEn: 'Line 9/10 / Cloud Line' } });
  assert.equal(output.commands[0].attrs.fill, '#FFFFFF');
  const badges = ['9', '10', '云间'].map(label => badgeFor(output, label));
  assert.deepEqual(badges.map(badge => badge.background.attrs.fill), linePalette.map(line => line.color));
  for (const badge of badges) {
    assert.equal(badge.background.attrs.width, output.width);
    assert.equal(badge.text.attrs.fill, Core.contrastTextColor(badge.background.attrs.fill));
  }
  for (let index = 1; index < badges.length; index++) {
    assert.ok(badges[index - 1].background.attrs.y + badges[index - 1].background.attrs.height <= badges[index].background.attrs.y + 1e-8);
  }
});

test('门套色块与数字材质化后保持自动明暗绑定，项目保存恢复不丢失', () => {
  for (const id of ['transfer-doorhead', 'transfer-doorpost', 'transfer-doorpost-multiline']) {
    const parts = Composition.materialize(id, undefined, measure);
    const digits = parts.filter(element => element.type === 'plain-text' && /^\d+$/.test(element.props.text));
    assert.ok(digits.length > 0, id);
    for (const digit of digits) {
      const background = parts.find(element => element.id === digit.props.contrastSourceId);
      assert.ok(background && background.type === 'shape', id + ': contrastSourceId');
      assert.equal(digit.props.autoContrast, true);
      assert.equal(digit.props.color, Core.contrastTextColor(background.props.fill));
    }
    const initial = S.createSign();
    const sign = S.addTemplateRow(initial, initial.rows[0].id, parts);
    assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign, id);
  }
});

test('当前站换乘填写完整线路名时，色块仅显示10或星环，完整名称仍用于查色', () => {
  const routes = globalThis.SignRoutes;
  const line = routes.createLine({ id: 'nine', nameZh: '9号线', nameEn: 'Line 9', color: '#713FAD',
    stations: [{ id: 'interchange', nameZh: '星港', nameEn: 'Starport', code: '01', transfers: '10号线 / 星环线' }],
    currentStationId: 'interchange' });
  const related = [
    { id: 'ten', nameZh: '10号线', nameEn: 'Line 10', color: '#E97722' },
    { id: 'star', nameZh: '星环线', nameEn: 'Star Loop', color: '#005EB8' },
  ];
  for (const id of ['transfer-doorhead', 'transfer-doorpost-multiline']) {
    const overrides = Composition.contextOverrides(Catalog.get(id), { line, stationId: 'interchange' }, related);
    assert.equal(overrides.fields.line, '10号线 / 星环线');
    const output = recipe(id, overrides);
    assert.equal(badgeFor(output, '10').background.attrs.fill, '#E97722');
    assert.equal(badgeFor(output, '星环').background.attrs.fill, '#005EB8');
    assert.equal(output.commands.some(command => command.tag === 'text' && command.contrastOf && /号线|星环线/.test(command.text)), false);
    assert.ok(output.commands.some(command => command.tag === 'text' && !command.contrastOf && command.text === '线'));
    const explicit = recipe(id, { ...overrides, fields: { ...overrides.fields, labelZh: '线路' } });
    assert.ok(explicit.commands.some(command => command.tag === 'text' && command.text === '线路'));
  }
});

test('横梁改为极窄比例时仍保留正尺寸色块，长文字整体适配而不越界', () => {
  for (const widthRatio of [0.1, 1, 6, 64]) {
    const output = recipe('transfer-doorhead', { widthRatio, fields: {
      title: '换乘通道的长说明', subtitle: 'A deliberately long interchange description', line: '10号线',
    } }, 400);
    assert.ok(badgeFor(output, '10').background.attrs.width > 0, String(widthRatio));
    for (const command of output.commands.filter(command => command.tag === 'text')) {
      const attrs = command.attrs, size = attrs['font-size'];
      assert.ok(attrs.x >= -1e-8 && attrs.x + measure(command.text, attrs['font-family'], 400, size) <= output.width + 1e-8);
      assert.ok(attrs.y - measure.ascent(command.text, attrs['font-family'], 400, size) >= -1e-8);
      assert.ok(attrs.y + measure.descent(command.text, attrs['font-family'], 400, size) <= output.height + 1e-8);
    }
  }
});
