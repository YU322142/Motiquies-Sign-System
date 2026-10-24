import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const name of ['core', 'icons', 'crt-symbols', 'crt-catalog', 'state', 'render', 'composition', 'crt-render', 'routes', 'workspace']) {
  const file = new URL('../js/' + name + '.js', import.meta.url);
  (0, eval)(readFileSync(file, 'utf8'));
}
const { SignCore: Core, SignState: S, SignRender: R, SignComposition: C, SignCRT: Catalog } = globalThis;
const measure = (text, font, weight, size) => Array.from(String(text)).length * size * 0.6;
measure.ink = (text, font, weight, size) => ({ abl: 0, abr: measure(text, font, weight, size), adv: measure(text, font, weight, size) });
measure.ascent = (text, font, weight, size) => size * 0.8;
measure.descent = (text, font, weight, size) => size * 0.2;
function workspace() {
  assert.ok(globalThis.SignWorkspace, '完整竖牌和横牌必须进入独立牌面，不能追加为等高行');
  return globalThis.SignWorkspace;
}
function preset(sign, id) {
  const template = Catalog.get(id);
  return workspace().addPreset(sign, C.materialize(id, undefined, measure), {
    name: template.name, templateId: id, widthRatio: template.width / template.height,
  });
}
function text(sign) { return JSON.stringify(sign.rows.map((row) => row.elements.map((el) => el.props))); }

test('用户图回归：先竖站名后门楣形成独立牌面，当前预览只绘制门楣', () => {
  const W = workspace();
  const vertical = preset(S.createSign(), 'station-name');
  assert.equal(W.list(vertical).length, 1, '第一张预设应复用初始空白牌');
  const verticalId = vertical.workspace.activeId;
  const both = preset(vertical, 'entrance-lintel');
  assert.equal(W.list(both).length, 2);
  assert.notEqual(both.workspace.activeId, verticalId);
  assert.equal(both.rows.length, 1, '两个完整标识不能共用行高拼接到同一 Sign');
  assert.equal(R.layoutSign(both, measure).width, both.rowHeight * 6);
  assert.equal(R.layoutSign(both, measure).height, both.rowHeight);
  assert.ok(text(both).includes('八公里'));
  assert.ok(!text(both).includes('石油路'));
});

test('切回竖牌恢复自己的尺寸，长横牌不参与竖牌的适配宽度', () => {
  const W = workspace(), vertical = preset(S.createSign(), 'station-name'), id = vertical.workspace.activeId;
  const both = preset(vertical, 'entrance-lintel');
  const selected = W.select(both, id), layout = R.layoutSign(selected, measure);
  assert.equal(layout.width, selected.rowHeight * 0.75);
  assert.equal(layout.height, selected.rowHeight);
  assert.equal(selected.rows.length, 1);
  assert.ok(text(selected).includes('石油路') && !text(selected).includes('八公里'));
  assert.equal(W.list(selected).length, 2);
});

test('切牌保留每块的文字、行高和比例，状态更新不可变', () => {
  const W = workspace();
  let sign = preset(S.createSign(), 'station-name');
  const verticalId = sign.workspace.activeId;
  const title = sign.rows[0].elements.find((el) => el.type === 'bilingual-text');
  sign = S.updateElementProps(sign, title.id, { textZh: '星港站', textEn: 'Star Harbor' });
  sign = S.updateSignSettings(sign, { rowHeight: 400 });
  sign = S.setRowAspectRatio(sign, sign.rows[0].id, 0.8);
  sign = preset(sign, 'entrance-lintel');
  const lintelId = sign.workspace.activeId;
  const before = JSON.stringify(sign);
  const selected = W.select(sign, verticalId);
  assert.equal(JSON.stringify(sign), before);
  assert.equal(selected.rowHeight, 400);
  assert.equal(selected.rows[0].widthRatio, 0.8);
  assert.ok(text(selected).includes('星港站') && text(selected).includes('Star Harbor'));
  const back = W.select(selected, lintelId);
  assert.ok(text(back).includes('八公里') && !text(back).includes('星港站'));
});

test('项目 JSON 恢复全部牌面及名称，活动牌不在 workspace 中递归存储', () => {
  const W = workspace();
  let sign = preset(S.createSign(), 'station-name');
  const first = sign.workspace.activeId;
  sign = W.rename(sign, first, '星港竖站名');
  sign = preset(sign, 'entrance-lintel');
  const second = sign.workspace.activeId;
  sign = W.rename(sign, second, '星港入口门楣');
  const saved = S.deserializeSign(S.serializeSign(sign));
  assert.equal(saved.workspace.activeId, second);
  assert.deepEqual(W.list(saved).map(({ id, name }) => ({ id, name })), W.list(sign).map(({ id, name }) => ({ id, name })));
  assert.ok(text(W.select(saved, first)).includes('石油路'));
  assert.ok(text(W.select(saved, second)).includes('八公里'));
  for (const entry of saved.workspace.boards) {
    if (entry.id === saved.workspace.activeId) assert.equal(Object.hasOwn(entry, 'sign'), false);
    else assert.ok(entry.sign && !entry.sign.workspace);
  }
});

test('删除当前牌后保留另一张完整牌，改名和删除不修改旧状态', () => {
  const W = workspace();
  let sign = preset(S.createSign(), 'station-name');
  const first = sign.workspace.activeId;
  sign = preset(sign, 'entrance-lintel');
  const before = JSON.stringify(sign), second = sign.workspace.activeId;
  const renamed = W.rename(sign, first, '竖牌 A');
  assert.equal(JSON.stringify(sign), before);
  assert.equal(W.list(renamed).find((board) => board.id === first).name, '竖牌 A');
  const removed = W.remove(renamed, second);
  assert.equal(W.list(removed).length, 1);
  assert.equal(removed.workspace.activeId, first);
  assert.ok(text(removed).includes('石油路') && !text(removed).includes('八公里'));
});

test('无 workspace 的旧项目有稳定初始牌 ID，同牌增加普通行不创建新牌', () => {
  const W = workspace();
  const original = S.createSign(), before = JSON.stringify(original);
  assert.equal(W.list(original).length, 1);
  assert.equal(W.list(original)[0].id, original.rows[0].id);
  assert.equal(W.list(original)[0].id, W.list(original)[0].id);
  assert.equal(JSON.stringify(original), before);
  const addedRow = S.addRow(original);
  assert.equal(addedRow.rows.length, 2);
  assert.equal(W.list(addedRow).length, 1, '基础元素多行编辑仍属于一张牌');
});

test('列出的每张牌都是不含 workspace 的独立 Sign，可单独渲染或导出', () => {
  const W = workspace();
  const sign = preset(preset(S.createSign(), 'station-name'), 'entrance-lintel');
  const entries = W.list(sign);
  assert.equal(entries.filter((board) => board.active).length, 1);
  assert.equal(new Set(entries.map((board) => board.id)).size, 2);
  for (const board of entries) {
    assert.ok(board.name && board.sign && !board.sign.workspace);
    assert.equal(board.rowCount, 1);
    const layout = R.layoutSign(board.sign, measure);
    assert.equal(layout.height, board.sign.rowHeight);
    assert.equal(layout.width, Math.ceil(board.sign.rowHeight * board.widthRatio));
  }
});

test('用户旧截图项目恢复时，把已有的完整竖横预设拆成独立牌面', () => {
  const W = workspace();
  let legacy = S.createSign();
  for (const id of ['station-name', 'entrance-lintel']) {
    const template = Catalog.get(id);
    legacy = S.addTemplateRow(legacy, undefined, C.materialize(id, undefined, measure), {
      widthRatio: template.width / template.height, templateId: id,
    });
  }
  assert.equal(legacy.rows.length, 2, '复现旧版两种完整牌等高混排的项目文件');
  const restored = S.deserializeSign(S.serializeSign(legacy));
  assert.equal(W.list(restored).length, 2);
  assert.equal(restored.rows.length, 1);
  const vertical = W.list(restored).find((board) => board.sign.rows[0].templateId === 'station-name');
  const selected = W.select(restored, vertical.id);
  assert.equal(R.layoutSign(selected, measure).width, selected.rowHeight * 0.75);
  assert.ok(text(selected).includes('石油路') && !text(selected).includes('八公里'));
  assert.equal(W.list(S.deserializeSign(S.serializeSign(restored))).length, 2, '二次读取不重复分牌');
});

test('旧项目手工增加的基础元素多行仍在一张牌内，JSON 恢复不误拆', () => {
  const W = workspace();
  let sign = S.createSign();
  sign = S.addElement(sign, sign.rows[0].id, S.createElement('exit', { code: '1' }));
  sign = S.addRow(sign);
  sign = S.addElement(sign, sign.rows[1].id, S.createElement('bilingual-text', { textZh: '星港', textEn: 'Star Harbor' }));
  const restored = S.deserializeSign(S.serializeSign(sign));
  assert.equal(W.list(restored).length, 1);
  assert.equal(restored.rows.length, 2);
  assert.deepEqual(restored.rows.map((row) => row.elements[0].id), sign.rows.map((row) => row.elements[0].id));
});
