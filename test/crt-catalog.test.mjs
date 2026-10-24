import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

(0, eval)(readFileSync(new URL('../js/crt-catalog.js', import.meta.url), 'utf8'));
const CRT = globalThis.SignCRT;

test('重庆矩形标识目录覆盖进出站、换乘、设施、综合、安全与互联互通', () => {
  for (const id of ['station-name', 'entrance-lintel', 'ticket-guide', 'exit-information',
    'transfer-column', 'lost-found', 'nursing-room', 'first-last-train', 'network-map',
    'no-smoking', 'warning-gap', 'fire-alarm-button', 'emergency-stop-button',
    'evacuation-map', 'interconnection-timetable', 'protection-notice']) {
    assert.equal(CRT.get(id).id, id, id);
  }
  assert.equal(CRT.ALL.some(t => /地面换乘|圆形手信号|停车位置|圆形警示牌/.test(t.name)), false);
});

test('每个矩形模板都有唯一标识、来源、正尺寸与可编辑字符串字段', () => {
  const ids = new Set();
  for (const t of CRT.ALL) {
    assert.equal(ids.has(t.id), false, t.id);
    ids.add(t.id);
    assert.ok(t.width > 0 && t.height > 0, t.id);
    assert.ok(t.source.page > 0 && t.source.figure && t.source.section, t.id);
    assert.ok(['guide', 'station', 'facility', 'information', 'route', 'notice'].includes(t.layout), t.id);
    const keys = new Set();
    for (const f of t.fields) {
      assert.equal(keys.has(f.key), false, t.id + ':' + f.key);
      keys.add(f.key);
      assert.equal(typeof f.value, 'string', t.id + ':' + f.key);
    }
    assert.equal(CRT.createProps(t.id).widthRatio, t.width / t.height);
  }
});

test('模板默认字段和元素属性每次独立创建，未知模板回退站名标识', () => {
  const a = CRT.createProps('station-name');
  const b = CRT.createProps('station-name');
  a.fields.title = '改过的站名';
  a.padding.left = 3;
  assert.notEqual(a.fields.title, b.fields.title);
  assert.equal(b.padding.left, 0);
  assert.equal(CRT.get('__unknown__').id, 'station-name');
  assert.equal(a.paddingAuto, false);
  assert.equal(a.backgroundColor, null);
});

test('新增库移除指定预设，补横梁与单侧站台后保留82款当前预设', () => {
  const removed = ['entrance-identity', 'gate-indicator', 'fare-information'];
  for (const id of removed) {
    assert.equal(CRT.ALL.some(template => template.id === id), false, id + '不得出现在新增库');
    assert.ok(CRT.REMOVED_IDS.includes(id), id + '必须标记为旧项目兼容');
  }
  assert.equal(CRT.ALL.length, 82);
  assert.equal(CRT.LEGACY_ALL.length, 91);
  assert.equal(CRT.REMOVED_IDS.length, 9);
});

test('移出的三款仍可按原ID恢复默认内容、尺寸与属性，不回退为站名牌', () => {
  for (const [id, name] of [
    ['entrance-identity', '出入口确认矩形附牌'],
    ['gate-indicator', '自动检票机通行状态'],
    ['fare-information', '票价表'],
  ]) {
    const template = CRT.get(id);
    assert.equal(template.id, id);
    assert.equal(template.name, name);
    assert.ok(CRT.LEGACY_ALL.includes(template));
    const props = CRT.createProps(id);
    assert.equal(props.templateId, id);
    assert.equal(props.widthRatio, template.width / template.height);
    assert.deepEqual(props.fields, CRT.defaultFields(id));
    assert.ok(Object.keys(props.fields).length > 0);
  }
});

test('岛式与同站台多线分向采用正文结构与编辑比例，只默认左侧内环小标题', () => {
  const split = CRT.get('platform-direction-split');
  const multiline = CRT.get('platform-direction-multiline');
  assert.equal(split.background, '#E4002B');
  assert.equal(split.color, '#FFFFFF');
  for (const [template, figure] of [[split, '4.1.10-1'], [multiline, '4.1.10-2']]) {
    assert.equal(template.source.page, 33);
    assert.equal(template.source.figure, figure);
    assert.equal(template.source.section, '4.1.10');
    assert.equal(template.width, 3600);
    assert.equal(template.height, 320);
    assert.match(template.source.note, /总宽.*编辑.*比例/);
    assert.equal(template.source.note.includes('XG-03'), false);
  }
  assert.match(split.source.note, /EQ等宽/);
  assert.match(split.source.note, /60\+200\+60得320/);
  assert.equal(multiline.source.note.includes('EQ'), false);
  assert.equal(multiline.source.note.includes('60+200+60'), false);
  const fields = CRT.defaultFields(multiline.id);
  assert.equal(fields.line, '环/5');
  assert.equal(fields.leftQualifier, '内环');
  assert.equal(fields.leftQualifierEn, 'Clockwise Loop');
  assert.equal(fields.rightQualifier, '');
  assert.equal(fields.rightQualifierEn, '');
});

test('岛式单线分向仅编辑中央线号，多线分向保留实际绘制的英文线路标签', () => {
  assert.equal(CRT.get('platform-direction-split').fields.some(field => field.key === 'lineEn'), false);
  assert.equal(Object.hasOwn(CRT.defaultFields('platform-direction-split'), 'lineEn'), false);
  assert.equal(CRT.defaultFields('platform-direction-multiline').lineEn, 'Loop Line / Line 5');
});
