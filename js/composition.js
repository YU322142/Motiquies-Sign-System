/**
 * composition.js — 标准标识与自由编辑共用的元素组合。
 * 内容先组成普通元素，再统一测量和摆放；几何阶段不创建 ID、不访问 DOM。
 */
(function (global) {
  'use strict';
  var Core = global.SignCore;
  var SECTIONS = [
    { id: 'horizontal', name: '横牌', description: '箭头、线路、出口与双语文字，按内容宽度横向排列。' },
    { id: 'vertical', name: '竖牌', description: '站名、编号与设施信息，在竖向牌面内分区摆放。' },
    { id: 'route', name: '线路图', description: '用线路、站点圆点、连接线与站名组成线路信息。' },
    { id: 'safety', name: '安全牌', description: '组合禁止、警告、消防符号与提示文字。' },
  ];

  function sectionFor(template) {
    if (/安全|消防|保护区/.test(template.group || '')) return 'safety';
    if (template.layout === 'route' || /map/.test(template.id)) return 'route';
    if (template.width / template.height < 1.8) return 'vertical';
    return 'horizontal';
  }

  function part(type, props) {
    var defaults = Core.deepClone(global.SignState.DEFAULT_PROPS[type]);
    var merged = Object.assign(defaults, props || {});
    merged.padding = Object.assign({}, global.SignState.DEFAULT_PROPS[type].padding, props && props.padding);
    merged.paddingAuto = true;
    return { type: type, props: merged };
  }

  function colorFor(label, props, fallback) {
    if (Array.isArray(props.linePalette) && global.SignRoutes) {
      var custom = global.SignRoutes.colorFor(label, props.linePalette);
      return custom ? custom.bg : '#66727B';
    }
    if (props.lineColorMode === 'custom') return props.lineColor || fallback;
    var line = Core.lineColorFor(label, 'chongqing');
    return line ? line.bg : props.lineColor || fallback;
  }

  function primaryColor(template, props) {
    props = props || {};
    var fields = props.fields || {};
    var label = typeof fields.line === 'string' ? fields.line.split('/')[0].trim() : '';
    return label ? colorFor(label, props, template.accent) : props.lineColor || template.accent;
  }

  function lineParts(label, english, props, textColor) {
    props = props || {};
    var tokens = String(label || '').split(/[\/、,，;；\r\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var names = String(english || '').split('/').map(function (s) { return s.trim(); });
    return tokens.map(function (token, index) {
      var color = colorFor(token, props, '#424A52');
      var en = names[index] === undefined ? '' : names[index];
      if (/^\d+(?:号线)?$/.test(token)) {
        var number = token.replace(/号线$/, '');
        // The large numeral already supplies the number; keep the original “Line” label.
        if (/^(?:Line\s*)?\d+$/i.test(en)) en = 'Line';
        return part('number-line', {
          lines: [{ number: number, color: color }], labelEn: en,
          lineColorMode: props.lineColorMode === 'custom' ? 'custom' : 'auto',
          textColor: textColor || '#000000', backgroundColor: null,
        });
      }
      return part('text-line', {
        text: token.replace(/线$/, ''), textEn: en, nameSink: true,
        blockColor: color, textColor: textColor || '#000000', backgroundColor: null,
        lineColorMode: props.lineColorMode === 'custom' ? 'custom' : 'auto',
      });
    });
  }

  function adjacent(parts) {
    return global.SignState.applyPaddingAuto({ widthMode: 'dynamic', rows: [{ elements: parts }] }).rows[0].elements;
  }

  function horizontalParts(template, props) {
    if (!template || ['guide', 'facility'].indexOf(template.layout) === -1 || template.width / template.height < 1.8) return null;
    var variant = template.variant || '';
    if (/direction-(?:split|single)|four-sided|transfer-column|transfer-portrait|security-portrait/.test(variant)) return null;
    var fields = Object.assign({}, global.SignCRT.defaultFields(template.id), props && props.fields);
    // Multi-section signs retain their own rows and information hierarchy.
    if (fields.body) return null;
    props = props || {};
    var color = props.textColor || template.color || '#000000';
    var background = props.backgroundColor || template.background || '#FFFFFF';
    var doorhead = /doorhead|lintel/.test(template.variant || '');
    var right = template.layout === 'guide' && !doorhead && /^right(?:-|$)/.test(props.direction || '');
    var parts = [];
    var arrows = { left: 'arrow_left', 'left-up': 'arrow_left_up', up: 'arrow_up',
      'right-up': 'arrow_right_up', right: 'arrow_right', 'right-down': 'arrow_right_down',
      down: 'arrow_down', 'left-down': 'arrow_left_down' };
    function add(type, values) {
      parts.push(part(type, Object.assign({ color: color, textColor: color, backgroundColor: background }, values)));
    }
    function bilingual(zh, en) {
      if (zh || en) add('bilingual-text', { textZh: zh || '', textEn: en || '', align: 'left' });
    }
    function lines() {
      lineParts(fields.line, fields.lineEn, props, color).forEach(function (el) {
        el.props.backgroundColor = background; parts.push(el);
      });
    }
    var isExit = /exit/.test(template.id);
    var isDoor = /doorhead|lintel/.test(variant) && !isExit;
    var guide = template.layout === 'guide';
    if (guide && !doorhead) add('icon', { icon: arrows[props.direction] || 'arrow_up' });
    if (template.icon) add('icon', { icon: template.icon });
    if (isExit) {
      add('exit', { code: fields.code || '', labelZh: fields.title || '', labelEn: fields.subtitle || '', align: 'left' });
    } else {
      if (isDoor) lines();
      var title = fields.title || '', subtitle = fields.subtitle || '';
      if (template.id === 'transfer-wall' && /^换乘\s*\d+\s*号线$/.test(title)) title = '换乘';
      if (template.id === 'transfer-wall' && /^Transfer to Line \d+$/i.test(subtitle)) subtitle = 'Transfer';
      bilingual(title, subtitle);
      if (!isDoor) lines();
      if (fields.code) add('entrance', { code: fields.code });
    }
    bilingual(fields.destination, fields.destinationEn);
    if (fields.footer && !(isDoor && fields.footer === '出入口 Entrance')) bilingual(fields.footer, '');
    if (right) {
      parts.reverse();
      parts.forEach(function (el) {
        if (['number-line', 'text-line', 'exit', 'bilingual-text'].indexOf(el.type) !== -1) el.props.align = 'right';
      });
    }
    return adjacent(parts);
  }

  function layoutParts(parts, rowHeight, measure, box) {
    var fragments = adjacent(parts).map(function (el) {
      return global.SignRender.measureFragment(el.type, el.props, rowHeight, measure);
    });
    var width = fragments.reduce(function (sum, fragment) { return sum + fragment.width; }, 0);
    var scale = Math.max(0, Math.min(1, box.w / Math.max(width, 0.001), box.h / rowHeight));
    var mirrored = parts.some(function (el) { return el.props.align === 'right'; });
    var x = box.x + (mirrored ? box.w - width * scale : 0);
    var y = box.y + (box.h - rowHeight * scale) / 2;
    var commands = fragments.map(function (fragment) {
      var command = { tag: 'element', attrs: { transform: 'translate(' + x + ' ' + y + ') scale(' + scale + ')' },
        element: fragment.element, metrics: fragment.metrics, rowHeight: rowHeight };
      x += fragment.width * scale;
      return command;
    });
    return { commands: commands, scale: scale, width: width * scale, height: rowHeight * scale };
  }

  function fallbackMeasure(text, family, weight, size) {
    return Array.from(String(text)).length * size * 0.6;
  }
  fallbackMeasure.ink = function (text, family, weight, size) {
    return { abl: 0, abr: fallbackMeasure(text, family, weight, size), adv: fallbackMeasure(text, family, weight, size) };
  };
  fallbackMeasure.ascent = function (text, family, weight, size) { return size * 0.8; };
  fallbackMeasure.descent = function (text, family, weight, size) { return size * 0.2; };

  /** Compile a sign recipe to editable ordinary elements; no complete-sign element is retained. */
  function primitiveParts(commands, height, measure) {
    var result = [];
    function put(type, props, x, y, width, hh, command) {
      if (!(width > 0 && hh > 0)) return;
      var values = Object.assign({}, props, { paddingAuto: false,
        box: { x: x / height, y: y / height, width: width / height, height: hh / height } });
      if (command && command.fourSidedEntryId) values.fourSidedEntryId = command.fourSidedEntryId;
      if (command && command.fourSidedRole) values.fourSidedRole = command.fourSidedRole;
      if (type === 'shape' || type === 'plain-text' || type === 'icon') values.padding = { top: 0, right: 0, bottom: 0, left: 0 };
      var element = { type: type, props: values };
      if (command && command.contrastKey) element.contrastKey = command.contrastKey;
      if (command && command.contrastOf) element.contrastOf = command.contrastOf;
      result.push(element);
    }
    commands.forEach(function (command) {
      var a = command.attrs || {};
      if (command.tag === 'element') {
        var translation = /translate\(\s*([-+\d.eE]+)[ ,]+([-+\d.eE]+)/.exec(a.transform || '');
        var scaling = /scale\(\s*([-+\d.eE]+)/.exec(a.transform || '');
        var scale = scaling ? Number(scaling[1]) : 1;
        put(command.element.type, Core.deepClone(command.element.props), translation ? Number(translation[1]) : 0,
          translation ? Number(translation[2]) : 0, command.metrics.width * scale, command.rowHeight * scale, command);
        return;
      }
      if (command.tag === 'symbol') {
        var iconSize = Math.min(Number(a.width), Number(a.height));
        put('icon', { icon: command.iconId, color: command.color || '#000000', backgroundColor: null },
          Number(a.x) + (Number(a.width) - iconSize) / 2,
          Number(a.y) + (Number(a.height) - iconSize) / 2, iconSize, iconSize, command);
        return;
      }
      if (command.tag === 'text') {
        var fs = Number(a['font-size']), weight = Number(a['font-weight']) || 400;
        var family = a['font-family'] || Core.FONT_ZH;
        var bounds = measure.ink(command.text, family, weight, fs);
        var ascent = measure.ascent(command.text, family, weight, fs);
        var descent = measure.descent(command.text, family, weight, fs);
        var width = Math.max(0.1, bounds.abl + bounds.abr), hh = Math.max(0.1, ascent + descent);
        put('plain-text', { text: command.text, font: family === Core.FONT_NUM ? 'num' : family === Core.FONT_EN ? 'en' : 'zh',
          bold: weight >= 600, color: a.fill || '#000000', fontSizeRatio: fs / hh, backgroundColor: null },
          Number(a.x) - bounds.abl, Number(a.y) - ascent, width, hh, command);
        return;
      }
      var shape = command.tag;
      var x, y, width, hh;
      if (shape === 'rect') {
        x = Number(a.x); y = Number(a.y); width = Number(a.width); hh = Number(a.height);
      } else if (shape === 'circle') {
        x = Number(a.cx) - Number(a.r); y = Number(a.cy) - Number(a.r);
        width = hh = Number(a.r) * 2;
      } else if (shape === 'line') {
        x = Math.min(a.x1, a.x2); y = Math.min(a.y1, a.y2);
        width = Math.abs(a.x2 - a.x1); hh = Math.abs(a.y2 - a.y1);
      } else if (shape === 'path' || shape === 'polygon') {
        var points = String(a.points || a.d || '').match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g) || [];
        var xx = [], yy = [];
        points.forEach(function (n, i) { (i % 2 ? yy : xx).push(Number(n)); });
        x = Math.min.apply(null, xx); y = Math.min.apply(null, yy);
        width = Math.max.apply(null, xx) - x; hh = Math.max.apply(null, yy) - y;
      } else return;
      var stroke = a.stroke || 'none';
      var sw = stroke === 'none' ? 0 : Number(a['stroke-width']) || 0;
      var padding = sw / 2;
      var geometry = {};
      ['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'd', 'points',
        'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'].forEach(function (key) {
        if (a[key] !== undefined) geometry[key] = a[key];
      });
      var view = [x - padding, y - padding, Math.max(0.1, width + sw), Math.max(0.1, hh + sw)];
      put('shape', { shape: shape, viewBox: view, geometry: geometry,
        fill: a.fill && a.fill !== 'none' ? a.fill : null,
        stroke: stroke === 'none' ? null : stroke, strokeWidth: sw, backgroundColor: null },
        view[0], view[1], view[2], view[3], command);
    });
    return result;
  }

  function materialize(templateId, overrides, measure) {
    var template = global.SignCRT.get(templateId);
    var props = Object.assign(global.SignCRT.createProps(template.id), overrides || {});
    props.fields = Object.assign(global.SignCRT.defaultFields(template.id), overrides && overrides.fields);
    var parts = horizontalParts(template, props);
    if (!parts) {
      var measurer = measure || (global.App && global.App.measure) || fallbackMeasure;
      var recipe = global.SignCRTRender.metrics({ type: 'crt-sign', props: props }, 1000, measurer);
      parts = primitiveParts(recipe.commands, 1000, measurer);
    }
    var elements = parts.map(function (el) { return global.SignState.createElement(el.type, el.props); });
    var contrastSources = Object.create(null);
    parts.forEach(function (part, index) {
      if (part.contrastKey) contrastSources[part.contrastKey] = elements[index].id;
    });
    elements = elements.map(function (el, index) {
      var sourceId = parts[index].contrastOf && contrastSources[parts[index].contrastOf];
      return sourceId ? Object.assign({}, el, { props: Object.assign({}, el.props, {
        contrastSourceId: sourceId, autoContrast: true,
      }) }) : el;
    });
    if (template.id === 'platform-direction-split' || template.id === 'platform-direction-single') {
      var background = elements[0];
      var center = elements.find(function (el) {
        return el !== background && el.type === 'shape' && el.props.fill === '#FFFFFF' && el.props.box.height === 1;
      });
      if (background && center) elements = elements.map(function (el) {
        var box = el.props.box, band = center.props.box;
        var outside = box && (box.x + box.width <= band.x + 1e-8 || box.x >= band.x + band.width - 1e-8);
        if (!outside || ['plain-text', 'icon'].indexOf(el.type) === -1) return el;
        return Object.assign({}, el, { props: Object.assign({}, el.props, {
          contrastSourceId: background.id, autoContrast: !props.textColor,
        }) });
      });
    }
    return elements;
  }

  function contextStation(context) {
    if (!context || !context.line || !Array.isArray(context.line.stations)) return null;
    return context.line.stations.find(function (station) { return station.id === context.stationId; }) || context.line.stations[0] || null;
  }

  function contextLineNumber(context) {
    var match = context && context.line && /^\s*(\d{1,2})\s*(?:号线)?\s*$/.exec(context.line.nameZh || '');
    return match ? match[1] : '';
  }

  /** Keep standard wording by purpose, and fill project-specific names only where they belong. */
  function contextOverrides(template, context, lines) {
    if (!context || !context.line) return {};
    var line = context.line, station = contextStation(context), fields = {};
    var known = template.fields.map(function (field) { return field.key; });
    function set(key, value) { if (known.indexOf(key) !== -1) fields[key] = value || ''; }
    var label = contextLineNumber(context) || line.nameZh;
    set('line', label); set('lineEn', line.nameEn);
    var stations = line.stations || [];
    var end = stations[line.direction === 'backward' ? 0 : stations.length - 1];
    var other = stations[line.direction === 'backward' ? stations.length - 1 : 0];
    if (station && (template.layout === 'station' || /doorhead|lintel/.test(template.variant || '') && !/exit/.test(template.id))) {
      set('title', station.nameZh); set('subtitle', station.nameEn);
      if (/^station-name/.test(template.id)) set('code', station.code);
    }
    if (station && template.layout === 'route') {
      set('title', station.nameZh); set('subtitle', station.nameEn);
      set('stations', stations.map(function (s) { return [s.nameZh, s.nameEn, s.code].join('|'); }).join('\n'));
    }
    if (/^platform-direction/.test(template.id)) {
      set('title', end ? end.nameZh + '方向' : '请填写方向');
      set('subtitle', end && end.nameEn ? 'To ' + end.nameEn : '');
      set('destination', other ? other.nameZh + '方向' : '');
      set('destinationEn', other && other.nameEn ? 'To ' + other.nameEn : '');
    }
    if (/transfer/.test(template.id)) {
      var transfers = station && station.transfers || '';
      set('line', transfers); set('lineEn', '');
      set('title', '换乘'); set('subtitle', 'Transfer');
      if (/^transfer-door/.test(template.id)) {
        var tokens = transfers.split(/[\/、,，;；\r\n]+/).map(function (token) { return token.trim(); }).filter(Boolean);
        set('lineEn', 'Line');
        set('labelZh', tokens.length && tokens.every(function (token) { return /^\d+(?:号线)?$/.test(token); }) ? '号线' : '线');
      }
      if (known.indexOf('body') !== -1) set('body', (transfers || '换乘线路') + '|Transfer|' +
        (end ? end.nameZh + '方向' : '请填写方向') + '|' + (end && end.nameEn ? 'To ' + end.nameEn : ''));
    }
    if (/^exit-information$|^exit-doorpost$/.test(template.id)) set('body', '出口信息\n请填写目的地');
    if (template.id === 'four-sided-guide') set('body',
      (other ? other.nameZh + '方向' : '请填写方向') + '|' + (other && other.nameEn ? 'To ' + other.nameEn : '') + '|' + label + '|' +
      (end ? end.nameZh + '方向' : '请填写方向') + '|' + (end && end.nameEn ? 'To ' + end.nameEn : ''));
    var result = { fields: fields };
    if (known.indexOf('line') !== -1 || ['station', 'route', 'guide'].indexOf(template.layout) !== -1) {
      result.lineColor = line.color; result.lineColorMode = 'custom';
      result.linePalette = [line].concat(Array.isArray(lines) ? lines : [], line.relatedLines || []);
    }
    if (template.id === 'platform-direction') {
      result.backgroundColor = line.color; result.textColor = Core.contrastTextColor(line.color);
    }
    if (template.id === 'platform-direction-single' || template.id === 'platform-direction-split') result.backgroundColor = line.color;
    return result;
  }

  function contextProps(type, props, context) {
    var result = Object.assign({}, props || {});
    if (!context || !context.line) return result;
    var line = context.line, station = contextStation(context), number = contextLineNumber(context);
    if (type === 'number-line') {
      result.lines = [{ number: number, color: line.color }];
      result.labelZh = number ? '号线' : line.nameZh;
      result.labelEn = line.nameEn;
      result.lineColorMode = 'custom';
    } else if (type === 'text-line') {
      result.text = line.nameZh.replace(/线$/, ''); result.textEn = line.nameEn;
      result.blockColor = line.color; result.lineColorMode = 'custom';
    } else if (station && type === 'bilingual-text' && (!result.textZh || result.textZh === '站名')) {
      result.textZh = station.nameZh; result.textEn = station.nameEn;
    } else if (station && type === 'big-number' && !result.text) result.text = station.code;
    else if (station && type === 'plain-text' && /^(?:站名|站点名称|文字)$/.test(result.text || '文字')) result.text = station.nameZh;
    return result;
  }

  global.SignComposition = {
    SECTIONS: SECTIONS, sectionFor: sectionFor,
    lineParts: lineParts, primaryColor: primaryColor, horizontalParts: horizontalParts,
    layoutParts: layoutParts, materialize: materialize, primitiveParts: primitiveParts,
    contextOverrides: contextOverrides, contextProps: contextProps, contextLineNumber: contextLineNumber,
  };
})(typeof window !== 'undefined' ? window : globalThis);
