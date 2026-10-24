/**
 * state.js — SignState 状态模型纯函数
 *
 * 所有变更函数返回新对象，绝不修改传入状态（不可变更新）。
 * 数据模型（PRD）：
 *   SignState { widthMode, width, rowHeight, aspectLocked, backgroundColor, rows }
 *   Row   { id, elements }
 *   Element { id, type, props }
 *
 * padding 为比例值（相对行高），渲染时乘以行高得到像素。
 * 本文件不依赖 DOM，可在 Node 中加载测试。
 */
(function (global) {
  'use strict';

  var Core = global.SignCore;
  var uuid = Core.uuid;

  var ELEMENT_TYPES = [
    'arrow', 'bilingual-text', 'big-number', 'number-line',
    'text-line', 'entrance', 'exit', 'space', 'icon', 'crt-sign', 'plain-text', 'shape',
  ];

  // 支持内容对齐（align: left|right，元素内部镜像排版）的元素类型
  var CONTENT_ALIGN_TYPES = ['number-line', 'text-line', 'exit'];
  var CONTRAST_TYPES = ['plain-text', 'bilingual-text', 'big-number', 'arrow', 'icon', 'entrance', 'exit'];

  /** 绑定只影响文字/图标前景；源必须是同一牌面中存在的基础图形。 */
  function syncContrastLinks(sign) {
    var sources = new Map();
    sign.rows.forEach(function (row) {
      row.elements.forEach(function (element) {
        if (element.type === 'shape') sources.set(element.id, { element: element, row: row });
      });
    });
    var changed = false;
    var rows = sign.rows.map(function (row) {
      var rowChanged = false;
      var elements = row.elements.map(function (element) {
        var props = element.props;
        if (props.contrastSourceId === undefined && props.autoContrast === undefined) return element;
        var source = CONTRAST_TYPES.indexOf(element.type) !== -1 &&
          typeof props.contrastSourceId === 'string' && sources.get(props.contrastSourceId);
        var next;
        if (!source) {
          next = Object.assign({}, props);
          delete next.contrastSourceId; delete next.autoContrast;
        } else if (props.autoContrast !== false) {
          var fill = Core.normalizeHex(source.element.props.fill) ||
            Core.normalizeHex(source.row.backgroundColor) || Core.normalizeHex(sign.backgroundColor) || '#FFFFFF';
          var color = Core.contrastTextColor(fill);
          if (props.color === color) return element;
          next = Object.assign({}, props, { color: color });
        } else return element;
        changed = rowChanged = true;
        return Object.assign({}, element, { props: next });
      });
      return rowChanged ? Object.assign({}, row, { elements: elements }) : row;
    });
    return changed ? Object.assign({}, sign, { rows: rows }) : sign;
  }

  /** 预设复制时两遍生成 ID，关联背景也必须指向本次复制得到的元素。 */
  function cloneElements(elements) {
    var ids = new Map();
    var copies = (Array.isArray(elements) ? elements : []).filter(function (element) {
      return element && ELEMENT_TYPES.indexOf(element.type) !== -1;
    }).map(function (element) {
      var id = uuid();
      if (!ids.has(element.id)) ids.set(element.id, id);
      return { id: id, type: element.type, props: Core.deepClone(element.props || {}) };
    });
    copies.forEach(function (element) {
      if (typeof element.props.contrastSourceId === 'string') {
        element.props.contrastSourceId = ids.get(element.props.contrastSourceId);
      }
    });
    return syncContrastLinks({ rows: [{ elements: copies }] }).rows[0].elements;
  }

  // 各元素类型默认属性。padding 一律为相对行高的比例。
  // elementAlign 为固定宽度模式下的元素对齐（left|center|right），动态宽度忽略；
  // 双语文本的 align 是其文字对齐，与元素对齐相互独立。
  var DEFAULT_PROPS = {
    'plain-text': {
      text: '文字', font: 'zh', bold: false, color: '#000000', fontSizeRatio: 1,
      backgroundColor: null, elementAlign: 'left', padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    'shape': {
      shape: 'rect', viewBox: [0, 0, 100, 100], geometry: { x: 0, y: 0, width: 100, height: 100 },
      fill: '#000000', stroke: null, strokeWidth: 0,
      backgroundColor: null, elementAlign: 'left', padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    'crt-sign': {
      templateId: 'station-name', fields: {}, widthRatio: 4,
      lineColor: '#E4002B', lineColorMode: 'auto', direction: 'left', backgroundColor: null,
      elementAlign: 'left',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    'arrow': {
      direction: 'left',            // up|down|left|right|left-up|right-up|right-down|left-down
      color: '#000000',
      thicknessRatio: 0.25,         // 相对内容尺寸
      backgroundColor: null,        // null = 透明
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
    'bilingual-text': {
      textZh: '站名',
      textEn: 'Station',
      color: '#000000',
      bold: false,
      align: 'center',              // 文字对齐（left|center|right）
      backgroundColor: null,
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
    'big-number': {
      text: '1',
      color: '#000000',
      backgroundColor: null,
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
    'number-line': {
      lines: [{ number: '1', color: '#E4002B' }],   // 默认重庆地铁 1 号线红
      labelZh: '号线', labelEn: 'Line',
      textColor: '#000000',
      align: 'left',                // 内容对齐（left|right）：右对齐时色块移至右缘，仅渲染第 1 条线路
      backgroundColor: null,
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
    'text-line': {
      text: '环',                   // 色条右侧大字（思源黑体）
      textEn: 'Loop Line',          // 英文线路名，与「线」组合显示
      nameSink: true,               // 线路名下沉：大字显示并与「线」组合；关闭则与「线」同字号完整显示
      blockColor: '#F2A900',        // 贯穿色条颜色（默认重庆环线黄）
      textColor: '#000000',
      align: 'left',                // 内容对齐（left|right）：右对齐时色块移至右缘
      backgroundColor: null,
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
    'entrance': {
      code: '1',
      labelZh: '出入口', labelEn: 'Entrance',
      color: '#000000',
      backgroundColor: null,
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
    'exit': {
      code: '1',
      labelZh: '出口', labelEn: 'Exit',
      color: '#000000',
      align: 'left',                // 内容对齐（left|right）：右对齐时编号移至「出口」右侧
      backgroundColor: Core.EXIT_COLOR, // 出口背景色固定出口黄
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
    'space': {
      widthRatio: 0.5,              // 宽度 = 行高 × 此比例
      backgroundColor: null,        // null = 透明，可选背景色
      elementAlign: 'left',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    'icon': {
      icon: 'elevator',             // 图标 id，见 js/icons.js
      color: '#000000',
      backgroundColor: null,
      elementAlign: 'left',
      padding: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
  };

  // ─── 工厂 ──────────────────────────────────────────────────

  function createRow(elements) {
    return { id: uuid(), elements: elements ? elements.slice() : [] };
  }

  function createElement(type, props) {
    var base = Core.deepClone(DEFAULT_PROPS[type] || {});
    if (type === 'crt-sign' && global.SignCRT) {
      Object.assign(base, global.SignCRT.createProps(props && props.templateId));
    }
    // 新建元素默认开启相邻自动内边距（space 除外：其宽度即显式间距）
    base.paddingAuto = ['space', 'crt-sign', 'plain-text', 'shape'].indexOf(type) === -1;
    if (props) {
      if (type === 'crt-sign' && isPlainObject(props.fields)) {
        base.fields = Object.assign({}, base.fields, props.fields);
      }
      if (props.padding) {
        base.padding = Object.assign({}, base.padding, props.padding);
      }
      var copy = Object.assign({}, props);
      delete copy.padding;
      if (type === 'crt-sign') delete copy.fields;
      Object.assign(base, copy);
    }
    return { id: uuid(), type: type, props: base };
  }

  function createSign() {
    return {
      widthMode: 'fixed',           // fixed | dynamic
      width: 2048,
      rowHeight: 256,
      aspectLocked: false,
      backgroundColor: '#FFFFFF',
      frameWidth: 0,                // 灰框宽度（px），从牌面边界向内；0 = 不显示
      rows: [createRow()],
    };
  }

  var MAX_FOUR_SIDED_ENTRIES = 12;
  var FOUR_SIDED_FIELDS = ['leftZh', 'leftEn', 'line', 'lineEn', 'rightZh', 'rightEn'];
  function fourSidedText(value) {
    return typeof value === 'string' ? value.slice(0, 10000) :
      typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
  }
  function fourSidedLineEnglish(line) {
    return /^\d+(?:号线)?$/.test(line) ? 'Line' : /^环(?:线)?$/.test(line) ? 'Loop Line' : '';
  }
  function fourSidedBody(body) {
    return String(body || '').split(/\r?\n/).filter(function (row) { return row.trim(); }).map(function (row) {
      var cells = row.split('|').map(function (cell) { return cell.trim(); });
      return { leftZh: cells[0], leftEn: cells[1], line: cells[2], rightZh: cells[3], rightEn: cells[4],
        lineEn: cells[5] === undefined ? fourSidedLineEnglish(cells[2] || '') : cells[5] };
    });
  }
  function fourSidedReferenceRatio() {
    var template = global.SignCRT && global.SignCRT.get('four-sided-guide');
    var defaults = global.SignCRT && global.SignCRT.defaultFields('four-sided-guide');
    return template ? template.width / template.height * Math.max(1, fourSidedBody(defaults.body).length) : 4370 / 350;
  }
  function fourSidedProps(input) {
    var source = isPlainObject(input) ? input : {};
    var result = { lineColor: sanitizeColor(source.lineColor, '#333F48'),
      lineColorMode: source.lineColorMode === 'custom' ? 'custom' : 'auto',
      backgroundColor: sanitizeColor(source.backgroundColor, null) };
    if (source.textColor !== undefined) result.textColor = sanitizeColor(source.textColor, '#000000');
    if (Array.isArray(source.linePalette)) result.linePalette = source.linePalette.slice(0, 256).filter(function (line) {
      return isPlainObject(line) && typeof line.id === 'string' && line.id.trim() && Core.normalizeHex(line.color);
    }).map(function (line) {
      return { id: line.id, nameZh: fourSidedText(line.nameZh), nameEn: fourSidedText(line.nameEn), color: Core.normalizeHex(line.color) };
    });
    return result;
  }
  function normalizeFourSided(input) {
    var source = isPlainObject(input) ? input : {};
    var entries = Array.isArray(source.entries) ? source.entries.filter(isPlainObject).slice(0, MAX_FOUR_SIDED_ENTRIES) : [];
    if (!entries.length) entries = [{}];
    var seen = new Set();
    return { entries: entries.map(function (entry) {
      var id = typeof entry.id === 'string' && entry.id.trim() && !seen.has(entry.id) ? entry.id : uuid();
      while (seen.has(id)) id = uuid();
      seen.add(id);
      var result = { id: id };
      FOUR_SIDED_FIELDS.forEach(function (key) { result[key] = fourSidedText(entry[key]); });
      return result;
    }), props: fourSidedProps(source.props),
    referenceRowRatio: sanitizeNumber(source.referenceRowRatio, 0.1, 64, fourSidedReferenceRatio()) };
  }
  /** 创建排编辑数据，不重绘已存在的基础元素，也不读取 App。 */
  function createFourSided(props) {
    props = isPlainObject(props) ? props : {};
    var defaults = global.SignCRT ? global.SignCRT.defaultFields('four-sided-guide') : {};
    var body = props.fields && typeof props.fields.body === 'string' ? props.fields.body : defaults.body;
    return normalizeFourSided({ entries: Array.isArray(props.fourSidedEntries) ? props.fourSidedEntries : fourSidedBody(body),
      props: props, referenceRowRatio: props.referenceRowRatio });
  }

  function fourSidedElementKey(element) {
    var props = element.props;
    return typeof props.fourSidedRole === 'string'
      ? (props.fourSidedEntryId || '') + '|' + props.fourSidedRole + '|' + element.type : '';
  }
  /** 重新排版时复用同一排同一用途的 ID，并保留独立改过的颜色等样式。 */
  function reuseFourSidedElements(elements, previous, preserveStyles) {
    var old = new Map(), ids = new Map();
    previous.forEach(function (element) {
      var key = fourSidedElementKey(element);
      if (key && !old.has(key)) old.set(key, element);
    });
    var next = elements.map(function (element) {
      var before = old.get(fourSidedElementKey(element));
      var id = before ? before.id : element.id;
      ids.set(element.id, id);
      var props = Object.assign({}, element.props);
      if (before && preserveStyles) {
        ['color', 'textColor', 'bold', 'autoContrast', 'align'].forEach(function (key) {
          if (before.props[key] !== undefined) props[key] = before.props[key];
        });
        if (element.type === 'shape') ['fill', 'stroke', 'strokeWidth'].forEach(function (key) {
          if (before.props[key] !== undefined) props[key] = before.props[key];
        });
        if (element.type === 'number-line') props.lines = props.lines.map(function (line, index) {
          var prior = before.props.lines[index];
          return prior && prior.number === line.number ? Object.assign({}, line, { color: prior.color }) : line;
        });
        if (element.type === 'text-line' && before.props.text === props.text) props.blockColor = before.props.blockColor;
      }
      return Object.assign({}, element, { id: id, props: props });
    });
    next.forEach(function (element) {
      if (element.props.contrastSourceId && ids.has(element.props.contrastSourceId)) {
        element.props.contrastSourceId = ids.get(element.props.contrastSourceId);
      }
    });
    return next;
  }
  function applyFourSidedEntries(sign, rowId, entries, measure, options) {
    var index = sign.rows.findIndex(function (row) { return row.id === rowId; });
    if (index < 0) return sign;
    if (typeof measure !== 'function') throw new Error('四方体排版需要显式文字测量函数');
    if (!global.SignComposition || !global.SignComposition.materialize) throw new Error('四方体排版模块尚未加载');
    options = options || {};
    var row = sign.rows[index], previous = row.fourSided ? normalizeFourSided(row.fourSided) : createFourSided(options.props);
    var definition = normalizeFourSided({ entries: entries,
      props: Object.assign({}, previous.props, options.props || {}),
      referenceRowRatio: options.referenceRowRatio === undefined ? previous.referenceRowRatio : options.referenceRowRatio });
    var reference = Core.clamp(definition.referenceRowRatio / definition.entries.length, 0.1, 64);
    var oldReference = row.referenceWidthRatio || previous.referenceRowRatio / previous.entries.length;
    var factor = row.widthRatio ? row.widthRatio / oldReference : 1;
    var ratio = Core.clamp(Number.isFinite(options.widthRatio) ? options.widthRatio : reference * factor, 0.1, 64);
    var props = Object.assign({}, definition.props, { fourSidedEntries: definition.entries, widthRatio: ratio, fourSidedAutoRatio: false });
    var elements = global.SignComposition.materialize('four-sided-guide', props, measure);
    elements = reuseFourSidedElements(elements, row.elements, !options.props);
    var rows = sign.rows.slice();
    rows[index] = Object.assign({}, row, { elements: elements, layout: 'free', templateId: 'four-sided-guide',
      widthRatio: ratio, referenceWidthRatio: reference, fourSided: definition });
    return syncContrastLinks(Object.assign({}, sign, { rows: rows, widthMode: 'dynamic' }));
  }
  function fourSidedRow(sign, rowId) {
    return sign.rows.find(function (row) { return row.id === rowId && row.fourSided; });
  }
  function updateFourSidedEntry(sign, rowId, entryId, patch, measure) {
    var row = fourSidedRow(sign, rowId);
    if (!row || !row.fourSided.entries.some(function (entry) { return entry.id === entryId; })) return sign;
    var entries = row.fourSided.entries.map(function (entry) {
      return entry.id === entryId ? Object.assign({}, entry, isPlainObject(patch) ? patch : {}, { id: entry.id }) : entry;
    });
    return applyFourSidedEntries(sign, rowId, entries, measure);
  }
  function addFourSidedEntry(sign, rowId, afterId, measure) {
    var row = fourSidedRow(sign, rowId);
    if (!row || row.fourSided.entries.length >= MAX_FOUR_SIDED_ENTRIES) return sign;
    var entries = row.fourSided.entries.slice();
    var index = entries.findIndex(function (entry) { return entry.id === afterId; });
    entries.splice(index < 0 ? entries.length : index + 1, 0, { leftZh: '左侧方向', leftEn: 'Left Direction',
      line: '', lineEn: 'Line', rightZh: '右侧方向', rightEn: 'Right Direction' });
    return applyFourSidedEntries(sign, rowId, entries, measure);
  }
  function removeFourSidedEntry(sign, rowId, entryId, measure) {
    var row = fourSidedRow(sign, rowId);
    if (!row || row.fourSided.entries.length <= 1 || !row.fourSided.entries.some(function (entry) { return entry.id === entryId; })) return sign;
    return applyFourSidedEntries(sign, rowId, row.fourSided.entries.filter(function (entry) { return entry.id !== entryId; }), measure);
  }
  function moveFourSidedEntry(sign, rowId, entryId, delta, measure) {
    var row = fourSidedRow(sign, rowId);
    if (!row || !Number.isFinite(delta)) return sign;
    var entries = row.fourSided.entries.slice(), from = entries.findIndex(function (entry) { return entry.id === entryId; });
    var to = from + Math.trunc(delta);
    if (from < 0 || to < 0 || to >= entries.length || to === from) return sign;
    entries.splice(to, 0, entries.splice(from, 1)[0]);
    return applyFourSidedEntries(sign, rowId, entries, measure);
  }

  // ─── 行操作 ────────────────────────────────────────────────

  /** 在 index 处插入新空行（缺省追加到末尾） */
  function addRow(sign, index) {
    var rows = sign.rows.slice();
    var i = index === undefined ? rows.length : Core.clamp(index, 0, rows.length);
    rows.splice(i, 0, createRow());
    return Object.assign({}, sign, { rows: rows });
  }

  /** 删除行；仅剩一行时不做任何事（标识牌至少保留一行） */
  function deleteRow(sign, rowId) {
    if (sign.rows.length <= 1) return sign;
    var idx = -1;
    for (var i = 0; i < sign.rows.length; i++) {
      if (sign.rows[i].id === rowId) { idx = i; break; }
    }
    if (idx === -1) return sign;
    var rows = sign.rows.slice();
    rows.splice(idx, 1);
    return syncContrastLinks(Object.assign({}, sign, { rows: rows }));
  }

  /** 移动行顺序（fromIndex/toIndex 均为当前数组下标） */
  function moveRow(sign, fromIndex, toIndex) {
    var n = sign.rows.length;
    if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n || fromIndex === toIndex) {
      return sign;
    }
    var rows = sign.rows.slice();
    var row = rows.splice(fromIndex, 1)[0];
    rows.splice(toIndex, 0, row);
    return Object.assign({}, sign, { rows: rows });
  }

  // ─── 元素操作 ──────────────────────────────────────────────

  /** 向指定行插入元素（缺省追加到末尾） */
  function addElement(sign, rowId, element, index) {
    var rows = sign.rows.map(function (row) {
      if (row.id !== rowId) return row;
      var els = row.elements.slice();
      var i = index === undefined ? els.length : Core.clamp(index, 0, els.length);
      var placed = row.layout === 'free' && !element.props.box ? defaultFreeElement(row, element) : element;
      els.splice(i, 0, placed);
      var nextRow = Object.assign({}, row, { elements: els });
      if (row.layout === 'free') nextRow.widthRatio = Math.max(row.widthRatio || 0.1, freeWidth(els));
      return nextRow;
    });
    return Object.assign({}, sign, { rows: rows });
  }

  /** 删除元素（按 id，全牌搜索） */
  function deleteElement(sign, elementId) {
    var rows = sign.rows.map(function (row) {
      if (!row.elements.some(function (e) { return e.id === elementId; })) return row;
      return Object.assign({}, row, {
        elements: row.elements.filter(function (e) { return e.id !== elementId; }),
      });
    });
    return syncContrastLinks(Object.assign({}, sign, { rows: rows }));
  }

  /** 用已有元素替换指定元素，保留所在行、顺序及其他行的引用。 */
  function replaceElementWithElements(sign, elementId, elements) {
    var found = findElement(sign, elementId);
    if (!found || !Array.isArray(elements)) return sign;
    var rows = sign.rows.slice();
    var row = rows[found.rowIndex];
    var free = elements.some(function (element) { return !!element.props.box; });
    if (free && row.elements.length > 1 && row.layout !== 'free') {
      return addTemplateRow(deleteElement(sign, elementId), row.id, elements);
    }
    rows[found.rowIndex] = Object.assign({}, row, {
      elements: row.elements.slice(0, found.index).concat(elements, row.elements.slice(found.index + 1)),
    });
    if (free) {
      rows[found.rowIndex].layout = 'free';
      rows[found.rowIndex].widthRatio = freeWidth(rows[found.rowIndex].elements);
    }
    return Object.assign({}, sign, { rows: rows });
  }

  /** 整行添加标识牌：空行复用，否则放在所选行之后；无选择时找最后空行。 */
  function addTemplateRow(sign, preferredRowId, elements, options) {
    if (!Array.isArray(elements) || !elements.length) return sign;
    options = options || {};
    var preferred = -1;
    sign.rows.forEach(function (row, index) { if (row.id === preferredRowId) preferred = index; });
    var index = preferred;
    if (index < 0) {
      for (var i = sign.rows.length - 1; i >= 0; i--) {
        if (!sign.rows[i].elements.length) { index = i; break; }
      }
    }
    var rows = sign.rows.slice();
    if (options.replaceRowId) {
      index = rows.findIndex(function (row) { return row.id === options.replaceRowId; });
    }
    if (index >= 0 && (!rows[index].elements.length || rows[index].id === options.replaceRowId)) {
      rows[index] = Object.assign({}, rows[index], { elements: elements.slice() });
    } else {
      rows.splice(preferred < 0 ? rows.length : preferred + 1, 0, createRow(elements));
      index = preferred < 0 ? rows.length - 1 : preferred + 1;
    }
    var free = elements.some(function (element) { return !!element.props.box; });
    rows[index].layout = free ? 'free' : 'flow';
    if (free) rows[index].widthRatio = freeWidth(elements);
    else delete rows[index].widthRatio;
    ['templateId', 'referenceWidthRatio', 'route', 'fourSided', 'backgroundColor'].forEach(function (key) { delete rows[index][key]; });
    if (Number.isFinite(options.widthRatio) && options.widthRatio > 0) {
      rows[index].widthRatio = Core.clamp(options.widthRatio, 0.1, 64);
      rows[index].referenceWidthRatio = Number.isFinite(options.referenceWidthRatio)
        ? Core.clamp(options.referenceWidthRatio, 0.1, 64) : rows[index].widthRatio;
    }
    if (typeof options.templateId === 'string' && global.SignCRT) {
      var template = global.SignCRT.get(options.templateId);
      rows[index].templateId = template.id;
      rows[index].backgroundColor = template.background || '#FFFFFF';
      if (!rows[index].referenceWidthRatio) rows[index].referenceWidthRatio = template.width / template.height;
    }
    if (options.backgroundColor) rows[index].backgroundColor = sanitizeColor(options.backgroundColor, '#FFFFFF');
    if (options.route && global.SignRoutes) rows[index].route = {
      line: global.SignRoutes.normalizeLine(options.route.line),
      orientation: options.route.orientation === 'horizontal' ? 'horizontal' : 'vertical',
    };
    if (rows[index].route && (options.route.source === 'server' || options.route.source === 'local')) rows[index].route.source = options.route.source;
    if (options.fourSided || rows[index].templateId === 'four-sided-guide') {
      rows[index].fourSided = options.fourSided ? normalizeFourSided(options.fourSided) : createFourSided();
      var fourReference = Core.clamp(rows[index].fourSided.referenceRowRatio / rows[index].fourSided.entries.length, 0.1, 64);
      rows[index].referenceWidthRatio = options.referenceWidthRatio || fourReference;
      if (!Number.isFinite(options.widthRatio)) rows[index].widthRatio = fourReference;
    }
    var next = Object.assign({}, sign, { rows: rows });
    if (options.widthRatio || sign.rows.every(function (row) { return !row.elements.length; })) next.widthMode = 'dynamic';
    return next;
  }

  /** 改变单行牌面的宽高比，位置随牌宽调整，图文仍使用等比绘制。 */
  function setRowAspectRatio(sign, rowId, ratio) {
    if (!Number.isFinite(ratio) || ratio <= 0) return sign;
    ratio = Core.clamp(ratio, 0.1, 64);
    var touched = false;
    var rows = sign.rows.map(function (row) {
      if (row.id !== rowId) return row;
      touched = true;
      var previous = row.widthRatio || (row.layout === 'free' ? freeWidth(row.elements) : sign.width / sign.rowHeight);
      var factor = ratio / Math.max(previous, 0.001);
      return Object.assign({}, row, { widthRatio: ratio,
        elements: row.layout !== 'free' ? row.elements : row.elements.map(function (element) {
          var box = element.props.box;
          if (!box) return element;
          var props = Object.assign({}, element.props, {
            box: Object.assign({}, box, { x: box.x * factor, width: box.width * factor }),
          });
          if (element.type === 'shape' && ['rect', 'line'].indexOf(props.shape) !== -1) {
            props.viewBox = props.viewBox.slice();
            props.viewBox[0] *= factor; props.viewBox[2] *= factor;
            props.geometry = Object.assign({}, props.geometry);
            ['x', 'width', 'x1', 'x2', 'rx'].forEach(function (key) {
              if (typeof props.geometry[key] === 'number') props.geometry[key] *= factor;
            });
          }
          return Object.assign({}, element, { props: props });
        }),
      });
    });
    return touched ? Object.assign({}, sign, { rows: rows, widthMode: 'dynamic' }) : sign;
  }

  /** 当前虚构线路/车站只影响后续添加，已完成牌面不随切站改写。 */
  function setProjectContext(sign, context) {
    var next = Object.assign({}, sign);
    if (!context || !global.SignRoutes) { delete next.context; return next; }
    var line = global.SignRoutes.normalizeLine(context.line);
    var station = line.stations.find(function (item) { return item.id === context.stationId; });
    next.context = { line: line, stationId: station ? station.id : line.currentStationId || (line.stations[0] && line.stations[0].id) || null };
    var origin = context.source;
    if (origin === undefined && sign.context && sign.context.line.id === line.id) origin = sign.context.source;
    if (origin === 'server' || origin === 'local') next.context.source = origin;
    return next;
  }

  function freeWidth(elements) {
    return Math.max(0.1, elements.reduce(function (right, element) {
      var box = element.props.box;
      return box ? Math.max(right, box.x + box.width) : right;
    }, 0));
  }

  function defaultFreeElement(row, element) {
    var rowWidth = row.widthRatio || freeWidth(row.elements);
    var offset = row.elements.length % 5;
    var inset = Math.min(0.08, rowWidth * 0.1);
    var x = Math.min(inset + offset * 0.04, rowWidth * 0.3);
    var height = element.type === 'plain-text' ? 0.15 : 0.25;
    var width = element.type === 'icon' || element.type === 'shape' && element.props.shape === 'circle' ? height : 0.6;
    width = Math.max(0.01, Math.min(width, rowWidth - x - inset));
    return Object.assign({}, element, { props: Object.assign({}, element.props, {
      box: { x: x, y: 0.1 + offset * 0.06, width: width, height: height }, paddingAuto: false,
    }) });
  }

  /**
   * 移动元素（同行排序或跨行移动）。
   * gapIndex 为"当前布局中的落点间隙序号"：目标行内、位于第 gapIndex 个元素之前，
   * 其语义以拖拽时看到的行内容为准（若同行的源元素在落点之前，内部自动回退一位）。
   */
  function moveElement(sign, elementId, toRowId, gapIndex) {
    var found = findElement(sign, elementId);
    if (!found) return sign;
    var fromRowId = found.rowId;
    var sourceIndex = found.index;

    var rows = sign.rows.map(function (row) {
      if (row.id === fromRowId) {
        return Object.assign({}, row, {
          elements: row.elements.filter(function (e) { return e.id !== elementId; }),
        });
      }
      return row;
    });

    var target = Core.clamp(gapIndex, 0, Infinity);
    if (fromRowId === toRowId && sourceIndex < gapIndex) target = gapIndex - 1;

    rows = rows.map(function (row) {
      if (row.id !== toRowId) return row;
      var i = Core.clamp(target, 0, row.elements.length);
      var els = row.elements.slice();
      els.splice(i, 0, found.element);
      return Object.assign({}, row, { elements: els });
    });

    return Object.assign({}, sign, { rows: rows });
  }

  /** 更新元素属性（浅合并 patch；padding 单独深合并一层）。
   *  写入左右内边距视为手动编辑 → 钉住（paddingAuto=false），
   *  自动重算走 applyPaddingAuto，不经过此函数。 */
  function updateElementProps(sign, elementId, patch) {
    var rows = sign.rows.map(function (row) {
      var hit = row.elements.some(function (e) { return e.id === elementId; });
      if (!hit) return row;
      var nextRow = Object.assign({}, row, {
        elements: row.elements.map(function (e) {
          if (e.id !== elementId) return e;
          var props = Object.assign({}, e.props, patch);
          if (CONTRAST_TYPES.indexOf(e.type) !== -1 && props.contrastSourceId &&
              patch.color !== undefined && patch.autoContrast === undefined) props.autoContrast = false;
          if (patch.box) props.box = Object.assign({}, e.props.box, patch.box);
          if (patch.geometry) props.geometry = Object.assign({}, e.props.geometry, patch.geometry);
          if (e.type === 'crt-sign' && patch.lineColor !== undefined && patch.lineColorMode === undefined) {
            props.lineColorMode = 'custom';
          }
          if (patch.padding) {
            props.padding = Object.assign({}, e.props.padding, patch.padding);
            if (patch.padding.left !== undefined || patch.padding.right !== undefined) {
              props.paddingAuto = false;
            }
          }
          return Object.assign({}, e, { props: props });
        }),
      });
      if (row.fourSided) {
        var edited = nextRow.elements.find(function (element) { return element.id === elementId; });
        var marker = edited.props, entryId = marker.fourSidedEntryId, role = marker.fourSidedRole;
        var definition = row.fourSided, entryPatch = {}, hasEntryPatch = false;
        if (role === 'background' && patch.fill !== undefined) {
          nextRow.fourSided = Object.assign({}, definition, { props: Object.assign({}, definition.props,
            { backgroundColor: sanitizeColor(marker.fill, null) }) });
        } else if (entryId && role) {
          if (role === 'left-direction' || role === 'right-direction') {
            var prefix = role === 'left-direction' ? 'left' : 'right';
            if (patch.textZh !== undefined) { entryPatch[prefix + 'Zh'] = fourSidedText(marker.textZh); hasEntryPatch = true; }
            if (patch.textEn !== undefined) { entryPatch[prefix + 'En'] = fourSidedText(marker.textEn); hasEntryPatch = true; }
          }
          var lineRole = /^line-(\d+)$/.exec(role);
          var currentEntry = definition.entries.find(function (entry) { return entry.id === entryId; });
          if (lineRole && currentEntry) {
            var lineIndex = Number(lineRole[1]);
            var labels = currentEntry.line.split(/[\/、,，;；\r\n]+/).map(function (part) { return part.trim(); }).filter(Boolean);
            var names = currentEntry.lineEn.split('/').map(function (part) { return part.trim(); });
            if (edited.type === 'number-line' && patch.lines !== undefined && Array.isArray(marker.lines)) {
              labels.splice(lineIndex, 1, marker.lines.map(function (line) { return fourSidedText(line.number); }).join('/'));
              entryPatch.line = labels.join('/'); hasEntryPatch = true;
            }
            if (edited.type === 'text-line' && patch.text !== undefined) {
              labels[lineIndex] = fourSidedText(marker.text); entryPatch.line = labels.join('/'); hasEntryPatch = true;
            }
            if (patch.labelEn !== undefined || patch.textEn !== undefined) {
              names[lineIndex] = fourSidedText(edited.type === 'number-line' ? marker.labelEn : marker.textEn);
              entryPatch.lineEn = names.join('/'); hasEntryPatch = true;
            }
          }
          if (hasEntryPatch) nextRow.fourSided = Object.assign({}, definition, { entries: definition.entries.map(function (entry) {
            return entry.id === entryId ? Object.assign({}, entry, entryPatch) : entry;
          }) });
        }
      }
      if (row.layout === 'free' && patch.box) nextRow.widthRatio = Math.max(row.widthRatio || 0.1, freeWidth(nextRow.elements));
      return nextRow;
    });
    return syncContrastLinks(Object.assign({}, sign, { rows: rows }));
  }

  /** 全牌搜索元素，返回 { rowId, rowIndex, index, element } 或 null */
  function findElement(sign, elementId) {
    for (var ri = 0; ri < sign.rows.length; ri++) {
      var row = sign.rows[ri];
      for (var ei = 0; ei < row.elements.length; ei++) {
        if (row.elements[ei].id === elementId) {
          return { rowId: row.id, rowIndex: ri, index: ei, element: row.elements[ei] };
        }
      }
    }
    return null;
  }

  // ─── 标识牌设置 ────────────────────────────────────────────

  /**
   * 更新标识牌设置。锁定宽高比时（以补丁生效后的开关状态为准）：
   *   - 改 rowHeight → width 等比缩放
   *   - 改 width     → rowHeight 等比缩放
   */
  function updateSignSettings(sign, patch) {
    var next = Object.assign({}, sign, patch);
    if (next.aspectLocked && patch.rowHeight !== undefined && patch.rowHeight !== sign.rowHeight) {
      next.width = Math.round(sign.width * (next.rowHeight / sign.rowHeight));
    } else if (next.aspectLocked && patch.width !== undefined && patch.width !== sign.width) {
      next.rowHeight = Math.round(sign.rowHeight * (next.width / sign.width));
    }
    return next;
  }

  /** 清空标识牌：保留设置，恢复为一行空白 */
  function clearSign(sign) {
    return Object.assign({}, sign, { rows: [createRow()] });
  }

  // ─── 序列化 / 反序列化 ─────────────────────────────────────

  var SCHEMA_VERSION = 1;

  function serializeSign(sign) {
    return JSON.stringify({ version: SCHEMA_VERSION, sign: sign });
  }

  function isPlainObject(v) {
    return Object.prototype.toString.call(v) === '[object Object]';
  }

  // padding 上限（相对行高比例）：上下受内容盒高度约束 ≤1；左右只影响元素宽度，可更大
  var PADDING_MAX = { top: 1, right: 8, bottom: 1, left: 8 };

  function sanitizePadding(p) {
    var base = { top: 0, right: 0, bottom: 0, left: 0 };
    if (!isPlainObject(p)) return base;
    ['top', 'right', 'bottom', 'left'].forEach(function (k) {
      var n = Number(p[k]);
      if (isFinite(n)) base[k] = Core.clamp(n, 0, PADDING_MAX[k]);
    });
    return base;
  }

  function sanitizeColor(c, fallback) {
    return Core.normalizeHex(c) || fallback;
  }

  /** 文本属性强制字符串：null/undefined 回默认，其余 String 化（渲染层只认字符串） */
  function sanitizeText(v, fallback) {
    if (typeof v === 'string') return v;
    return v === undefined || v === null ? fallback : String(v);
  }

  /** 数值属性：非有限数回默认，否则夹到 [lo, hi] */
  function sanitizeNumber(v, lo, hi, fallback) {
    var n = Number(v);
    return isFinite(n) ? Core.clamp(n, lo, hi) : fallback;
  }

  function sanitizeBox(value) {
    var box = isPlainObject(value) ? value : {};
    return {
      x: sanitizeNumber(box.x, -64, 64, 0), y: sanitizeNumber(box.y, -64, 64, 0),
      width: sanitizeNumber(box.width, 0, 64, 1), height: sanitizeNumber(box.height, 0, 64, 1),
    };
  }

  function sanitizeGeometry(value) {
    var input = isPlainObject(value) ? value : {};
    var geometry = {};
    ['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2'].forEach(function (key) {
      if (input[key] === undefined) return;
      var number = Number(input[key]);
      if (isFinite(number)) geometry[key] = number;
    });
    if (input.d !== undefined) geometry.d = typeof input.d === 'string' && /^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]*$/.test(input.d) ? input.d : '';
    ['points', 'stroke-dasharray'].forEach(function (key) {
      if (input[key] !== undefined) geometry[key] = typeof input[key] === 'string' && /^[0-9eE+.,\s-]*$/.test(input[key]) ? input[key] : '';
    });
    if (['butt', 'round', 'square'].indexOf(input['stroke-linecap']) !== -1) geometry['stroke-linecap'] = input['stroke-linecap'];
    if (['miter', 'round', 'bevel'].indexOf(input['stroke-linejoin']) !== -1) geometry['stroke-linejoin'] = input['stroke-linejoin'];
    if (['evenodd', 'nonzero'].indexOf(input['fill-rule']) !== -1) geometry['fill-rule'] = input['fill-rule'];
    return geometry;
  }

  // ─── 相邻自动内边距 ────────────────────────────────────────

  var PADDING_AUTO_DEFAULT = 0.2;   // 自动侧无邻居时
  var PADDING_AUTO_ADJACENT = 0.1;  // 自动侧有相邻元素时

  function elementLane(el, fixed) {
    if (!fixed) return 'left';
    var a = el.props.elementAlign;
    return a === 'right' ? 'right' : a === 'center' ? 'center' : 'left';
  }

  /**
   * 相邻自动内边距（纯函数、幂等）：paddingAuto 元素的左/右侧在同行同通道
   * 紧邻其他元素时折减为 0.1，无邻居时回到 0.2。空白占位不算邻居
   * （其宽度是显式的间距表达）；贴右通道的数组序与视觉序相反，
   * 按视觉方向映射到对应侧。手动钉住的元素（paddingAuto=false）不参与。
   * 在 App.update 管线中每次变更后运行，随当次更新一并落盘/撤销。
   */
  function applyPaddingAuto(sign) {
    var fixed = sign.widthMode === 'fixed';
    var rows = sign.rows.map(function (row) {
      if (row.layout === 'free') return row;
      var els = row.elements;
      var touched = false;
      var mapped = els.map(function (el, i) {
        if (el.type === 'space' || !el.props.paddingAuto) return el;
        var lane = elementLane(el, fixed);
        function neighborAt(delta) {
          var j = i + delta;
          if (j < 0 || j >= els.length) return null;
          var n = els[j];
          if (n.type === 'space') return null;
          return elementLane(n, fixed) === lane ? n : null;
        }
        var leftNeighbor = neighborAt(-1), rightNeighbor = neighborAt(1);
        var hasLeft = lane === 'right' ? !!rightNeighbor : !!leftNeighbor;
        var hasRight = lane === 'right' ? !!leftNeighbor : !!rightNeighbor;
        var pl = hasLeft ? PADDING_AUTO_ADJACENT : PADDING_AUTO_DEFAULT;
        var pr = hasRight ? PADDING_AUTO_ADJACENT : PADDING_AUTO_DEFAULT;
        if (el.props.padding.left === pl && el.props.padding.right === pr) return el;
        touched = true;
        return Object.assign({}, el, {
          props: Object.assign({}, el.props, {
            padding: Object.assign({}, el.props.padding, { left: pl, right: pr }),
          }),
        });
      });
      if (!touched) return row;
      return Object.assign({}, row, { elements: mapped });
    });
    return Object.assign({}, sign, { rows: rows });
  }

  var ARROW_DIRECTIONS = [
    'up', 'down', 'left', 'right', 'left-up', 'right-up', 'right-down', 'left-down',
  ];

  /**
   * 数字线路列表：必须收敛为 [{ number: string, color: #RRGGBB }]。
   * 非数组的 lines 会让渲染层 .map 崩溃（历史导入崩溃点）；非对象项剔除；
   * 空数组合法（面板允许移除全部线路）。
   */
  function sanitizeLines(v) {
    if (!Array.isArray(v)) return Core.deepClone(DEFAULT_PROPS['number-line'].lines);
    return v.filter(isPlainObject).map(function (l) {
      return {
        number: sanitizeText(l.number, ''),
        color: sanitizeColor(l.color, '#424A52'),
      };
    });
  }

  /** 校验并修补单个元素：未知类型返回 null。
   *  反序列化是外部数据的唯一入口，凡渲染层假定过的形状（数组/数值/枚举/字符串）
   *  都必须在此收敛，否则一份手改的项目 JSON 就能让整牌渲染崩溃。 */
  function sanitizeElement(el) {
    if (!isPlainObject(el) || ELEMENT_TYPES.indexOf(el.type) === -1) return null;
    var defaults = DEFAULT_PROPS[el.type];
    if (el.type === 'crt-sign' && global.SignCRT) {
      defaults = Object.assign({}, defaults,
        global.SignCRT.createProps(isPlainObject(el.props) ? el.props.templateId : undefined));
    }
    // paddingAuto 需在默认值合并前读取：仅显式 true 保留，
    // 旧存档/未标记元素一律钉住（打开老标识牌不能被悄悄改内边距）
    var savedAuto = isPlainObject(el.props) && el.props.paddingAuto === true;
    var props = Object.assign(Core.deepClone(defaults), isPlainObject(el.props) ? el.props : {});
    props.padding = sanitizePadding(props.padding);
    props.paddingAuto = ['space', 'crt-sign', 'plain-text', 'shape'].indexOf(el.type) !== -1 ? false : savedAuto;
    if (props.box !== undefined) props.box = sanitizeBox(props.box);
    if (typeof props.fourSidedEntryId !== 'string' || !props.fourSidedEntryId.trim()) delete props.fourSidedEntryId;
    if (typeof props.fourSidedRole !== 'string' || !/^(?:background|frame|left-arrow|right-arrow|left-direction|right-direction|line-\d+)$/.test(props.fourSidedRole)) {
      delete props.fourSidedRole; delete props.fourSidedEntryId;
    }
    if (props.color !== undefined) props.color = sanitizeColor(props.color, '#000000');
    if (CONTRAST_TYPES.indexOf(el.type) !== -1 && typeof props.contrastSourceId === 'string' && props.contrastSourceId.trim()) {
      if (props.autoContrast !== undefined && typeof props.autoContrast !== 'boolean') delete props.autoContrast;
    } else {
      delete props.contrastSourceId; delete props.autoContrast;
    }
    if (props.backgroundColor !== undefined && props.backgroundColor !== null) {
      props.backgroundColor = sanitizeColor(props.backgroundColor, null);
    }
    if (el.type === 'exit') props.backgroundColor = Core.EXIT_COLOR;
    if (['number-line', 'text-line'].indexOf(el.type) !== -1 && props.lineColorMode !== undefined) {
      props.lineColorMode = props.lineColorMode === 'custom' ? 'custom' : 'auto';
    }
    if (props.elementAlign !== 'center' && props.elementAlign !== 'right') props.elementAlign = 'left';
    // 内容对齐仅这三类元素支持，且只有 left|right 两档；双语文本的 align（left|center|right）不受影响
    if (CONTENT_ALIGN_TYPES.indexOf(el.type) !== -1 && props.align !== 'right') props.align = 'left';
    if (el.type === 'icon' && typeof props.icon !== 'string') props.icon = 'elevator';

    if (el.type === 'plain-text') {
      props.text = sanitizeText(props.text, defaults.text);
      if (['zh', 'en', 'num'].indexOf(props.font) === -1) props.font = 'zh';
      props.bold = !!props.bold;
      props.fontSizeRatio = sanitizeNumber(props.fontSizeRatio, 0.01, 64, 1);
    } else if (el.type === 'shape') {
      if (['rect', 'circle', 'line', 'path', 'polygon'].indexOf(props.shape) === -1) props.shape = 'rect';
      var vb = Array.isArray(props.viewBox) ? props.viewBox : defaults.viewBox;
      props.viewBox = [sanitizeNumber(vb[0], -1e7, 1e7, 0), sanitizeNumber(vb[1], -1e7, 1e7, 0),
        sanitizeNumber(vb[2], 0.001, 1e7, 100), sanitizeNumber(vb[3], 0.001, 1e7, 100)];
      props.geometry = sanitizeGeometry(props.geometry);
      props.fill = props.fill === null || props.fill === 'none' ? props.fill : sanitizeColor(props.fill, '#000000');
      props.stroke = props.stroke === 'none' ? 'none' : sanitizeColor(props.stroke, null);
      props.strokeWidth = sanitizeNumber(props.strokeWidth, 0, 2048, 0);
    } else if (el.type === 'arrow') {
      if (ARROW_DIRECTIONS.indexOf(props.direction) === -1) props.direction = 'left';
      props.thicknessRatio = sanitizeNumber(props.thicknessRatio, 0.05, 0.95, defaults.thicknessRatio);
    } else if (el.type === 'bilingual-text') {
      props.textZh = sanitizeText(props.textZh, defaults.textZh);
      props.textEn = sanitizeText(props.textEn, defaults.textEn);
      props.bold = !!props.bold;
      if (props.align !== 'left' && props.align !== 'right') props.align = 'center';
    } else if (el.type === 'big-number') {
      props.text = sanitizeText(props.text, defaults.text);
    } else if (el.type === 'number-line') {
      props.lines = sanitizeLines(props.lines);
      props.labelZh = sanitizeText(props.labelZh, defaults.labelZh);
      props.labelEn = sanitizeText(props.labelEn, defaults.labelEn);
      props.textColor = sanitizeColor(props.textColor, '#000000');
    } else if (el.type === 'text-line') {
      props.text = sanitizeText(props.text, defaults.text);
      props.textEn = sanitizeText(props.textEn, defaults.textEn);
      props.nameSink = props.nameSink !== false; // 缺省视为开启（历史数据兼容）
      props.blockColor = sanitizeColor(props.blockColor, defaults.blockColor);
      props.textColor = sanitizeColor(props.textColor, '#000000');
    } else if (el.type === 'entrance' || el.type === 'exit') {
      props.code = sanitizeText(props.code, defaults.code);
      props.labelZh = sanitizeText(props.labelZh, defaults.labelZh);
      props.labelEn = sanitizeText(props.labelEn, defaults.labelEn);
    } else if (el.type === 'space') {
      props.widthRatio = sanitizeNumber(props.widthRatio, 0, 8, defaults.widthRatio);
    } else if (el.type === 'crt-sign') {
      var lib = global.SignCRT;
      var template = lib && lib.get(typeof props.templateId === 'string' ? props.templateId : 'station-name');
      props.templateId = template ? template.id :
        (typeof props.templateId === 'string' && props.templateId ? props.templateId : 'station-name');
      var fields = template ? lib.defaultFields(template.id) : {};
      var savedFields = isPlainObject(props.fields) ? props.fields : {};
      // Only known fields enter the renderer when the catalog is available.
      var keys = template ? Object.keys(fields) : Object.keys(savedFields);
      keys.forEach(function (key) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
        fields[key] = sanitizeText(savedFields[key], fields[key] || '');
      });
      props.fields = fields;
      props.widthRatio = sanitizeNumber(props.widthRatio, 0.1, 64,
        template ? template.width / template.height : defaults.widthRatio);
      props.lineColor = sanitizeColor(props.lineColor, defaults.lineColor);
      var savedProps = isPlainObject(el.props) ? el.props : {};
      if (savedProps.lineColorMode === 'auto' || savedProps.lineColorMode === 'custom') {
        props.lineColorMode = savedProps.lineColorMode;
      } else {
        var savedColor = Core.normalizeHex(savedProps.lineColor);
        var defaultColor = Core.normalizeHex(template ? template.accent : defaults.lineColor);
        props.lineColorMode = savedColor && savedColor !== defaultColor ? 'custom' : 'auto';
      }
      if (ARROW_DIRECTIONS.indexOf(props.direction) === -1) props.direction = 'left';
      props.padding = { top: 0, right: 0, bottom: 0, left: 0 };
      props.backgroundColor = null;
    }
    return {
      id: typeof el.id === 'string' && el.id ? el.id : uuid(),
      type: el.type,
      props: props,
    };
  }

  /**
   * 反序列化并校验 SignState。结构不合法时抛出 Error（中文消息）。
   * 尽量宽容：缺失的 props 以默认值补齐，颜色规范化。
   */
  function deserializeSign(json, options) {
    var data;
    if (typeof json === 'string') {
      data = JSON.parse(json); // 解析失败自然抛出
    } else {
      data = json;
    }
    if (!isPlainObject(data)) throw new Error('项目文件不是有效的 JSON 对象');
    var sign = isPlainObject(data.sign) ? data.sign : data;

    if (!Array.isArray(sign.rows)) throw new Error('缺少 rows 数组');
    if (sign.rows.length === 0) throw new Error('rows 不能为空');

    var widthMode = sign.widthMode === 'dynamic' ? 'dynamic' : 'fixed';
    var width = Math.round(Number(sign.width));
    if (!isFinite(width) || width < 64 || width > 32768) width = 2048;
    var rowHeight = Math.round(Number(sign.rowHeight));
    if (!isFinite(rowHeight) || rowHeight < 32 || rowHeight > 2048) rowHeight = 256;
    var frameWidth = Math.round(Number(sign.frameWidth));
    if (!isFinite(frameWidth) || frameWidth < 0) frameWidth = 0;
    if (frameWidth > 512) frameWidth = 512;

    var seenRowIds = {};
    var seenElementIds = {};
    var sourceIds = new Map();
    var rowSourceIds = [];
    /** 重复 id 会让 data-element-id 查询与选中态指向歧义节点，重新生成 */
    function pickUniqueId(id, seen) {
      var usable = typeof id === 'string' && id && !seen[id];
      var final = usable ? id : uuid();
      seen[final] = true;
      return final;
    }

    var rows = sign.rows.map(function (row) {
      if (!isPlainObject(row) || !Array.isArray(row.elements)) {
        throw new Error('存在无效的行');
      }
      var elements = [];
      var localSourceIds = new Map();
      row.elements.forEach(function (el) {
        var ok = sanitizeElement(el);
        if (ok) {
          ok.id = pickUniqueId(ok.id, seenElementIds);
          if (ok.type === 'shape' && typeof el.id === 'string') {
            if (!localSourceIds.has(el.id)) localSourceIds.set(el.id, ok.id);
            if (!sourceIds.has(el.id)) sourceIds.set(el.id, ok.id);
          }
          elements.push(ok);
        }
      });
      rowSourceIds.push(localSourceIds);
      var restoredRow = {
        id: pickUniqueId(row.id, seenRowIds),
        elements: elements,
      };
      if (row.layout === 'free') {
        restoredRow.layout = 'free';
        var preceding = [];
        restoredRow.elements = elements.map(function (element) {
          var placed = element.props.box ? element : defaultFreeElement({ elements: preceding }, element);
          preceding.push(placed);
          return placed;
        });
        restoredRow.widthRatio = sanitizeNumber(row.widthRatio, 0.1, 64, freeWidth(restoredRow.elements));
      } else if (row.layout !== undefined) restoredRow.layout = 'flow';
      if (row.widthRatio !== undefined) restoredRow.widthRatio = sanitizeNumber(row.widthRatio, 0.1, 64,
        row.layout === 'free' ? freeWidth(restoredRow.elements) : width / rowHeight);
      if (row.referenceWidthRatio !== undefined) restoredRow.referenceWidthRatio = sanitizeNumber(row.referenceWidthRatio, 0.1, 64, restoredRow.widthRatio || 1);
      if (typeof row.templateId === 'string') restoredRow.templateId = global.SignCRT ? global.SignCRT.get(row.templateId).id : row.templateId;
      if (row.backgroundColor !== undefined) restoredRow.backgroundColor = sanitizeColor(row.backgroundColor, '#FFFFFF');
      if (isPlainObject(row.route) && isPlainObject(row.route.line) && global.SignRoutes) restoredRow.route = {
        line: global.SignRoutes.normalizeLine(row.route.line), orientation: row.route.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      };
      if (restoredRow.route && (row.route.source === 'server' || row.route.source === 'local')) restoredRow.route.source = row.route.source;
      if (isPlainObject(row.fourSided)) restoredRow.fourSided = normalizeFourSided(row.fourSided);
      else if (restoredRow.templateId === 'four-sided-guide') restoredRow.fourSided = createFourSided();
      return restoredRow;
    });

    rows.forEach(function (row, index) {
      row.elements.forEach(function (element) {
        var source = element.props.contrastSourceId;
        if (source !== undefined) element.props.contrastSourceId = rowSourceIds[index].get(source) || sourceIds.get(source);
      });
    });

    var restored = {
      widthMode: widthMode,
      width: width,
      rowHeight: rowHeight,
      aspectLocked: !!sign.aspectLocked,
      backgroundColor: sanitizeColor(sign.backgroundColor, '#FFFFFF'),
      frameWidth: frameWidth,
      rows: rows,
    };
    restored = syncContrastLinks(restored);
    if (isPlainObject(sign.context) && isPlainObject(sign.context.line)) restored = setProjectContext(restored, sign.context);
    if (global.SignWorkspace && !(options && options.skipWorkspace)) {
      restored = sign.workspace ? global.SignWorkspace.restore(restored, sign.workspace) : global.SignWorkspace.migrate(restored);
    }
    return restored;
  }

  global.SignState = {
    ELEMENT_TYPES: ELEMENT_TYPES,
    DEFAULT_PROPS: DEFAULT_PROPS,
    SCHEMA_VERSION: SCHEMA_VERSION,
    createSign: createSign,
    createRow: createRow,
    createElement: createElement,
    cloneElements: cloneElements,
    MAX_FOUR_SIDED_ENTRIES: MAX_FOUR_SIDED_ENTRIES,
    createFourSided: createFourSided,
    normalizeFourSided: normalizeFourSided,
    applyFourSidedEntries: applyFourSidedEntries,
    updateFourSidedEntry: updateFourSidedEntry,
    addFourSidedEntry: addFourSidedEntry,
    removeFourSidedEntry: removeFourSidedEntry,
    moveFourSidedEntry: moveFourSidedEntry,
    addRow: addRow,
    deleteRow: deleteRow,
    moveRow: moveRow,
    addElement: addElement,
    deleteElement: deleteElement,
    replaceElementWithElements: replaceElementWithElements,
    addTemplateRow: addTemplateRow,
    setRowAspectRatio: setRowAspectRatio,
    setProjectContext: setProjectContext,
    moveElement: moveElement,
    updateElementProps: updateElementProps,
    updateSignSettings: updateSignSettings,
    findElement: findElement,
    clearSign: clearSign,
    applyPaddingAuto: applyPaddingAuto,
    PADDING_AUTO_ADJACENT: PADDING_AUTO_ADJACENT,
    PADDING_AUTO_DEFAULT: PADDING_AUTO_DEFAULT,
    serializeSign: serializeSign,
    deserializeSign: deserializeSign,
  };
})(typeof window !== 'undefined' ? window : globalThis);
