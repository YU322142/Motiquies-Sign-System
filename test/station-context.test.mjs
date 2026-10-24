import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['core', 'state', 'routes']) (0, eval)(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'));
const { SignState: S, SignRoutes: L } = globalThis;

test('单牌车站上下文保留完整线路、本站、来源和换乘选择，不改其他牌', () => {
  const line = L.createLine({ id: 'server-line', nameZh: '云间线', color: '#123ABC' });
  const initial = S.addRow(S.createSign());
  const before = JSON.stringify(initial);
  const context = { line, stationId: line.stations[1].id, source: 'server', transferLineIds: ['one', 'two', 'one', 3, ''] };
  const sign = S.setRowStationContext(initial, initial.rows[0].id, context);
  assert.equal(JSON.stringify(initial), before);
  assert.equal(sign.rows[1], initial.rows[1]);
  assert.deepEqual(sign.rows[0].stationContext, { line, stationId: line.stations[1].id, source: 'server', transferLineIds: ['one', 'two'] });
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
  const removed = S.setRowStationContext(sign, sign.rows[0].id, null);
  assert.equal(removed.rows[0].stationContext, undefined);
  assert.equal(sign.rows[0].stationContext.stationId, line.stations[1].id);
  assert.equal(S.setRowStationContext(sign, 'missing', context), sign);
});

test('添加预设时附加本站快照，替换时清理旧站点并规范化外部资料', () => {
  const line = L.createLine({ id: 'local-line' });
  const initial = S.createSign();
  const parts = [S.createElement('plain-text')];
  const sign = S.addTemplateRow(initial, initial.rows[0].id, parts, { stationContext: { line, stationId: 'missing', source: 'invalid', transferLineIds: [] } });
  assert.equal(sign.rows[0].stationContext.stationId, line.currentStationId);
  assert.equal(sign.rows[0].stationContext.source, undefined);
  assert.deepEqual(sign.rows[0].stationContext.transferLineIds, []);
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)), sign);
  const changed = S.setRowStationContext(sign, sign.rows[0].id, { ...sign.rows[0].stationContext, source: 'local' });
  const next = S.setRowStationContext(changed, changed.rows[0].id, { line, stationId: line.stations[1].id });
  assert.equal(next.rows[0].stationContext.source, 'local');
  const replaced = S.addTemplateRow(next, next.rows[0].id, parts, { replaceRowId: next.rows[0].id });
  assert.equal(replaced.rows[0].stationContext, undefined);
});
