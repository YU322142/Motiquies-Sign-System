import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = (p) => (0, eval)(readFileSync(new URL(p, import.meta.url), 'utf8'));
['core', 'icons', 'crt-symbols', 'crt-catalog', 'crt-render', 'state', 'render', 'composition', 'exporters']
  .forEach((name) => load('../js/' + name + '.js'));
const { SignCRT: C, SignState: S, SignRender: R, SignCRTRender: CR, SignCore: Core } = globalThis;
const measure = (text, family, weight, size) => Array.from(String(text)).length * size * 0.65;
measure.ink = (text, family, weight, size) => ({ abl: 0, abr: measure(text, family, weight, size), adv: measure(text, family, weight, size) });
measure.ascent = (text, family, weight, size) => size * 0.8;
measure.descent = (text, family, weight, size) => size * 0.2;

test('每款重庆矩形标识均有可追溯来源、有效比例和独立字段', () => {
  assert.ok(C.ALL.length > 35, '应覆盖标准多个章节和附录，而非仅有文本示例');
  assert.equal(new Set(C.ALL.map((t) => t.id)).size, C.ALL.length);
  for (const t of C.ALL) {
    assert.ok(t.source.page >= 1 && t.source.page <= 181, t.id);
    assert.ok(t.width > 0 && t.height > 0, t.id);
    assert.ok(t.width / t.height >= 0.1 && t.width / t.height <= 64, t.id);
    const fields = C.defaultFields(t.id);
    assert.ok(Object.values(fields).every((v) => typeof v === 'string'), t.id);
    assert.notEqual(fields, C.defaultFields(t.id));
  }
});

test('全部矩形模板可保存并恢复，无字段或几何信息丢失', () => {
  for (const t of C.ALL) {
    const sign = S.createSign();
    const el = S.createElement('crt-sign', { templateId: t.id });
    sign.rows[0].elements = [el];
    assert.equal(el.props.templateId, t.id);
    assert.equal(el.props.widthRatio, t.width / t.height);
    assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign, t.id);
    const mt = R.elementMetrics(el, 256, measure);
    assert.equal(mt.width, 256 * el.props.widthRatio, t.id);
    assert.ok(mt.commands.length > 1, t.id);
    for (const cmd of mt.commands) {
      for (const [key, value] of Object.entries(cmd.attrs)) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), t.id + ':' + key);
        if (typeof value === 'string') assert.doesNotMatch(value, /NaN|Infinity/, t.id + ':' + key);
        if (key === 'width' || key === 'height' || key === 'r') assert.ok(value >= 0, t.id + ':' + key);
      }
    }
  }
});

test('未知模板、损坏字段和极端比例可导入后继续渲染', () => {
  const sign = S.createSign();
  sign.rows[0].elements = [{ id: 'broken', type: 'crt-sign', props: {
    templateId: '<unknown>', fields: { title: { text: 'abc' }, unknown: 'ignored' },
    widthRatio: -100, lineColor: '<script>', direction: 'outside', paddingAuto: true,
  } }];
  const el = S.deserializeSign(sign).rows[0].elements[0];
  assert.equal(el.props.templateId, 'station-name');
  assert.equal(el.props.widthRatio, 0.1);
  assert.equal(el.props.fields.unknown, undefined);
  assert.equal(el.props.paddingAuto, false);
  assert.ok(CR.metrics(el, 256, measure).commands.length);
});

test('每个可编辑字段都影响牌面内容，避免面板出现无效输入', () => {
  const unused = [];
  for (const t of C.ALL) {
    const el = S.createElement('crt-sign', { templateId: t.id });
    const before = JSON.stringify(CR.metrics(el, 300, measure).commands);
    for (const f of t.fields) {
      const next = { ...el, props: { ...el.props, fields: { ...el.props.fields, [f.key]: 'Changed Different Text 123' } } };
      if (JSON.stringify(CR.metrics(next, 300, measure).commands) === before) unused.push(t.id + ':' + f.key);
    }
  }
  assert.deepEqual(unused, []);
});

test('竖版整牌动态导出宽度按实际比例裁定，不附加正方形空白', () => {
  const sign = S.createSign();
  sign.widthMode = 'dynamic';
  sign.rows[0].elements = [S.createElement('crt-sign', { widthRatio: 0.15 })];
  assert.equal(R.layoutSign(sign, measure).width, Math.ceil(256 * 0.15));
  assert.equal(R.layoutSign(sign, measure).height, 256);
});

test('缺省整牌属性按所选模板修复，保留该模板的参考比例与颜色', () => {
  const t = C.ALL.find((item) => item.width / item.height < 0.25);
  const sign = S.createSign();
  sign.rows[0].elements = [{ id: 'partial', type: 'crt-sign', props: { templateId: t.id } }];
  const p = S.deserializeSign(sign).rows[0].elements[0].props;
  assert.equal(p.widthRatio, t.width / t.height);
  assert.equal(p.lineColor, t.accent);
  assert.deepEqual(p.fields, C.defaultFields(t.id));
});

test('线路图按可编辑站名定位本站，而不是总选列表中间站', () => {
  const el = S.createElement('crt-sign', { templateId: 'route-vertical', fields: {
    title: '石油路', stations: '石油路|Shiyoulu|08\n大坪|Daping|07\n鹅岭|Eling|06',
  } });
  assert.equal(CR.metrics(el, 300, measure).currentStationIndex, 0);
  const changed = { ...el, props: { ...el.props, fields: { ...el.props.fields, title: '鹅岭' } } };
  assert.equal(CR.metrics(changed, 300, measure).currentStationIndex, 2);
});

test('符号库保持自包含矢量，重庆模板导出收集实际使用的字体面', () => {
  for (const [id, icon] of Object.entries(globalThis.SignCRTSymbols.ALL)) {
    assert.match(icon.vb, /^0 0 /, id);
    assert.doesNotMatch(icon.body, /<script|<foreignObject|<image|https?:|onload=|@font-face/i, id);
  }
  const sign = S.createSign();
  sign.rows[0].elements = [S.createElement('crt-sign')];
  const faces = globalThis.SignExporters.collectUsedFonts(sign);
  for (const face of ['zh400', 'zh700', 'en400', 'en700', 'num400', 'num700']) assert.equal(faces[face], true);
});
