/**
 * crt-render.js — 重庆标准矩形标识牌的纯几何与 SVG 绘制。
 *
 * 所有测量、换行、缩放与图形坐标只在 metrics 中计算。draw 只把几何指令
 * 转成 SVG DOM；文字保留为 text，符号为内嵌矢量，不依赖 PDF 位图。
 */
(function (global) {
  'use strict';

  var Core = global.SignCore;
  var NS = Core.SVG_NS;
  var ARROW_ICONS = {
    left: 'arrow_left', 'left-up': 'arrow_left_up', up: 'arrow_up',
    'right-up': 'arrow_right_up', right: 'arrow_right',
    'right-down': 'arrow_right_down', down: 'arrow_down', 'left-down': 'arrow_left_down',
  };

  function value(fields, key, fallback) {
    return typeof fields[key] === 'string' ? fields[key] : (fallback || '');
  }

  function metrics(el, height, measure) {
    var props = el.props || {};
    var catalog = global.SignCRT;
    var template = catalog && catalog.get(props.templateId);
    if (!template) return { width: height, height: height, commands: [] };
    var h = height;
    var naturalRatio = template.width / template.height;
    var ratio = Number.isFinite(props.widthRatio) ? props.widthRatio : naturalRatio;
    var w = h * Core.clamp(ratio, 0.1, 64);
    var commands = [];
    var currentStationIndex = null;
    var fields = Object.assign({}, catalog.defaultFields(template.id), props.fields || {});
    var ink = props.textColor || template.color || '#000000';
    var bg = props.backgroundColor || template.background || '#FFFFFF';
    var accent = global.SignComposition.primaryColor(template, props);
    if (template.id === 'platform-direction-split') {
      bg = props.backgroundColor || accent;
      ink = props.textColor || Core.contrastTextColor(bg);
    }
    var margin = Math.min(w, h) * 0.055;
    var unit = Math.min(w, h);
    var variant = template.variant || template.id;
    var kind = variant + ' ' + template.id;
    var font = Core.FONT_ZH;

    function add(tag, attrs, text) {
      var cmd = { tag: tag, attrs: attrs };
      if (text !== undefined) cmd.text = text;
      commands.push(cmd);
      return cmd;
    }
    function rect(x, y, width, hh, fill, stroke, sw, radius) {
      return add('rect', { x: x, y: y, width: Math.max(0, width), height: Math.max(0, hh),
        fill: fill || 'none', stroke: stroke || undefined, 'stroke-width': sw || undefined,
        rx: radius || undefined });
    }
    function line(x1, y1, x2, y2, color, sw, dash) {
      return add('line', { x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: color || ink, 'stroke-width': sw || unit * 0.002,
        'stroke-dasharray': dash || undefined });
    }
    function circle(cx, cy, r, fill, stroke, sw) {
      return add('circle', { cx: cx, cy: cy, r: Math.max(0, r), fill: fill || 'none',
        stroke: stroke || undefined, 'stroke-width': sw || undefined });
    }
    function textInk(text, family, weight, size) {
      var bounds = measure.ink ? measure.ink(text, family, weight, size) :
        { abl: 0, abr: measure(text, family, weight, size) };
      var ascent = measure.ascent ? measure.ascent(text, family, weight, size) : size * 0.84;
      var descent = measure.descent ? measure.descent(text, family, weight, size) : size * 0.15;
      return { width: Math.max(0, bounds.abl + bounds.abr), left: bounds.abl,
        ascent: ascent, descent: descent, height: ascent + descent };
    }
    /** 指定盒中按墨区居中/左/右对齐，超长文字同比缩小。 */
    function text(textValue, box, size, color, family, weight, align, rotation) {
      if (!textValue || box.w <= 0 || box.h <= 0) return;
      var content = String(textValue).replace(/\r?\n/g, ' ');
      var ff = family || font, fw = weight || 400;
      var initial = textInk(content, ff, fw, size);
      var scale = Math.min(1, box.w / Math.max(initial.width, 0.001),
        box.h / Math.max(initial.height, 0.001));
      var fs = Math.max(0.001, size * scale);
      var bounds = textInk(content, ff, fw, fs);
      // Canvas 的 ascent 常取整；再收敛一次以保证很小牌面也不越界。
      if (bounds.height > box.h || bounds.width > box.w) {
        fs *= Math.min(box.h / Math.max(bounds.height, 0.001), box.w / Math.max(bounds.width, 0.001)) * 0.99;
        bounds = textInk(content, ff, fw, fs);
      }
      var x = box.x + bounds.left;
      if (align === 'center') x += (box.w - bounds.width) / 2;
      if (align === 'right') x += box.w - bounds.width;
      var y = box.y + (box.h - bounds.height) / 2 + bounds.ascent;
      return add('text', { x: x, y: y, fill: color || ink,
        'font-family': ff, 'font-size': fs, 'font-weight': fw,
        transform: rotation ? 'rotate(' + rotation + ' ' + (box.x + box.w / 2) + ' ' + (box.y + box.h / 2) + ')' : undefined,
        'data-crt-text': 'true' }, content);
    }
    /** 将已测量的原生元素整体放入信息盒，保持字号、墨区间距与图形比例。 */
    function fittedFragment(fragment, box, align, bounds) {
      if (box.w <= 0 || box.h <= 0) return;
      var area = bounds || { x: 0, y: 0, w: fragment.width, h: fragment.height };
      var scale = Math.min(1, box.w / Math.max(area.w, 0.001), box.h / Math.max(area.h, 0.001));
      var x = box.x - area.x * scale;
      if (align === 'center') x += (box.w - area.w * scale) / 2;
      if (align === 'right') x += box.w - area.w * scale;
      var y = box.y + (box.h - area.h * scale) / 2 - area.y * scale;
      commands.push({ tag: 'element', attrs: { transform: 'translate(' + x + ' ' + y + ') scale(' + scale + ')' },
        element: fragment.element, metrics: fragment.metrics, rowHeight: fragment.height });
    }
    function bilingual(zh, en, box, size, color, align, bold) {
      if ((!zh && !en) || box.w <= 0 || box.h <= 0) return;
      var render = global.SignRender;
      var childHeight = size / render.ZH_FONT_RATIO;
      var textZh = String(zh || '').replace(/\r?\n/g, ' ');
      var textEn = String(en || '').replace(/\r?\n/g, ' ');
      var alignment = align || 'left';
      var fragment = render.measureFragment('bilingual-text', {
        textZh: textZh, textEn: textEn, color: color || ink, align: alignment, bold: !!bold,
        padding: { top: 0, right: 0, bottom: 0, left: 0 }, paddingAuto: false,
      }, childHeight, measure);
      var mt = fragment.metrics;
      var positions = render.bilingualAlignX({ width: mt.textW, zhW: mt.zhW, enW: mt.enW },
        0, alignment, childHeight / 30);
      var runs = [];
      if (textZh) runs.push({ text: textZh, font: Core.FONT_ZH, size: mt.zhSize,
        x: positions.zhX, y: mt.zhBase, left: mt.zhAbl, right: mt.zhAbr });
      if (textEn) runs.push({ text: textEn, font: Core.FONT_EN, size: mt.enSize,
        x: positions.enX, y: mt.enBase, left: mt.enAbl, right: mt.enAbr });
      var left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      runs.forEach(function (run) {
        var ascent = measure.ascent(run.text, run.font, mt.weight, run.size);
        var descent = measure.descent ? measure.descent(run.text, run.font, mt.weight, run.size) : run.size * 0.21;
        left = Math.min(left, run.x - run.left);
        right = Math.max(right, run.x + run.right);
        top = Math.min(top, run.y - ascent);
        bottom = Math.max(bottom, run.y + descent);
      });
      fittedFragment(fragment, box, alignment, { x: left, y: top, w: right - left, h: bottom - top });
    }
    function wrap(input, maxWidth, size, family, weight) {
      var result = [];
      String(input || '').split(/\r?\n/).forEach(function (paragraph) {
        if (!paragraph) { result.push(''); return; }
        var tokens = paragraph.match(/[A-Za-z0-9][A-Za-z0-9.,:;!?()\/-]*\s*|[^\x00-\x7F]|\s+|./g) || [];
        var current = '';
        tokens.forEach(function (token) {
          if (current && textInk(current + token, family, weight, size).width > maxWidth) {
            result.push(current.trim()); current = token.trimStart();
          } else current += token;
        });
        if (current) result.push(current.trim());
      });
      return result;
    }
    function paragraph(input, box, size, color, family, weight) {
      if (!input || box.w <= 0 || box.h <= 0) return;
      var ff = family || font, fw = weight || 400;
      var fs = size, rows = wrap(input, box.w, fs, ff, fw);
      for (var attempt = 0; attempt < 8 && rows.length * fs * 1.48 > box.h; attempt++) {
        fs *= Math.max(0.4, Math.min(0.92, box.h / (rows.length * fs * 1.48)));
        rows = wrap(input, box.w, fs, ff, fw);
      }
      var step = Math.min(fs * 1.48, box.h / Math.max(rows.length, 1));
      rows.forEach(function (row, index) {
        text(row, { x: box.x, y: box.y + index * step, w: box.w, h: step * 0.94 },
          fs, color, ff, fw, 'left');
      });
    }
    function symbol(id, box, color) {
      var crtLib = global.SignCRTSymbols;
      var icon = crtLib && crtLib.get(id);
      if (!icon && global.SignIcons && Object.prototype.hasOwnProperty.call(global.SignIcons.ALL, id))
        icon = global.SignIcons.get(id);
      if (!icon) return;
      commands.push({ tag: 'symbol', attrs: { x: box.x, y: box.y, width: box.w,
        height: box.h, viewBox: icon.vb, preserveAspectRatio: 'xMidYMid meet' },
        iconId: id, color: color || ink,
        body: icon.body.replace(/(fill|stroke)="(?:black|#000000|#000)"/gi,
          function (_, attr) { return attr + '="' + (color || ink) + '"'; }) });
    }
    function arrow(box, direction, color) {
      if (box.w <= 0 || box.h <= 0) return;
      var size = Math.min(box.w, box.h);
      var fragment = global.SignRender.measureFragment('icon', {
        icon: ARROW_ICONS[direction] || 'arrow_up', color: color || ink,
        padding: { top: 0, right: 0, bottom: 0, left: 0 }, paddingAuto: false,
      }, size, measure);
      fittedFragment(fragment, box, 'center');
    }
    function rule(y) { line(margin, y, w - margin, y, ink, unit * 0.002); }
    function stationRows(input) {
      return String(input || '').split(/\r?\n/).filter(function (row) { return row.trim(); }).map(function (row, index) {
        var cells = row.split('|');
        return { zh: cells[0].trim(), en: (cells[1] || '').trim(), code: (cells[2] || String(index + 1)).trim() };
      });
    }
    function lineBadge(label, x, y, bh, width) {
      var bw = width || bh * Math.max(1.5, String(label).length * 0.8);
      rect(x, y, bw, bh, accent);
      text(label, { x: x + bh * 0.12, y: y + bh * 0.1, w: bw - bh * 0.24, h: bh * 0.8 },
        bh * 0.68, Core.contrastTextColor(accent), font, 700, 'center');
      return bw;
    }
    function doorwayTint(color) {
      var hex = Core.normalizeHex(color) || '#424A52';
      return '#' + [1, 3, 5].map(function (offset) {
        return Math.round(parseInt(hex.slice(offset, offset + 2), 16) * 0.3 + 255 * 0.7).toString(16).padStart(2, '0');
      }).join('').toUpperCase();
    }
    /** 门套的上下两行保留各自字号，并按实际墨区整组适配。 */
    function doorwayStack(zh, en, box, zhSize, enSize, color, align) {
      var runs = [{ content: zh, family: Core.FONT_ZH, size: zhSize },
        { content: en, family: Core.FONT_EN, size: enSize }].filter(function (run) { return run.content; });
      if (!runs.length || box.w <= 0 || box.h <= 0) return;
      var gap = runs.length > 1 ? Math.min(zhSize, enSize) * 0.12 : 0;
      var total = gap, maxWidth = 0;
      runs.forEach(function (run) {
        run.bounds = textInk(run.content, run.family, 400, run.size);
        total += run.bounds.height; maxWidth = Math.max(maxWidth, run.bounds.width);
      });
      var scale = Math.min(1, box.w / Math.max(maxWidth, 0.001), box.h / Math.max(total, 0.001));
      var yy = box.y + (box.h - total * scale) / 2;
      runs.forEach(function (run) {
        var hh = run.bounds.height * scale;
        text(run.content, { x: box.x, y: yy, w: box.w, h: hh }, run.size * scale,
          color, run.family, 400, align || 'center');
        yy += hh + gap * scale;
      });
    }
    function doorwayLabel(label) {
      var cleaned = String(label || '').trim();
      var number = /^(\d+)\s*(?:号线)?$/.exec(cleaned) || /^line\s*(\d+)$/i.exec(cleaned);
      return number ? number[1] : cleaned.replace(/线$/, '') || cleaned;
    }
    function doorwayBadge(label, index, box) {
      var localProps = Object.assign({}, props, { fields: Object.assign({}, fields, { line: label }) });
      var color = global.SignComposition.primaryColor(template, localProps);
      var key = 'transfer-badge-' + index;
      rect(box.x, box.y, box.w, box.h, color).contrastKey = key;
      var number = text(doorwayLabel(label), { x: box.x + box.w * 0.065, y: box.y + box.h * 0.05,
        w: box.w * 0.87, h: box.h * 0.9 }, Math.min(box.w * 0.74, box.h * 0.86),
      Core.contrastTextColor(color), Core.FONT_NUM, 400, 'center');
      if (number) number.contrastOf = key;
    }
    function lineMark(label, english, box) {
      if (!label || box.w <= 0 || box.h <= 0) return;
      var composition = global.SignComposition;
      var parts = composition.lineParts(label, english, props, ink);
      var layout = composition.layoutParts(parts, box.h, measure, box);
      Array.prototype.push.apply(commands, layout.commands);
    }
    function stationBadge(cx, cy, radius, lineNumber, stationCode) {
      circle(cx, cy, radius, '#FFFFFF', accent, radius * 0.06);
      line(cx - radius * 0.85, cy, cx + radius * 0.85, cy, accent, radius * 0.035);
      text(lineNumber, { x: cx - radius * 0.8, y: cy - radius * 0.88, w: radius * 1.6, h: radius * 0.8 },
        radius * 0.7, accent, Core.FONT_NUM, 400, 'center');
      text(stationCode, { x: cx - radius * 0.8, y: cy + radius * 0.09, w: radius * 1.6, h: radius * 0.77 },
        radius * 0.68, accent, Core.FONT_NUM, 400, 'center');
    }

    rect(0, 0, w, h, bg);
    // 通用牌面不添加装饰灰框；标准专用边框与编辑器灰框分别由对应版式和宿主负责。
    if (template.border) rect(unit * 0.003, unit * 0.003, w - unit * 0.006, h - unit * 0.006,
      'none', template.border, unit * 0.002);

    var title = value(fields, 'title');
    var subtitle = value(fields, 'subtitle');
    var body = value(fields, 'body');
    var footer = value(fields, 'footer');
    var code = value(fields, 'code');
    var direction = props.direction || 'up';
    var iconId = template.icon;

    function guide() {
      var composition = global.SignComposition;
      var parts = composition.horizontalParts(template, props);
      if (parts) {
        Array.prototype.push.apply(commands, composition.layoutParts(parts, h, measure,
          { x: 0, y: 0, w: w, h: h }).commands);
        return;
      }
      var bh = h - 2 * margin;
      var arrowSize = Math.min(bh * 0.75, w * 0.13);
      var x = margin;
      var isDoorhead = /doorhead|door-head|lintel|entrance-header|门楣/.test(kind) && !/doorhead-exit|exit-doorhead/.test(kind);
      var isExit = /exit/.test(kind) && !/emergency/.test(kind);
      if (/four-sided/.test(kind)) {
        function sideText(input) { return typeof input === 'string' ? input : ''; }
        function sideEnglish(label) { return /^\d+(?:号线)?$/.test(label) ? 'Line' : /^环(?:线)?$/.test(label) ? 'Loop Line' : ''; }
        var sideRows = Array.isArray(props.fourSidedEntries) ? props.fourSidedEntries.filter(function (entry) { return entry && typeof entry === 'object'; }) :
          String(body || '').split(/\r?\n/).filter(function (row) { return row.trim(); }).map(function (row, index) {
            var cells = row.split('|');
            return { id: 'legacy-' + index, leftZh: cells[0], leftEn: cells[1], line: cells[2], rightZh: cells[3], rightEn: cells[4],
              lineEn: cells[5] === undefined ? value(fields, 'lineEn') || sideEnglish(cells[2] || '') : cells[5] };
          });
        sideRows = sideRows.slice(0, 12);
        if (!sideRows.length) sideRows = [{ id: 'legacy-0', leftZh: title, leftEn: subtitle, line: value(fields, 'line'),
          lineEn: value(fields, 'lineEn'), rightZh: value(fields, 'destination'), rightEn: value(fields, 'destinationEn') }];
        if (props.fourSidedAutoRatio !== false && Math.abs(ratio - naturalRatio) < 0.00000001) {
          var defaultCount = String(catalog.defaultFields(template.id).body || '').split(/\r?\n/).filter(function (row) { return row.trim(); }).length || 1;
          w = h * Core.clamp(naturalRatio * defaultCount / sideRows.length, 0.1, 64);
          commands[0].attrs.width = w;
        }
        commands[0].fourSidedRole = 'background';
        var sideH = h / sideRows.length;
        sideRows.forEach(function (entry, index) {
          var yy = index * sideH;
          var edge = Math.min(sideH * 0.12, w * 0.02), inset = Math.min(sideH * 0.035, w * 0.01);
          var arrowSize = Math.min(sideH * 0.44, w * 0.1), gap = Math.min(sideH * 0.12, w * 0.02);
          var middleW = w * 0.19;
          function mark(start, role) {
            for (var i = start; i < commands.length; i++) {
              commands[i].fourSidedEntryId = sideText(entry.id) || 'legacy-' + index;
              commands[i].fourSidedRole = role === 'line' ? 'line-' + (i - start) : role;
            }
          }
          var start = commands.length;
          rect(inset, yy + inset, w - 2 * inset, sideH - 2 * inset, 'none', '#808080', sideH * 0.004);
          mark(start, 'frame'); start = commands.length;
          arrow({ x: edge, y: yy + (sideH - arrowSize) / 2, w: arrowSize, h: arrowSize }, 'left', ink);
          mark(start, 'left-arrow'); start = commands.length;
          arrow({ x: w - edge - arrowSize, y: yy + (sideH - arrowSize) / 2, w: arrowSize, h: arrowSize }, 'right', ink);
          mark(start, 'right-arrow'); start = commands.length;
          var routeLabel = sideText(entry.line), routeEn = sideText(entry.lineEn);
          lineMark(routeLabel, routeEn, { x: (w - middleW) / 2, y: yy + sideH * 0.12, w: middleW, h: sideH * 0.7 });
          mark(start, 'line'); start = commands.length;
          var directionX = edge + arrowSize + gap;
          var directionWidth = Math.max(0, (w - middleW) / 2 - directionX - gap);
          bilingual(sideText(entry.leftZh), sideText(entry.leftEn), { x: directionX, y: yy + sideH * 0.15,
            w: directionWidth, h: sideH * 0.68 }, sideH * 0.37, ink, 'center', false);
          mark(start, 'left-direction'); start = commands.length;
          bilingual(sideText(entry.rightZh), sideText(entry.rightEn), { x: (w + middleW) / 2 + gap, y: yy + sideH * 0.15,
            w: directionWidth, h: sideH * 0.68 }, sideH * 0.37, ink, 'center', false);
          mark(start, 'right-direction');
        });
        return;
      }
      if (/transfer-column/.test(kind)) { transfer(); return; }
      if (/transfer-portrait/.test(kind)) {
        var doorwayLines = value(fields, 'line').split(/[\/、,，;；\r\n]+/).map(function (label) { return label.trim(); }).filter(Boolean);
        var horizontalDoorway = template.id === 'transfer-doorhead';
        var multipleDoorway = template.id === 'transfer-doorpost-multiline' || doorwayLines.length > 1;
        bg = props.backgroundColor || (multipleDoorway ? '#FFFFFF' : doorwayTint(accent));
        ink = props.textColor || Core.contrastTextColor(bg);
        commands[0].attrs.fill = bg;
        var numericDoorway = doorwayLines.every(function (label) { return /^\d+$/.test(doorwayLabel(label)); });
        var unitZh = value(fields, 'labelZh') || (numericDoorway ? '号线' : '线'), unitEn = value(fields, 'lineEn', 'Line');
        if (horizontalDoorway) {
          var zhSize = h * 0.44, enSize = h * 0.275, pad = Math.min(h * 0.16, w * 0.08), gap = h * 0.18;
          function stackWidth(zh, en) {
            return Math.max(textInk(zh, Core.FONT_ZH, 400, zhSize).width,
              textInk(en, Core.FONT_EN, 400, enSize).width);
          }
          var titleWidth = stackWidth(title, subtitle), unitWidth = stackWidth(unitZh, unitEn);
          var blockWidth = h * 0.85, count = doorwayLines.length;
          var naturalWidth = titleWidth + unitWidth + 2 * gap + count * blockWidth + Math.max(0, count - 1) * gap * 0.2;
          var fit = Math.min(1, (w - 2 * pad) / Math.max(naturalWidth, 0.001));
          var cursor = (w - naturalWidth * fit) / 2;
          doorwayStack(title, subtitle, { x: cursor, y: 0, w: titleWidth * fit, h: h }, zhSize * fit, enSize * fit, ink);
          cursor += (titleWidth + gap) * fit;
          doorwayLines.forEach(function (label, index) {
            doorwayBadge(label, index, { x: cursor, y: 0, w: blockWidth * fit, h: h });
            cursor += (blockWidth + gap * 0.2) * fit;
          });
          if (count) cursor -= gap * 0.2 * fit;
          cursor += gap * fit;
          doorwayStack(unitZh, unitEn, { x: cursor, y: 0, w: unitWidth * fit, h: h }, zhSize * fit, enSize * fit, ink);
        } else {
          var mm = Math.min(w / 600, h / 2320), headSize = 260 * mm;
          arrow({ x: (w - headSize) / 2, y: 160 * mm, w: headSize, h: headSize }, direction, ink);
          doorwayStack(title, subtitle, { x: w * 0.1, y: 515 * mm, w: w * 0.8, h: 240 * mm },
            359 * 25.4 / 72 * mm, 230 * 25.4 / 72 * mm, ink);
          var badgeTop = 850 * mm, labelHeight = 230 * mm;
          var available = Math.max(1, h - badgeTop - labelHeight - 110 * mm);
          var separator = Math.min(10 * mm, available / (4 * Math.max(1, doorwayLines.length - 1)));
          var badgeHeight = Math.min(420 * mm, (available - separator * Math.max(0, doorwayLines.length - 1)) / Math.max(1, doorwayLines.length));
          doorwayLines.forEach(function (label, index) {
            doorwayBadge(label, index, { x: 0, y: badgeTop + index * (badgeHeight + separator), w: w, h: badgeHeight });
          });
          var labelTop = badgeTop + doorwayLines.length * badgeHeight + Math.max(0, doorwayLines.length - 1) * separator + 30 * mm;
          doorwayStack(unitZh, unitEn, { x: w * 0.1, y: labelTop, w: w * 0.8, h: labelHeight },
            359 * 25.4 / 72 * mm, 230 * 25.4 / 72 * mm, ink);
        }
        return;
      }
      if (/direction-split/.test(kind)) {
        // 正文图4.1.10-1与-2是两种布局，不共用中央线路徽块。
        // 字号以pt换算；320为图-1内容高度，图-2仅沿用编辑参考高度。
        var mm = Math.min(h / 320, w / 1800);
        var pt = mm * 25.4 / 72;
        var leftZh = value(fields, 'leftTitle', title);
        var rightZh = value(fields, 'rightTitle', value(fields, 'destination', body));
        var leftEn = value(fields, 'leftSubtitle', subtitle);
        var rightEn = value(fields, 'rightSubtitle', value(fields, 'destinationEn', footer));
        function directionStack(zh, en, box, zhPt, enPt, color, align) {
          var runs = [{ content: zh, family: Core.FONT_ZH, size: zhPt * pt },
            { content: en, family: Core.FONT_EN, size: enPt * pt }].filter(function (run) { return run.content; });
          if (!runs.length || box.w <= 0 || box.h <= 0) return;
          var gap = runs.length > 1 ? 8 * mm : 0;
          var total = gap, maxWidth = 0;
          runs.forEach(function (run) {
            run.bounds = textInk(run.content, run.family, 400, run.size);
            total += run.bounds.height;
            maxWidth = Math.max(maxWidth, run.bounds.width);
          });
          var scale = Math.min(1, box.w / Math.max(maxWidth, .001), box.h / Math.max(total, .001));
          var yy = box.y + (box.h - total * scale) / 2;
          runs.forEach(function (run) {
            var hh = run.bounds.height * scale;
            text(run.content, { x: box.x, y: yy, w: box.w, h: hh }, run.size * scale,
              color, run.family, 400, align);
            yy += hh + gap * scale;
          });
        }
        if (template.id === 'platform-direction-split') {
          var centerW = 400 * mm, sideW = (w - centerW) / 2;
          var edge = 80 * mm, arrowW = 200 * mm, gap = 60 * mm;
          arrow({ x: edge, y: (h - arrowW) / 2, w: arrowW, h: arrowW }, 'left', ink);
          arrow({ x: w - edge - arrowW, y: (h - arrowW) / 2, w: arrowW, h: arrowW }, 'right', ink);
          var directionX = edge + arrowW + gap;
          var directionW = sideW - directionX - gap;
          directionStack(leftZh, leftEn, { x: directionX, y: 0, w: directionW, h: h }, 280, 175, ink, 'left');
          directionStack(rightZh, rightEn, { x: sideW + centerW + gap, y: 0, w: directionW, h: h }, 280, 175, ink, 'right');
          rect(sideW, 0, centerW, h, '#FFFFFF');
          var lineLabel = value(fields, 'line', code);
          text(lineLabel, { x: sideW + 35 * mm, y: 0, w: centerW - 70 * mm, h: h },
            790 * pt, '#000000', /^\d+$/.test(lineLabel) ? Core.FONT_NUM : Core.FONT_ZH, 400, 'center');
        } else {
          var lineLabels = value(fields, 'line').split('/');
          var lineNames = value(fields, 'lineEn').split('/');
          var edge = 80 * mm, arrowW = 170 * mm, gap = 60 * mm;
          // 线名也拆成基础文字和色条，保留PDF主字/标签的字号层次。
          function directionLine(label, english) {
            label = String(label || '').trim();
            var numeric = /^\d+(?:号线)?$/.test(label);
            var main = label.replace(numeric ? /号线$/ : /线$/, '');
            var suffix = numeric ? '号线' : '线';
            var mainFont = numeric ? Core.FONT_NUM : Core.FONT_ZH;
            var mainSize = (numeric ? 694 : 536) * pt;
            var mainBounds = textInk(main, mainFont, 400, mainSize);
            var en = String(english || (numeric ? 'Line ' + main : '')).trim();
            var tagW = Math.max(textInk(suffix, Core.FONT_ZH, 400, 240 * pt).width,
              textInk(en, Core.FONT_EN, 400, 152 * pt).width);
            var width = 85 * mm + gap + mainBounds.width + gap + tagW;
            var scale = Math.min(1, w * .22 / Math.max(width, .001));
            return { width: width * scale, draw: function (x) {
              var step = mm * scale;
              var localProps = Object.assign({}, props, { fields: { line: label } });
              var stripe = global.SignComposition.primaryColor(template, localProps);
              // 图-2两条色带都在所属线号之前，不随右侧位置镜像。
              rect(x, h * .31, 85 * step, h * .69, stripe);
              var mainX = x + (85 + 60) * step;
              text(main, { x: mainX, y: h * .31, w: mainBounds.width * scale, h: h * .66 },
                mainSize * scale, ink, mainFont, 400, 'left');
              directionStack(suffix, en, { x: mainX + mainBounds.width * scale + 60 * step,
                y: h * .31, w: tagW * scale, h: h * .64 }, 240 * scale, 152 * scale, ink, 'left');
            } };
          }
          var leftLine = directionLine(lineLabels[0], lineNames[0]);
          var rightLine = directionLine(lineLabels[1] || lineLabels[0], lineNames[1] || lineNames[0]);
          var lineX = edge + arrowW + gap;
          var rightLineX = w - edge - arrowW - gap - rightLine.width;
          arrow({ x: edge, y: h * .31, w: arrowW, h: arrowW }, 'left', ink);
          arrow({ x: w - edge - arrowW, y: h * .31, w: arrowW, h: arrowW }, 'right', ink);
          leftLine.draw(lineX); rightLine.draw(rightLineX);
          var leftX = lineX + leftLine.width + gap;
          var middleGap = 60 * mm;
          var rightEnd = rightLineX - gap;
          var leftBox = { x: leftX, y: h * .37, w: w / 2 - middleGap / 2 - leftX, h: h * .57 };
          var rightBox = { x: w / 2 + middleGap / 2, y: h * .37,
            w: rightEnd - w / 2 - middleGap / 2, h: h * .57 };
          directionStack(leftZh, leftEn, leftBox, 240, 152, ink, 'left');
          directionStack(rightZh, rightEn, rightBox, 240, 152, ink, 'right');
          directionStack(value(fields, 'leftQualifier'), value(fields, 'leftQualifierEn'),
            { x: leftBox.x, y: h * .045, w: leftBox.w, h: h * .29 }, 115, 71, ink, 'left');
          directionStack(value(fields, 'rightQualifier'), value(fields, 'rightQualifierEn'),
            { x: rightBox.x, y: h * .045, w: rightBox.w, h: h * .29 }, 115, 71, ink, 'right');
        }
        return;
      }
      if (/doorhead-exit|exit-doorhead/.test(kind)) {
        bilingual(title || '出口', subtitle || 'Exit', { x: margin, y: margin, w: w * 0.35, h: bh }, h * 0.5, ink, 'center', false);
        text(code, { x: w * 0.42, y: margin, w: w * 0.35, h: bh }, h * 0.85, ink, Core.FONT_NUM, 400, 'center');
        if (iconId) symbol(iconId, { x: w - margin - bh * 0.7, y: h * 0.2, w: bh * 0.7, h: bh * 0.7 }, ink);
        return;
      }
      if (isDoorhead) {
        var doorIconSize = Math.min(bh * 0.8, w * 0.16);
        symbol(iconId || 'monorail', { x: x, y: (h - doorIconSize) / 2, w: doorIconSize, h: doorIconSize }, ink);
        x += doorIconSize + margin;
        var badgeW = Math.min(bh * 2, w * 0.23);
        lineMark(value(fields, 'line', '3'), value(fields, 'lineEn', 'Line 3'),
          { x: x, y: margin + bh * 0.12, w: badgeW, h: bh * 0.76 });
        x += badgeW + bh * 0.2;
        var codeW = Math.min(w * 0.28, bh * 2.4);
        bilingual(title, subtitle, { x: x, y: margin + bh * 0.06, w: Math.max(1, w - x - codeW - margin), h: bh * 0.88 },
          bh * 0.62, ink, 'center', false);
        if (code) bilingual(code, value(fields, 'codeEn', footer || '出入口 Entrance'),
          { x: w - codeW - margin, y: margin, w: codeW, h: bh }, bh * 0.75, ink, 'center', false);
        return;
      }
      var arrowRight = direction === 'right' || direction === 'right-up' || direction === 'right-down';
      if (!arrowRight) {
        arrow({ x: x, y: (h - arrowSize) / 2, w: arrowSize, h: arrowSize }, direction, ink);
        x += arrowSize + margin * 0.65;
      }
      var availableEnd = w - margin - (arrowRight ? arrowSize + margin * 0.65 : 0);
      if (iconId) {
        var is = Math.min(bh * 0.72, (availableEnd - x) * 0.19);
        symbol(iconId, { x: x, y: (h - is) / 2, w: is, h: is }, ink);
        x += is + margin * 0.7;
      }
      if (code) {
        var codeW2 = Math.min(bh * 1.45, (availableEnd - x) * 0.25);
        text(code, { x: x, y: margin, w: codeW2, h: bh }, bh * 1.02, ink, Core.FONT_NUM, 400, 'center');
        x += codeW2 + margin * 0.4;
      }
      var lineText = value(fields, 'line');
      if (lineText) {
        var markW = title ? Math.min(bh * (lineText.indexOf('/') !== -1 ? 3.2 : 2.1), (availableEnd - x) * 0.42) : availableEnd - x;
        lineMark(lineText, value(fields, 'lineEn'), { x: availableEnd - markW, y: margin, w: markW, h: bh });
        availableEnd -= markW + margin * 0.4;
      }
      var dest = value(fields, 'destination'), destEn = value(fields, 'destinationEn');
      if (dest) {
        bilingual(title, subtitle || value(fields, 'lineEn'),
          { x: x, y: margin + bh * 0.02, w: availableEnd - x, h: bh * 0.55 }, bh * 0.43, ink, 'left', false);
        bilingual(dest, destEn, { x: x, y: margin + bh * 0.64, w: availableEnd - x, h: bh * 0.34 },
          bh * 0.25, ink, 'left', false);
      } else bilingual(title || (isExit ? '出口' : lineText), subtitle || value(fields, 'lineEn'),
        { x: x, y: margin, w: availableEnd - x, h: bh }, bh * 0.64, ink, 'left', false);
      if (arrowRight) arrow({ x: w - margin - arrowSize, y: (h - arrowSize) / 2, w: arrowSize, h: arrowSize }, direction, ink);
      if (footer) text(footer, { x: x, y: h * 0.89, w: availableEnd - x, h: h * 0.06 }, h * 0.045, ink);
    }

    function station() {
      if (/entrance-identity/.test(kind)) {
        var splitX = w * 0.35;
        text(code, { x: margin, y: h * 0.08, w: splitX - margin * 1.5, h: h * 0.61 }, h * 0.7, ink, Core.FONT_NUM, 400, 'center');
        bilingual('出入口', value(fields, 'codeEn', 'Entrance / Exit'),
          { x: margin, y: h * 0.73, w: splitX - margin * 1.5, h: h * 0.2 }, h * 0.13, ink, 'center', false);
        line(splitX, h * 0.1, splitX, h * 0.9, ink, unit * 0.003);
        bilingual(title, subtitle, { x: splitX + margin, y: h * 0.08, w: w - splitX - 2 * margin, h: h * 0.42 }, h * 0.32, ink, 'left', false);
        lineMark(value(fields, 'line'), value(fields, 'lineEn'),
          { x: splitX + margin, y: h * 0.56, w: w - splitX - 2 * margin, h: h * 0.34 });
        return;
      }
      if (h > w * 1.7) {
        var top = margin;
        if (/station-name-vertical|station-vertical/.test(kind)) {
          stationBadge(w / 2, w * 0.55, w * 0.4, value(fields, 'line'), code);
          top = w * 1.15;
        } else if (iconId) {
          symbol(iconId, { x: margin, y: top, w: w - 2 * margin, h: w * 0.7 }, ink);
          top += w * 0.78;
        }
        if (value(fields, 'line') && !/station-name-vertical|station-vertical/.test(kind)) {
          lineBadge(value(fields, 'line'), margin, top, w * 0.35, w - 2 * margin); top += w * 0.43;
        }
        var zh = Array.from(title);
        var zhH = Math.max(0, h - top - margin - w * 0.6);
        var step = Math.min(w * 0.7, zhH / Math.max(zh.length, 1));
        zh.forEach(function (character, index) {
          text(character, { x: margin, y: top + index * step, w: w - 2 * margin, h: step },
            w * 0.68, ink, font, 700, 'center');
        });
        text(subtitle, { x: margin, y: top + zhH, w: w - 2 * margin, h: w * 0.4 }, w * 0.18, ink, Core.FONT_EN, 400, 'center');
        return;
      }
      if (h > w) {
        // 图 4.4.11-2：顶端细色条、站名、下方大色块和跨界站号章。
        rect(0, 0, w, h * 0.018, accent);
        rect(0, h * 0.76, w, h * 0.24, accent);
        bilingual(title, subtitle, { x: margin, y: h * 0.3, w: w - 2 * margin, h: h * 0.29 },
          w * 0.25, ink, 'center', false);
        stationBadge(w / 2, h * 0.76, Math.min(w * 0.16, h * 0.12), value(fields, 'line'), code);
        return;
      }
      var logoWidth = iconId ? Math.min(h * 0.85, w * 0.27) : 0;
      if (iconId) symbol(iconId, { x: margin, y: (h - logoWidth) / 2, w: logoWidth, h: logoWidth }, ink);
      var tx = margin + logoWidth + (logoWidth ? margin : 0);
      var rightWidth = code ? Math.min(h * 0.85, w * 0.23) : 0;
      var lineText = value(fields, 'line');
      if (lineText) {
        var badgeHeight = h * 0.19;
        lineBadge(lineText, tx, margin, badgeHeight, Math.min(w * 0.25, h * 1.2));
      }
      bilingual(title, subtitle, { x: tx, y: lineText ? h * 0.32 : margin,
        w: w - tx - margin - rightWidth, h: lineText ? h * 0.55 : h - 2 * margin }, h * 0.54, ink, 'center', false);
      if (code) bilingual(code, value(fields, 'codeEn', '出入口'),
        { x: w - margin - rightWidth, y: margin, w: rightWidth, h: h - 2 * margin }, h * 0.7, ink, 'center', false);
    }

    function facility() {
      var composition = global.SignComposition;
      var parts = composition.horizontalParts(template, props);
      if (parts) {
        Array.prototype.push.apply(commands, composition.layoutParts(parts, h, measure,
          { x: 0, y: 0, w: w, h: h }).commands);
        return;
      }
      var isFire = /fire|hydrant|extinguisher|alarm|gas-control|gas_controller/.test(kind) || template.group === '消防疏散';
      var horizontal = w >= h * 1.45;
      var arrowW = isFire ? Math.min(h * 0.5, w * 0.17) : 0;
      if (/security-portrait/.test(kind)) {
        var securityIcon = w * 0.8;
        symbol(iconId, { x: (w - securityIcon) / 2, y: h * 0.05, w: securityIcon, h: securityIcon }, ink);
        var securityChars = Array.from(title);
        var securityStep = Math.min(w * 0.74, h * 0.57 / Math.max(securityChars.length, 1));
        securityChars.forEach(function (ch, index) {
          text(ch, { x: margin, y: h * 0.32 + index * securityStep, w: w - 2 * margin, h: securityStep },
            w * 0.55, ink, font, 700, 'center');
        });
        text(subtitle, { x: margin, y: h * 0.92, w: w - 2 * margin, h: h * 0.045 }, w * 0.12, ink, Core.FONT_EN, 400, 'center');
        return;
      }
      if (horizontal) {
        var is = Math.min(h * 0.72, w * 0.23);
        var x = margin;
        if (iconId) { symbol(iconId, { x: x, y: (h - is) / 2, w: is, h: is }, ink); x += is + margin; }
        bilingual(title, subtitle, { x: x, y: margin, w: w - x - margin - arrowW, h: h - 2 * margin }, h * 0.48, ink, 'left', false);
        if (arrowW) {
          line(w - arrowW - margin * 0.4, margin * 0.7, w - arrowW - margin * 0.4, h - margin * 0.7, ink, unit * 0.006);
          arrow({ x: w - arrowW, y: h * 0.25, w: arrowW - margin * 0.5, h: h * 0.5 }, direction, ink);
        }
      } else {
        var ih = Math.min(w * 0.8, h * 0.61);
        if (iconId) symbol(iconId, { x: (w - ih) / 2, y: margin, w: ih, h: ih }, ink);
        bilingual(title, subtitle, { x: margin, y: iconId ? margin + ih + h * 0.02 : h * 0.2,
          w: w - 2 * margin, h: iconId ? h - ih - 2 * margin - h * 0.02 : h * 0.6 },
          Math.min(w * 0.19, h * 0.2), ink, 'center', false);
      }
    }

    function table(bodyText, box, opts) {
      var rows = String(bodyText || '').split(/\r?\n/).filter(function (row) { return row.trim(); });
      var cells = rows.map(function (row) { return row.split('|'); });
      var cols = cells.reduce(function (max, row) { return Math.max(max, row.length); }, 1);
      var rowH = box.h / Math.max(cells.length, 1);
      cells.forEach(function (row, ri) {
        var header = opts && opts.header && ri === 0;
        rect(box.x, box.y + ri * rowH, box.w, rowH, header ? accent : (ri % 2 ? '#EFEFEF' : '#FFFFFF'));
        for (var ci = 0; ci < cols; ci++) {
          var cellX = box.x + ci * box.w / cols;
          if (ci) line(cellX, box.y + ri * rowH, cellX, box.y + (ri + 1) * rowH, '#BBBBBB', unit * 0.001);
          text(row[ci] || '', { x: cellX + rowH * 0.1, y: box.y + ri * rowH + rowH * 0.1,
            w: box.w / cols - rowH * 0.2, h: rowH * 0.8 }, Math.min(rowH * 0.48, unit * 0.055),
            header ? Core.contrastTextColor(accent) : '#222222', font, header ? 700 : 400, 'center');
        }
      });
    }

    function hourlyTable(bodyText, box) {
      var data = String(bodyText || '').split(/\r?\n/).filter(function (row) { return row.trim(); })
        .map(function (row) { return row.split('|'); });
      var headings = ['小时', '平日时刻表', '双休日时刻表'];
      if (data.length && /小时|时段|hour/i.test(data[0][0])) headings = data.shift();
      var headerH = Math.min(box.h * 0.13, unit * 0.09);
      var hourW = box.w * 0.1;
      var sideW = (box.w - hourW) / 2;
      rect(box.x, box.y, box.w, headerH, '#B7B7B7');
      text(headings[1] || '平日时刻表', { x: box.x + unit * 0.015, y: box.y + headerH * 0.14,
        w: sideW - unit * 0.03, h: headerH * 0.72 }, headerH * 0.48, '#FFFFFF', font, 400, 'center');
      text(headings[2] || '双休日时刻表', { x: box.x + sideW + hourW + unit * 0.015, y: box.y + headerH * 0.14,
        w: sideW - unit * 0.03, h: headerH * 0.72 }, headerH * 0.48, '#FFFFFF', font, 400, 'center');
      rect(box.x + sideW, box.y, hourW, box.h, '#111111');
      text(headings[0], { x: box.x + sideW, y: box.y + headerH * 0.1, w: hourW, h: headerH * 0.8 },
        headerH * 0.43, '#FFFFFF', font, 400, 'center');
      var slotH = (box.h - headerH) / Math.max(data.length, 1);
      data.forEach(function (entry, index) {
        var yy = box.y + headerH + index * slotH;
        rect(box.x, yy, sideW, slotH, index % 2 ? '#FFFFFF' : '#EEEEEE');
        rect(box.x + sideW + hourW, yy, sideW, slotH, index % 2 ? '#FFFFFF' : '#EEEEEE');
        text(entry[0] || '', { x: box.x + sideW + hourW * 0.08, y: yy + slotH * 0.12,
          w: hourW * 0.84, h: slotH * 0.76 }, Math.min(unit * 0.043, slotH * 0.54), '#FFFFFF', Core.FONT_NUM, 400, 'center');
        text(entry[1] || '', { x: box.x + unit * 0.02, y: yy + slotH * 0.15,
          w: sideW - unit * 0.04, h: slotH * 0.7 }, Math.min(unit * 0.038, slotH * 0.5), '#111111', Core.FONT_NUM, 400, 'right');
        text(entry[2] || '', { x: box.x + sideW + hourW + unit * 0.02, y: yy + slotH * 0.15,
          w: sideW - unit * 0.04, h: slotH * 0.7 }, Math.min(unit * 0.038, slotH * 0.5), '#111111', Core.FONT_NUM, 400, 'left');
      });
    }

    function map(box) {
      // 编辑器内的示意图：街道、轨道、站点、出口均为可导出的 SVG 几何。
      var mapLabelH = Math.min(unit * 0.06, box.h * 0.15);
      text(value(fields, 'schematicLabel', '示意图 / Schematic'),
        { x: box.x, y: box.y, w: box.w, h: mapLabelH }, mapLabelH * 0.62, '#555555', font, 400, 'center');
      box = { x: box.x, y: box.y + mapLabelH * 1.25, w: box.w, h: box.h - mapLabelH * 1.25 };
      if (/evacuation/.test(kind)) { evacuation(box); return; }
      rect(box.x, box.y, box.w, box.h, '#F3F2EB', '#A4A4A4', unit * 0.002);
      var streetColor = '#FFFFFF';
      [0.22, 0.5, 0.78].forEach(function (fraction) {
        var yy = box.y + box.h * fraction;
        line(box.x, yy, box.x + box.w, yy, '#CCCCCC', box.h * 0.065);
        line(box.x, yy, box.x + box.w, yy, streetColor, box.h * 0.052);
      });
      [0.2, 0.52, 0.8].forEach(function (fraction) {
        var xx = box.x + box.w * fraction;
        line(xx, box.y, xx, box.y + box.h, '#CCCCCC', box.w * 0.065);
        line(xx, box.y, xx, box.y + box.h, streetColor, box.w * 0.052);
      });
      line(box.x + box.w * 0.12, box.y + box.h * 0.67, box.x + box.w * 0.88, box.y + box.h * 0.32, accent, unit * 0.018);
      var labels = stationRows(value(fields, 'stations'));
      if (!labels.length) labels = [{ zh: value(fields, 'mapStation', '本站'), en: '', code: '' }];
      labels.slice(0, 12).forEach(function (station, index) {
        var fraction = labels.length === 1 ? 0.5 : index / (Math.min(labels.length, 12) - 1);
        var cx = box.x + box.w * (0.16 + fraction * 0.68), cy = box.y + box.h * (0.65 - fraction * 0.3);
        circle(cx, cy, unit * 0.015, '#FFFFFF', accent, unit * 0.007);
        text(station.zh, { x: cx - box.w * 0.14, y: cy - unit * 0.08, w: box.w * 0.28, h: unit * 0.045 },
          unit * 0.035, '#333333', font, 400, 'center');
      });
      arrow({ x: box.x + box.w - unit * 0.08, y: box.y + unit * 0.02, w: unit * 0.05, h: unit * 0.06 }, 'up', '#333333');
      text('N', { x: box.x + box.w - unit * 0.075, y: box.y + unit * 0.09, w: unit * 0.04, h: unit * 0.035 },
        unit * 0.03, '#333333', Core.FONT_EN, 700, 'center');
    }

    function evacuation(box) {
      rect(box.x, box.y, box.w, box.h, '#FFFFFF', '#666666', unit * 0.004);
      // 上下房间之间保留中央疏散通道，避免把街区地图冒充疏散平面图。
      for (var room = 0; room < 5; room++) {
        var roomX = box.x + box.w * (0.03 + room * 0.19);
        rect(roomX, box.y + box.h * 0.06, box.w * 0.16, box.h * 0.27, '#F1F1F1', '#888888', unit * 0.002);
        rect(roomX, box.y + box.h * 0.68, box.w * 0.16, box.h * 0.26, '#F1F1F1', '#888888', unit * 0.002);
      }
      var middleY = box.y + box.h * 0.5;
      var currentX = box.x + box.w * 0.53;
      line(box.x + box.w * 0.1, middleY, box.x + box.w * 0.9, middleY, '#00843D', unit * 0.016);
      arrow({ x: box.x + box.w * 0.12, y: middleY - unit * 0.04, w: unit * 0.08, h: unit * 0.08 }, 'left', '#00843D');
      arrow({ x: box.x + box.w * 0.8, y: middleY - unit * 0.04, w: unit * 0.08, h: unit * 0.08 }, 'right', '#00843D');
      circle(currentX, middleY, unit * 0.018, '#C8102E', '#FFFFFF', unit * 0.004);
      var evacuationLabels = String(body || '').split(/\r?\n/);
      text(evacuationLabels[0] || '当前位置', { x: currentX - box.w * 0.14, y: middleY + unit * 0.045,
        w: box.w * 0.28, h: unit * 0.045 }, unit * 0.032, '#C8102E', font, 700, 'center');
      [0.01, 0.89].forEach(function (fraction) {
        var ex = box.x + box.w * fraction;
        rect(ex, middleY - unit * 0.052, box.w * 0.1, unit * 0.104, '#00843D');
        symbol('emergency_exit', { x: ex + box.w * 0.01, y: middleY - unit * 0.044,
          w: box.w * 0.08, h: unit * 0.08 }, '#FFFFFF');
      });
      text(evacuationLabels[1] || '疏散路线', { x: box.x + box.w * 0.2, y: box.y + box.h * 0.35,
        w: box.w * 0.5, h: unit * 0.045 }, unit * 0.032, '#00843D', font, 400, 'center');
      text(evacuationLabels[2] || '安全出口', { x: box.x + box.w * 0.7, y: box.y + box.h * 0.58,
        w: box.w * 0.27, h: unit * 0.045 }, unit * 0.032, '#00843D', font, 400, 'center');
    }

    function information() {
      var isTable = /timetable|first-last|service-times|首末|时刻/.test(kind);
      var isMap = /map|plan|diagram|schematic|地图|平面/.test(kind);
      var isExit = /exit-information|exit-info|exit-doorpost|出口信息/.test(kind);
      var isTransfer = /transfer|interchange|换乘/.test(kind);
      var isBulletin = /bulletin|announcement|noticeboard|公告/.test(kind);
      if (isTransfer) { transfer(); return; }
      if (/room/.test(variant) && template.id === 'room-name') {
        text(code, { x: margin, y: h * 0.12, w: w - 2 * margin, h: h * 0.4 }, h * 0.42, ink, Core.FONT_NUM, 400, 'center');
        rect(0, h * 0.62, w, h * 0.38, '#333F48');
        text(title, { x: margin, y: h * 0.68, w: w - 2 * margin, h: h * 0.25 }, h * 0.24, '#FFFFFF', font, 400, 'center');
        return;
      }
      if (/gate-indicator/.test(kind)) {
        var gates = String(body || '').split(/\r?\n/).filter(function (row) { return row.trim(); });
        var gateW = (w - 2 * margin) / Math.max(gates.length, 1);
        gates.forEach(function (gate, index) {
          var xx = margin + index * gateW;
          var symbolSize = Math.min(h * 0.46, gateW * 0.55);
          if (/禁止|关闭/.test(gate)) symbol('no_entry', { x: xx + (gateW - symbolSize) / 2, y: h * 0.25, w: symbolSize, h: symbolSize }, '#C8102E');
          else if (/无障碍/.test(gate)) symbol('accessible', { x: xx + (gateW - symbolSize) / 2, y: h * 0.25, w: symbolSize, h: symbolSize }, '#FFFFFF');
          else arrow({ x: xx + (gateW - symbolSize) / 2, y: h * 0.25, w: symbolSize, h: symbolSize }, 'up', '#27C66E');
          text(gate, { x: xx + gateW * 0.08, y: h * 0.75, w: gateW * 0.84, h: h * 0.17 }, h * 0.14, ink, font, 400, 'center');
        });
        text(title, { x: margin, y: h * 0.035, w: w - 2 * margin, h: h * 0.15 }, h * 0.12, ink, font, 400, 'center');
        return;
      }
      var headerH = Math.min(h * (h > w ? 0.14 : 0.2), unit * 0.24);
      if (isExit && code) headerH = Math.min(h * 0.21, w * 0.65);
      rect(0, 0, w, headerH, accent);
      var headerColor = Core.contrastTextColor(accent);
      var headerX = margin;
      if (iconId) {
        symbol(iconId, { x: margin, y: headerH * 0.14, w: headerH * 0.72, h: headerH * 0.72 }, headerColor);
        headerX += headerH * 0.9;
      }
      if (isExit && code) {
        text(code, { x: headerX, y: headerH * 0.08, w: headerH * 0.85, h: headerH * 0.82 },
          headerH * 0.9, headerColor, Core.FONT_NUM, 400, 'center');
        headerX += headerH;
      }
      var informationLine = value(fields, 'line'), informationLineEn = value(fields, 'lineEn');
      var headerTitle = informationLine ? informationLine + (/^\d+$/.test(informationLine) ? '号线 ' : '线 ') + title : title;
      var headerSubtitle = informationLineEn ? informationLineEn + ' · ' + subtitle : subtitle;
      bilingual(headerTitle, headerSubtitle, { x: headerX, y: headerH * 0.12, w: w - headerX - margin, h: headerH * 0.76 },
        headerH * 0.43, headerColor, 'left', false);
      var footerH = footer ? Math.min(h * 0.14, unit * 0.15) : margin;
      var box = { x: margin, y: headerH + margin * 0.75, w: w - 2 * margin,
        h: h - headerH - footerH - margin * 1.5 };
      if (isMap) {
        if (/network-map/.test(kind)) {
          map({ x: box.x, y: box.y, w: box.w, h: box.h * 0.64 });
          var lowerY = box.y + box.h * 0.69;
          rect(box.x, lowerY, box.w * 0.47, box.h * 0.31, '#F8F8F8', '#999999', unit * 0.002);
          rect(box.x + box.w * 0.53, lowerY, box.w * 0.47, box.h * 0.31, '#F8F8F8', '#999999', unit * 0.002);
          var mapLabels = String(body || '').split(/\r?\n/);
          paragraph(mapLabels.slice(1, 3).join('\n'), { x: box.x + margin * 0.3, y: lowerY + margin * 0.3,
            w: box.w * 0.47 - margin * 0.6, h: box.h * 0.31 - margin * 0.6 }, unit * 0.046, ink);
          paragraph(mapLabels.slice(3).join('\n') || '出口信息', { x: box.x + box.w * 0.53 + margin * 0.3, y: lowerY + margin * 0.3,
            w: box.w * 0.47 - margin * 0.6, h: box.h * 0.31 - margin * 0.6 }, unit * 0.046, ink);
        } else if (/street-map/.test(kind)) {
          map({ x: box.x, y: box.y, w: box.w, h: box.h * 0.76 });
          paragraph(body, { x: box.x, y: box.y + box.h * 0.81, w: box.w, h: box.h * 0.19 }, unit * 0.04, ink);
        } else map(box);
      } else if (isTable || body.indexOf('|') !== -1) {
        if (/interconnection-timetable/.test(kind)) {
          hourlyTable(body, box);
        } else if (/first-last-train/.test(kind)) {
          table('线路|方向|首班|末班\n' + body, { x: box.x, y: box.y, w: box.w, h: box.h * 0.55 }, { header: true });
          if (code) text('出入口 ' + code, { x: box.x, y: box.y + box.h * 0.59, w: box.w, h: box.h * 0.07 }, unit * 0.045, ink, font, 400, 'left');
          map({ x: box.x, y: box.y + box.h * 0.69, w: box.w, h: box.h * 0.3 });
        } else table(body, box, { header: true });
      } else if (isExit) {
        var exits = stationRows(body);
        var exitH = box.h / Math.max(exits.length, 1);
        exits.forEach(function (entry, index) {
          if (index) line(box.x, box.y + index * exitH, box.x + box.w, box.y + index * exitH, '#AAAAAA', unit * 0.002);
          bilingual(entry.zh, entry.en, { x: box.x, y: box.y + index * exitH + exitH * 0.12, w: box.w, h: exitH * 0.74 },
            Math.min(unit * 0.11, exitH * 0.45), ink, 'left', false);
        });
      } else {
        if (isBulletin) {
          rect(box.x, box.y, box.w, box.h, 'none', '#888888', unit * 0.003);
          line(box.x + box.w / 2, box.y, box.x + box.w / 2, box.y + box.h, '#888888', unit * 0.003);
          var bulletinRows = String(body || '').split(/\r?\n/);
          var divide = Math.ceil(bulletinRows.length / 2);
          [bulletinRows.slice(0, divide), bulletinRows.slice(divide)].forEach(function (rows, index) {
            paragraph(rows.join('\n'), { x: box.x + index * box.w / 2 + margin * 0.5,
              y: box.y + margin * 0.5, w: box.w / 2 - margin, h: box.h - margin }, unit * 0.065, ink);
          });
          return;
        }
        paragraph(body, box, Math.min(unit * 0.065, box.h * 0.12), ink);
      }
      if (footer) {
        rule(h - footerH);
        paragraph(footer, { x: margin, y: h - footerH + margin * 0.2, w: w - 2 * margin, h: footerH - margin * 0.4 },
          unit * 0.036, ink);
      }
    }

    function transfer() {
      var entries = String(body || '').split(/\r?\n/).filter(function (row) { return row.trim(); });
      if (!entries.length) entries = [title + '|' + subtitle + '|' + value(fields, 'destination') + '|' + value(fields, 'destinationEn')];
      var header = title && entries.length > 1 ? Math.min(unit * 0.17, h * 0.13) : 0;
      if (header) bilingual(title, subtitle, { x: margin, y: margin * 0.6, w: w - 2 * margin, h: header }, header * 0.55, ink, 'left', false);
      var lineFooter = value(fields, 'line') ? Math.min(unit * 0.15, h * 0.12) : 0;
      var slot = (h - 2 * margin - header - lineFooter) / entries.length;
      entries.forEach(function (entry, index) {
        var cells = entry.split('|');
        var top = margin + header + index * slot;
        if (index) line(margin, top, w - margin, top, '#888888', unit * 0.002);
        var arrowSize = Math.min(slot * 0.32, w * 0.15);
        var right = index > 0 || direction.indexOf('right') === 0;
        var arrowX = right ? w - margin - arrowSize : margin;
        arrow({ x: arrowX, y: top + slot * 0.12, w: arrowSize, h: arrowSize }, right ? 'right' : direction, ink);
        var textX = right ? margin : margin + arrowSize + unit * 0.04;
        var textW = w - 2 * margin - arrowSize - unit * 0.07;
        var stripeW = unit * 0.025;
        rect(right ? w - margin - arrowSize - unit * 0.06 : textX, top + slot * 0.12, stripeW, slot * 0.36, accent);
        if (!right) textX += stripeW + unit * 0.02;
        bilingual(cells[0] || title, cells[1] || subtitle, { x: textX, y: top + slot * 0.1, w: textW, h: slot * 0.41 },
          Math.min(unit * 0.105, slot * 0.26), ink, right ? 'right' : 'left', false);
        bilingual(cells[2] || value(fields, 'destination'), cells[3] || value(fields, 'destinationEn'),
          { x: margin, y: top + slot * 0.58, w: w - 2 * margin, h: slot * 0.3 },
          Math.min(unit * 0.074, slot * 0.19), ink, right ? 'right' : 'left', false);
      });
      if (lineFooter) lineMark(value(fields, 'line'), value(fields, 'lineEn'),
        { x: margin, y: h - margin - lineFooter * 0.85, w: w - 2 * margin, h: lineFooter * 0.85 });
    }

    function route() {
      var stations = stationRows(value(fields, 'stations', body));
      var isHorizontal = w > h * 1.8;
      var isDouble = /double|two-way|bidirectional|双向/.test(kind);
      var selected = parseInt(value(fields, 'current'), 10) - 1;
      if (!Number.isFinite(selected)) {
        selected = stations.findIndex(function (station) { return station.zh === title; });
        if (selected < 0) selected = Math.floor(stations.length / 2);
      }
      if (!stations.length) stations = [{ zh: title, en: subtitle, code: code }];
      selected = Core.clamp(selected, 0, stations.length - 1);
      currentStationIndex = selected;
      var routeLine = value(fields, 'line'), routeLineEn = value(fields, 'lineEn');
      var routeTitle = routeLine ? routeLine + (/^\d+$/.test(routeLine) ? '号线 ' : '线 ') + title : title;
      var routeSubtitle = routeLineEn ? routeLineEn + ' · ' + subtitle : subtitle;
      if (isHorizontal) {
        var hasBranch = /branch/.test(kind) && stations.length > 1;
        var routeStations = hasBranch ? stations.slice(0, -1) : stations;
        bilingual(routeTitle, routeSubtitle, { x: margin, y: margin * 0.4, w: w - 2 * margin, h: h * 0.26 },
          h * 0.2, ink, 'center', false);
        var left = margin + h * 0.12, right = w - margin - h * 0.12;
        var trackY = h * (hasBranch ? 0.55 : 0.65);
        line(left, trackY, right, trackY, accent, h * 0.055);
        arrow({ x: right - h * 0.2, y: trackY - h * 0.1, w: h * 0.2, h: h * 0.2 }, 'right', accent);
        routeStations.forEach(function (station, index) {
          var cx = routeStations.length === 1 ? (left + right) / 2 : left + index * (right - left) / (routeStations.length - 1);
          circle(cx, trackY, h * 0.038, index === selected ? accent : '#FFFFFF', accent, h * 0.012);
          var cellW = Math.min((right - left) / Math.max(routeStations.length, 1) * 0.92, h * 1.5, w - 2 * margin);
          var labelX = Math.max(margin, Math.min(cx - cellW / 2, w - margin - cellW));
          bilingual(station.zh, station.en, { x: labelX, y: h * (hasBranch ? 0.27 : 0.35), w: cellW, h: h * 0.22 },
            h * 0.14, ink, 'center', index === selected);
          text(station.code, { x: labelX, y: h * (hasBranch ? 0.63 : 0.75), w: cellW, h: h * 0.12 },
            h * 0.1, ink, Core.FONT_NUM, 400, 'center');
        });
        if (hasBranch) {
          var branch = stations[stations.length - 1];
          var forkX = left + (right - left) * 0.5;
          var endX = left + (right - left) * 0.8;
          add('path', { d: 'M' + forkX + ' ' + trackY + ' L' + (forkX + h * 0.28) + ' ' + (h * 0.86) +
            ' L' + endX + ' ' + (h * 0.86), fill: 'none', stroke: accent, 'stroke-width': h * 0.04 });
          circle(endX, h * 0.86, h * 0.033, selected === stations.length - 1 ? accent : '#FFFFFF', accent, h * 0.012);
          var branchW = Math.min(h * 1.6, w - 2 * margin);
          var branchX = Math.max(margin, Math.min(endX - branchW / 2, w - margin - branchW));
          bilingual(branch.zh, branch.en, { x: branchX, y: h * 0.63, w: branchW, h: h * 0.19 },
            h * 0.12, ink, 'center', false);
        }
      } else {
        var hh = Math.min(w * 0.22, h * 0.12);
        rect(0, 0, w, hh, accent);
        bilingual(routeTitle, routeSubtitle, { x: margin, y: hh * 0.12, w: w - 2 * margin, h: hh * 0.75 },
          hh * 0.48, Core.contrastTextColor(accent), 'center', false);
        var top = hh + margin + unit * 0.08, bottom = h - margin - unit * 0.05;
        var trackX = isDouble ? w * 0.36 : w * 0.3;
        var step = stations.length > 1 ? (bottom - top) / (stations.length - 1) : 0;
        [trackX].concat(isDouble ? [w * 0.65] : []).forEach(function (tx, trackIndex) {
          line(tx, top - unit * 0.03, tx, bottom + unit * 0.03, accent, unit * 0.035);
          stations.forEach(function (station, index) {
            var cy = stations.length === 1 ? (top + bottom) / 2 : top + index * step;
            var active = index === selected;
            if (active) rect(trackIndex === 0 && isDouble ? margin * 0.3 : tx,
              cy - unit * 0.037, isDouble ? w * 0.34 : w - tx - margin * 0.2, unit * 0.074, accent);
            circle(tx, cy, unit * 0.018, '#FFFFFF', accent, unit * 0.006);
            var labelX = isDouble && trackIndex === 0 ? margin * 0.6 : tx + unit * 0.055;
            var labelW = isDouble ? w * 0.26 : w - labelX - margin;
            bilingual(station.zh, station.en, { x: labelX, y: cy - Math.min(unit * 0.035, step * 0.3),
              w: labelW, h: Math.min(unit * 0.073, (step || unit * 0.1) * 0.75) },
              unit * (isDouble ? 0.034 : 0.048), active ? Core.contrastTextColor(accent) : ink,
              isDouble && trackIndex === 0 ? 'right' : 'left', active);
            text(station.code, { x: trackIndex === 0 && isDouble ? tx - unit * 0.065 : tx - unit * 0.06,
              y: cy - unit * 0.018, w: unit * 0.042, h: unit * 0.036 }, unit * 0.03, ink, Core.FONT_NUM, 400, 'center');
          });
        });
        if (isDouble) arrow({ x: w * 0.45, y: (top + bottom) / 2 - unit * 0.06, w: w * 0.1, h: unit * 0.12 }, direction, accent);
        else arrow({ x: margin * 0.6, y: h * 0.45, w: w * 0.13, h: unit * 0.2 }, direction, accent);
      }
      if (footer) text(footer, { x: margin, y: h - margin * 0.65, w: w - 2 * margin, h: margin * 0.5 },
        unit * 0.025, ink);
    }

    function notice() {
      if (variant === 'fire') { facility(); return; }
      var isButton = /stop-button|emergency-button|emergency-stop/.test(kind);
      var isDangerous = /dangerous|dangerous-goods|prohibited-articles/.test(kind);
      var isProtection = /protection|control-area|警示桩/.test(kind);
      var isFireLift = /lift-safety|elevator-safety|fire-elevator|safety-lift|escalator-safety/.test(kind);
      var isWarning = /warning/.test(kind);
      var isEmergency = /emergency-exit|escape-exit/.test(kind);
      if (isButton) {
        var inset = unit * 0.025;
        rect(inset, inset, w - 2 * inset, h - 2 * inset, 'none', ink, unit * 0.006, unit * 0.035);
        var isTallButton = h > w * 1.2;
        bilingual(title, subtitle, { x: margin, y: h * 0.025, w: w - 2 * margin, h: h * (isTallButton ? 0.075 : 0.2) },
          unit * 0.06, ink, 'center', false);
        var holeW = w * 0.584;
        if (isTallButton) rect((w - holeW) / 2, h * 0.12, holeW, h * 0.84, '#FFFFFF', undefined, undefined, holeW / 2);
        else circle(w / 2, h * 0.636, holeW / 2, '#FFFFFF');
        if (body) text(body, { x: margin, y: h * 0.93, w: w - 2 * margin, h: h * 0.04 }, unit * 0.03, ink, font, 400, 'center');
        return;
      }
      if (isProtection) {
        if (h > w * 3) {
          rect(0, 0, w, Math.min(h * 0.03, w * 0.15), '#C62828');
          symbol(iconId || 'crt', { x: margin, y: h * 0.08, w: w - 2 * margin, h: w * 0.45 }, '#00843D');
          arrow({ x: w * 0.22, y: h * 0.22, w: w * 0.55, h: w * 0.45 }, 'down', '#C62828');
          var characters = Array.from(title);
          var postStep = h * 0.49 / Math.max(characters.length, 1);
          characters.forEach(function (ch, i) {
            text(ch, { x: w * 0.15, y: h * 0.43 + i * postStep, w: w * 0.7, h: postStep * 0.94 },
              w * 0.5, ink, font, 700, 'center');
          });
          paragraph(value(fields, 'phone', body || footer), { x: margin, y: h * 0.31, w: w - 2 * margin, h: h * 0.09 }, w * 0.13, ink, font);
        } else {
          symbol(iconId || 'crt', { x: margin, y: h * 0.1, w: w * 0.35, h: h * 0.2 }, ink);
          text(value(fields, 'phone', footer), { x: w * 0.6, y: h * 0.12, w: w * 0.34, h: h * 0.14 }, h * 0.045, ink, Core.FONT_EN, 400, 'center');
          bilingual(title, subtitle, { x: margin, y: h * 0.37, w: w - 2 * margin, h: h * 0.22 }, h * 0.13, ink, 'center', false);
          paragraph(body, { x: margin * 1.5, y: h * 0.67, w: w - 3 * margin, h: h * 0.25 }, h * 0.085, ink);
        }
        return;
      }
      if (isEmergency) {
        var arrowW = Math.min(h * 0.75, w * 0.22);
        arrow({ x: margin, y: (h - arrowW) / 2, w: arrowW, h: arrowW }, direction, ink);
        var iconW = Math.min(h * 0.82, w * 0.22);
        symbol(iconId || 'emergency_exit', { x: margin + arrowW + margin * 0.6, y: (h - iconW) / 2, w: iconW, h: iconW }, ink);
        var tx = margin + arrowW + margin * 0.6 + iconW + margin;
        bilingual(title, subtitle, { x: tx, y: h * 0.2, w: w - tx - margin, h: h * 0.65 }, h * 0.32, ink, 'right', false);
        return;
      }
      if (isFireLift) {
        symbol('fire', { x: margin, y: h * 0.05, w: h * 0.24, h: h * 0.24 }, '#111111');
        bilingual(title, subtitle, { x: margin + h * 0.28, y: h * 0.04, w: w - margin * 2 - h * 0.28, h: h * 0.25 }, h * 0.17, '#111111', 'left', false);
        rule(h * 0.32);
        var liftRows = stationRows(body);
        if (!liftRows.length) liftRows = [{ zh: '禁止使用电梯', en: 'Do not use elevators' }, { zh: '请使用逃生楼梯', en: 'Please use the escape stairs' }];
        var rowH = h * 0.55 / liftRows.length;
        liftRows.forEach(function (entry, index) {
          var yy = h * 0.38 + index * rowH;
          rect(margin, yy, w - 2 * margin, rowH * 0.88, '#007A33', undefined, undefined, h * 0.012);
          symbol(index ? 'stairs_fire' : 'no_elevator', { x: margin * 1.3, y: yy + rowH * 0.05, w: rowH * 0.75, h: rowH * 0.75 }, '#FFFFFF');
          bilingual(entry.zh, entry.en, { x: margin + rowH, y: yy + rowH * 0.07,
            w: w - 2 * margin - rowH - margin * 0.3, h: rowH * 0.72 }, rowH * 0.42, '#FFFFFF', 'left', false);
        });
        return;
      }
      if (isDangerous) {
        var ids = (template.icons || ['danger_balloon', 'danger_radioactive', 'danger_barrel', 'danger_flammable',
          'danger_weapons', 'danger_explosive', 'danger_fireworks', 'danger_toxic']);
        var areaH = h * 0.58, iconSide = Math.min((w - 2 * margin) / 4 * 0.82, areaH / 2 * 0.8);
        ids.forEach(function (id, index) {
          var cx = margin + (w - 2 * margin) * ((index % 4) + 0.5) / 4;
          var yy = margin + Math.floor(index / 4) * areaH / 2;
          symbol(id, { x: cx - iconSide / 2, y: yy, w: iconSide, h: iconSide }, '#111111');
        });
        rect(margin, h * 0.64, w - 2 * margin, h * 0.3, '#C62828');
        bilingual(title, subtitle, { x: margin * 1.4, y: h * 0.66, w: w - margin * 2.8, h: h * 0.11 }, unit * 0.062, '#FFFFFF', 'center', false);
        bilingual(body, footer, { x: margin * 1.4, y: h * 0.79, w: w - margin * 2.8, h: h * 0.12 }, unit * 0.05, '#FFFFFF', 'center', false);
        return;
      }
      // 200×300 禁止/警告牌：内部符号即使为圆/三角形，外牌仍为矩形。
      var iconSize = Math.min(w - 2 * margin, h * 0.59);
      if (iconId) symbol(iconId, { x: (w - iconSize) / 2, y: margin, w: iconSize, h: iconSize }, ink);
      var labelY = iconId ? Math.max(h * 0.66, margin + iconSize + h * 0.03) : h * 0.15;
      var labelH = h - labelY - margin;
      var labelBg = isWarning ? '#FFD100' : (template.labelBackground || '#C62828');
      if (!iconId && body) labelH = h * 0.32;
      rect(margin, labelY, w - 2 * margin, labelH, labelBg);
      bilingual(title, subtitle, { x: margin * 1.25, y: labelY + labelH * 0.1,
        w: w - margin * 2.5, h: labelH * 0.8 }, Math.min(w * 0.17, labelH * 0.46),
        Core.contrastTextColor(labelBg), 'center', false);
      if (!iconId && body) paragraph(body, { x: margin, y: labelY + labelH + h * 0.04,
        w: w - 2 * margin, h: h - labelY - labelH - margin - h * 0.04 }, unit * 0.055, ink);
    }

    var layouts = { guide: guide, station: station, facility: facility,
      information: information, route: route, notice: notice };
    (layouts[template.layout] || information)();
    return { width: w, height: h, templateId: template.id, layout: template.layout,
      viewport: { x: 0, y: 0, width: w, height: h, viewBox: '0 0 ' + w + ' ' + h,
        preserveAspectRatio: 'none', overflow: 'hidden' },
      commands: commands, fields: fields, currentStationIndex: currentStationIndex };
  }

  function draw(group, element, mt) {
    // 用户可把横幅宽高比改得极窄。独立 SVG 视口保证牌面内容不侵入相邻元素；
    // 不使用带 id 的 clipPath，多个模板并排和导出时不会发生引用冲突。
    var viewport = document.createElementNS(NS, 'svg');
    Object.keys(mt.viewport || {}).forEach(function (name) { viewport.setAttribute(name, mt.viewport[name]); });
    group.appendChild(viewport);
    mt.commands.forEach(function (command) {
      if (command.tag === 'element') {
        var child = document.createElementNS(NS, 'g');
        Object.keys(command.attrs).forEach(function (name) {
          var attr = command.attrs[name];
          if (attr !== undefined && attr !== null) child.setAttribute(name, attr);
        });
        global.SignRender.drawMeasuredElement(child, command.element, command.metrics, command.rowHeight);
        viewport.appendChild(child);
        return;
      }
      var node = document.createElementNS(NS, command.tag === 'symbol' ? 'svg' : command.tag);
      Object.keys(command.attrs).forEach(function (name) {
        var attr = command.attrs[name];
        if (attr !== undefined && attr !== null) node.setAttribute(name, attr);
      });
      if (command.text !== undefined) node.textContent = command.text;
      // body 来自仓库内固定符号库，不含用户输入或外部 SVG。
      if (command.body !== undefined) node.innerHTML = command.body;
      viewport.appendChild(node);
    });
  }

  global.SignCRTRender = { metrics: metrics, draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
