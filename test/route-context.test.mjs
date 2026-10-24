import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

['core', 'icons', 'crt-symbols', 'crt-catalog', 'crt-render', 'state', 'render', 'composition', 'routes']
  .forEach((name) => (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8')));
const { SignRoutes: Routes, SignCRT: Catalog, SignCRTRender: Render } = globalThis;
const measure = (value, font, weight, size) => Array.from(String(value)).length * size * 0.6;
measure.ink = (value, font, weight, size) => ({ abl: 0, abr: measure(value, font, weight, size) });
measure.ascent = (value, font, weight, size) => size * 0.8;
measure.descent = (value, font, weight, size) => size * 0.2;

function lineFixture() {
  return Routes.createLine({ id: 'cloud', nameZh: '云间线', nameEn: 'Cloud Line', color: '#713CAC',
    stations: [
      { id: 'first', nameZh: '同名站', nameEn: 'West Star', code: '01', transfers: '' },
      { id: 'chosen', nameZh: '同名站', nameEn: 'East Star', code: '02', transfers: '72号线 / 未知线' },
      { id: 'last', nameZh: '支线终点', nameEn: 'Branch Terminus', code: '03', transfers: '72号线' },
    ], currentStationId: 'first', direction: 'backward' });
}
const other = { id: 'seventy-two', nameZh: '72号线', nameEn: 'Line 72', color: '#F29B25', stations: [], currentStationId: null, direction: 'forward' };
function metrics(templateId, routeLine) {
  return Render.metrics({ props: { ...Catalog.createProps(templateId), routeLine } }, 1000, measure);
}
function textContents(commands) {
  return commands.flatMap((command) => command.tag === 'element'
    ? [command.element.props.textZh, command.element.props.textEn, command.element.props.text].filter(Boolean)
    : command.text === undefined ? [] : [command.text]);
}

test('当前车站线路快照按站点 ID 设置本站，并保留运行方向、全部站点与换乘配色', () => {
  const context = { line: lineFixture(), stationId: 'chosen' };
  const before = structuredClone(context);
  const result = Routes.forContext(context, [other]);
  assert.equal(result.currentStationId, 'chosen');
  assert.equal(result.direction, 'backward');
  assert.deepEqual(result.stations, context.line.stations);
  assert.deepEqual(result.relatedLines, [{ id: other.id, nameZh: other.nameZh, nameEn: other.nameEn, color: other.color }]);
  assert.deepEqual(context, before);
  assert.notEqual(result.stations, context.line.stations);
  assert.equal(Routes.forContext(null, []), null);
  assert.equal(Routes.forContext({}, []), null);
  assert.equal(Routes.forContext({ line: context.line, stationId: 'missing' }, []).currentStationId, 'first');
});

test('标准线路图直接使用完整线路对象，同名站按 ID 高亮且不带默认示例站', () => {
  const routeLine = Routes.withRelatedLines(Routes.patchLine(lineFixture(), { currentStationId: 'chosen' }), [other]);
  for (const templateId of Catalog.ALL.filter((template) => template.layout === 'route').map((template) => template.id)) {
    const mt = metrics(templateId, routeLine);
    assert.equal(mt.currentStationIndex, 1, templateId);
    const labels = textContents(mt.commands);
    for (const station of routeLine.stations) {
      assert.ok(labels.includes(station.nameZh), templateId + ':' + station.nameZh);
      assert.ok(labels.includes(station.nameEn), templateId + ':' + station.nameEn);
    }
    assert.ok(labels.some((text) => text.includes(routeLine.nameZh)), templateId + ':line name');
    assert.equal(labels.some((text) => /石油路|Shiyoulu|长福路|Changfulu/.test(text)), false, templateId);
    assert.ok(mt.commands.some((command) => command.text === '72号线' && command.attrs.fill === other.color), templateId + ':transfer color');
    assert.ok(mt.commands.some((command) => command.text === '未知线' && command.attrs.fill === '#66727B'), templateId + ':unknown transfer');
    for (const command of mt.commands) {
      for (const value of Object.values(command.attrs)) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), templateId);
        if (typeof value === 'string') assert.doesNotMatch(value, /NaN|Infinity/, templateId);
      }
    }
  }
});

test('完整线路的运行方向驱动横向和竖向标准线路图箭头，双向与支线外形保持', () => {
  for (const [templateId, backwards, forwards] of [
    ['train-route', 'arrow_left', 'arrow_right'],
    ['route-vertical', 'arrow_up', 'arrow_down'],
    ['route-vertical-double', 'arrow_up', 'arrow_down'],
  ]) {
    for (const [direction, expected] of [['backward', backwards], ['forward', forwards]]) {
      const mt = metrics(templateId, Routes.patchLine(lineFixture(), { direction }));
      assert.ok(mt.commands.some((command) => command.tag === 'element' && command.element.props.icon === expected), templateId + ':' + direction);
    }
  }
  const double = metrics('route-vertical-double', lineFixture());
  assert.equal(double.commands.filter((command) => command.tag === 'line' && command.attrs.x1 === command.attrs.x2 && command.attrs.stroke === '#713CAC').length, 2);
  const branch = metrics('train-route-branch', lineFixture());
  assert.ok(branch.commands.some((command) => command.tag === 'path' && command.attrs.stroke === '#713CAC'));
});

test('无站点的真实线路不会回退到示例站，未选本站不高亮第一站', () => {
  const empty = metrics('route-vertical', Routes.patchLine(lineFixture(), { stations: [] }));
  assert.ok(textContents(empty.commands).includes('请添加站点'));
  assert.equal(textContents(empty.commands).some((text) => /石油路|Shiyoulu/.test(text)), false);
  const noCurrent = metrics('train-route', Routes.patchLine(lineFixture(), { currentStationId: null }));
  assert.equal(noCurrent.currentStationIndex, -1);
});

test('百站至二百五十六站的标准线路图按站距缩小圆点、本站条与站号，同名站仍按 ID 高亮', () => {
  for (const count of [100, 256]) {
    const stations = Array.from({ length: count }, (_, index) => ({ id: 's-' + index,
      nameZh: '同名站', nameEn: 'Station ' + index, code: String(index + 1), transfers: index % 4 ? '' : '72号线' }));
    const line = Routes.withRelatedLines(Routes.createLine({ ...lineFixture(), stations, currentStationId: 's-50' }), [other]);
    for (const templateId of ['route-vertical', 'route-vertical-double', 'train-route', 'train-route-branch']) {
      const mt = metrics(templateId, line);
      assert.equal(mt.currentStationIndex, 50, templateId + ':' + count);
      const horizontal = templateId.startsWith('train-route');
      const groups = new Map();
      for (const command of mt.commands.filter((command) => command.tag === 'circle')) {
        const key = horizontal ? command.attrs.cy : command.attrs.cx;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(command.attrs);
      }
      let smallestGap = Infinity;
      for (const circles of groups.values()) {
        circles.sort((a, b) => horizontal ? a.cx - b.cx : a.cy - b.cy);
        for (let index = 1; index < circles.length; index++) {
          const previous = circles[index - 1], circle = circles[index];
          const gap = horizontal ? circle.cx - previous.cx : circle.cy - previous.cy;
          smallestGap = Math.min(smallestGap, gap);
          assert.ok(previous.r + circle.r + ((previous['stroke-width'] || 0) + (circle['stroke-width'] || 0)) / 2 < gap,
            templateId + ':' + count + ':adjacent station rings');
        }
      }
      if (!horizontal) {
        const highlights = mt.commands.filter((command) => command.tag === 'rect' && command.attrs.y > 0 && command.attrs.fill === line.color);
        assert.ok(highlights.length, templateId + ':current station highlight');
        assert.ok(highlights.every((command) => command.attrs.height < smallestGap), templateId + ':current station strip height');
      }
      const codes = mt.commands.filter((command) => command.tag === 'text' && /^\d+$/.test(command.text));
      assert.ok(codes.length, templateId + ':station codes');
      assert.ok(codes.every((command) => command.attrs['font-size'] <= smallestGap * 0.5), templateId + ':' + count + ':station code size');
    }
  }
});

test('常规短线路保持原圆点、线宽与本站条尺寸', () => {
  const line = lineFixture();
  for (const templateId of ['route-vertical', 'route-vertical-double']) {
    const mt = metrics(templateId, line), unit = Math.min(mt.width, mt.height);
    assert.ok(mt.commands.filter((command) => command.tag === 'circle').every((command) => command.attrs.r === unit * 0.018));
    assert.ok(mt.commands.some((command) => command.tag === 'rect' && command.attrs.y > 0 && command.attrs.height === unit * 0.074));
  }
  const horizontal = metrics('train-route', line);
  assert.ok(horizontal.commands.filter((command) => command.tag === 'circle').every((command) => command.attrs.r === 38));
  assert.ok(horizontal.commands.some((command) => command.tag === 'line' && command.attrs['stroke-width'] === 55));
});
