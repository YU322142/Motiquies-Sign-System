import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['core', 'state', 'routes']) {
  (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
}
const { SignState: S, SignRoutes: L } = globalThis;

test('公共线路来源随项目保存，切站不会因为缺省source而变成本地', () => {
  const line = L.createLine({ id: 'shared-72', nameZh: '72号线' });
  const sign = S.setProjectContext(S.createSign(), { line, stationId: line.stations[0].id, source: 'server' });
  assert.equal(sign.context.source, 'server');
  const restored = S.deserializeSign(S.serializeSign(sign));
  assert.deepEqual(restored, sign);
  const switched = S.setProjectContext(restored, { line, stationId: line.stations[1].id });
  assert.equal(switched.context.source, 'server');
  const local = S.setProjectContext(switched, { line, stationId: line.stations[0].id, source: 'local' });
  assert.equal(local.context.source, 'local', '同ID本地线路仍可明确切换来源');
  const legacy = S.setProjectContext(S.createSign(), { line });
  assert.equal(legacy.context.source, undefined, '旧项目不额外添加来源字段');
});

test('公共线路图的来源保存在行快照，重新打开不会按配色偏好猜来源', () => {
  const line = L.createLine({ id: 'public-route', nameZh: '公共线' });
  const initial = S.createSign();
  const sign = S.addTemplateRow(initial, initial.rows[0].id, [S.createElement('plain-text', { text: '公共线' })], {
    route: { line, orientation: 'horizontal', source: 'server' }, widthRatio: 6,
  });
  assert.equal(sign.rows[0].route.source, 'server');
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
});
