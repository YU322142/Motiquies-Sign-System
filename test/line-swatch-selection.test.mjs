import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const context = vm.createContext({ crypto: globalThis.crypto });
vm.runInContext(readFileSync(new URL('../js/core.js', import.meta.url), 'utf8'), context);
const Core = context.SignCore;
const line = (id, marker, bg, name = marker + '号线') => ({ id, line: marker, name, nameEn: 'Line ' + marker, bg });

test('线路色块按唯一身份返回线路号和中英文名，不把完整名称当线路号', () => {
  const candidate = line('custom-2', '2', '#1DBCBF');
  const before = structuredClone(candidate);
  assert.equal(Core.uniqueLineForColor('#1dbcbf', [candidate]), candidate);
  assert.equal(Core.uniqueLineForColor('#1DBCBF', [candidate]).line, '2');
  assert.deepEqual(candidate, before);
});

test('同色不同线路不能猜测，同线路重复快照不会制造歧义', () => {
  const two = line('two', '2', '#1DBCBF'), three = line('three', '3', '#1DBCBF');
  assert.equal(Core.uniqueLineForColor('#1DBCBF', [two, three]), null);
  assert.equal(Core.uniqueLineForColor('#1DBCBF', [two, { ...two }]), two);
});

test('文字线路保留独立名称和英文，数字与文字共色仍属于歧义', () => {
  const cloud = { id: 'cloud', line: '云间', name: '云间线', nameEn: 'Cloud Line', bg: '#1DBCBF' };
  assert.equal(Core.uniqueLineForColor('#1DBCBF', [cloud]).nameEn, 'Cloud Line');
  assert.equal(Core.uniqueLineForColor('#1DBCBF', [cloud, line('two', '2', '#1DBCBF')]), null);
});

test('通用色与非法颜色不会从无关线路猜出线路身份', () => {
  const candidates = [line('two', '2', '#1DBCBF')];
  for (const color of [null, 'red', '#FFFF00', '#424A52', '#000000', '#FFFFFF']) {
    assert.equal(Core.uniqueLineForColor(color, candidates), null);
  }
  assert.equal(Core.uniqueLineForColor('#1DBCBF', null), null);
  assert.equal(Core.uniqueLineForColor('#1DBCBF', [{ bg: '#1DBCBF' }, null]), null);
});

test('真实城市只有唯一线路色自动选线，重庆潘通共色保持不选', () => {
  const candidates = (city) => Core.CITY_PALETTES[city].lines.map((item) =>
    line(city + ':' + item.line, item.line, item.bg));
  assert.equal(Core.uniqueLineForColor('#82BF25', candidates('shanghai')).line, '2');
  assert.equal(Core.uniqueLineForColor('#0057B7', candidates('chongqing')), null);
});
