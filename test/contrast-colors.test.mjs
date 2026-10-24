import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function load() {
  const values = new Map();
  const context = vm.createContext({ crypto: globalThis.crypto, console,
    localStorage: { getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } });
  for (const name of ['core', 'state', 'presets']) {
    vm.runInContext(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'), context);
  }
  return context;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const props = (S, sign, id) => S.findElement(sign, id).element.props;

function fixture(S) {
  const background = S.createElement('shape', { fill: '#003DA5' });
  const text = S.createElement('plain-text', { text: '璧山方向', color: '#FFFFFF', contrastSourceId: background.id });
  const icon = S.createElement('icon', { icon: 'arrow_left', color: '#FFFFFF', contrastSourceId: background.id });
  const manual = S.createElement('plain-text', { text: '中央数字', color: '#000000' });
  const other = S.createRow([S.createElement('bilingual-text')]);
  return { background, text, icon, manual,
    sign: { ...S.createSign(), rows: [S.createRow([background, text, icon, manual]), other] } };
}

test('背景由深色改为浅色时只不可变更新绑定文字和箭头，连续编辑不丢内容', () => {
  const { SignState: S } = load();
  const { sign, background, text, icon, manual } = fixture(S);
  const snapshot = plain(sign);
  let next = S.updateElementProps(sign, text.id, { text: '自建终点方向' });
  next = S.updateElementProps(next, background.id, { fill: '#FFFF00' });
  assert.equal(props(S, next, text.id).color, '#000000');
  assert.equal(props(S, next, icon.id).color, '#000000');
  assert.equal(props(S, next, text.id).text, '自建终点方向');
  assert.equal(S.findElement(next, manual.id).element, manual);
  assert.equal(next.rows[1], sign.rows[1]);
  next = S.updateElementProps(next, background.id, { fill: '#111111' });
  assert.equal(props(S, next, text.id).color, '#FFFFFF');
  assert.deepEqual(plain(sign), snapshot);
});

test('手动颜色退出自动绑定，勾回自动黑白立即恢复并保留背景关联', () => {
  const { SignState: S } = load();
  const { sign, background, text } = fixture(S);
  let next = S.updateElementProps(sign, text.id, { color: '#123456' });
  assert.equal(props(S, next, text.id).autoContrast, false);
  assert.equal(props(S, next, text.id).contrastSourceId, background.id);
  next = S.updateElementProps(next, background.id, { fill: '#FFFFFF' });
  assert.equal(props(S, next, text.id).color, '#123456');
  next = S.updateElementProps(next, text.id, { autoContrast: true });
  assert.equal(props(S, next, text.id).color, '#000000');
  next = S.updateElementProps(next, text.id, { color: '#ABCDEF', autoContrast: true });
  assert.equal(props(S, next, text.id).color, '#000000', '显式自动模式优先于手动颜色');
});

test('自动与手动绑定均随项目保存恢复，恢复后仍可修改背景', () => {
  const { SignState: S } = load();
  const { sign, background, text, icon } = fixture(S);
  const edited = S.updateElementProps(sign, icon.id, { color: '#123456' });
  const restored = S.deserializeSign(S.serializeSign(edited));
  assert.deepEqual(plain(restored), plain(edited));
  const next = S.updateElementProps(restored, background.id, { fill: '#FFFFFF' });
  assert.equal(props(S, next, text.id).color, '#000000');
  assert.equal(props(S, next, icon.id).color, '#123456');
});

test('导入重复行元素ID时引用跟随所在行的新背景ID，不能连接另一张旧牌', () => {
  const { SignState: S } = load();
  const row = (fill) => ({ id: 'row', elements: [
    { id: 'bg', type: 'shape', props: { fill } },
    { id: 'text', type: 'plain-text', props: { text: '方向', contrastSourceId: 'bg' } },
  ] });
  const restored = S.deserializeSign({ rows: [row('#000000'), row('#FFFFFF')] });
  const [first, second] = restored.rows;
  assert.notEqual(first.elements[0].id, second.elements[0].id);
  assert.equal(second.elements[1].props.contrastSourceId, second.elements[0].id);
  assert.equal(first.elements[1].props.color, '#FFFFFF');
  assert.equal(second.elements[1].props.color, '#000000');
});

test('导入只接受文字图标的有效背景引用，清理非法与悬空绑定并保留颜色', () => {
  const { SignState: S } = load();
  const sign = S.deserializeSign({ rows: [{ elements: [
    { id: 'bad-id', type: 'plain-text', props: { contrastSourceId: 42, autoContrast: 'false', color: '#123456' } },
    { id: 'missing', type: 'icon', props: { contrastSourceId: 'gone', autoContrast: true, color: '#654321' } },
    { id: 'shape', type: 'shape', props: { contrastSourceId: 'shape', autoContrast: true } },
  ] }] });
  for (const element of sign.rows[0].elements) {
    assert.equal(element.props.contrastSourceId, undefined);
    assert.equal(element.props.autoContrast, undefined);
  }
  assert.equal(props(S, sign, 'missing').color, '#654321');
});

test('删除背景后清理关联，删除其他元素不改变绑定', () => {
  const { SignState: S } = load();
  const { sign, background, text, manual } = fixture(S);
  const intact = S.deleteElement(sign, manual.id);
  assert.equal(props(S, intact, text.id).contrastSourceId, background.id);
  const removed = S.deleteElement(intact, background.id);
  assert.equal(props(S, removed, text.id).contrastSourceId, undefined);
  assert.equal(props(S, removed, text.id).color, '#FFFFFF');
  assert.equal(props(S, sign, text.id).contrastSourceId, background.id);
});

test('背景改透明时按所在行的实际底色选择黑白', () => {
  const { SignState: S } = load();
  const { sign, background, text } = fixture(S);
  sign.rows[0].backgroundColor = '#FFFFFF';
  const next = S.updateElementProps(sign, background.id, { fill: null });
  assert.equal(props(S, next, text.id).color, '#000000');
});

test('复制元素两遍重建ID和背景引用，缺少背景的单独复制不留下悬空引用', () => {
  const { SignState: S } = load();
  const { sign, background, text } = fixture(S);
  const clone = S.cloneElements(sign.rows[0].elements);
  assert.notEqual(clone[0].id, background.id);
  assert.notEqual(clone[1].id, text.id);
  assert.equal(clone[1].props.contrastSourceId, clone[0].id);
  const lone = S.cloneElements([text]);
  assert.equal(lone[0].props.contrastSourceId, undefined);
  assert.equal(text.props.contrastSourceId, background.id);
});

test('我的预设保存后重复添加，两份背景颜色各自联动且不修改原预设', () => {
  const { SignState: S, SignPresets: P } = load();
  const { sign } = fixture(S);
  P.save('分向牌', sign.rows[0].elements);
  const saved = plain(P.list()[0]);
  const first = P.materialize(saved.id), second = P.materialize(saved.id);
  assert.equal(first[1].props.contrastSourceId, first[0].id);
  assert.equal(second[1].props.contrastSourceId, second[0].id);
  let next = { ...S.createSign(), rows: [S.createRow(first), S.createRow(second)] };
  next = S.updateElementProps(next, first[0].id, { fill: '#FFFFFF' });
  assert.equal(next.rows[0].elements[1].props.color, '#000000');
  assert.equal(next.rows[1].elements[1].props.color, '#FFFFFF');
  assert.deepEqual(plain(P.list()[0]), saved);
});
