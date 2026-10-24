/**
 * routes.js — 独立线路文件、本地线路库与可编辑线路图配方。
 * 数据操作均返回副本；仅线路库接口访问传入的 Storage，不依赖 DOM 或网络。
 */
(function (global) {
  'use strict';
  var Core = global.SignCore;
  var FORMAT = 'railway-line';
  var VERSION = 1;
  var STORAGE_KEY = 'railway-line-library-v1';
  var MAX_STATIONS = 256;
  var DEFAULT_COLOR = '#005EB8';

  function plain(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }
  function string(value, fallback) { return typeof value === 'string' ? value.slice(0, 10000) : (fallback || ''); }
  function id(value, seen) {
    var result = typeof value === 'string' && value.trim() ? value : Core.uuid();
    while (seen && seen.has(result)) result = Core.uuid();
    if (seen) seen.add(result);
    return result;
  }
  function defaultStations() {
    return [
      { nameZh: '起点站', nameEn: 'Start', code: '01', transfers: '' },
      { nameZh: '中间站', nameEn: 'Midway', code: '02', transfers: '' },
      { nameZh: '终点站', nameEn: 'Terminus', code: '03', transfers: '' },
    ];
  }
  function normalizeStation(input, index, seen) {
    var value = plain(input) ? input : {};
    return { id: id(value.id, seen), nameZh: string(value.nameZh),
      nameEn: string(value.nameEn), code: string(value.code, String(index + 1).padStart(2, '0')),
      transfers: string(value.transfers) };
  }

  // 配色只取线路的身份字段，不经 normalizeLine，避免查询时生成 ID 或复制站点。
  function lineSnapshot(input) {
    if (!plain(input) || typeof input.id !== 'string' || !input.id.trim() ||
      typeof input.nameZh !== 'string' || typeof input.nameEn !== 'string') return null;
    var color = Core.normalizeHex(input.color);
    if (!color) return null;
    return { id: input.id, nameZh: string(input.nameZh), nameEn: string(input.nameEn), color: color };
  }
  function cleanLabel(value) {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value).normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
  }
  function numericLabel(value) {
    var text = cleanLabel(value);
    var match = /^(\d+)\s*(?:号线)?$/i.exec(text) || /^line\s*(\d+)$/i.exec(text);
    return match ? match[1].replace(/^0+(?=\d)/, '') : '';
  }
  function labelKey(value) {
    var text = cleanLabel(value);
    return numericLabel(text) || text.replace(/线$/, '').trim().toLowerCase();
  }
  function lineToken(line) {
    var zh = cleanLabel(line.nameZh), en = cleanLabel(line.nameEn);
    return numericLabel(zh) || (zh ? zh.replace(/线$/, '') || zh : numericLabel(en) || en);
  }
  function colorCandidates(lines, preferredLine) {
    var source = Array.isArray(lines) ? lines : [];
    var preferred = typeof preferredLine === 'string'
      ? source.find(function (line) { return line && line.id === preferredLine; }) : preferredLine;
    var result = [], seen = new Set();
    function add(line) {
      var snapshot = lineSnapshot(line);
      if (snapshot && !seen.has(snapshot.id)) { result.push(snapshot); seen.add(snapshot.id); }
    }
    add(preferred);
    source.forEach(add);
    // 外线快照作为后备；本地库存在同 ID 的新资料时，优先使用本地库。
    if (preferred && Array.isArray(preferred.relatedLines)) preferred.relatedLines.forEach(add);
    return result;
  }

  /** 精确匹配线路号、中英文线路名；当前线路优先，未命中返回 null。 */
  function colorFor(label, lines, preferredLine) {
    var key = labelKey(label);
    if (!key) return null;
    var candidates = colorCandidates(lines, preferredLine);
    for (var i = 0; i < candidates.length; i++) {
      var line = candidates[i];
      if (key === labelKey(line.nameZh) || key === labelKey(line.nameEn)) {
        return { id: line.id, line: lineToken(line), name: line.nameZh || line.nameEn,
          nameEn: line.nameEn, bg: line.color };
      }
    }
    return null;
  }

  /** 我的线路与通用颜色；相同颜色合并线路名，不访问本地存储。 */
  function swatches(lines, preferredLine) {
    var result = [], byColor = new Map();
    function add(name, color) {
      var bg = Core.normalizeHex(color);
      if (!bg) return;
      var entry = byColor.get(bg);
      if (!entry) {
        entry = { name: name, bg: bg };
        result.push(entry); byColor.set(bg, entry);
      } else if (entry.name.split(' / ').indexOf(name) === -1) entry.name += ' / ' + name;
    }
    colorCandidates(lines, preferredLine).forEach(function (line) { add(line.nameZh || line.nameEn, line.color); });
    Core.UNIVERSAL_SWATCHES.forEach(function (color) { add(color.name, color.bg); });
    return result;
  }

  function transferLabels(line) {
    var labels = [];
    line.stations.forEach(function (station) {
      station.transfers.split(/[\/、,，;；\r\n|]+/).forEach(function (part) {
        var label = part.trim();
        if (label) labels.push(label);
      });
    });
    return labels;
  }
  function neededSnapshots(line, lines) {
    var snapshots = [], seen = new Set(), candidates = colorCandidates(lines, line);
    transferLabels(line).forEach(function (label) {
      var match = colorFor(label, candidates, line);
      if (match && match.id !== line.id && !seen.has(match.id)) {
        snapshots.push(lineSnapshot(candidates.find(function (candidate) { return candidate.id === match.id; })));
        seen.add(match.id);
      }
    });
    return snapshots;
  }

  /** 宽容入口供项目存档使用；独立线路文件导入另走严格 validateLine。 */
  function normalizeLine(input) {
    var value = plain(input) ? input : {};
    var source = value.stations === undefined ? defaultStations() : Array.isArray(value.stations) ? value.stations : [];
    var seen = new Set();
    var stations = source.slice(0, MAX_STATIONS).map(function (station, index) {
      return normalizeStation(station, index, seen);
    });
    var current = value.currentStationId;
    if (current !== null && !stations.some(function (station) { return station.id === current; })) {
      current = stations.length ? stations[0].id : null;
    }
    var result = {
      id: id(value.id), nameZh: string(value.nameZh, '新建线路'), nameEn: string(value.nameEn, 'New Line'),
      color: Core.normalizeHex(value.color) || DEFAULT_COLOR, stations: stations,
      currentStationId: stations.length ? current : null,
      direction: value.direction === 'backward' ? 'backward' : 'forward',
    };
    if (value.relatedLines !== undefined) {
      var related = Array.isArray(value.relatedLines) ? value.relatedLines.map(lineSnapshot).filter(Boolean) : [];
      result.relatedLines = neededSnapshots(result, related);
    }
    return result;
  }
  function createLine(overrides) { return normalizeLine(overrides); }

  /** 导出或保存时收集站点实际引用的外线，保留最小身份与配色快照。 */
  function withRelatedLines(input, lines) {
    var line = normalizeLine(input);
    var candidates = (Array.isArray(lines) ? lines : []).concat(line.relatedLines || []);
    var related = neededSnapshots(line, candidates);
    if (related.length || line.relatedLines !== undefined) line.relatedLines = related;
    return line;
  }

  function fail(message) { throw new Error('线路文件无效：' + message); }
  function assertText(value, label, nonempty) {
    if (typeof value !== 'string' || value.length > 10000 || (nonempty && !value.trim())) fail(label + '必须为' + (nonempty ? '非空' : '') + '字符串');
  }
  function validateLine(input) {
    if (!plain(input)) fail('线路内容必须是对象');
    assertText(input.id, '线路 ID', true);
    assertText(input.nameZh, '线路中文名称');
    assertText(input.nameEn, '线路英文名称');
    if (typeof input.color !== 'string' || !Core.normalizeHex(input.color)) fail('线路颜色必须为十六进制颜色');
    if (input.direction !== 'forward' && input.direction !== 'backward') fail('运行方向必须为 forward 或 backward');
    if (!Array.isArray(input.stations) || input.stations.length > MAX_STATIONS) fail('站点必须为最多 ' + MAX_STATIONS + ' 项的数组');
    var seen = new Set();
    input.stations.forEach(function (station, index) {
      if (!plain(station)) fail('第 ' + (index + 1) + ' 个站点必须是对象');
      assertText(station.id, '站点 ID', true);
      if (seen.has(station.id)) fail('站点 ID 重复');
      seen.add(station.id);
      ['nameZh', 'nameEn', 'code', 'transfers'].forEach(function (key) { assertText(station[key], '站点 ' + key); });
    });
    if (input.relatedLines !== undefined) {
      if (!Array.isArray(input.relatedLines)) fail('换乘线路必须为数组');
      var relatedIds = new Set();
      input.relatedLines.forEach(function (line) {
        if (!plain(line)) fail('换乘线路必须为对象');
        assertText(line.id, '换乘线路 ID', true);
        assertText(line.nameZh, '换乘线路中文名称');
        assertText(line.nameEn, '换乘线路英文名称');
        if (relatedIds.has(line.id)) fail('换乘线路 ID 重复');
        relatedIds.add(line.id);
        if (typeof line.color !== 'string' || !Core.normalizeHex(line.color)) fail('换乘线路颜色必须为十六进制颜色');
      });
    }
    if (input.currentStationId !== null && (typeof input.currentStationId !== 'string' || !seen.has(input.currentStationId))) fail('本站必须引用已有站点 ID 或为 null');
    return normalizeLine(input);
  }
  function patchLine(line, patch) {
    return normalizeLine(Object.assign({}, normalizeLine(line), plain(patch) ? patch : {}));
  }
  function addStation(line, station, index) {
    var next = normalizeLine(line);
    if (next.stations.length >= MAX_STATIONS) throw new Error('线路最多支持 ' + MAX_STATIONS + ' 个站点');
    var at = index === undefined ? next.stations.length : Core.clamp(Math.trunc(index) || 0, 0, next.stations.length);
    var seen = new Set(next.stations.map(function (s) { return s.id; }));
    next.stations.splice(at, 0, normalizeStation(station, at, seen));
    if (next.currentStationId === null && next.stations.length === 1) next.currentStationId = next.stations[0].id;
    return next;
  }
  function updateStation(line, stationId, patch) {
    var next = normalizeLine(line);
    next.stations = next.stations.map(function (station) {
      if (station.id !== stationId) return station;
      return Object.assign({}, station, plain(patch) ? patch : {}, { id: station.id });
    });
    return normalizeLine(next);
  }
  function removeStation(line, stationId) {
    var next = normalizeLine(line);
    var index = next.stations.findIndex(function (station) { return station.id === stationId; });
    if (index < 0) return next;
    next.stations.splice(index, 1);
    if (next.currentStationId === stationId) {
      next.currentStationId = next.stations.length ? next.stations[Math.min(index, next.stations.length - 1)].id : null;
    }
    return normalizeLine(next);
  }
  function moveStation(line, fromIndex, toIndex) {
    var next = normalizeLine(line), count = next.stations.length;
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= count || toIndex >= count) return next;
    var moved = next.stations.splice(fromIndex, 1)[0];
    next.stations.splice(toIndex, 0, moved);
    return next;
  }

  function serialize(line) {
    return JSON.stringify({ format: FORMAT, version: VERSION, line: validateLine(line) }, null, 2) + '\n';
  }
  function deserialize(input) {
    var file = input;
    if (typeof input === 'string') {
      try { file = JSON.parse(input.replace(/^\uFEFF/, '')); }
      catch (_) { fail('不是合法 JSON'); }
    }
    if (!plain(file) || file.format !== FORMAT) fail('文件类型必须为 ' + FORMAT);
    if (file.version !== VERSION) fail('不支持的线路文件版本');
    return validateLine(file.line);
  }

  function storageOrDefault(storage) {
    if (storage) return storage;
    try { return global.localStorage || null; } catch (_) { return null; }
  }
  function list(storage) {
    var store = storageOrDefault(storage);
    if (!store) return [];
    try {
      var file = JSON.parse(store.getItem(STORAGE_KEY) || 'null');
      if (!plain(file) || file.format !== 'railway-line-library' || file.version !== VERSION || !Array.isArray(file.lines)) return [];
      var seen = new Set();
      return file.lines.reduce(function (lines, value) {
        try {
          var line = validateLine(value);
          if (!seen.has(line.id)) { lines.push(line); seen.add(line.id); }
        } catch (_) { /* 单条损坏不影响其余已保存线路。 */ }
        return lines;
      }, []);
    } catch (_) { return []; }
  }
  function writeLibrary(lines, storage) {
    var store = storageOrDefault(storage);
    if (!store || typeof store.setItem !== 'function') throw new Error('当前环境无法使用本地线路库');
    store.setItem(STORAGE_KEY, JSON.stringify({ format: 'railway-line-library', version: VERSION, lines: lines }));
  }
  function save(line, storage) {
    var normalized = validateLine(line);
    var lines = list(storage).filter(function (saved) { return saved.id !== normalized.id; });
    lines.unshift(normalized);
    writeLibrary(lines, storage);
    return normalizeLine(normalized);
  }
  function remove(lineId, storage) {
    var lines = list(storage).filter(function (line) { return line.id !== lineId; });
    writeLibrary(lines, storage);
    return lines;
  }

  /** 生成自由排版的普通元素；本站、站号和换乘文字均可在放入牌面后独立编辑。 */
  function materialize(input, orientation, measure) {
    var line = normalizeLine(input);
    var vertical = orientation === 'vertical';
    var direction = vertical ? (line.direction === 'backward' ? 'up' : 'down') : (line.direction === 'backward' ? 'left' : 'right');
    var count = line.stations.length;
    var h = 1000;
    var ratio = Core.clamp(vertical ? 1 / (1.15 + Math.max(1, count) * 0.6) : Math.max(3.6, count * 1.25 + 0.8), 0.1, 64);
    var w = h * ratio;
    var elements = [];
    var render = global.SignRender;
    var m = measure || (global.App && global.App.measure);
    if (!m) throw new Error('生成线路图需要文字测量函数');
    var zeroPadding = { top: 0, right: 0, bottom: 0, left: 0 };
    var currentIndex = line.stations.findIndex(function (station) { return station.id === line.currentStationId; });
    var muted = '#A5ABB0';
    function put(type, props, box) {
      if (!(box.width > 0 && box.height > 0)) return;
      var values = Object.assign({ backgroundColor: null, paddingAuto: false, padding: zeroPadding }, props, {
        box: { x: box.x / h, y: box.y / h, width: box.width / h, height: box.height / h },
      });
      elements.push(global.SignState.createElement(type, values));
    }
    function rectangle(box, fill) {
      put('shape', { shape: 'rect', viewBox: [0, 0, box.width, box.height],
        geometry: { x: 0, y: 0, width: box.width, height: box.height }, fill: fill, stroke: null, strokeWidth: 0 }, box);
    }
    function circle(cx, cy, radius, fill, stroke, sw) {
      var size = radius * 2;
      put('shape', { shape: 'circle', viewBox: [0, 0, size, size],
        geometry: { cx: radius, cy: radius, r: Math.max(0, radius - sw / 2) },
        fill: fill, stroke: stroke, strokeWidth: sw },
      { x: cx - radius, y: cy - radius, width: size, height: size });
    }
    function bilingual(zh, en, box, color, bold) {
      if (!zh && !en) return;
      var childHeight = box.height * 0.88;
      var fragment = render.measureFragment('bilingual-text', { textZh: zh || '', textEn: en || '',
        color: color, align: 'center', bold: !!bold, padding: zeroPadding, paddingAuto: false }, childHeight, m);
      var scale = Math.min(1, box.width / Math.max(fragment.width, 0.001));
      put('bilingual-text', fragment.element.props, { x: box.x + (box.width - fragment.width * scale) / 2,
        y: box.y + (box.height - childHeight * scale) / 2, width: Math.max(0.001, fragment.width * scale), height: childHeight * scale });
    }
    function text(value, box, fontSize, color, font, bold) {
      if (!value) return;
      var family = font === 'num' ? Core.FONT_NUM : font === 'en' ? Core.FONT_EN : Core.FONT_ZH;
      var weight = bold ? 700 : 400;
      var bounds = m.ink(value, family, weight, fontSize);
      var ascent = m.ascent(value, family, weight, fontSize), descent = m.descent(value, family, weight, fontSize);
      var naturalWidth = Math.max(0.001, bounds.abl + bounds.abr), naturalHeight = Math.max(0.001, ascent + descent);
      var scale = Math.min(1, box.width / naturalWidth, box.height / naturalHeight);
      var textHeight = naturalHeight * scale;
      put('plain-text', { text: value, font: font || 'zh', bold: !!bold, color: color, fontSizeRatio: fontSize / naturalHeight },
        { x: box.x + (box.width - naturalWidth * scale) / 2, y: box.y + (box.height - textHeight) / 2,
          width: naturalWidth * scale, height: textHeight });
    }
    function arrow(x, y, size, color) {
      var geometry = render.arrowGeometry(size, size * 0.18, direction);
      [geometry.head1, geometry.head2, geometry.shaft].forEach(function (points) {
        put('shape', { shape: 'polygon', viewBox: [0, 0, size, size],
          geometry: { points: points.map(function (point) { return point.join(','); }).join(' ') },
          fill: color, stroke: null, strokeWidth: 0 }, { x: x, y: y, width: size, height: size });
      });
    }
    function passed(index) {
      return currentIndex >= 0 && (line.direction === 'backward' ? index > currentIndex : index < currentIndex);
    }

    function transferText(value, box, fontSize, fallback) {
      if (!value) return;
      var tokens = value.split(/[\/、,，;；\r\n|]+/).map(function (label) { return label.trim(); }).filter(Boolean);
      var parts = tokens.map(function (label) { return { text: label, match: colorFor(label, line.relatedLines || [], line) }; });
      if (!parts.some(function (part) { return !!part.match; })) {
        text(value, box, fontSize, fallback === contrast ? contrast : '#66727B', 'zh', false);
        return;
      }
      var gap = fontSize * 0.6;
      var widths = parts.map(function (part) {
        var bounds = m.ink(part.text, Core.FONT_ZH, 400, fontSize);
        return Math.max(0.001, bounds.abl + bounds.abr);
      });
      var total = widths.reduce(function (sum, width) { return sum + width; }, 0) + Math.max(0, parts.length - 1) * gap;
      var scale = Math.min(1, box.width / Math.max(total, 0.001));
      var x = box.x + (box.width - total * scale) / 2;
      parts.forEach(function (part, index) {
        var width = widths[index] * scale;
        text(part.text, { x: x, y: box.y, width: width, height: box.height }, fontSize * scale,
          part.match ? part.match.bg : '#66727B', 'zh', false);
        x += width + gap * scale;
      });
    }

    rectangle({ x: 0, y: 0, width: w, height: h }, '#FFFFFF');
    var headerHeight = vertical ? w * 0.64 : h * 0.23;
    rectangle({ x: 0, y: 0, width: w, height: headerHeight }, line.color);
    var contrast = Core.contrastTextColor(line.color);
    var arrowSize = vertical ? w * 0.15 : h * 0.15;
    bilingual(line.nameZh, line.nameEn,
      { x: w * 0.035, y: headerHeight * 0.08, width: w - arrowSize * 1.7, height: headerHeight * 0.8 }, contrast, false);
    arrow(w - arrowSize * 1.2, (headerHeight - arrowSize) / 2, arrowSize, contrast);
    if (!count) {
      text('请添加站点', { x: w * 0.1, y: headerHeight + (h - headerHeight) * 0.4,
        width: w * 0.8, height: Math.min(w * 0.16, h * 0.1) }, Math.min(w * 0.1, h * 0.07), '#66727B', 'zh', false);
    } else if (vertical) {
      var trackX = w * 0.2;
      var top = headerHeight + w * 0.35;
      var bottom = h - w * 0.34;
      var step = count > 1 ? (bottom - top) / (count - 1) : 0;
      // 长线路保持可操作的牌面比例；站点信息带随站距同比缩小。
      var stationUnit = count > 1 ? Math.min(w, step / 0.65) : w;
      line.stations.forEach(function (station, index) {
        var cy = count === 1 ? (top + bottom) / 2 : top + index * step;
        var active = station.id === line.currentStationId;
        var color = passed(index) ? muted : line.color;
        if (index < count - 1) rectangle({ x: trackX - stationUnit * 0.013, y: cy, width: stationUnit * 0.026, height: step }, passed(line.direction === 'backward' ? index + 1 : index) ? muted : line.color);
        if (active) rectangle({ x: w * 0.3, y: cy - stationUnit * 0.16, width: w * 0.66, height: stationUnit * 0.32 }, line.color);
        circle(trackX, cy, stationUnit * 0.046, active ? line.color : '#FFFFFF', color, stationUnit * 0.014);
        text(station.code, { x: w * 0.015, y: cy - stationUnit * 0.055, width: w * 0.12, height: stationUnit * 0.11 }, stationUnit * 0.085, color, 'num', false);
        if (stationUnit < 32) {
          // 极小双行字号会受到字体墨区取整影响；密集信息改为同基线分栏。
          var singleRow = stationUnit < 12;
          var labelY = cy - stationUnit * 0.1;
          text(station.nameZh, { x: w * 0.32, y: labelY, width: w * (singleRow ? 0.18 : 0.26), height: stationUnit * 0.2 },
            stationUnit * 0.145, active ? contrast : '#111111', 'zh', active);
          text(station.nameEn, { x: w * (singleRow ? 0.52 : 0.6), y: labelY, width: w * (singleRow ? 0.22 : 0.34), height: stationUnit * 0.2 },
            stationUnit * 0.1, active ? contrast : '#111111', 'en', active);
          transferText(station.transfers, singleRow
            ? { x: w * 0.77, y: labelY, width: w * 0.19, height: stationUnit * 0.2 }
            : { x: w * 0.3, y: cy + stationUnit * 0.19, width: w * 0.66, height: stationUnit * 0.13 },
          stationUnit * 0.075, singleRow && active ? contrast : line.color);
        } else {
          bilingual(station.nameZh, station.nameEn, { x: w * 0.32, y: cy - stationUnit * 0.15, width: w * 0.62, height: stationUnit * 0.28 }, active ? contrast : '#111111', active);
          transferText(station.transfers, { x: w * 0.3, y: cy + stationUnit * 0.19, width: w * 0.66, height: stationUnit * 0.13 }, stationUnit * 0.075, line.color);
        }
        if (active) text('本站', { x: w * 0.04, y: cy + stationUnit * 0.07, width: w * 0.27, height: stationUnit * 0.1 }, stationUnit * 0.065, line.color, 'zh', false);
      });
    } else {
      var left = h * 0.64, right = w - h * 0.64;
      var trackY = h * 0.61;
      var gap = count > 1 ? (right - left) / (count - 1) : 0;
      var stationScale = count > 1 ? Math.min(h, gap / 1.2) : h;
      var nameTop = trackY - h * 0.09 - stationScale * 0.18;
      line.stations.forEach(function (station, index) {
        var cx = count === 1 ? w / 2 : left + index * gap;
        var active = station.id === line.currentStationId;
        var color = passed(index) ? muted : line.color;
        if (index < count - 1) rectangle({ x: cx, y: trackY - stationScale * 0.012, width: gap, height: stationScale * 0.024 }, passed(line.direction === 'backward' ? index + 1 : index) ? muted : line.color);
        if (active) rectangle({ x: cx - stationScale * 0.56, y: nameTop - stationScale * 0.01, width: stationScale * 1.12, height: stationScale * 0.2 }, line.color);
        bilingual(station.nameZh, station.nameEn, { x: cx - stationScale * 0.53, y: nameTop, width: stationScale * 1.06, height: stationScale * 0.18 }, active ?contrast : '#111111', active);
        circle(cx, trackY, stationScale * 0.038, active ? line.color : '#FFFFFF', color, stationScale * 0.011);
        text(station.code, { x: cx - stationScale * 0.45, y: h * 0.68, width: stationScale * 0.9, height: stationScale * 0.08 }, stationScale * 0.065, color, 'num', false);
        transferText(station.transfers, { x: cx - stationScale * 0.55, y: h * 0.8, width: stationScale * 1.1, height: stationScale * 0.11 }, stationScale * 0.065, line.color);
        if (active) text('本站', { x: cx - stationScale * 0.4, y: nameTop - stationScale * 0.075, width: stationScale * 0.8, height: stationScale * 0.055 }, stationScale * 0.045, line.color, 'zh', false);
      });
    }
    return { elements: elements, widthRatio: ratio,
      route: { line: normalizeLine(line), orientation: vertical ? 'vertical' : 'horizontal' } };
  }

  global.SignRoutes = {
    FORMAT: FORMAT, VERSION: VERSION, STORAGE_KEY: STORAGE_KEY, MAX_STATIONS: MAX_STATIONS,
    createLine: createLine, normalizeLine: normalizeLine, validateLine: validateLine,
    patchLine: patchLine, addStation: addStation, updateStation: updateStation,
    removeStation: removeStation, moveStation: moveStation,
    serialize: serialize, deserialize: deserialize, list: list, save: save, remove: remove,
    colorFor: colorFor, swatches: swatches, withRelatedLines: withRelatedLines,
    materialize: materialize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
