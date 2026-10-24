/** 行内元素与重庆整牌必须共享同一套几何，避免两套字号、色条和边距规则漂移。 */
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'crt-render']) {
  const file = new URL('../js/' + name + '.js', import.meta.url);
  (0, eval)(readFileSync(file, 'utf8'));
}
const { SignCore: Core, SignState: S, SignRender: R, SignCRT: Catalog, SignCRTRender: CRT } = globalThis;
const h = 256;
const measure = (text, family, weight, size) => Array.from(String(text)).length * size * 0.9;
measure.ink = (text, family, weight, size) => ({ abl: -0.05 * size, abr: 0.85 * size, adv: 0.9 * size });
measure.ascent = (text, family, weight, size) => size * (family === Core.FONT_ZH ? 0.8 : family === Core.FONT_NUM ? 0.7 : 0.72);
measure.descent = (text, family, weight, size) => size * (family === Core.FONT_ZH ? 0.09 : 0.21);

function composition() {
  assert.ok(globalThis.SignComposition, '缺少供原有元素与 CRT 共用的纯几何组合模块');
  return globalThis.SignComposition;
}
function propsFor(id, patch = {}) {
  const props = Catalog.createProps(id);
  return { ...props, ...patch, fields: { ...props.fields, ...patch.fields } };
}
function elementCommands(id, patch = {}) {
  const el = S.createElement('crt-sign', propsFor(id, patch));
  return CRT.metrics(el, h, measure).commands.filter((cmd) => cmd.tag === 'element');
}
function scales(commands) {
  return commands.map((cmd) => {
    const match = /scale\(\s*([-+\d.eE]+)/.exec(cmd.attrs.transform || '');
    assert.ok(match, '组合的平移/缩放必须由命令记录，绘制不能重新排版');
    return Number(match[1]);
  });
}

test('原生元素片段无 DOM、无 UUID、无输入变更，几何与原有元素一致', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof R.measureFragment, 'function', '缺少无 DOM 的原生元素片段度量入口');
  const originalUUID = Core.uuid;
  Core.uuid = () => { throw new Error('片段度量不应生成编辑器元素 ID'); };
  try {
    for (const type of ['number-line', 'text-line', 'exit', 'icon', 'bilingual-text']) {
      const props = { ...S.DEFAULT_PROPS[type], padding: { top: 0.2, right: 0.1, bottom: 0.2, left: 0.2 } };
      const before = JSON.stringify(props);
      const fragment = R.measureFragment(type, props, h, measure);
      assert.equal(JSON.stringify(props), before, type + ' 不得修改传入属性');
      assert.equal(fragment.element.type, type);
      assert.equal(fragment.height, h);
      assert.equal(fragment.width, fragment.metrics.width);
      // 不调用 createElement：该函数用于编辑器状态，会产生与几何无关的 ID。
      const expected = R.elementMetrics({ type, props }, h, measure);
      assert.deepEqual(fragment.metrics, expected, type);
      assert.deepEqual(R.measureFragment(type, props, h, measure), fragment, type + ' 必须确定性返回');
    }
  } finally {
    Core.uuid = originalUUID;
  }
});

test('重庆进站引导中的线路使用原有 number-line 的同高几何', () => {
  const commands = elementCommands('entrance-guide', { fields: { line: '3', lineEn: 'Line 3' } });
  const line = commands.find((cmd) => cmd.element.type === 'number-line');
  assert.ok(line, 'CRT 不应另算线路数字、色条和双语标签');
  assert.equal(line.rowHeight, h);
  assert.deepEqual(line.metrics, R.elementMetrics(line.element, h, measure));
  assert.equal(line.metrics.stripeH, h - line.metrics.pad.t);
  assert.equal(line.metrics.entries[0].stripeW, line.metrics.size * R.STRIPE_RATIO);
  assert.equal(line.metrics.entries[0].fontSize, line.metrics.size * R.NUM_FONT_RATIO);
});

test('重庆站厅出站引导复用出口编号与双语标签的原生组合', () => {
  const commands = elementCommands('concourse-exit');
  const exit = commands.find((cmd) => cmd.element.type === 'exit');
  assert.ok(exit, '出口标签不应另作字号加倍的主标题');
  assert.equal(exit.element.props.code, '1/2');
  assert.deepEqual(exit.metrics, R.elementMetrics(exit.element, exit.rowHeight, measure));
  assert.equal(exit.metrics.label.zhSize, exit.metrics.size * 0.75 * R.ZH_FONT_RATIO);
  assert.equal(exit.metrics.label.enSize, exit.metrics.size * 0.75 * R.EN_FONT_RATIO);
});

test('重庆横向设施牌复用图标与原生双语，英文基线保持相同公式', () => {
  const commands = elementCommands('accessible-elevator');
  assert.ok(commands.some((cmd) => cmd.element.type === 'icon' && cmd.element.props.icon === 'elevator'));
  const label = commands.find((cmd) => cmd.element.type === 'bilingual-text');
  assert.ok(label, '设施牌必须消费与自由组合相同的双语片段');
  assert.equal(label.element.props.textZh, '无障碍电梯');
  assert.equal(label.element.props.textEn, 'Accessible Elevator');
  assert.deepEqual(label.metrics, R.elementMetrics(label.element, label.rowHeight, measure));
  assert.equal(label.metrics.zhSize, label.metrics.pad.size * R.ZH_FONT_RATIO);
  assert.equal(label.metrics.enSize, label.metrics.pad.size * R.EN_FONT_RATIO);
});

test('超长目的地在窄盒中整组等比缩放，不逐项缩字号或重排墨区', () => {
  const C = composition();
  const props = propsFor('train-guide', { fields: {
    title: '开往重庆江北国际机场及周边公共交通换乘设施',
    subtitle: 'To Chongqing Jiangbei International Airport and Public Transport Interchange',
    line: '10', lineEn: 'Line 10',
  } });
  const parts = C.horizontalParts(Catalog.get('train-guide'), props);
  assert.ok(Array.isArray(parts) && parts.length > 2);
  const roomy = C.layoutParts(parts, h, measure, { x: 0, y: 0, w: 100000, h });
  const compact = C.layoutParts(parts, h, measure, { x: 19, y: 7, w: 300, h: h - 14 });
  assert.equal(roomy.scale, 1);
  assert.ok(compact.scale > 0 && compact.scale < 1);
  assert.equal(compact.commands.length, roomy.commands.length);
  assert.ok(compact.commands.every((cmd) => cmd.tag === 'element'));
  assert.deepEqual(compact.commands.map((cmd) => cmd.metrics), roomy.commands.map((cmd) => cmd.metrics),
    '缩小外盒不能改变片段原生墨区、字号和字距');
  assert.deepEqual(compact.commands.map((cmd) => cmd.rowHeight), roomy.commands.map((cmd) => cmd.rowHeight));
  for (const scale of scales(compact.commands)) assert.ok(Math.abs(scale - compact.scale) < 1e-9);
});

test('左右方向镜像整个出站组合，保留编号并切换原生内容对齐', () => {
  const C = composition(), template = Catalog.get('concourse-exit');
  const left = C.horizontalParts(template, propsFor(template.id, { direction: 'left' }));
  const right = C.horizontalParts(template, propsFor(template.id, { direction: 'right' }));
  assert.deepEqual(right.map((part) => part.type), left.map((part) => part.type).reverse());
  const leftExit = left.find((part) => part.type === 'exit');
  const rightExit = right.find((part) => part.type === 'exit');
  assert.equal(leftExit.props.align, 'left');
  assert.equal(rightExit.props.align, 'right');
  assert.equal(rightExit.props.code, leftExit.props.code);
  const arrowLeft = left.find((part) => part.type === 'icon' && /arrow/.test(part.props.icon));
  const arrowRight = right.find((part) => part.type === 'icon' && /arrow/.test(part.props.icon));
  assert.ok(arrowLeft && arrowRight, '复用原有方向图标并随方向镜像');
  assert.notEqual(arrowLeft.props.icon, arrowRight.props.icon);
});

test('数字线路和环线混排保持独立类型与重庆线路配色', () => {
  const C = composition();
  const parts = C.lineParts('环/5', 'Loop Line / Line 5', {}, '#123456');
  const loop = parts.find((part) => part.type === 'text-line');
  const numbered = parts.filter((part) => part.type === 'number-line').flatMap((part) => part.props.lines);
  assert.ok(loop, '环线应复用原有文字线路元素');
  assert.equal(loop.props.text, '环');
  assert.equal(loop.props.textEn, 'Loop Line');
  assert.equal(loop.props.blockColor, Core.lineColorFor('环', 'chongqing').bg);
  assert.ok(numbered.some((line) => line.number === '5' && line.color === Core.lineColorFor('5', 'chongqing').bg));
});

test('多条数字线路分别记录线路色，不共用第一条线路的色条', () => {
  const C = composition();
  const parts = C.lineParts('1/3/6', 'Line 1 / Line 3 / Line 6', {}, '#123456');
  const lines = parts.filter((part) => part.type === 'number-line').flatMap((part) => part.props.lines);
  assert.deepEqual(lines.map((line) => line.number), ['1', '3', '6']);
  for (const line of lines) assert.equal(line.color, Core.lineColorFor(line.number, 'chongqing').bg, line.number);
  assert.ok(new Set(lines.map((line) => line.color)).size > 1);
});

test('手选线路色覆盖每条线路，文字色仍独立保留', () => {
  const C = composition();
  const parts = C.lineParts('环/5', 'Loop Line / Line 5', { lineColorMode: 'custom', lineColor: '#123456' }, '#ABCDEF');
  for (const part of parts) {
    assert.equal(part.props.textColor, '#ABCDEF');
    if (part.type === 'text-line') assert.equal(part.props.blockColor, '#123456');
    if (part.type === 'number-line') for (const line of part.props.lines) assert.equal(line.color, '#123456');
  }
});

test('右上与右下方向也镜像目的地和线路次序，并同步双语右对齐', () => {
  const C = composition(), template = Catalog.get('train-guide');
  const left = C.horizontalParts(template, propsFor(template.id, { direction: 'left' }));
  for (const direction of ['right', 'right-up', 'right-down']) {
    const parts = C.horizontalParts(template, propsFor(template.id, { direction }));
    assert.deepEqual(parts.map((part) => part.type), left.map((part) => part.type).reverse(), direction);
    assert.equal(parts.find((part) => part.type === 'bilingual-text').props.align, 'right', direction);
    assert.equal(parts.find((part) => part.type === 'number-line').props.align, 'right', direction);
  }
});

test('不能横向组合的竖牌保留自身版式和参考宽高比', () => {
  const C = composition();
  for (const id of ['station-name', 'station-name-vertical', 'transfer-doorpost', 'security-check', 'route-vertical']) {
    const template = Catalog.get(id);
    assert.equal(C.horizontalParts(template, propsFor(id)), null, id + ' 不应强行改成横向原生元素组合');
    const el = S.createElement('crt-sign', { templateId: id });
    assert.equal(CRT.metrics(el, h, measure).width, h * template.width / template.height);
  }
});
