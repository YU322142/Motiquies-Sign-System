/** 已有线路/车站生成标识：点击、拖入、单牌选站和批量更换共用同一份配方。 */
(function (global) {
  'use strict';
  var State = global.SignState, Routes = global.SignRoutes, Composition = global.SignComposition;

  function supports(template) {
    return !!template && (template.layout === 'station' || template.layout === 'route' ||
      /transfer|interchange|platform-direction|train-guide|entrance-lintel/.test(template.id));
  }

  function contextFor(input, lines) {
    if (!input || !input.line) return null;
    var line = Routes.forContext(input, lines);
    var context = { line: line, stationId: line.currentStationId };
    if (input.source === 'local' || input.source === 'server') context.source = input.source;
    if (Array.isArray(input.transferLineIds)) context.transferLineIds = input.transferLineIds.filter(function (id, index, ids) {
      return typeof id === 'string' && id !== line.id && ids.indexOf(id) === index;
    });
    return context;
  }

  function build(templateId, input, lines, measure) {
    var template = global.SignCRT.get(templateId), context = contextFor(input, lines);
    var effective = context, targets = null;
    if (context && Array.isArray(context.transferLineIds) && /transfer|interchange/.test(template.id)) {
      targets = context.transferLineIds.map(function (id) { return (lines || []).find(function (line) { return line.id === id; }); }).filter(Boolean);
      var changed = Routes.normalizeLine(context.line);
      changed.stations = changed.stations.map(function (station) {
        return station.id === context.stationId ? Object.assign({}, station, {
          transfers: targets.map(function (line) { return line.nameZh || line.nameEn; }).join(' / '),
        }) : station;
      });
      effective = Object.assign({}, context, { line: Routes.withRelatedLines(changed, lines) });
    }
    var overrides = Composition.contextOverrides(template, effective, lines);
    if (targets) overrides.linePalette = targets.concat(overrides.linePalette || []);
    if (context && template.layout === 'route') overrides.routeLine = context.line;
    var fourSided = template.id === 'four-sided-guide' ? State.createFourSided(overrides) : null;
    if (fourSided) overrides = Object.assign({}, overrides, { fourSidedEntries: fourSided.entries });
    var options = { templateId: template.id, widthRatio: fourSided
      ? fourSided.referenceRowRatio / fourSided.entries.length : template.width / template.height };
    if (overrides.backgroundColor) options.backgroundColor = overrides.backgroundColor;
    if (fourSided) options.fourSided = fourSided;
    if (context && supports(template)) options.stationContext = context;
    if (context && template.layout === 'route') {
      options.route = { line: context.line, orientation: template.width > template.height ? 'horizontal' : 'vertical' };
      if (context.source) options.route.source = context.source;
    }
    return { elements: Composition.materialize(template.id, overrides, measure), options: options, overrides: overrides };
  }

  function canReplace(row) {
    return !!(row && (row.route || row.templateId && supports(global.SignCRT.get(row.templateId))));
  }

  function replaceRow(sign, rowId, input, lines, measure) {
    var row = sign.rows.find(function (item) { return item.id === rowId; });
    if (!canReplace(row)) return sign;
    var context = contextFor(input, lines), result;
    if (!context) return sign;
    if (row.templateId) result = build(row.templateId, context, lines, measure);
    else {
      var materialized = Routes.materialize(context.line, row.route.orientation, measure);
      result = { elements: materialized.elements, options: { widthRatio: materialized.widthRatio,
        route: Object.assign({}, materialized.route, context.source ? { source: context.source } : {}), stationContext: context } };
    }
    var options = Object.assign({}, result.options, { replaceRowId: rowId });
    var next = State.addTemplateRow(sign, rowId, result.elements, options);
    // 保留用户相对参考比例的调整；线路图站点数改变时采用新的参考尺寸。
    var multiplier = row.widthRatio && row.referenceWidthRatio ? row.widthRatio / row.referenceWidthRatio : 1;
    if (multiplier !== 1) next = State.setRowAspectRatio(next, rowId, result.options.widthRatio * multiplier);
    return Object.assign({}, next, { widthMode: sign.widthMode });
  }

  function replaceBoards(sign, boardIds, context, lines, measure) {
    var Workspace = global.SignWorkspace, active = Workspace.list(sign).find(function (board) { return board.active; }).id;
    var next = sign;
    Workspace.list(sign).forEach(function (board) {
      if (boardIds.indexOf(board.id) === -1 || !board.sign.rows.some(canReplace)) return;
      next = Workspace.select(next, board.id);
      board.sign.rows.forEach(function (row) { next = replaceRow(next, row.id, context, lines, measure); });
    });
    return Workspace.select(next, active);
  }

  global.SignContent = { supports: supports, build: build, canReplace: canReplace, replaceRow: replaceRow, replaceBoards: replaceBoards };
})(typeof window !== 'undefined' ? window : globalThis);
