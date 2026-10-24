/** 独立牌面工作区：外层是当前 Sign，其他牌面保存无递归的不可变快照。 */
(function (global) {
  'use strict';
  var Core = global.SignCore;
  var State = global.SignState;

  function plain(value) { return value && Object.prototype.toString.call(value) === '[object Object]'; }
  function snapshot(sign) {
    var copy = Object.assign({}, sign);
    delete copy.workspace; delete copy.context;
    return copy;
  }
  function initialId(sign) { return sign.rows[0] && sign.rows[0].id || 'initial-board'; }
  function structure(sign) {
    return sign.workspace || { activeId: initialId(sign), boards: [{ id: initialId(sign), name: '标识牌 1' }] };
  }
  function withContext(sign, context) {
    var copy = snapshot(sign);
    if (context) copy.context = context;
    return copy;
  }
  function widthRatio(sign) {
    if (sign.widthMode === 'dynamic' && sign.rows.some(function (row) { return !(row.widthRatio > 0); })) return null;
    var width = sign.widthMode === 'fixed' ? sign.width / sign.rowHeight : Math.max.apply(null,
      sign.rows.map(function (row) { return row.widthRatio; }));
    return width / Math.max(1, sign.rows.length);
  }
  function list(sign) {
    var workspace = structure(sign);
    return workspace.boards.map(function (board) {
      var active = board.id === workspace.activeId;
      var value = withContext(active ? sign : board.sign, sign.context);
      return { id: board.id, name: board.name, active: active, sign: value,
        widthRatio: widthRatio(value), rowCount: value.rows.length };
    });
  }
  function select(sign, id) {
    var workspace = structure(sign);
    if (workspace.activeId === id) return sign;
    var target = workspace.boards.find(function (board) { return board.id === id; });
    if (!target || !target.sign) return sign;
    var boards = workspace.boards.map(function (board) {
      if (board.id === workspace.activeId) return { id: board.id, name: board.name, sign: snapshot(sign) };
      if (board.id === id) return { id: board.id, name: board.name };
      return board;
    });
    return Object.assign(withContext(target.sign, sign.context), { workspace: { activeId: id, boards: boards } });
  }
  function nameFor(options, fallback) { return options && typeof options.name === 'string' && options.name.trim() ? options.name.trim() : fallback; }
  function insert(sign, value, name, reuseEmpty) {
    var workspace = structure(sign);
    var reuse = reuseEmpty && sign.rows.every(function (row) { return !row.elements.length; });
    var id = reuse ? workspace.activeId : Core.uuid();
    var boards = workspace.boards.map(function (board) {
      if (board.id !== workspace.activeId) return board;
      return reuse ? { id: id, name: name } : { id: board.id, name: board.name, sign: snapshot(sign) };
    });
    if (!reuse) boards.push({ id: id, name: name });
    return Object.assign(withContext(value, sign.context), { workspace: { activeId: id, boards: boards } });
  }
  function addPreset(sign, elements, options) {
    if (!Array.isArray(elements) || !elements.length) return sign;
    options = options || {};
    var base = Object.assign(State.createSign(), { rowHeight: sign.rowHeight });
    var value = State.addTemplateRow(base, base.rows[0].id, elements, options);
    return insert(sign, value, nameFor(options, '标识牌 ' + (structure(sign).boards.length + 1)), true);
  }
  function addBlank(sign, options) {
    var value = Object.assign(State.createSign(), { rowHeight: sign.rowHeight });
    return insert(sign, value, nameFor(options, '空白牌面'), false);
  }
  function rename(sign, id, name) {
    if (typeof name !== 'string' || !name.trim()) return sign;
    var workspace = structure(sign);
    return Object.assign({}, sign, { workspace: { activeId: workspace.activeId,
      boards: workspace.boards.map(function (board) {
        return board.id === id ? Object.assign({}, board, { name: name.trim() }) : board;
      }),
    } });
  }
  function remove(sign, id) {
    var workspace = structure(sign);
    var index = workspace.boards.findIndex(function (board) { return board.id === id; });
    if (index < 0) return sign;
    if (workspace.boards.length === 1) {
      var blank = Object.assign(State.createSign(), { rowHeight: sign.rowHeight });
      return Object.assign(withContext(blank, sign.context), {
        workspace: { activeId: workspace.activeId, boards: [{ id: workspace.activeId, name: '空白牌面' }] },
      });
    }
    var next = id === workspace.activeId ? select(sign, workspace.boards[index > 0 ? index - 1 : 1].id) : sign;
    var nextWorkspace = structure(next);
    return Object.assign({}, next, { workspace: { activeId: nextWorkspace.activeId,
      boards: nextWorkspace.boards.filter(function (board) { return board.id !== id; }) } });
  }
  function restore(sign, input) {
    if (!plain(input) || !Array.isArray(input.boards)) return sign;
    var activeId = typeof input.activeId === 'string' && input.activeId ? input.activeId : initialId(sign);
    var seen = new Set(), boards = [];
    input.boards.slice(0, 2048).forEach(function (entry) {
      if (!plain(entry)) return;
      var id = typeof entry.id === 'string' && entry.id ? entry.id : Core.uuid();
      if (seen.has(id)) id = Core.uuid();
      var name = typeof entry.name === 'string' && entry.name.trim() ? entry.name : '未命名牌面';
      if (id === activeId) { boards.push({ id: id, name: name }); seen.add(id); return; }
      if (!plain(entry.sign)) return;
      try {
        var restored = State.deserializeSign(JSON.stringify({ version: State.SCHEMA_VERSION, sign: snapshot(entry.sign) }), { skipWorkspace: true });
        boards.push({ id: id, name: name, sign: snapshot(restored) }); seen.add(id);
      } catch (error) { /* 保留其余可用牌面。 */ }
    });
    if (!seen.has(activeId)) boards.unshift({ id: activeId, name: '当前牌面' });
    return Object.assign({}, sign, { workspace: { activeId: activeId, boards: boards } });
  }
  /** 旧版把完整预设作为行保存：只拆带明确来源的混排，普通多行牌保持原样。 */
  function migrate(sign) {
    if (sign.workspace) return sign;
    var complete = sign.rows.filter(function (row) { return !!(row.templateId || row.route); });
    if (complete.length < 2) return sign;
    var groups = [];
    sign.rows.forEach(function (row) {
      if (row.templateId || row.route) {
        var title = row.templateId && global.SignCRT ? global.SignCRT.get(row.templateId).name :
          row.route && row.route.line.nameZh + ' · 线路图';
        groups.push({ name: title || '标识牌', rows: [row], complete: true });
      } else {
        var previous = groups[groups.length - 1];
        if (previous && !previous.complete) previous.rows.push(row);
        else groups.push({ name: '原有标识牌', rows: [row], complete: false });
      }
    });
    var boards = groups.map(function (group) {
      var value = Object.assign(snapshot(sign), { rows: group.rows });
      if (group.complete) value.widthMode = 'dynamic';
      return { id: group.rows[0].id, name: group.name, sign: value };
    });
    var last = boards[boards.length - 1];
    var activeSign = last.sign;
    return Object.assign(withContext(activeSign, sign.context), { workspace: { activeId: last.id,
      boards: boards.map(function (board) { return board.id === last.id ? { id: board.id, name: board.name } : board; }) } });
  }

  global.SignWorkspace = { list: list, addPreset: addPreset, addBlank: addBlank, select: select,
    rename: rename, remove: remove, restore: restore, migrate: migrate };
})(typeof window !== 'undefined' ? window : globalThis);
