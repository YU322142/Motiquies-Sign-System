/**
 * panel.js — 左栏元素选择区 + 右栏属性/设置面板 + 颜色选择器
 *
 * 右栏三种模式：元素属性（选中元素时）/ 预设预览 / 标识牌设置（默认）。
 * syncRightPanel() 采用签名机制：结构变化才重建 DOM，
 * 否则只做值同步（跳过焦点元素），保证输入过程不掉焦点。
 */
(function (global) {
  'use strict';

  var Core = global.SignCore;
  var State = global.SignState;
  var Render = global.SignRender;
  var Presets = global.SignPresets;
  var UI = global.SignUI;
  var App = global.App;
  var h = UI.h;

  var TYPE_NAMES = {
    'arrow': '箭头',
    'bilingual-text': '双语文本',
    'big-number': '大文本',
    'number-line': '数字线路',
    'text-line': '文本线路',
    'entrance': '出入口',
    'exit': '出口',
    'space': '空白占位',
    'icon': '图标',
    'crt-sign': '重庆矩形标识',
    'plain-text': '单行文字',
    'shape': '基础图形',
  };

  // ─── 左栏：元素选择区 ──────────────────────────────────────

  // 方向指示 = js/icons.js 的 12 种方向图标（替代旧几何箭头元素）；
  // items 项为类型名（字符串）或 { type, icon, name }（预设属性的图标项）。
  var DIRECTION_ICONS = [
    { type: 'icon', icon: 'arrow_up', name: '向上' },
    { type: 'icon', icon: 'arrow_down', name: '向下' },
    { type: 'icon', icon: 'arrow_left', name: '向左' },
    { type: 'icon', icon: 'arrow_right', name: '向右' },
    { type: 'icon', icon: 'arrow_left_up', name: '左上' },
    { type: 'icon', icon: 'arrow_right_up', name: '右上' },
    { type: 'icon', icon: 'arrow_right_down', name: '右下' },
    { type: 'icon', icon: 'arrow_left_down', name: '左下' },
    { type: 'icon', icon: 'arrow_ahead_left', name: '前方向左' },
    { type: 'icon', icon: 'arrow_ahead_right', name: '前方向右' },
    { type: 'icon', icon: 'arrow_back_left', name: '左行向后' },
    { type: 'icon', icon: 'arrow_back_right', name: '右行向后' },
  ];

  var CATEGORIES = [
    { name: '方向指示', items: DIRECTION_ICONS },
    { name: '线路标识', items: ['number-line', 'text-line', 'big-number'] },
    { name: '位置标识', items: ['entrance', 'exit'] },
    { name: '文本', items: ['bilingual-text'] },
    { name: '服务图标', items: [
      { type: 'icon', icon: 'elevator', name: '图标' },
      { type: 'icon', icon: 'customer_service', name: '乘客服务' },
      { type: 'icon', icon: 'lost_found', name: '失物招领' },
      { type: 'icon', icon: 'security_check', name: '安全检查' },
    ] },
    { name: '辅助', items: ['space'] },
    { name: '图形与文字', items: [
      'plain-text',
      { type: 'shape', name: '矩形', props: { shape: 'rect' } },
      { type: 'shape', name: '圆形', props: { shape: 'circle', geometry: { cx: 50, cy: 50, r: 45 } } },
      { type: 'shape', name: '线段', props: { shape: 'line', geometry: { x1: 0, y1: 50, x2: 100, y2: 50 }, fill: null, stroke: '#000000', strokeWidth: 3 } },
    ] },
  ];
  var graphItems = CATEGORIES[CATEGORIES.length - 1].items;
  var SECTION_CATEGORIES = {
    vertical: [
      { name: '站名与文字', items: ['bilingual-text', { type: 'plain-text', name: '站名文字', props: { text: '站名', font: 'zh', bold: true } }] },
      { name: '编号标识', items: ['big-number', 'entrance', 'exit'] },
      { name: '线路信息', items: ['number-line', 'text-line'] },
      { name: '服务设施', items: CATEGORIES[4].items },
      { name: '分区与图形', items: graphItems.slice(1).concat(['space']) },
    ],
    route: [
      { name: '线路标识', items: ['number-line', 'text-line'] },
      { name: '站点与连接', items: [
        { type: 'shape', name: '站点圆点', props: { shape: 'circle', geometry: { cx: 50, cy: 50, r: 40 }, fill: '#FFFFFF', stroke: '#003DA5', strokeWidth: 8 } },
        { type: 'shape', name: '连接线', props: { shape: 'line', geometry: { x1: 0, y1: 50, x2: 100, y2: 50 }, fill: null, stroke: '#003DA5', strokeWidth: 8 } },
      ] },
      { name: '站名与编号', items: ['bilingual-text', { type: 'plain-text', name: '站点文字', props: { text: '站点名称', font: 'zh' } }, 'big-number'] },
      { name: '方向与换乘', items: [DIRECTION_ICONS[0], DIRECTION_ICONS[3], { type: 'icon', icon: 'train', name: '列车' }] },
      { name: '底色与间距', items: [graphItems[1], 'space'] },
    ],
    safety: [
      { name: '禁止标识', items: [
        { type: 'icon', icon: 'no_smoking', name: '禁止吸烟' }, { type: 'icon', icon: 'no_entry', name: '禁止进入' },
        { type: 'icon', icon: 'no_touching', name: '请勿触摸' },
      ] },
      { name: '警告与疏散', items: [
        { type: 'icon', icon: 'warning', name: '注意安全' }, { type: 'icon', icon: 'emergency_exit', name: '紧急出口' },
        { type: 'icon', icon: 'stairs_fire', name: '逃生楼梯' },
      ] },
      { name: '消防设施', items: [
        { type: 'icon', icon: 'extinguisher', name: '灭火器箱' }, { type: 'icon', icon: 'hydrant', name: '消火栓' },
        { type: 'icon', icon: 'alarm_button', name: '报警按钮' },
      ] },
      { name: '提示文字', items: ['bilingual-text', { type: 'plain-text', name: '安全说明', props: { text: '注意安全', font: 'zh', bold: true } }] },
      { name: '底色与边线', items: [graphItems[1], graphItems[3], 'space'] },
    ],
  };
  function categoriesForSection() { return SECTION_CATEGORIES[activeSignSection] || CATEGORIES; }
  var crtQuery = '';
  var crtGroup = '';
  var activeSignSection = 'horizontal';
  var SIGN_SECTIONS = global.SignComposition.SECTIONS;
  var templateCategory = { name: '标识牌', crt: true, items: global.SignCRT
    ? global.SignCRT.ALL.map(function (t) {
      return { type: 'crt-sign', name: t.name, group: t.group, props: { templateId: t.id } };
    }) : [] };

  function itemProps(item) {
    if (typeof item === 'string') return undefined;
    return item.props || { icon: item.icon };
  }

  function filteredItems(cat) {
    if (!cat.crt) return cat.items;
    return cat.items.filter(function (item) {
      return itemSection(item) === activeSignSection && (!crtGroup || item.group === crtGroup) &&
        (!crtQuery || (item.name + ' ' + item.group).toLowerCase().indexOf(crtQuery.toLowerCase()) !== -1);
    });
  }

  function itemSection(item) { return global.SignComposition.sectionFor(global.SignCRT.get(item.props.templateId)); }

  function sectionItems() { return templateCategory.items.filter(function (item) { return itemSection(item) === activeSignSection; }); }

  function addPresetBoard(sign, elements, options) {
    return global.SignWorkspace ? global.SignWorkspace.addPreset(sign, elements, options)
      : State.addTemplateRow(sign, null, elements, options);
  }

  function boardNameForTemplate(template) {
    var context = App.state.context;
    var station = context && context.line.stations.find(function (item) { return item.id === context.stationId; });
    return (station && (station.nameZh || station.nameEn) ? (station.nameZh || station.nameEn) + ' · ' : '') + template.name;
  }

  function refreshCRTCards() {
    var root = document.getElementById('palette');
    var grid = root.querySelector('.crt-grid');
    var cat = templateCategory;
    if (grid) {
      grid.innerHTML = '';
      filteredItems(cat).forEach(function (item) { grid.appendChild(buildItemCard(item)); });
    }
    root.querySelectorAll('.crt-chips .palette-chip').forEach(function (chip) {
      chip.hidden = !!chip.dataset.group && !sectionItems().some(function (item) { return item.group === chip.dataset.group; });
      chip.classList.toggle('active', chip.dataset.group === crtGroup);
      chip.setAttribute('aria-selected', chip.dataset.group === crtGroup ? 'true' : 'false');
    });
    var count = root.querySelector('.crt-result-count');
    if (count) {
      var matches = filteredItems(cat).length;
      count.textContent = matches + ' / ' + sectionItems().length + ' 款组合预设';
      count.parentElement.classList.toggle('no-results', matches === 0);
    }
  }

  function buildCRTToolbar(cat) {
    var search = h('input', { type: 'search', placeholder: '搜索标识，如换乘、安检', 'aria-label': '搜索重庆矩形标识', value: crtQuery });
    search.addEventListener('input', function () { crtQuery = search.value; refreshCRTCards(); });
    var groups = h('div', { class: 'palette-chips crt-chips', role: 'tablist', 'aria-label': '标识牌分类' });
    var names = [''];
    cat.items.forEach(function (item) {
      if (names.indexOf(item.group) === -1) names.push(item.group);
    });
    names.forEach(function (name) {
      var chip = h('button', { class: 'palette-chip' + (crtGroup === name ? ' active' : ''),
        text: name || '全部', role: 'tab', 'data-group': name, 'aria-selected': crtGroup === name ? 'true' : 'false' });
      chip.addEventListener('click', function () { crtGroup = name; refreshCRTCards(); });
      groups.appendChild(chip);
      chip.hidden = !!name && !sectionItems().some(function (item) { return item.group === name; });
    });
    return h('div', { class: 'crt-toolbar' + (filteredItems(cat).length ? '' : ' no-results') }, [search, groups,
      h('div', { class: 'hint-text crt-result-count', role: 'status', text: filteredItems(cat).length + ' / ' + sectionItems().length + ' 款组合预设' }),
    ]);
  }

  function itemTypeOf(item) {
    return typeof item === 'string' ? item : item.type;
  }

  /** 创建选择区条目对应的元素（图标项带 icon 属性） */
  function createElementForItem(item) {
    var type = itemTypeOf(item);
    var props = itemProps(item);
    var context = App.state && App.state.context;
    if (context && type === 'crt-sign' && global.SignComposition.contextOverrides) {
      var template = global.SignCRT.get(props.templateId);
      props = Object.assign({}, props, global.SignComposition.contextOverrides(template, context, routeLinesForContext(context)));
      if (template.layout === 'route') props.routeLine = global.SignRoutes.forContext(context, routeLinesForContext(context));
    } else if (context && global.SignComposition.contextProps) {
      props = global.SignComposition.contextProps(type, props, context);
    }
    return State.createElement(type, props);
  }

  function itemDisplayName(item) {
    return typeof item === 'string' ? TYPE_NAMES[item] : item.name;
  }

  /** 卡片图标用的示例元素（比默认值更有代表性） */
  function sampleElement(type) {
    switch (type) {
      case 'arrow': return State.createElement('arrow', { direction: 'right', padding: { top: 0.12, right: 0.12, bottom: 0.12, left: 0.12 } });
      case 'number-line': return State.createElement('number-line', { lines: [{ number: '3', color: '#FCD600' }] });
      case 'text-line': return State.createElement('text-line', { text: '环' });
      case 'big-number': return State.createElement('big-number', { text: '4' });
      case 'entrance': return State.createElement('entrance', { code: 'C' });
      case 'exit': return State.createElement('exit', { code: '1' });
      case 'bilingual-text': return State.createElement('bilingual-text', { textZh: '站名', textEn: 'Station' });
      default: return State.createElement(type);
    }
  }

  function spaceIcon() {
    var svg = document.createElementNS(Core.SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('height', '36');
    var rect = document.createElementNS(Core.SVG_NS, 'rect');
    rect.setAttribute('x', '4'); rect.setAttribute('y', '4');
    rect.setAttribute('width', '32'); rect.setAttribute('height', '32');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#9aa3af');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(rect);
    return svg;
  }

  /** 拖拽负载：左栏卡片 → 编辑区（HTML5 DnD），MIME 与 interact.js 约定一致 */
  function setDragPayload(ev, payload) {
    var mime = payload.kind === 'preset' ? SignInteract.MIME_PRESET :
      payload.kind === 'template' ? SignInteract.MIME_TEMPLATE || SignInteract.MIME_NEW : SignInteract.MIME_NEW;
    var json = JSON.stringify(payload);
    try {
      ev.dataTransfer.setData(mime, json);
      ev.dataTransfer.setData('text/plain', json);
    } catch (e) { /* 部分浏览器仅支持标准 MIME */ }
    ev.dataTransfer.effectAllowed = 'copy';
  }

  /** 移动端禁用卡片 HTML5 拖拽：触屏长按会唤起原生拖拽会话（卡片置灰、页面卡住收不了场） */
  function cardDraggableAttr() {
    return App.isMobileView && App.isMobileView() ? 'false' : 'true';
  }

  function wireCardDrag(card, payload) {
    card.addEventListener('dragstart', function (ev) {
      if (App.isMobileView && App.isMobileView()) {
        ev.preventDefault(); // 添加只走点击；桌面保持拖入编辑区
        return;
      }
      setDragPayload(ev, payload);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
  }

  var activePaletteTab = 'templates';
  var paletteScrollTops = {};
  /** 移动端当前基础元素分类，跨重建保留。 */
  var activeCategory = 0;
  var categoryBySection = {};
  var categoryScrollBySection = {};

  function buildPalette() {
    var root = document.getElementById('palette');
    var scrollPositions = {};
    root.querySelectorAll('.palette-chips').forEach(function (node) {
      scrollPositions[node.classList.contains('crt-chips') ? 'templates' : 'basic'] = node.scrollLeft;
    });
    var scrollTop = root.scrollTop;
    root.innerHTML = '';
    var sections = h('div', { class: 'sign-section-nav', role: 'tablist', 'aria-label': '标识牌类型' });
    SIGN_SECTIONS.forEach(function (section) {
      var button = h('button', { class: 'sign-section-button', role: 'tab', 'data-sign-section': section.id, text: section.name });
      button.addEventListener('click', function () { selectSignSection(section.id); });
      sections.appendChild(button);
    });
    root.appendChild(sections);
    var contextLine = h('select', { class: 'project-context-line', 'aria-label': '当前线路', 'data-context-line': '' });
    contextLine.addEventListener('change', function () {
      var entry = lineEntries().find(function (item) { return item.key === contextLine.value; });
      if (!entry) return;
      App.update(function (sign) { return State.setProjectContext(sign, {
        line: entry.line, stationId: entry.line.currentStationId, source: entry.source,
      }); });
      setPaletteCity(entry.source === 'server' ? 'server' : 'fictional');
      refreshBasicPalette(root); refreshCRTCards();
    });
    var contextStation = h('select', { 'aria-label': '当前车站', 'data-context-station': '' });
    contextStation.addEventListener('change', function () {
      var context = App.state.context;
      if (!context) return;
      App.update(function (sign) { return State.setProjectContext(sign, { line: context.line, stationId: contextStation.value, source: context.source }); });
      refreshBasicPalette(root); refreshCRTCards();
    });
    var contextManage = h('button', { class: 'project-context-manage', text: '管理', title: '管理当前线路', 'data-context-manage': '' });
    contextManage.addEventListener('click', function () { openRouteManager(); });
    root.appendChild(h('div', { class: 'project-context-bar' }, [contextLine, contextStation, contextManage]));
    var replaceBoards = h('button', { class: 'project-context-manage', text: '批量', title: '同时更换其他牌面', 'aria-label': '同时更换其他牌面', 'data-replace-boards': '' });
    replaceBoards.addEventListener('click', function () { openSignDataPicker(null, true); });
    root.querySelector('.project-context-bar').appendChild(replaceBoards);
    root.appendChild(h('div', { class: 'palette-section-description' }));
    var routeManager = h('button', { class: 'palette-tab route-manager-tab', text: '线路管理', 'data-route-manager': '' });
    routeManager.addEventListener('click', function () { openRouteManager(); });
    var tabs = h('div', { class: 'palette-tabs', role: 'tablist', 'aria-label': '添加内容' });
    [
      { id: 'basic', name: '基础元素' }, { id: 'templates', name: '组合预设' }, { id: 'presets', name: '我的预设' },
    ].forEach(function (tab) {
      var button = h('button', { class: 'palette-tab', role: 'tab', 'data-palette-tab': tab.id, text: tab.name });
      button.addEventListener('click', function () { selectPaletteTab(tab.id); });
      tabs.appendChild(button);
    });
    tabs.appendChild(routeManager);
    root.appendChild(tabs);
    var basic = h('div', { class: 'palette-pane', 'data-palette-pane': 'basic' });
    if (App.isMobileView && App.isMobileView()) buildPaletteMobile(basic);
    else categoriesForSection().forEach(function (cat) { basic.appendChild(buildDesktopCategory(cat)); });
    root.appendChild(basic);

    var templates = h('div', { class: 'palette-pane', 'data-palette-pane': 'templates' }, [
      h('div', { class: 'palette-intro', text: '所有标识均为基础元素组合预设，添加后可分别编辑图文与位置。' }),
      buildCRTToolbar(templateCategory),
    ]);
    var grid = h('div', { class: 'crt-grid' + (App.isMobileView && App.isMobileView() ? ' palette-strip crt-strip' : '') });
    filteredItems(templateCategory).forEach(function (item) { grid.appendChild(buildItemCard(item)); });
    templates.appendChild(grid);
    root.appendChild(templates);

    var presets = h('div', { class: 'palette-pane', 'data-palette-pane': 'presets' });
    if (App.isMobileView && App.isMobileView()) {
      var strip = h('div', { class: 'palette-strip' });
      buildPresetCards().forEach(function (card) { strip.appendChild(card); });
      presets.appendChild(strip);
    } else buildPresetCategory(presets);
    root.appendChild(presets);
    paintSignSections(root);
    syncContextBar();
    selectPaletteTab(activePaletteTab);
    root.querySelectorAll('.palette-chips').forEach(function (node) {
      node.scrollLeft = scrollPositions[node.classList.contains('crt-chips') ? 'templates' : 'basic'] || 0;
    });
    root.scrollTop = scrollTop;
  }

  function syncContextBar() {
    var root = document.getElementById('palette');
    var bar = root && root.querySelector('.project-context-bar');
    if (!bar) return;
    var context = App.state && App.state.context;
    var entries = lineEntries(context);
    bar.hidden = !context && !entries.length;
    document.body.classList.toggle('has-project-context', !bar.hidden);
    var name = bar.querySelector('[data-context-line]');
    paintLineOptions(name, entries, context ? contextKey(context) : '', '选择已有线路…');
    name.title = context ? '当前线路：' + (context.line.nameZh || context.line.nameEn) : '选择线路后再选择车站';
    var bulk = root.querySelector('[data-replace-boards]');
    if (bulk) bulk.hidden = !context || !global.SignWorkspace.list(App.state).some(function (board) { return board.sign.rows.some(global.SignContent.canReplace); });
    var line = context ? context.line : { id: '', stations: [] };
    var stations = bar.querySelector('[data-context-station]');
    var signature = line.id + '|' + line.stations.map(function (station) { return station.id; }).join('|');
    if (stations.dataset.stations !== signature) {
      stations.innerHTML = '';
      line.stations.forEach(function (station) { stations.appendChild(h('option', { value: station.id })); });
      stations.dataset.stations = signature;
    }
    line.stations.forEach(function (station, index) {
      stations.options[index].textContent = (station.code ? station.code + ' ' : '') + (station.nameZh || station.nameEn || '未命名车站');
    });
    if (document.activeElement !== stations) stations.value = context && context.stationId || '';
    stations.disabled = !line.stations.length;
  }

  function paintSignSections(root) {
    root.querySelectorAll('[data-sign-section]').forEach(function (button) {
      var selected = button.dataset.signSection === activeSignSection;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    var section = SIGN_SECTIONS.filter(function (item) { return item.id === activeSignSection; })[0];
    var hint = root.querySelector('.palette-section-description');
    if (hint) hint.textContent = activeSignSection === 'route' && !App.state.context
      ? '先新建线路，再选当前站，再选预设制作标识。' : section.description;
    var routeTools = root.querySelector('.route-manager-tab');
    if (routeTools) routeTools.hidden = false;
    root.querySelector('.palette-tabs').classList.add('route-context');
  }

  /** 牌型切换保持两层导航及搜索框节点，只更新当前牌型的预设。 */
  function selectSignSection(id) {
    if (activeSignSection === id) return;
    categoryBySection[activeSignSection] = activeCategory;
    var existingChips = document.querySelector('.basic-chips');
    if (existingChips) categoryScrollBySection[activeSignSection] = existingChips.scrollLeft;
    activeSignSection = id;
    activeCategory = categoryBySection[id] || 0;
    if (crtGroup && !sectionItems().some(function (item) { return item.group === crtGroup; })) crtGroup = '';
    var root = document.getElementById('palette');
    paintSignSections(root);
    refreshBasicPalette(root);
    refreshCRTCards();
    root.scrollTop = 0;
  }

  function refreshBasicPalette(root) {
    var pane = root.querySelector('[data-palette-pane="basic"]');
    var categories = categoriesForSection();
    if (activeCategory >= categories.length) activeCategory = 0;
    var chips = pane.querySelector('.basic-chips');
    if (!chips) {
      pane.innerHTML = '';
      categories.forEach(function (cat) { pane.appendChild(buildDesktopCategory(cat)); });
      return;
    }
    while (chips.children.length > categories.length) chips.lastChild.remove();
    categories.forEach(function (category, index) {
      var button = chips.children[index];
      if (!button) {
        button = h('button', { class: 'palette-chip' });
        button.addEventListener('click', function () { selectPaletteCategory(index); });
        chips.appendChild(button);
      }
      button.textContent = category.name;
      button.classList.toggle('active', index === activeCategory);
    });
    chips.scrollLeft = categoryScrollBySection[activeSignSection] || 0;
    var strip = pane.querySelector('.basic-strip');
    if (strip) strip.parentNode.replaceChild(buildCardStrip(), strip);
  }

  /** tab 切换只更新可见性，搜索框、chip 行和卡片条保持原节点。 */
  function selectPaletteTab(id) {
    var root = document.getElementById('palette');
    var changed = activePaletteTab !== id;
    if (changed) paletteScrollTops[activePaletteTab] = root.scrollTop;
    activePaletteTab = id;
    root.querySelectorAll('[data-palette-tab]').forEach(function (tab) {
      var selected = tab.dataset.paletteTab === id;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    root.querySelectorAll('[data-palette-pane]').forEach(function (pane) {
      pane.hidden = pane.dataset.palettePane !== id;
    });
    if (changed) root.scrollTop = paletteScrollTops[id] || 0;
  }

  function buildCardStrip() {
    var strip = h('div', { class: 'palette-strip basic-strip' });
    categoriesForSection()[activeCategory].items.forEach(function (item) { strip.appendChild(buildItemCard(item)); });
    return strip;
  }

  /** ≤768px：基础元素的 6 分类 chip 行 + 当前分类横向卡片条。 */
  function buildPaletteMobile(root) {
    var chips = h('div', { class: 'palette-chips basic-chips' });
    function chip(label, idx) {
      return h('button', {
        class: 'palette-chip' + (activeCategory === idx ? ' active' : ''),
        text: label,
      });
    }
    categoriesForSection().forEach(function (cat, i) {
      var c = chip(cat.name, i);
      c.addEventListener('click', function () { selectPaletteCategory(i); });
      chips.appendChild(c);
    });
    root.appendChild(chips);
    root.appendChild(buildCardStrip());
  }

  /**
   * 切换当前分类：chip 行的结构不随分类变化，故只翻转 active 态、就地替换
   * 下方卡片条，不整树重建——重建会归零 chip 行的 scrollLeft（chip 行滑到
   * 右侧点选分类后弹回最左、刚点中的分类飞出视口），也会打断滑动惯性。
   */
  function selectPaletteCategory(idx) {
    if (activeCategory === idx) return;
    activeCategory = idx;
    var root = document.getElementById('palette');
    var chips = root.querySelectorAll('.basic-chips .palette-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', i === idx);
    }
    var strip = root.querySelector('.basic-strip');
    if (strip) strip.parentNode.replaceChild(buildCardStrip(), strip);
  }

  function buildDesktopCategory(cat) {
    var grid = h('div', { class: 'palette-grid' + (cat.crt ? ' crt-grid' : '') });
    filteredItems(cat).forEach(function (item) { grid.appendChild(buildItemCard(item)); });
    return h('div', { class: 'palette-category' }, [
      h('div', { class: 'palette-category-title', text: cat.name }),
      cat.crt ? buildCRTToolbar(cat) : null,
      grid,
    ]);
  }

  /**
   * 元素卡片：两端点击即添加（桌面不选中，移动端添加后自动选中）；
   * 桌面另支持 HTML5 拖入编辑区。
   */
  function buildItemCard(item) {
    var sample = createElementForItem(item);
    var isTemplate = itemTypeOf(item) === 'crt-sign';
    // 空白占位无可见内容，用虚线框示意
    var preview = itemTypeOf(item) === 'space'
      ? spaceIcon()
      : Render.renderElementStandalone(sample, 36, App.measure).node;
    var card = h('div', {
      class: 'palette-card' + (isTemplate ? ' template-card' : ''),
      draggable: cardDraggableAttr(),
      title: isTemplate ? '点击新建独立牌面，或拖入编辑区' : '点击添加到当前行，或拖入编辑区',
      'data-template-id': itemTypeOf(item) === 'crt-sign' ? item.props.templateId : null,
      'data-group': typeof item === 'string' ? null : item.group,
      role: 'button', tabindex: '0',
    }, [
      h('div', { class: 'card-icon' }, [preview]),
      h('div', { class: 'card-name', text: itemDisplayName(item) }),
    ]);
    wireCardDrag(card, isTemplate ? { kind: 'template', templateId: item.props.templateId } : {
      kind: 'new',
      type: itemTypeOf(item),
      props: itemProps(item),
    });
    card.addEventListener('click', function () {
      // 先创建再入状态：id 可捕获，供移动端添加后选中
      if (isTemplate) {
        if (!App.state.context) setPaletteCity('chongqing');
        var result = buildTemplateContent(item.props.templateId);
        var elements = result.elements;
        App.update(function (s) { return addPresetBoard(s, elements, result.options); });
        selectAddedElements(elements);
      } else {
        var created = createElementForItem(item);
        App.update(function (s) {
          var rowId = targetRowId(s);
          if (activeSignSection !== 'horizontal') {
            var ratios = { vertical: 0.75, route: 1.5, safety: 0.667 };
            var rows = s.rows.map(function (row) {
              return row.id === rowId && !row.elements.length
                ? Object.assign({}, row, { layout: 'free', widthRatio: ratios[activeSignSection], referenceWidthRatio: ratios[activeSignSection] }) : row;
            });
            var empty = s.rows.every(function (row) { return !row.elements.length; });
            s = Object.assign({}, s, { rows: rows });
            if (empty) s.widthMode = 'dynamic';
          }
          return State.addElement(s, rowId, created);
        });
        if (activeSignSection !== 'horizontal' || App.isMobileView && App.isMobileView()) App.select(created.id);
      }
      SignUI.toast('已添加「' + itemDisplayName(item) + '」', 'success');
    });
    card.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); card.click(); }
    });
    return card;
  }

  function selectAddedElements(elements) {
    var target = elements.find(function (element) { return element.type === 'bilingual-text' || element.type === 'plain-text'; }) ||
      elements.find(function (element) { return ['number-line', 'text-line', 'entrance', 'exit'].indexOf(element.type) !== -1; }) || elements[0];
    if (target) App.select(target.id);
  }

  /** 元素点击添加时的目标行：选中元素所在行，否则最后一行 */
  function targetRowId(s) {
    if (App.selection.elementId) {
      var found = State.findElement(s, App.selection.elementId);
      if (found) return found.rowId;
    }
    return s.rows[s.rows.length - 1].id;
  }

  // ─── 预设分类卡片 ──────────────────────────────────────────

  function renderRowThumb(elements, height, options) {
    if (options && options.widthRatio || elements.some(function (element) { return !!element.props.box; })) {
      var sign = State.addTemplateRow(State.createSign(), null, elements, options);
      sign = Object.assign({}, sign, { rowHeight: height, widthMode: 'dynamic' });
      var positioned = document.createElementNS(Core.SVG_NS, 'svg');
      Render.renderSignInto(positioned, sign, App.measure, { clean: true });
      return positioned;
    }
    var x = 0;
    var slots = elements.map(function (el) {
      var w = Render.computeElementWidth(el, height, App.measure);
      var slot = { el: el, x: x, w: w };
      x += w;
      return slot;
    });
    var svg = document.createElementNS(Core.SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + Math.max(x, 1) + ' ' + height);
    svg.setAttribute('xmlns', Core.SVG_NS);
    var bg = document.createElementNS(Core.SVG_NS, 'rect');
    bg.setAttribute('width', Math.max(x, 1));
    bg.setAttribute('height', height);
    bg.setAttribute('fill', '#FFFFFF');
    svg.appendChild(bg);
    slots.forEach(function (slot) {
      var node = Render.renderElement(slot.el, height, App.measure, { clean: true }).node;
      node.setAttribute('transform', 'translate(' + slot.x + ',0)');
      svg.appendChild(node);
    });
    return svg;
  }

  /** 预设卡片节点列表（空时为提示节点）；桌面入分类容器，移动端入横向卡片条 */
  function buildPresetCards() {
    var nodes = [];
    var items = Presets.list();
    if (items.length === 0) {
      nodes.push(h('div', { class: 'palette-empty', text: '悬停行右上角「存为预设」可保存当前行' }));
      return nodes;
    }
    items.forEach(function (p) {
      var del = h('button', {
        class: 'preset-delete', title: '删除预设', text: '✕',
      });
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        SignUI.confirmDialog('确定要删除预设「' + p.name + '」吗？', '删除预设').then(function (ok) {
          if (!ok) return;
          Presets.remove(p.id);
          if (App.presetPreviewId === p.id) App.previewPreset(null);
          SignUI.toast('预设已删除');
        });
      });
      var card = h('div', {
        class: 'preset-card',
        draggable: cardDraggableAttr(),
        title: '点击预览并使用，或拖入编辑区',
      }, [
        h('div', { class: 'preset-thumb' }, [renderRowThumb(p.elements, 48, p.row)]),
        h('div', { class: 'preset-name', text: p.name }),
        del,
      ]);
      wireCardDrag(card, { kind: 'preset', id: p.id });
      card.addEventListener('click', function () {
        App.previewPreset(p.id);
      });
      nodes.push(card);
    });
    return nodes;
  }

  function buildPresetCategory(root) {
    var cat = h('div', { class: 'palette-category' }, [
      h('div', { class: 'palette-category-title', text: '预设' }),
    ]);
    buildPresetCards().forEach(function (n) { cat.appendChild(n); });
    root.appendChild(cat);
  }

  Presets.onChange(function () {
    if (App.measure) buildPalette();
  });

  // ─── 颜色选择器组件 ────────────────────────────────────────

  // 选色板城市切换联动：一处切换，所有打开中的选择器同步重建色板。
  // 观察者在 rebuildRightPanel 时随 syncFns 一起清空，避免引用过期 DOM。
  var paletteCityFns = [];
  var lastLinePaletteSignature = '';
  var lastPaletteContextId;
  var serverCatalog = { lines: [], updatedAt: null, warnings: [], loading: false, loaded: false, error: '', generation: 0 };
  var serverCatalogListeners = [];

  function notifyServerLines() {
    syncContextBar();
    refreshLinePalettes(true);
    serverCatalogListeners.slice().forEach(function (listener) { listener(); });
  }

  function refreshServerLines() {
    if (!global.SignLineCatalog) return Promise.resolve(null);
    var generation = ++serverCatalog.generation;
    serverCatalog.loading = true; serverCatalog.error = ''; notifyServerLines();
    return global.SignLineCatalog.load().then(function (result) {
      if (generation !== serverCatalog.generation) return null;
      serverCatalog.lines = result.lines; serverCatalog.updatedAt = result.updatedAt;
      serverCatalog.warnings = result.warnings; serverCatalog.loaded = true;
      return result;
    }).catch(function (error) {
      if (generation === serverCatalog.generation) serverCatalog.error = error.message || '无法读取服务器线路';
      return null;
    }).then(function (result) {
      if (generation === serverCatalog.generation) { serverCatalog.loading = false; notifyServerLines(); }
      return result;
    });
  }

  function mergeRouteLines(sources) {
    var byId = Object.create(null), order = [];
    sources.forEach(function (line) {
      if (!line || !line.id || !Core.normalizeHex(line.color)) return;
      if (!byId[line.id]) order.push(line.id);
      byId[line.id] = line;
    });
    return order.map(function (id) { return byId[id]; });
  }

  function contextKey(context) { return (context.source === 'server' ? 'server:' : 'local:') + context.line.id; }

  function lineEntries(context) {
    var entries = (global.SignRoutes ? global.SignRoutes.list() : []).map(function (line) {
      return { key: 'local:' + line.id, source: 'local', line: line };
    }).concat(serverCatalog.lines.map(function (line) { return { key: 'server:' + line.id, source: 'server', line: line }; }));
    context = context || App.state && App.state.context;
    if (context && !entries.some(function (entry) { return entry.key === contextKey(context); })) {
      entries.push({ key: contextKey(context), source: context.source === 'server' ? 'server' : 'local', line: context.line });
    }
    return entries;
  }

  function paintLineOptions(select, entries, selected, placeholder) {
    var signature = JSON.stringify(entries.map(function (entry) { return entry.key; }));
    if (select.dataset.lineKeys !== signature) {
      select.replaceChildren(h('option', { value: '', text: placeholder || '选择已有线路…' }));
      [['local', '我的线路 / 项目线路'], ['server', '服务器线路']].forEach(function (source) {
        var items = entries.filter(function (entry) { return entry.source === source[0]; });
        if (!items.length) return;
        var group = h('optgroup', { label: source[1] });
        items.forEach(function (entry) { group.appendChild(h('option', { value: entry.key })); });
        select.appendChild(group);
      });
      select.dataset.lineKeys = signature;
    }
    entries.forEach(function (entry) {
      var option = Array.from(select.options).find(function (option) { return option.value === entry.key; });
      option.textContent = entry.line.nameZh || entry.line.nameEn || '未命名线路';
    });
    if (document.activeElement !== select) select.value = selected;
  }

  function routeLinesForContext(context) {
    var local = global.SignRoutes ? global.SignRoutes.list() : [];
    var sources = context && context.source === 'server' ? local.concat(serverCatalog.lines) : serverCatalog.lines.concat(local);
    return mergeRouteLines((context && context.line.relatedLines || []).concat(sources, context ? [context.line] : []));
  }

  function buildTemplateContent(templateId, context) {
    context = context === undefined ? App.state.context : context;
    var result = global.SignContent.build(templateId, context, routeLinesForContext(context), App.measure);
    result.options.name = boardNameForTemplate(global.SignCRT.get(templateId));
    return result;
  }

  function availableRouteLines() {
    var preferred = preferredFictionalLine();
    var local = global.SignRoutes ? global.SignRoutes.list() : [];
    var sources = publicProjectContext() ? local.concat(serverCatalog.lines) : serverCatalog.lines.concat(local);
    return mergeRouteLines((preferred && preferred.relatedLines || []).concat(sources, preferred ? [preferred] : []));
  }

  function localRouteLines() { return mergeRouteLines(serverCatalog.lines.concat(availableFictionalLines())); }

  function activeCustomLines() {
    return App.prefs.paletteCity === 'server' ? serverCatalog.lines : availableFictionalLines();
  }

  function preferredFictionalLine() { return App.state && App.state.context && App.state.context.line; }

  function publicProjectContext() { return !!(App.state && App.state.context && App.state.context.source === 'server'); }

  function preferredPaletteLine() {
    var line = preferredFictionalLine();
    return App.prefs.paletteCity === 'server' || publicProjectContext() ? null : line;
  }

  function availableFictionalLines() {
    var Routes = global.SignRoutes;
    if (!Routes) return [];
    var preferred = preferredFictionalLine();
    if (publicProjectContext()) return Routes.list();
    var sources = (preferred && preferred.relatedLines || []).concat(Routes.list(), preferred ? [preferred] : []);
    var byId = Object.create(null), order = [];
    sources.forEach(function (line) {
      if (!line || !line.id || !Core.normalizeHex(line.color)) return;
      if (!byId[line.id]) order.push(line.id);
      byId[line.id] = line;
    });
    return order.map(function (id) { return byId[id]; });
  }

  function fictionalColorFor(label) {
    return global.SignRoutes && global.SignRoutes.colorFor
      ? global.SignRoutes.colorFor(label, activeCustomLines(), preferredPaletteLine()) : null;
  }

  function refreshLinePalettes(force) {
    var preferred = preferredFictionalLine();
    var currentId = preferred ? (publicProjectContext() ? 'server:' : 'local:') + preferred.id : null;
    if (lastPaletteContextId !== undefined && lastPaletteContextId !== currentId && preferred) setPaletteCity(publicProjectContext() ? 'server' : 'fictional');
    lastPaletteContextId = currentId;
    var signature = JSON.stringify([availableFictionalLines(), serverCatalog.lines].map(function (lines) {
      return lines.map(function (line) { return [line.id, line.nameZh, line.nameEn, line.color]; });
    }));
    if (!force && signature === lastLinePaletteSignature) return;
    lastLinePaletteSignature = signature;
    paletteCityFns.slice().forEach(function (fn) { fn(); });
  }

  function fictionalLineMarker(line) {
    var hit = global.SignRoutes && global.SignRoutes.colorFor && global.SignRoutes.colorFor(line.nameZh || line.nameEn, [line], line);
    return hit ? hit.line : '';
  }

  function paletteLineCandidates(city, customLines) {
    if (city === 'fictional' || city === 'server') {
      var Routes = global.SignRoutes;
      return Routes && Routes.colorFor ? customLines.map(function (line) {
        return Routes.colorFor(line.nameZh || line.nameEn, [line], line);
      }).filter(Boolean) : [];
    }
    var definition = Core.CITY_PALETTES[city] || Core.CITY_PALETTES[Core.DEFAULT_CITY];
    return definition.lines.map(function (line) {
      return { id: city + ':' + line.line, line: line.line, name: line.line + '号线', nameEn: 'Line ' + line.line, bg: line.bg };
    }).concat(definition.extras.map(function (line) {
      return { id: city + ':' + line.name, line: line.name.replace(/线$/, ''), name: line.name,
        nameEn: line.name === '环线' ? 'Loop Line' : '', bg: line.bg };
    }));
  }

  function buildFictionalLineSelect(numericOnly, getLabel, chooseLine) {
    var select = h('select', { 'aria-label': numericOnly ? '从我的数字线路选择' : '从我的线路选择' });
    select.setAttribute(numericOnly ? 'data-fictional-number' : 'data-fictional-text', '');
    var lastOptions = '';
    function paint() {
      var lines = availableFictionalLines().filter(function (line) { return !numericOnly || /^\d+$/.test(fictionalLineMarker(line)); });
      var signature = JSON.stringify(lines.map(function (line) { return [line.id, line.nameZh, line.nameEn, line.color]; }));
      if (signature !== lastOptions) {
        select.innerHTML = '';
        select.appendChild(h('option', { value: '', text: lines.length ? '选择我的线路…' : numericOnly ? '暂无自建数字线路' : '暂无自建线路' }));
        lines.forEach(function (line) { select.appendChild(h('option', { value: line.id, text: (line.nameZh || line.nameEn) + ' · ' + line.color })); });
        lastOptions = signature;
      }
      select.disabled = !lines.length;
      var hit = fictionalColorFor(getLabel());
      if (document.activeElement !== select) select.value = hit && lines.some(function (line) { return line.id === hit.id; }) ? hit.id : '';
    }
    select.addEventListener('change', function () {
      var line = availableFictionalLines().find(function (item) { return item.id === select.value; });
      if (!line) return;
      setPaletteCity('fictional'); chooseLine(line); paint();
    });
    paint(); syncFns.push(paint); paletteCityFns.push(function () { if (select.isConnected) paint(); });
    return field('从我的线路选择', select);
  }

  /** 编辑器偏好：选色板城市（写入 localStorage 并通知全部选择器） */
  function setPaletteCity(city) {
    if (App.prefs.paletteCity === city) return;
    App.prefs.paletteCity = city;
    if (global.SignStorage) SignStorage.savePrefs(App.prefs);
    paletteCityFns.forEach(function (fn) { fn(); });
  }

  /** 编辑器偏好：输入线路号自动匹配线路色 */
  function setAutoLineColor(v) {
    App.prefs.autoLineColor = !!v;
    if (global.SignStorage) SignStorage.savePrefs(App.prefs);
  }

  /**
   * buildColorPicker({ value, getValue, nullable, onChange(v), onLineSelect(line), mini })
   * value 为 null 时显示"透明"态（仅 nullable 时允许）。
   * 可选 getValue：注册到 syncFns，外部（如线路号自动配色）改色后同步显示。
   */
  function buildColorPicker(opts) {
    var value = opts.value || null;
    var nullable = !!opts.nullable;
    var onChange = opts.onChange || function () {};

    if (opts.getValue) {
      var readValue = opts.getValue;
      syncFns.push(function () {
        var v = readValue() || null;
        if (v !== value) {
          value = v;
          paint();
        }
      });
    }

    var current = h('button', { class: 'cp-current', title: '当前颜色' });
    var hex = h('input', {
      class: 'hex-input', type: 'text', spellcheck: 'false',
      placeholder: '#RRGGBB', maxlength: '7',
    });
    var native = h('input', { class: 'cp-native', type: 'color', title: '自定义颜色' });
    var nullBtn = nullable ? h('button', { class: 'cp-null-btn', text: '透明', title: '清除颜色（透明）' }) : null;

    function paint() {
      // hex 输入框聚焦中（用户正在打字）时不得改写其文本，否则输入被规整化
      // 改写、光标跳末尾，与用户的编辑互相打架（删除 '#'/退格均被顶回）。
      var hexIdle = document.activeElement !== hex;
      if (value === null) {
        current.classList.add('nullable-null');
        current.removeAttribute('style');
        if (hexIdle) hex.value = '';
        if (nullBtn) nullBtn.classList.add('active');
      } else {
        current.classList.remove('nullable-null');
        current.style.background = value;
        if (hexIdle) hex.value = value;
        native.value = value;
        if (nullBtn) nullBtn.classList.remove('active');
      }
      swatchBtns.forEach(function (b) {
        b.classList.toggle('active', b.dataset.color === value);
      });
    }

    function commit(v, line) {
      value = v;
      paint();
      if (!line || !opts.onLineSelect || opts.onLineSelect(line) === false) onChange(v);
    }

    hex.addEventListener('input', function () {
      var raw = hex.value.trim();
      // 无 # 前缀的 6 位写法（如 7378be）也接受：只规整提交值，不改写输入框文本
      var v = raw && raw.charAt(0) !== '#' ? '#' + raw : raw;
      if (Core.isHexColor(v)) {
        hex.classList.remove('invalid');
        commit(Core.normalizeHex(v));
      } else {
        hex.classList.toggle('invalid', raw.length > 0);
      }
    });
    hex.addEventListener('blur', function () { paint(); });
    native.addEventListener('input', function () {
      commit(Core.normalizeHex(native.value));
    });
    if (nullBtn) {
      nullBtn.addEventListener('click', function () { commit(null); });
    }

    // 配色来源既可选实际城市，也可使用项目与本地库中的自建线路。
    var citySelect = h('select', { class: 'cp-city-select', title: '选择线路配色来源', 'aria-label': '线路配色来源' });
    citySelect.appendChild(h('option', { value: 'fictional', text: '我的线路' }));
    citySelect.appendChild(h('option', { value: 'server', text: '服务器线路' }));
    Core.PALETTE_CITY_ORDER.forEach(function (city) {
      citySelect.appendChild(h('option', {
        value: city, text: Core.CITY_PALETTES[city].name + '线路配色',
      }));
    });
    citySelect.addEventListener('change', function () { setPaletteCity(citySelect.value); });
    function paintCities() {
      citySelect.value = App.prefs.paletteCity;
    }
    paintCities(); // 构建时立即回显

    var swatchBtns = [];
    var swatches = h('div', { class: 'cp-swatches' });
    function renderSwatches() {
      swatchBtns = [];
      while (swatches.firstChild) swatches.removeChild(swatches.firstChild);
      var fictional = App.prefs.paletteCity === 'fictional' || App.prefs.paletteCity === 'server';
      swatches.classList.toggle('fictional-swatches', fictional);
      var customLines = fictional ? activeCustomLines() : [];
      var choices = fictional ? global.SignRoutes && global.SignRoutes.swatches
        ? global.SignRoutes.swatches(customLines, preferredPaletteLine()) : Core.UNIVERSAL_SWATCHES : Core.citySwatches(App.prefs.paletteCity);
      var candidates = paletteLineCandidates(App.prefs.paletteCity, customLines);
      if (fictional && !customLines.length) swatches.appendChild(h('div', { class: 'cp-empty-lines', text: App.prefs.paletteCity === 'server'
        ? '暂无线路，可在线路管理中刷新服务器列表。' : '在线路管理中保存线路后，可在这里选色。' }));
      choices.forEach(function (c) {
        var named = fictional && customLines.some(function (line) { return Core.normalizeHex(line.color) === c.bg; });
        var universal = Core.UNIVERSAL_SWATCHES.some(function (color) { return color.name === c.name && color.bg === c.bg; });
        var identity = universal ? null : Core.uniqueLineForColor(c.bg, candidates);
        var count = universal ? 0 : candidates.filter(function (line) { return Core.normalizeHex(line.bg) === c.bg; }).length;
        var b = h('button', {
          class: 'cp-swatch' + (named ? ' cp-fictional-swatch' : ''), title: named ? c.name + ' · ' + c.bg : c.name, 'data-color': c.bg,
          'data-line-name': named ? c.name : null, style: named ? null : 'background:' + c.bg,
          'data-line-id': identity ? identity.id : null, 'data-line-marker': identity ? identity.line : null, 'data-line-count': count,
        });
        if (named) {
          b.appendChild(h('span', { class: 'cp-line-dot', style: 'background:' + c.bg }));
          b.appendChild(h('span', { class: 'cp-line-name', text: c.name }));
          b.appendChild(h('span', { class: 'cp-line-hex', text: c.bg }));
        }
        b.addEventListener('click', function () {
          commit(c.bg, identity);
          if (opts.onLineSelect && count > 1) SignUI.toast('此颜色对应多条线路，已应用颜色；请单独选择线路。');
        });
        swatchBtns.push(b);
        swatches.appendChild(b);
      });
      paint();
    }
    renderSwatches();

    var row = h('div', { class: 'cp-row' }, [current, hex, native]);
    if (nullBtn) row.appendChild(nullBtn);
    var root = h('div', { class: 'color-picker' + (opts.mini ? ' mini' : '') }, [row, citySelect, swatches]);
    paletteCityFns.push(function () {
      if (!root.isConnected) return; // 选择器已随面板重建移除
      renderSwatches();
      paintCities();
    });
    paint();
    return root;
  }

  // ─── 右栏：模式管理与签名同步 ──────────────────────────────

  var lastSignature = null;
  var syncFns = [];
  var boardSwitcherSignature = '';
  var lastActiveBoardId = null;

  function syncBoardSwitcher() {
    var root = document.getElementById('board-switcher');
    var Workspace = global.SignWorkspace;
    if (!root || !Workspace || !App.state) return;
    var boards = Workspace.list(App.state);
    var activeId = App.state.workspace && App.state.workspace.activeId;
    if (!activeId) {
      var active = boards.find(function (board) { return board.active || board.isActive; });
      activeId = active ? active.id : boards.length ? boards[0].id : null;
    }
    var signature = boards.map(function (board) { return board.id; }).join('|');
    var list = root.querySelector('.board-list');
    if (!list || signature !== boardSwitcherSignature) {
      var oldScroll = list ? list.scrollLeft : 0;
      root.innerHTML = '';
      root.appendChild(h('span', { class: 'board-switcher-title', text: '牌面' }));
      list = h('div', { class: 'board-list', role: 'tablist', 'aria-label': '独立牌面' });
      boards.forEach(function (board) {
        var choose = h('button', { class: 'board-select', role: 'tab', 'data-board-select': board.id }, [
          h('span', { class: 'board-name' }), h('span', { class: 'board-info' }),
        ]);
        choose.addEventListener('click', function () {
          App.update(function (sign) { return Workspace.select(sign, board.id); });
          App.select(null);
        });
        var rename = h('button', { class: 'board-action', text: '✎', title: '重命名牌面', 'aria-label': '重命名牌面', 'data-board-rename': board.id });
        rename.addEventListener('click', function () {
          var current = Workspace.list(App.state).find(function (item) { return item.id === board.id; });
          SignUI.promptDialog('输入这块牌的名称', '重命名牌面', current ? current.name : '', '如：星港站 · 站名牌').then(function (name) {
            if (name) App.update(function (sign) { return Workspace.rename(sign, board.id, name); });
          });
        });
        var remove = h('button', { class: 'board-action board-delete', text: '×', title: '删除牌面', 'aria-label': '删除牌面', 'data-board-delete': board.id });
        remove.addEventListener('click', function () {
          var current = Workspace.list(App.state).find(function (item) { return item.id === board.id; });
          SignUI.confirmDialog('删除牌面「' + (current ? current.name : '') + '」及其中的图文？', '删除牌面').then(function (confirmed) {
            if (!confirmed) return;
            App.update(function (sign) { return Workspace.remove(sign, board.id); }); App.select(null);
          });
        });
        list.appendChild(h('div', { class: 'board-item', 'data-board-id': board.id }, [choose, rename, remove]));
      });
      root.appendChild(list);
      var add = h('button', { class: 'board-add', text: '＋ 空白牌', title: '新建一块独立的空白牌面', 'data-board-action': 'new' });
      add.addEventListener('click', function () { App.update(function (sign) { return Workspace.addBlank(sign); }); App.select(null); });
      root.appendChild(add);
      list.scrollLeft = oldScroll;
      boardSwitcherSignature = signature;
    }
    boards.forEach(function (board) {
      var item = Array.prototype.find.call(list.children, function (node) { return node.dataset.boardId === board.id; });
      if (!item) return;
      var selected = board.id === activeId;
      item.classList.toggle('active', selected);
      var choose = item.querySelector('.board-select'); choose.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.querySelector('.board-name').textContent = board.name || '未命名牌面';
      choose.title = board.name || '未命名牌面';
      var sign = board.sign || (selected ? App.state : null);
      var ratio = board.widthRatio || sign && sign.rows[0] && sign.rows[0].widthRatio;
      var count = board.rowCount || sign && sign.rows.length;
      item.querySelector('.board-info').textContent = ratio ? displayNumber(ratio) + ':1' : count > 1 ? count + ' 行' : '';
    });
    if (activeId !== lastActiveBoardId) {
      var selectedItem = Array.prototype.find.call(list.children, function (node) { return node.dataset.boardId === activeId; });
      if (selectedItem) selectedItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      lastActiveBoardId = activeId;
    }
  }

  function panelMode() {
    if (App.selection.elementId) return 'element';
    if (App.presetPreviewId) return 'preset';
    return 'settings';
  }

  /** 结构签名：变化才重建面板；纯值变化走 syncFns。
   *  设置面板仅含当前独立牌 ID——宽度模式等编辑值变化由 syncFns 回显，
   *  否则每次切换都会整面板重建，重建出的控件不带任何选中态。 */
  function panelSignature() {
    var mode = panelMode();
    if (mode === 'element') {
      var found = App.state && State.findElement(App.state, App.selection.elementId);
      if (!found) return 'element:none';
      var extra = found.element.type === 'number-line'
        ? ':n' + (found.element.props.lines || []).length : '';
      return 'element:' + found.element.id + ':' + found.element.type + extra;
    }
    if (mode === 'preset') return 'preset:' + App.presetPreviewId + ':' + Presets.list().length;
    return 'settings:' + (App.state && App.state.workspace ? App.state.workspace.activeId : 'initial');
  }

  function syncRightPanel() {
    syncContextBar();
    syncBoardSwitcher();
    refreshLinePalettes();
    if (!App.state || !App.measure) return;
    var sig = panelSignature();
    if (sig !== lastSignature) {
      rebuildRightPanel();
      lastSignature = sig;
    } else {
      syncFns.forEach(function (fn) { fn(); });
    }
    // 标题与关闭按钮
    var mode = panelMode();
    document.getElementById('right-panel-title').textContent =
      mode === 'element' ? '元素属性'
        : mode === 'preset' ? '预设预览' : '标识牌设置';
    document.getElementById('close-element-btn').hidden = mode === 'settings';
    document.getElementById('close-element-btn').title =
      mode === 'preset' ? '关闭预览' : '关闭元素属性';
    // 移动端：选中元素/进预览时底部属性带自动展开（折叠只由用户手动控制）
    if (mode !== 'settings' && App.isMobileView && App.isMobileView()) {
      var band = document.getElementById('right-panel');
      if (band.classList.contains('band-collapsed')) {
        band.classList.remove('band-collapsed');
        if (App.syncMobileChrome) App.syncMobileChrome();
      }
    }
  }

  function rebuildRightPanel() {
    syncFns = [];
    paletteCityFns = [];
    var body = document.getElementById('right-panel-body');
    body.innerHTML = '';
    var mode = panelMode();
    if (mode === 'element') body.appendChild(buildElementPanel());
    else if (mode === 'preset') body.appendChild(buildPresetPreviewPanel());
    else body.appendChild(buildSettingsPanel());
  }

  // ─── 表单控件工厂 ──────────────────────────────────────────

  function field(labelText, control, hint) {
    var children = [h('label', { text: labelText }), control];
    if (hint) children.push(h('div', { class: 'hint-text', text: hint }));
    return h('div', { class: 'field' }, children);
  }

  function numberInput(attrs, onCommit) {
    var input = h('input', Object.assign({ type: 'number' }, attrs));
    input.addEventListener('change', function () {
      var v = parseFloat(input.value);
      if (isFinite(v)) onCommit(v);
      else syncNow();
    });
    return input;
  }

  function displayNumber(value) { return isFinite(Number(value)) ? String(Number(Number(value).toFixed(4))) : ''; }

  function textInput(attrs, onInput) {
    var input = h('input', Object.assign({ type: 'text' }, attrs));
    input.addEventListener('input', function () { onInput(input.value); });
    return input;
  }

  function segGroup(options, getValue, onPick) {
    var group = h('div', { class: 'seg-group' });
    var buttons = options.map(function (opt) {
      var b = h('button', { text: opt.label, title: opt.title || '', 'data-value': opt.value });
      b.addEventListener('click', function () { onPick(opt.value); });
      group.appendChild(b);
      return b;
    });
    function paint() {
      var cur = getValue();
      buttons.forEach(function (b) {
        b.classList.toggle('active', b.dataset.value === String(cur));
      });
    }
    syncFns.push(paint);
    paint(); // 构建时立即回显（重建出的面板不含任何值状态）
    return group;
  }

  function checkbox(labelText, getValue, onChange) {
    var input = h('input', { type: 'checkbox' });
    input.addEventListener('change', function () { onChange(input.checked); });
    input.checked = !!getValue(); // 构建时立即回显
    syncFns.push(function () {
      if (document.activeElement !== input) input.checked = !!getValue();
    });
    return h('div', { class: 'field field-inline' }, [
      h('label', { text: labelText }), input,
    ]);
  }

  /** 同步输入框显示值（跳过焦点元素） */
  function bindSync(el2, getValue, format) {
    syncFns.push(function () {
      if (document.activeElement === el2) return;
      var v = getValue();
      el2.value = format ? format(v) : v;
    });
  }

  function syncNow() { syncFns.forEach(function (fn) { fn(); }); }

  // ─── 标识牌设置面板 ────────────────────────────────────────

  var ratioSettingsRowId = null;

  function buildRowAspectEditor(getElementId) {
    var container = h('div', { class: 'size-and-export' });
    var root = h('details', { class: 'row-aspect-editor', open: getElementId ? undefined : 'open' });
    var summaryTitle = h('span', { class: 'aspect-summary-title', text: '牌面比例' });
    var ratioBadge = h('span', { class: 'aspect-ratio-badge' });
    var summary = h('summary', { 'data-aspect-toggle': '' }, [
      h('span', { class: 'aspect-chevron', text: '›', 'aria-hidden': 'true' }), summaryTitle, ratioBadge,
    ]);
    root.appendChild(summary);
    var rowSelect = getElementId ? null : h('select', { 'aria-label': '调整比例的牌面' });
    var rowField = rowSelect ? field('调整哪一行', rowSelect) : null;
    if (rowField) root.appendChild(rowField);
    function currentRow() {
      var found = getElementId && State.findElement(App.state, getElementId());
      var rowId = found ? found.rowId : ratioSettingsRowId;
      return App.state.rows.filter(function (row) { return row.id === rowId; })[0] || App.state.rows[0];
    }
    function currentRatio() {
      var row = currentRow();
      return row.widthRatio || (App.layout ? App.layout.width / App.state.rowHeight : App.state.width / App.state.rowHeight);
    }
    function pairFor(ratio) {
      for (var height = 1; height <= 20; height++) {
        var width = Math.round(ratio * height);
        if (width > 0 && Math.abs(width / height - ratio) < 0.000001) return [width, height];
      }
      return ratio >= 1 ? [ratio, 1] : [1, 1 / ratio];
    }
    var width = h('input', { type: 'number', min: '0.01', max: '100000', step: '0.1', 'aria-label': '牌面比例宽', 'data-aspect-width': '' });
    var height = h('input', { type: 'number', min: '0.01', max: '100000', step: '0.1', 'aria-label': '牌面比例高', 'data-aspect-height': '' });
    var inputs = h('div', { class: 'aspect-inputs' }, [field('宽', width), h('span', { class: 'aspect-colon', text: ':' }), field('高', height)]);
    function commit() {
      var w = parseFloat(width.value), ht = parseFloat(height.value);
      if (!(w > 0 && ht > 0)) { paint(); return; }
      var row = currentRow();
      App.update(function (sign) { return State.setRowAspectRatio(sign, row.id, Core.clamp(w / ht, 0.1, 64)); });
    }
    width.addEventListener('change', commit); height.addEventListener('change', commit);
    width.addEventListener('blur', function () { paint(); }); height.addEventListener('blur', function () { paint(); });
    var choices = h('div', { class: 'aspect-presets' });
    [[4, 1], [3, 1], [1, 1], [3, 4]].forEach(function (pair) {
      var button = h('button', { class: 'aspect-preset', text: pair[0] + ':' + pair[1], 'data-aspect-ratio': pair[0] / pair[1] });
      button.addEventListener('click', function () {
        var row = currentRow();
        App.update(function (sign) { return State.setRowAspectRatio(sign, row.id, pair[0] / pair[1]); });
      });
      choices.appendChild(button);
    });
    var reset = h('button', { class: 'aspect-reset', text: '恢复参考比例', type: 'button' });
    function referenceRatio() {
      var row = currentRow();
      var template = row.templateId && global.SignCRT.get(row.templateId);
      return row.referenceWidthRatio || template && template.width / template.height;
    }
    reset.addEventListener('click', function () {
      var row = currentRow(), ratio = referenceRatio();
      if (ratio) App.update(function (sign) { return State.setRowAspectRatio(sign, row.id, ratio); });
    });
    root.appendChild(h('div', { class: 'aspect-section-head' }, [h('span', { text: '快捷比例' }), reset]));
    root.appendChild(choices);
    root.appendChild(h('div', { class: 'aspect-custom-label', text: '自定义宽高比' }));
    root.appendChild(inputs);
    container.appendChild(root);
    var outputScope = h('span', { class: 'aspect-output-scope' });
    var output = h('div', { class: 'aspect-output-card' }, [
      h('div', { class: 'aspect-section-head' }, [h('span', { text: '输出' }), outputScope]),
    ]);
    var dimensions = h('div', { class: 'aspect-dimensions', 'aria-live': 'polite' });
    output.appendChild(dimensions);
    var exports = h('div', { class: 'row-aspect-exports' });
    [['svg', 'SVG', 'exportSVGFile'], ['png', 'PNG', 'exportPNGFile']].forEach(function (definition) {
      var button = h('button', { class: 'btn', text: '↓ ' + definition[1], 'aria-label': '导出此牌 ' + definition[1],
        title: definition[0] === 'svg' ? '导出矢量文件，可继续编辑' : '导出图片，可用于贴图', 'data-export-row': definition[0] });
      button.addEventListener('click', function () {
        if (button.disabled) return;
        var row = currentRow();
        var sign = Object.assign({}, App.state, { rows: [row], widthMode: row.widthRatio ? 'dynamic' : App.state.widthMode });
        var label = button.textContent;
        button.disabled = true; button.textContent = '导出中…';
        function done() { button.disabled = false; button.textContent = label; }
        try {
          Promise.resolve(global.SignExporters[definition[2]](sign, App.measure)).then(done, function (error) {
            done(); SignUI.toast(error.message || '导出失败', 'error');
          });
        } catch (error) { done(); SignUI.toast(error.message || '导出失败', 'error'); }
      });
      exports.appendChild(button);
    });
    output.appendChild(exports); container.appendChild(output);
    function paint() {
      var multiple = App.state.rows.length > 1;
      if (rowField) rowField.hidden = !multiple;
      if (rowSelect) {
        var ids = App.state.rows.map(function (row) { return row.id; }).join('|');
        if (rowSelect.dataset.rows !== ids) {
          rowSelect.innerHTML = '';
          App.state.rows.forEach(function (row, index) { rowSelect.appendChild(h('option', { value: row.id, text: '第 ' + (index + 1) + ' 行' })); });
          rowSelect.dataset.rows = ids;
        }
        rowSelect.value = currentRow().id;
      }
      var ratio = currentRatio();
      var currentPair = pairFor(ratio);
      summaryTitle.textContent = multiple ? '行比例' : '牌面比例';
      ratioBadge.textContent = displayNumber(currentPair[0]) + ':' + displayNumber(currentPair[1]);
      var entered = parseFloat(width.value) / parseFloat(height.value);
      if (!isFinite(entered) || Math.abs(entered - ratio) > 0.000001) {
        if (document.activeElement !== width && document.activeElement !== height) {
          var pair = pairFor(ratio); width.value = displayNumber(pair[0]); height.value = displayNumber(pair[1]);
        }
      }
      choices.querySelectorAll('button').forEach(function (button) { button.classList.toggle('active', Math.abs(Number(button.dataset.aspectRatio) - ratio) < 0.000001); });
      dimensions.textContent = Math.ceil(ratio * App.state.rowHeight) + ' × ' + App.state.rowHeight + ' px';
      var index = App.state.rows.findIndex(function (row) { return row.id === currentRow().id; });
      outputScope.textContent = multiple ? '仅第 ' + (index + 1) + ' 行' : '当前牌面';
      var reference = referenceRatio();
      reset.disabled = !reference || Math.abs(reference - ratio) < 0.000001;
      reset.title = reference ? '恢复预设的 ' + displayNumber(pairFor(reference)[0]) + ':' + displayNumber(pairFor(reference)[1]) : '此牌面没有预设比例';
    }
    if (rowSelect) rowSelect.addEventListener('change', function () { ratioSettingsRowId = rowSelect.value; paint(); });
    paint(); syncFns.push(paint);
    return container;
  }

  function buildFourSidedEntryPoint(rowId) {
    var root = h('div', { class: 'four-sided-entry-point' });
    var button = h('button', { class: 'btn btn-primary', 'data-four-sided-edit': '' });
    function current() {
      return App.state.rows.find(function (row) {
        return (!rowId || row.id === rowId) && (row.fourSided || row.templateId === 'four-sided-guide');
      });
    }
    function paint() {
      var row = current();
      root.hidden = !row;
      if (!row) return;
      button.dataset.fourSidedEdit = row.id;
      var count = row.fourSided && row.fourSided.entries.length;
      button.textContent = '编辑各排内容与顺序' + (count ? ' · ' + count + ' 排' : '');
    }
    button.addEventListener('click', function () { var row = current(); if (row) openFourSidedEditor(row.id); });
    root.appendChild(button); paint(); syncFns.push(paint);
    return root;
  }

  function openFourSidedEditor(rowId) {
    var previousFocus = document.activeElement, composing = false, finished = false, signature = '';
    function current() { return App.state.rows.find(function (row) { return row.id === rowId; }); }
    var row = current();
    if (!row) return;
    App.select(null);
    if (!row.fourSided) App.update(function (sign) {
      return State.applyFourSidedEntries(sign, rowId, State.createFourSided().entries, App.measure);
    });
    var mask = h('div', { class: 'modal-mask four-sided-mask' });
    var modal = h('div', { class: 'modal route-modal four-sided-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'four-sided-title' });
    var close = h('button', { class: 'icon-btn', text: '✕', 'aria-label': '关闭逐排编辑' });
    modal.appendChild(h('div', { class: 'route-modal-header' }, [h('h3', { id: 'four-sided-title', text: '逐排编辑' }), close]));
    modal.appendChild(h('p', { class: 'hint-text', text: '每排分别设置线路和左右方向，调整后实时重新排版。' }));
    var count = h('input', { type: 'number', min: '1', max: '12', step: '1', 'data-four-sided-count': '', 'aria-label': '信息排数' });
    var add = h('button', { class: 'btn', text: '＋ 添加一排', 'data-four-sided-add': '' });
    modal.appendChild(h('div', { class: 'four-sided-toolbar' }, [field('信息排数', count), add]));
    var preview = h('div', { class: 'four-sided-preview', 'aria-label': '多排标识预览' });
    var list = h('div', { class: 'four-sided-entries' });
    modal.appendChild(preview); modal.appendChild(list);
    var done = h('button', { class: 'btn btn-primary', text: '完成', 'data-four-sided-done': '' });
    modal.appendChild(h('div', { class: 'route-modal-actions' }, [done]));
    mask.appendChild(modal); document.getElementById('modal-root').appendChild(mask);

    function change(fn) {
      App.update(fn);
      paint();
    }
    function entryById(id) { return current().fourSided.entries.find(function (entry) { return entry.id === id; }); }
    function buildCard(entry) {
      var card = h('section', { class: 'route-station four-sided-entry', 'data-four-sided-entry': entry.id });
      var title = h('strong', { 'data-four-sided-index': '' });
      var actions = h('div', { class: 'route-station-actions' });
      [['up', '↑', '上移此排'], ['down', '↓', '下移此排'], ['remove', '删除', '删除此排']].forEach(function (action) {
        var button = h('button', { class: 'route-station-action', text: action[1], title: action[2], 'aria-label': action[2], 'data-four-sided-action': action[0] });
        button.addEventListener('click', function () {
          change(function (sign) {
            return action[0] === 'remove' ? State.removeFourSidedEntry(sign, rowId, entry.id, App.measure)
              : State.moveFourSidedEntry(sign, rowId, entry.id, action[0] === 'up' ? -1 : 1, App.measure);
          });
        });
        actions.appendChild(button);
      });
      card.appendChild(h('div', { class: 'route-station-top' }, [title, actions]));
      var fields = h('div', { class: 'four-sided-fields' });
      [['左侧方向', 'leftZh', 'leftEn'], ['线路', 'line', 'lineEn'], ['右侧方向', 'rightZh', 'rightEn']].forEach(function (group) {
        var column = h('div');
        group.slice(1).forEach(function (key, index) {
          var input = h('input', { type: 'text', value: entry[key] || '', 'data-four-sided-field': key,
            'aria-label': group[0] + (index ? '英文' : '中文'), placeholder: index ? 'English' : group[0] === '线路' ? '如：1 / 环 / 云间线' : '如：星港方向' });
          input.addEventListener('input', function () {
            var patch = {}; patch[key] = input.value;
            change(function (sign) { return State.updateFourSidedEntry(sign, rowId, entry.id, patch, App.measure); });
          });
          column.appendChild(field(index ? '英文' : group[0], input));
        });
        fields.appendChild(column);
      });
      card.appendChild(fields); return card;
    }
    function paint() {
      var row = current();
      if (!row || !row.fourSided) { finish(); return; }
      var entries = row.fourSided.entries;
      var next = entries.map(function (entry) { return entry.id; }).join('|');
      if (next !== signature) {
        var cards = new Map(Array.from(list.children).map(function (card) { return [card.dataset.fourSidedEntry, card]; }));
        var fragment = document.createDocumentFragment();
        entries.forEach(function (entry) { fragment.appendChild(cards.get(entry.id) || buildCard(entry)); cards.delete(entry.id); });
        list.replaceChildren(fragment); signature = next;
      }
      Array.from(list.children).forEach(function (card, index) {
        var entry = entryById(card.dataset.fourSidedEntry);
        card.querySelector('[data-four-sided-index]').textContent = '第 ' + (index + 1) + ' 排';
        card.querySelector('[data-four-sided-action="up"]').disabled = index === 0;
        card.querySelector('[data-four-sided-action="down"]').disabled = index === entries.length - 1;
        card.querySelector('[data-four-sided-action="remove"]').disabled = entries.length <= 1;
        card.querySelectorAll('[data-four-sided-field]').forEach(function (input) {
          if (document.activeElement !== input) input.value = entry[input.dataset.fourSidedField] || '';
        });
      });
      if (document.activeElement !== count) count.value = entries.length;
      add.disabled = entries.length >= 12;
      preview.replaceChildren(renderRowThumb(row.elements, 120, row));
    }
    add.addEventListener('click', function () {
      change(function (sign) { return State.addFourSidedEntry(sign, rowId, null, App.measure); });
      var last = list.lastElementChild;
      if (last) { last.scrollIntoView({ block: 'nearest' }); last.querySelector('input').focus(); }
    });
    count.addEventListener('change', function () {
      var number = Number(count.value);
      if (!Number.isFinite(number) || !count.value) { count.value = current().fourSided.entries.length; return; }
      var desired = Math.max(1, Math.min(12, Math.round(number)));
      change(function (sign) {
        var row = sign.rows.find(function (row) { return row.id === rowId; });
        while (row.fourSided.entries.length < desired) {
          sign = State.addFourSidedEntry(sign, rowId, null, App.measure);
          row = sign.rows.find(function (row) { return row.id === rowId; });
        }
        while (row.fourSided.entries.length > desired) {
          sign = State.removeFourSidedEntry(sign, rowId, row.fourSided.entries[row.fourSided.entries.length - 1].id, App.measure);
          row = sign.rows.find(function (row) { return row.id === rowId; });
        }
        return sign;
      });
      count.value = desired;
    });
    function finish() {
      if (finished) return;
      finished = true; mask.remove();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
    close.addEventListener('click', finish); done.addEventListener('click', finish);
    modal.addEventListener('compositionstart', function () { composing = true; });
    modal.addEventListener('compositionend', function () { composing = false; });
    modal.addEventListener('keydown', function (event) {
      if (event.defaultPrevented || composing || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
      if (event.key === 'Tab') {
        var targets = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled)'));
        var first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    paint(); close.focus();
  }

  function buildSignDataEntryPoint(rowId) {
    var root = h('div', { class: 'sign-data-entry' });
    var summary = h('div', { class: 'hint-text', 'data-sign-data-summary': '' });
    var button = h('button', { class: 'btn', text: '从已有线路选择车站', 'data-sign-data-edit': '' });
    function currentRow() { return App.state.rows.find(function (row) { return rowId ? row.id === rowId : global.SignContent.canReplace(row); }); }
    function paint() {
      var row = currentRow();
      root.hidden = !global.SignContent.canReplace(row);
      var context = row && (row.stationContext || row.route && { line: row.route.line, stationId: row.route.line.currentStationId });
      var station = context && context.line.stations.find(function (item) { return item.id === context.stationId; });
      summary.textContent = context ? (context.line.nameZh || context.line.nameEn) + ' · ' +
        (station ? (station.code ? station.code + ' ' : '') + (station.nameZh || station.nameEn) : '未选择车站') : '可选用已保存的线路与站点';
    }
    button.addEventListener('click', function () { var row = currentRow(); if (row) openSignDataPicker(row.id); });
    root.appendChild(summary); root.appendChild(button); paint(); syncFns.push(paint); return root;
  }

  function openSignDataPicker(rowId, allBoards) {
    var Content = global.SignContent, Routes = global.SignRoutes, Workspace = global.SignWorkspace;
    var row = App.state.rows.find(function (item) { return item.id === rowId; });
    var initial = row && (row.stationContext || row.route && {
      line: row.route.line, stationId: row.route.line.currentStationId, source: row.route.source,
    }) || App.state.context;
    var entries = lineEntries(initial);
    if (!initial && entries.length) initial = { line: entries[0].line, stationId: entries[0].line.currentStationId, source: entries[0].source };
    var draft = initial ? Core.deepClone(initial) : null, finished = false, composing = false;
    if (draft) {
      var latest = entries.find(function (entry) { return entry.key === contextKey(draft); });
      if (latest) {
        draft.line = Routes.normalizeLine(latest.line);
        if (!draft.line.stations.some(function (station) { return station.id === draft.stationId; })) draft.stationId = draft.line.currentStationId || draft.line.stations[0] && draft.line.stations[0].id;
      }
    }
    var boards = Workspace.list(App.state), currentBoard = boards.find(function (board) { return board.active; });
    var targets = boards.filter(function (board) { return board.sign.rows.some(Content.canReplace); });
    var previousFocus = document.activeElement;
    var mask = h('div', { class: 'modal-mask sign-data-mask' });
    var modal = h('div', { class: 'modal sign-data-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sign-data-title' });
    var close = h('button', { class: 'icon-btn', text: '✕', 'aria-label': '关闭车站选择' });
    modal.appendChild(h('div', { class: 'route-modal-header' }, [h('h3', { id: 'sign-data-title', text: '选用线路与车站' }), close]));
    var lineSelect = h('select', { 'aria-label': '标识使用的线路', 'data-sign-data-line': '' });
    paintLineOptions(lineSelect, entries, draft ? contextKey(draft) : '');
    var stationSelect = h('select', { 'aria-label': '标识使用的车站', 'data-sign-data-station': '' });
    var direction = h('select', { 'aria-label': '标识运行方向', 'data-sign-data-direction': '' }, [
      h('option', { value: 'forward', text: '正向：首站 → 末站' }), h('option', { value: 'backward', text: '反向：末站 → 首站' }),
    ]);
    var body = h('div', { class: 'sign-data-body' });
    body.appendChild(h('div', { class: 'sign-data-fields' }, [field('线路', lineSelect), field('车站', stationSelect), field('运行方向', direction)]));
    var transfers = h('div', { class: 'sign-data-transfers', 'data-sign-data-transfers': '' }); body.appendChild(transfers);
    var bulk = h('input', { type: 'checkbox', checked: allBoards ? 'checked' : null, 'data-sign-data-bulk': '' });
    body.appendChild(h('label', { class: 'sign-data-bulk-label' }, [bulk, h('span', { text: '同时更换其他牌面' })]));
    var boardList = h('div', { class: 'sign-data-boards', 'aria-label': '参与更换的牌面' });
    targets.forEach(function (board) {
      var check = h('input', { type: 'checkbox', checked: allBoards || board.active ? 'checked' : null, 'data-sign-data-board': board.id });
      boardList.appendChild(h('label', { class: 'sign-data-choice' }, [check, h('span', { text: board.name + (board.active ? '（当前）' : '') })]));
    });
    body.appendChild(boardList);
    body.appendChild(h('div', { class: 'hint-text', text: '应用时按原预设重新生成所选标识的图文，保留牌型与手调比例。已手动修改的文字和位置会重新排版；左侧当前车站保持不变。' }));
    var message = h('div', { class: 'sign-data-status', role: 'status' }); body.appendChild(message);
    var manage = h('button', { class: 'btn', text: '管理线路与站点' });
    var cancel = h('button', { class: 'btn', text: '取消' });
    var apply = h('button', { class: 'btn btn-primary', text: '应用到当前标识', 'data-sign-data-apply': '' });
    modal.appendChild(body); modal.appendChild(h('div', { class: 'sign-data-actions' }, [manage, cancel, apply]));
    mask.appendChild(modal); document.getElementById('modal-root').appendChild(mask);

    function isTransfer() {
      return row && /transfer|interchange/.test(row.templateId || '') || bulk.checked && targets.some(function (board) {
        return board.sign.rows.some(function (item) { return /transfer|interchange/.test(item.templateId || ''); });
      });
    }
    function transferChoices() { return draft ? routeLinesForContext(draft).filter(function (line) { return line.id !== draft.line.id; }) : []; }
    function paintTransfers() {
      transfers.replaceChildren(); transfers.hidden = !draft || !isTransfer();
      if (transfers.hidden) return;
      transfers.appendChild(h('div', { class: 'section-title', text: '换乘到哪些线路' }));
      var station = draft.line.stations.find(function (item) { return item.id === draft.stationId; });
      var choices = transferChoices(), knownIds = [];
      (station && station.transfers || '').split(/[\/、,，;；\r\n|]+/).forEach(function (token) {
        var hit = Routes.colorFor(token, choices);
        if (hit && knownIds.indexOf(hit.id) === -1) knownIds.push(hit.id);
      });
      var selectedIds = Array.isArray(draft.transferLineIds) ? draft.transferLineIds : knownIds;
      choices.forEach(function (line) {
        var check = h('input', { type: 'checkbox', 'data-sign-data-transfer': line.id }); check.checked = selectedIds.indexOf(line.id) !== -1;
        var swatch = h('span', { class: 'sign-data-swatch' }); swatch.style.backgroundColor = line.color;
        check.addEventListener('change', function () {
          draft.transferLineIds = Array.from(transfers.querySelectorAll('input:checked')).map(function (input) { return input.dataset.signDataTransfer; });
        });
        transfers.appendChild(h('label', { class: 'sign-data-choice' }, [check, swatch, h('span', { text: line.nameZh || line.nameEn })]));
      });
      transfers.appendChild(h('div', { class: 'hint-text', text: !choices.length ? '尚无其他已定义线路，可在线路管理中添加。' :
        '可增减换乘线路，各线使用自己的主题色。此次选择只应用到所选牌面。' }));
    }
    function paintStations() {
      stationSelect.replaceChildren();
      if (draft) draft.line.stations.forEach(function (station) {
        stationSelect.appendChild(h('option', { value: station.id, text: (station.code ? station.code + ' ' : '') +
          (station.nameZh || station.nameEn || '未命名车站') + (station.nameEn ? ' · ' + station.nameEn : '') }));
      });
      stationSelect.value = draft && draft.stationId || ''; stationSelect.disabled = !draft || !draft.line.stations.length;
      direction.value = draft ? draft.line.direction : 'forward';
      message.textContent = !draft ? '先在线路管理中创建线路，或选择服务器线路。' : !draft.line.stations.length ? '这条线路还没有站点，请先添加站点。' : '';
      paintTransfers(); paintScope();
    }
    function paintScope() {
      boardList.hidden = !bulk.checked;
      var count = bulk.checked ? boardList.querySelectorAll('input:checked').length : row ? 1 : 0;
      apply.textContent = bulk.checked ? '更换选中的 ' + count + ' 块牌面' : '应用到当前标识';
      apply.disabled = !draft || !draft.line.stations.length || !count;
    }
    lineSelect.addEventListener('change', function () {
      var entry = entries.find(function (item) { return item.key === lineSelect.value; });
      draft = entry ? { line: Routes.normalizeLine(entry.line), stationId: entry.line.currentStationId || entry.line.stations[0] && entry.line.stations[0].id, source: entry.source } : null;
      paintStations();
    });
    stationSelect.addEventListener('change', function () { draft.stationId = stationSelect.value; delete draft.transferLineIds; paintTransfers(); });
    direction.addEventListener('change', function () { draft.line = Routes.patchLine(draft.line, { direction: direction.value }); });
    bulk.addEventListener('change', function () {
      if (bulk.checked) boardList.querySelectorAll('input').forEach(function (input) { input.checked = true; });
      paintTransfers(); paintScope();
    });
    boardList.addEventListener('change', paintScope);
    apply.addEventListener('click', function () {
      if (apply.disabled) return;
      if (isTransfer() && !transfers.hidden) {
        var selected = Array.from(transfers.querySelectorAll('input:checked')).map(function (input) { return input.dataset.signDataTransfer; });
        if (selected.length || Array.isArray(draft.transferLineIds)) draft.transferLineIds = selected;
      }
      var lines = routeLinesForContext(draft), selectedBoards = bulk.checked ? Array.from(boardList.querySelectorAll('input:checked')).map(function (input) { return input.dataset.signDataBoard; }) : [currentBoard.id];
      try {
        App.update(function (sign) {
          return bulk.checked ? Content.replaceBoards(sign, selectedBoards, draft, lines, App.measure)
            : Content.replaceRow(sign, rowId, draft, lines, App.measure);
        });
        var replacedRows = bulk.checked ? boards.filter(function (board) { return selectedBoards.indexOf(board.id) !== -1; })
          .reduce(function (ids, board) { return ids.concat(board.sign.rows.filter(Content.canReplace).map(function (item) { return item.id; })); }, []) : [rowId];
        forgetRouteDrafts(replacedRows);
        var updated = App.state.rows.find(function (item) { return item.id === rowId; }) || App.state.rows.find(Content.canReplace);
        if (updated) selectAddedElements(updated.elements);
        finish(); SignUI.toast(bulk.checked ? '已更换 ' + selectedBoards.length + ' 块牌面' : '已使用选定车站重新生成标识', 'success');
      } catch (error) { message.textContent = error.message || '无法应用车站资料'; }
    });
    function syncPickerSources() {
      if (finished) return;
      entries = lineEntries(draft); paintLineOptions(lineSelect, entries, draft ? contextKey(draft) : '');
    }
    serverCatalogListeners.push(syncPickerSources);
    function finish() {
      if (finished) return; finished = true;
      serverCatalogListeners = serverCatalogListeners.filter(function (listener) { return listener !== syncPickerSources; });
      mask.remove(); if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
    close.addEventListener('click', finish); cancel.addEventListener('click', finish);
    manage.addEventListener('click', function () { finish(); openRouteManager(); });
    modal.addEventListener('compositionstart', function () { composing = true; });
    modal.addEventListener('compositionend', function () { composing = false; });
    modal.addEventListener('keydown', function (event) {
      if (event.defaultPrevented || composing || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
      if (event.key === 'Tab') {
        var controls = Array.from(modal.querySelectorAll('button,input,select')).filter(function (node) { return !node.disabled && node.getClientRects().length; });
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
      }
    });
    paintStations(); lineSelect.focus();
  }

  function buildSettingsPanel() {
    var s = App.state;
    var root = h('div');

    root.appendChild(buildSignDataEntryPoint());
    root.appendChild(buildFourSidedEntryPoint());

    var rowHeightInput = numberInput({ min: '32', max: '2048', step: '4' }, function (v) {
      App.update(function (st) {
        return State.updateSignSettings(st, { rowHeight: Math.round(Core.clamp(v, 32, 2048)) });
      });
    });
    rowHeightInput.value = s.rowHeight;
    bindSync(rowHeightInput, function () { return App.state.rowHeight; });
    var heightField = field('行高（px）', rowHeightInput, '元素与内边距按行高等比适配');
    root.appendChild(heightField);

    var rowCount = h('input', { type: 'number', value: s.rows.length, disabled: 'disabled' });
    bindSync(rowCount, function () { return App.state.rows.length; });
    var rowCountField = field('行数（由添加/删除行控制）', rowCount);
    function paintRowLabels() {
      var four = App.state.rows.length === 1 && !!App.state.rows[0].fourSided;
      rowCountField.hidden = four;
      heightField.querySelector('label').textContent = four ? '牌面高度（px）' : '行高（px）';
      heightField.querySelector('.hint-text').textContent = four ? '整牌输出高度；信息排数在逐排编辑中调整' : '元素与内边距按行高等比适配';
    }
    paintRowLabels(); syncFns.push(paintRowLabels);
    root.appendChild(rowCountField);
    root.appendChild(buildRowAspectEditor());

    root.appendChild(field('宽度模式', segGroup([
      { value: 'fixed', label: '固定' },
      { value: 'dynamic', label: '动态' },
    ], function () { return App.state.widthMode; }, function (v) {
      App.update(function (st) { return State.updateSignSettings(st, { widthMode: v }); });
    })));

    var widthInput = numberInput({ min: '64', max: '32768', step: '16' }, function (v) {
      App.update(function (st) {
        return State.updateSignSettings(st, { width: Math.round(Core.clamp(v, 64, 32768)) });
      });
    });
    widthInput.value = s.width;
    bindSync(widthInput, function () { return App.state.width; });
    var widthField = field('固定宽度（px）', widthInput);
    syncFns.push(function () {
      widthField.style.display = App.state.widthMode === 'fixed' ? '' : 'none';
    });
    widthField.style.display = s.widthMode === 'fixed' ? '' : 'none';
    root.appendChild(widthField);

    var dynamicHint = h('div', { class: 'hint-text', text: '' });
    syncFns.push(function () {
      dynamicHint.style.display = App.state.widthMode === 'dynamic' ? '' : 'none';
      dynamicHint.textContent = '当前动态宽度：' + (App.layout ? App.layout.width : '–') + ' px（由最宽行决定）';
    });
    dynamicHint.style.display = s.widthMode === 'dynamic' ? '' : 'none';
    root.appendChild(dynamicHint);

    root.appendChild(checkbox('锁定宽高比', function () { return App.state.aspectLocked; }, function (v) {
      App.update(function (st) { return State.updateSignSettings(st, { aspectLocked: v }); });
    }));

    var bgColor = buildColorPicker({
      value: s.backgroundColor,
      onChange: function (v) {
        App.update(function (st) {
          return State.updateSignSettings(st, { backgroundColor: v || '#FFFFFF' });
        });
      },
    });
    root.appendChild(field('标识牌背景色', bgColor));

    var frameWidthInput = numberInput({ class: 'frame-width-input', min: '0', max: '512', step: '1' }, function (v) {
      App.update(function (st) {
        return State.updateSignSettings(st, { frameWidth: Math.round(Core.clamp(v, 0, 512)) });
      });
    });
    frameWidthInput.value = s.frameWidth;
    bindSync(frameWidthInput, function () { return App.state.frameWidth; });
    root.appendChild(field('灰框宽度（px）', frameWidthInput,
      '每行牌面从边缘向内延伸的直角灰框，模拟真实标识牌边框；0 为不显示'));

    root.appendChild(h('div', { class: 'divider' }));
    root.appendChild(h('div', { class: 'section-title', text: '编辑器' }));
    root.appendChild(checkbox('输入线路号自动匹配线路色', function () { return App.prefs.autoLineColor; }, function (v) {
      setAutoLineColor(v);
    }));
    root.appendChild(h('div', {
      class: 'hint-text',
      text: '开启后在线路列表输入线路号时自动填充当前城市的线路色；城市可在任意颜色选择器顶部的下拉菜单切换。',
    }));

    root.appendChild(h('button', {
      class: 'btn btn-danger', text: '🗑 清空标识牌',
      style: 'margin-top:6px',
    })).addEventListener('click', function () {
      SignUI.confirmDialog('确定要清空所有行和元素吗？', '清空标识牌', '清空').then(function (ok) {
        if (!ok) return;
        App.update(State.clearSign);
        App.select(null);
        SignUI.toast('标识牌已清空');
      });
    });

    root.appendChild(h('div', { class: 'divider' }));
    root.appendChild(h('div', { class: 'section-title', text: '导出' }));
    // 导出前可能要加载内嵌字体（fonts-data.js 约 7 MB），加载期间按钮保持忙碌态，
    // 避免慢网络下「点了没反应」；失败由导出函数 toast 错误。
    function exportButton(text, run) {
      var btn = h('button', { class: 'btn btn-primary', text: text });
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var original = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ 正在准备字体…';
        function done() { btn.disabled = false; btn.textContent = original; }
        run().then(done, done);
      });
      return btn;
    }
    root.appendChild(exportButton('⬇ 导出 SVG', function () {
      return SignExporters.exportSVGFile(App.state, App.measure);
    }));
    root.appendChild(exportButton('⬇ 导出 PNG', function () {
      return SignExporters.exportPNGFile(App.state, App.measure);
    }));

    root.appendChild(h('div', { class: 'divider' }));
    root.appendChild(h('div', { class: 'section-title', text: '项目' }));
    root.appendChild(h('button', { class: 'btn', text: '📤 导出项目（JSON）' })).addEventListener('click', function () {
      SignStorage.exportProject(App.state);
    });
    root.appendChild(h('button', { class: 'btn', text: '📥 导入项目（JSON）' })).addEventListener('click', function () {
      SignStorage.pickImportFile().then(function (file) {
        if (!file) return;
        SignStorage.importProject(file).then(function (sign) {
          App.update(function () { return sign; });
          App.select(null);
          SignUI.toast('项目导入成功', 'success');
        }, function (err) {
          SignUI.toast(err.message, 'error');
        });
      });
    });

    return root;
  }

  // ─── 元素属性面板 ──────────────────────────────────────────

  function patchProps(elementId, patch) {
    App.update(function (st) { return State.updateElementProps(st, elementId, patch); });
  }

  function buildElementPanel() {
    var found = State.findElement(App.state, App.selection.elementId);
    if (!found) return h('div', { class: 'hint-text', text: '元素不存在' });
    var el = found.element;

    // 状态是不可变更新：每次 patch 后 el 都会变成过期快照。
    // 回调与值同步必须经 live() 重查当前元素，否则编辑会互相回滚。
    var live = function () {
      var cur = State.findElement(App.state, el.id);
      return cur ? cur.element : el;
    };

    var root = h('div');
    root.appendChild(h('div', { class: 'section-title', text: TYPE_NAMES[el.type] }));
    root.appendChild(buildSignDataEntryPoint(found.rowId));
    var sizing = buildRowAspectEditor(function () { return el.id; });
    var output = sizing.querySelector('.aspect-output-card');
    if (output) output.remove();
    root.appendChild(sizing);
    if (App.state.rows[found.rowIndex].fourSided || App.state.rows[found.rowIndex].templateId === 'four-sided-guide') {
      root.appendChild(buildFourSidedEntryPoint(found.rowId));
    }
    if (App.state.rows[found.rowIndex].route) {
      var editRoute = h('button', { class: 'btn btn-primary', text: '编辑此线路', 'data-route-edit': found.rowId });
      editRoute.addEventListener('click', function () {
        var now = State.findElement(App.state, el.id);
        if (now) openRouteManager(now.rowId);
      });
      root.appendChild(editRoute);
    }

    switch (el.type) {
      case 'arrow': buildArrowFields(root, el, live); break;
      case 'bilingual-text': buildBilingualFields(root, el, live); break;
      case 'big-number': buildBigNumberFields(root, el, live); break;
      case 'number-line': buildNumberLineFields(root, el, live); break;
      case 'text-line': buildTextLineFields(root, el, live); break;
      case 'entrance':
      case 'exit': buildCodeFields(root, el, live); break;
      case 'space': buildSpaceFields(root, el, live); break;
      case 'icon': buildIconFields(root, el, live); break;
      case 'crt-sign': buildCRTFields(root, el, live); break;
      case 'plain-text': buildPlainTextFields(root, el, live); break;
      case 'shape': buildShapeFields(root, el, live); break;
    }

    if (el.props.contrastSourceId) {
      var contrast = checkbox('随背景自动黑白', function () { return live().props.autoContrast !== false; }, function (value) {
        patchProps(el.id, { autoContrast: value });
      });
      var contrastInput = contrast.querySelector('input');
      contrastInput.setAttribute('data-auto-contrast', '');
      contrastInput.setAttribute('aria-label', '随背景自动黑白');
      function paintContrast() { contrast.hidden = !live().props.contrastSourceId; }
      paintContrast(); syncFns.push(paintContrast);
      root.appendChild(contrast);
    }

    if (found.element.props.box || App.state.rows[found.rowIndex].layout === 'free') buildBoxFields(root, el, live);

    // 元素对齐：仅固定宽度模式支持（动态宽度整体左起排列）。
    // 编辑过程中宽度模式不会变化（它在设置面板里，与本面板互斥），构建时判断即可。
    if (App.state.widthMode === 'fixed' && App.state.rows[found.rowIndex].layout !== 'free') {
      root.appendChild(field('元素对齐', segGroup([
        { value: 'left', label: '贴左' },
        { value: 'center', label: '居中' },
        { value: 'right', label: '贴右' },
      ], function () { return live().props.elementAlign; }, function (v) {
        patchProps(el.id, { elementAlign: v });
      })));
    }

    if (el.type !== 'exit' && el.type !== 'crt-sign') {
      root.appendChild(h('div', { class: 'divider' }));
      root.appendChild(buildBackgroundPicker(el));
    }
    if (['space', 'crt-sign', 'plain-text', 'shape'].indexOf(el.type) === -1 && !el.props.box) {
      root.appendChild(buildPaddingEditor(el, live));
    }

    if (output) root.appendChild(output);
    root.appendChild(h('div', { class: 'divider' }));
    var del = h('button', { class: 'btn btn-danger', text: '🗑 删除元素' });
    del.addEventListener('click', function () {
      App.update(function (st) { return State.deleteElement(st, el.id); });
      App.select(null);
      SignUI.toast('元素已删除');
    });
    root.appendChild(del);
    return root;
  }

  function buildArrowFields(root, el, live) {
    root.appendChild(field('方向', segGroup([
      { value: 'left', label: '←', title: '向左' },
      { value: 'left-up', label: '↖', title: '向左上' },
      { value: 'up', label: '↑', title: '向上' },
      { value: 'right-up', label: '↗', title: '向右上' },
      { value: 'right', label: '→', title: '向右' },
      { value: 'right-down', label: '↘', title: '向右下' },
      { value: 'down', label: '↓', title: '向下' },
      { value: 'left-down', label: '↙', title: '向左下' },
    ], function () { return live().props.direction; }, function (v) {
      patchProps(el.id, { direction: v });
    })));

    var range = h('input', { type: 'range', min: '0.1', max: '0.5', step: '0.05' });
    var pct = h('span', { class: 'hint-text' });
    range.value = el.props.thicknessRatio;
    range.addEventListener('input', function () {
      pct.textContent = Math.round(range.value * 100) + '%';
      patchProps(el.id, { thicknessRatio: parseFloat(range.value) });
    });
    pct.textContent = Math.round(el.props.thicknessRatio * 100) + '%';
    root.appendChild(field('粗细比例', h('div', {}, [range, pct])));

    root.appendChild(field('颜色', buildColorPicker({
      value: el.props.color,
      getValue: function () { return live().props.color; },
      onChange: function (v) { patchProps(el.id, { color: v }); },
    })));
  }

  function buildCRTFields(root, el, live) {
    var t = global.SignCRT.get(el.props.templateId);
    root.appendChild(h('div', { class: 'crt-template-name', text: t.name }));
    var source = t.source || {};
    root.appendChild(h('div', { class: 'hint-text crt-source', text:
      '标准 ' + (source.section || '') + ' · PDF 第 ' + source.page + ' 页' +
      (source.figure ? ' · ' + source.figure : '') +
      '；参考尺寸 ' + t.width + ' × ' + t.height + ' mm' + (source.note ? '。' + source.note : '')
    }));
    t.fields.forEach(function (definition) {
      var key = definition.key;
      var input;
      var commit = function (value) {
        var next = Object.assign({}, live().props.fields);
        next[key] = value;
        patchProps(el.id, { fields: next });
      };
      if (definition.multiline) {
        input = h('textarea', { rows: '5', 'data-crt-field': key, 'aria-label': definition.label });
        input.value = el.props.fields[key] || '';
        input.addEventListener('input', function () { commit(input.value); });
      } else {
        input = textInput({ value: el.props.fields[key] || '', 'data-crt-field': key, 'aria-label': definition.label }, commit);
      }
      bindSync(input, function () { return live().props.fields[key] || ''; });
      root.appendChild(field(definition.label, input, definition.hint ||
        (key === 'stations' ? '每行一站：中文名 | 英文名 | 站点编号' :
          definition.multiline && t.layout === 'information' ? '可换行；表格每列用 | 分隔' : undefined)));
    });
    if (t.layout === 'guide' || t.directional) {
      root.appendChild(field('方向', segGroup([
        { value: 'left', label: '←' }, { value: 'left-up', label: '↖' },
        { value: 'up', label: '↑' }, { value: 'right-up', label: '↗' },
        { value: 'right', label: '→' }, { value: 'right-down', label: '↘' },
        { value: 'down', label: '↓' }, { value: 'left-down', label: '↙' },
      ], function () { return live().props.direction; }, function (value) { patchProps(el.id, { direction: value }); })));
    }
    if (['guide', 'station', 'route'].indexOf(t.layout) !== -1 || t.colorEditable) {
      root.appendChild(checkbox('按重庆线路自动配色', function () {
        return live().props.lineColorMode !== 'custom';
      }, function (enabled) {
        patchProps(el.id, enabled ? { lineColorMode: 'auto' } : { lineColorMode: 'custom', lineColor: currentLineColor() });
      }));
      function currentLineColor() {
        return global.SignComposition ? global.SignComposition.primaryColor(t, live().props) : live().props.lineColor;
      }
      root.appendChild(field('线路色', buildColorPicker({ value: currentLineColor(), getValue: currentLineColor,
        onChange: function (value) { patchProps(el.id, { lineColor: value }); },
      })));
    }
    var ratio = numberInput({ min: '0.1', max: '64', step: '0.05', 'aria-label': '矩形宽高比' }, function (value) {
      patchProps(el.id, { widthRatio: Core.clamp(value, 0.1, 64) });
    });
    ratio.value = el.props.widthRatio;
    bindSync(ratio, function () { return live().props.widthRatio; });
    root.appendChild(field('矩形宽高比', ratio, '高度跟随所在行的行高；默认保持标准大样比例'));
    var resetRatio = h('button', { class: 'btn', text: '恢复参考比例' });
    resetRatio.addEventListener('click', function () { patchProps(el.id, { widthRatio: t.width / t.height }); });
    root.appendChild(resetRatio);
    var convert = h('button', { class: 'btn crt-convert', text: '转为基础元素编辑' });
    function paintConvert() { convert.hidden = !global.SignComposition; }
    paintConvert();
    syncFns.push(paintConvert);
    convert.addEventListener('click', function () {
      var elements = global.SignComposition && global.SignComposition.materialize(t.id, live().props, App.measure);
      if (!elements || !elements.length) return;
      App.update(function (sign) { return State.replaceElementWithElements(sign, el.id, elements); });
      selectAddedElements(elements);
      SignUI.toast('已转为可分别编辑的基础元素', 'success');
    });
    root.appendChild(convert);
  }

  var rememberedRouteDraft = null;
  var rememberedRouteDrafts = Object.create(null);
  var rememberedRouteDirty = Object.create(null);
  var rememberedRouteOrigin = 'local';
  function routeDraftKey(origin, id) { return origin + ':' + id; }
  function forgetRouteDrafts(rowIds) {
    Object.keys(rememberedRouteDrafts).forEach(function (key) {
      if (!rowIds.some(function (rowId) { return key.endsWith(':row:' + rowId); })) return;
      delete rememberedRouteDrafts[key]; delete rememberedRouteDirty[key];
    });
  }

  function openRouteManager(rowId) {
    var Routes = global.SignRoutes;
    if (!Routes) { SignUI.toast('线路管理尚未就绪，请刷新后重试', 'error'); return; }
    var editingRow = App.state.rows.filter(function (row) { return row.id === rowId; })[0];
    var source = editingRow && editingRow.route;
    var initialLine = source ? source.line : App.state.context && Routes.forContext(App.state.context, routeLinesForContext(App.state.context)) || rememberedRouteDraft || Routes.createLine();
    var draftOrigin = source ? source.source === 'server' ? 'server' : 'local'
      : App.state.context ? App.state.context.source === 'server' ? 'server' : 'local' : rememberedRouteOrigin;
    function scopedDraftKey(origin, id) { return routeDraftKey(origin, id) + (rowId ? ':row:' + rowId : ':manager'); }
    var initialKey = scopedDraftKey(draftOrigin, initialLine.id);
    var draft = Routes.normalizeLine(rememberedRouteDirty[initialKey] && rememberedRouteDrafts[initialKey] || initialLine);
    var sourceDrafts = {}, draftDirty = !!rememberedRouteDirty[initialKey];
    var orientation = source && source.orientation || 'horizontal';
    var applyRowId = editingRow ? editingRow.id : null;
    var previewTimer = null;
    var composing = false;
    var finished = false;
    var previousFocus = document.activeElement;
    var mask = h('div', { class: 'modal-mask route-mask' });
    var modal = h('div', { class: 'modal route-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'route-manager-title' });
    var close = h('button', { class: 'icon-btn', text: '✕', title: '关闭线路管理', 'aria-label': '关闭线路管理' });
    modal.appendChild(h('div', { class: 'route-modal-header' }, [h('h3', { id: 'route-manager-title', text: '线路管理' }), close]));
    var status = h('div', { class: 'route-status', role: 'status', text: '新建线路并选择本站后，可用于制作车站标识，或将线路图放入牌面。' });
    var library = h('select', { 'aria-label': '已保存线路', 'data-route-library': '' });
    var routeSource = h('select', { 'aria-label': '线路列表来源', 'data-route-source': '' }, [
      h('option', { value: 'local', text: '我的线路' }), h('option', { value: 'server', text: '服务器线路' }),
    ]);
    routeSource.value = draftOrigin;
    var create = h('button', { class: 'btn', text: '新建线路', 'data-route-action': 'new' });
    var removeLine = h('button', { class: 'btn', text: '删除线路', 'data-route-action': 'delete-line' });
    var refreshServer = h('button', { class: 'btn', text: '刷新服务器列表', 'data-route-action': 'refresh-server' });
    var serverStatus = h('div', { class: 'server-lines-status', role: 'status', 'data-server-lines-status': '' });
    modal.appendChild(h('div', { class: 'route-library-bar' }, [routeSource, library, refreshServer, create, removeLine]));
    modal.appendChild(serverStatus);
    var workspace = h('div', { class: 'route-workspace' });
    var editor = h('div', { class: 'route-editor' });
    var config = h('div', { class: 'route-config-grid' });
    var nameZh = h('input', { type: 'text', 'aria-label': '线路中文名', 'data-route-field': 'nameZh' });
    var nameEn = h('input', { type: 'text', 'aria-label': '线路英文名', 'data-route-field': 'nameEn' });
    var color = h('input', { type: 'color', 'aria-label': '线路颜色', 'data-route-field': 'color' });
    var colorHex = h('input', { type: 'text', maxlength: '7', 'aria-label': '线路色值', 'data-route-field': 'colorHex' });
    var direction = h('select', { 'aria-label': '运行方向', 'data-route-field': 'direction' }, [
      h('option', { value: 'forward', text: '正向：首站 → 末站' }), h('option', { value: 'backward', text: '反向：末站 → 首站' }),
    ]);
    var layout = h('select', { 'aria-label': '线路图排版', 'data-route-field': 'orientation' }, [
      h('option', { value: 'horizontal', text: '横向线路图' }), h('option', { value: 'vertical', text: '竖向线路图' }),
    ]);
    config.appendChild(field('线路中文名', nameZh)); config.appendChild(field('线路英文名', nameEn));
    config.appendChild(field('线路颜色', h('div', { class: 'route-color-inputs' }, [color, colorHex])));
    config.appendChild(field('运行方向', direction)); config.appendChild(field('排版', layout));
    editor.appendChild(config);
    var stationTitle = h('span');
    var add = h('button', { class: 'btn', text: '＋ 添加站点', 'data-route-action': 'add-station' });
    editor.appendChild(h('div', { class: 'route-station-heading' }, [stationTitle, add]));
    var stations = h('div', { class: 'route-stations' }); editor.appendChild(stations);
    var preview = h('div', { class: 'route-preview', 'aria-label': '线路图预览' });
    workspace.appendChild(editor);
    workspace.appendChild(h('aside', { class: 'route-preview-panel' }, [h('div', { class: 'section-title', text: '线路图预览' }), preview,
      h('div', { class: 'hint-text', text: '站点顺序决定线路排列；选择本站后，已经过的区段会显示为灰色。' })]));
    modal.appendChild(workspace); modal.appendChild(status);
    var save = h('button', { class: 'btn', text: '保存到本地', 'data-route-action': 'save' });
    var makeStationSigns = h('button', { class: 'btn', text: '用于制作车站标识', 'data-route-action': 'context' });
    var exportFile = h('button', { class: 'btn', text: '导出线路文件', 'data-route-action': 'export' });
    var importFile = h('button', { class: 'btn', text: '导入线路文件', 'data-route-action': 'import' });
    var exportCatalog = h('button', { class: 'btn', text: '导出服务器线路列表', 'data-route-action': 'export-catalog',
      title: '将本地已保存的全部线路导出为 data/lines.json，由管理员上传到网站后发布' });
    var fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: 'hidden', 'aria-label': '导入线路JSON文件', 'data-route-file': '' });
    var apply = h('button', { class: 'btn btn-primary', text: applyRowId ? '保存并更新牌面' : '保存并放入牌面', 'data-route-action': 'apply' });
    modal.appendChild(h('div', { class: 'route-modal-actions' }, [importFile, exportFile, exportCatalog, save, makeStationSigns, apply, fileInput]));
    mask.appendChild(modal); document.getElementById('modal-root').appendChild(mask);

    function rememberDraft() {
      rememberedRouteDraft = Routes.normalizeLine(draft);
      rememberedRouteOrigin = draftOrigin;
      rememberedRouteDrafts[scopedDraftKey(draftOrigin, draft.id)] = rememberedRouteDraft;
      rememberedRouteDirty[scopedDraftKey(draftOrigin, draft.id)] = draftDirty;
      sourceDrafts[draftOrigin] = rememberedRouteDraft;
    }
    function message(text, error) { status.textContent = text; status.classList.toggle('error', !!error); }
    function refreshLibrary() {
      var publicList = routeSource.value === 'server';
      var lines = publicList ? serverCatalog.lines : Routes.list();
      library.innerHTML = '';
      var active = draftOrigin === routeSource.value && !draftDirty || !publicList && draftOrigin === 'local';
      if (publicList && (!active || !lines.some(function (line) { return line.id === draft.id; }))) {
        library.appendChild(h('option', { value: '', text: lines.length ? '选择服务器线路重新载入…' : '暂无服务器线路' }));
      } else if (!publicList && draftOrigin === 'local' && !lines.some(function (line) { return line.id === draft.id; })) {
        library.appendChild(h('option', { value: draft.id, text: '未保存 · ' + (draft.nameZh || '新建线路') }));
      }
      lines.forEach(function (line) { library.appendChild(h('option', { value: line.id, text: line.nameZh || line.nameEn || '未命名线路' })); });
      library.value = active ? draft.id : '';
      library.disabled = publicList && !lines.length;
      removeLine.disabled = draftOrigin === 'server' || !Routes.list().some(function (line) { return line.id === draft.id; });
      save.textContent = draftOrigin === 'server' ? '另存到我的线路' : '保存到本地';
      apply.textContent = (draftOrigin === 'server' ? '' : '保存并') + (applyRowId ? '更新牌面' : '放入牌面');
      refreshServer.hidden = !publicList; refreshServer.disabled = serverCatalog.loading;
      serverStatus.hidden = !publicList;
      if (publicList) {
        serverStatus.classList.toggle('error', !!serverCatalog.error);
        serverStatus.textContent = serverCatalog.loading ? '正在读取服务器线路…' : serverCatalog.error
          ? '服务器列表读取失败：' + serverCatalog.error + '。可继续使用本地线路' + (serverCatalog.lines.length ? '或上次读取的列表。' : '。')
          : (serverCatalog.lines.length ? serverCatalog.lines.length + ' 条服务器线路' : '服务器尚未发布线路') +
            (serverCatalog.updatedAt ? ' · 更新于 ' + serverCatalog.updatedAt : '') +
            (serverCatalog.warnings.length ? ' · 已跳过 ' + serverCatalog.warnings.length + ' 个无效条目' : '') +
            '。修改仅保存在个人草稿，公共列表由管理员上传更新。';
      }
    }
    function routeContent() {
      var template = editingRow && editingRow.templateId && global.SignCRT.get(editingRow.templateId);
      if (template && template.layout === 'route' && orientation === source.orientation) {
        var context = { line: draft, stationId: draft.currentStationId, source: draftOrigin };
        return global.SignContent.build(template.id, context, routeLinesForContext(context), App.measure);
      }
      var result = Routes.materialize(draft, orientation, App.measure);
      return { elements: result.elements, options: { widthRatio: result.widthRatio,
        route: Object.assign({}, result.route, { source: draftOrigin }),
        stationContext: { line: draft, stationId: draft.currentStationId, source: draftOrigin } } };
    }
    function drawPreview() {
      previewTimer = null;
      try {
        var result = routeContent();
        preview.innerHTML = '';
        preview.appendChild(renderRowThumb(result.elements, 240, result.options));
      } catch (error) { preview.textContent = error.message; }
    }
    function changed() {
      draftDirty = true;
      rememberDraft();
      if (draftOrigin === 'server') refreshLibrary();
      message(draftOrigin === 'server' ? '已修改个人草稿；另存到我的线路可保留，服务器列表不会改变。' : '线路已修改；保存到本地后可下次继续使用。');
      if (previewTimer) clearTimeout(previewTimer);
      previewTimer = setTimeout(drawPreview, 100);
    }
    function patchLine(patch) { draft = Routes.patchLine(draft, patch); changed(); }
    nameZh.addEventListener('input', function () { patchLine({ nameZh: nameZh.value }); });
    nameEn.addEventListener('input', function () { patchLine({ nameEn: nameEn.value }); });
    color.addEventListener('input', function () { colorHex.value = color.value.toUpperCase(); patchLine({ color: color.value }); });
    colorHex.addEventListener('input', function () {
      var hex = Core.normalizeHex(colorHex.value);
      colorHex.classList.toggle('invalid', !hex);
      if (hex) { color.value = hex; patchLine({ color: hex }); }
    });
    colorHex.addEventListener('blur', function () { colorHex.value = draft.color; colorHex.classList.remove('invalid'); });
    direction.addEventListener('change', function () { patchLine({ direction: direction.value }); });
    layout.addEventListener('change', function () { orientation = layout.value; changed(); });

    function rebuildStations() {
      stations.innerHTML = '';
      stationTitle.textContent = '站点（' + draft.stations.length + '）';
      add.disabled = draft.stations.length >= Routes.MAX_STATIONS;
      if (!draft.stations.length) stations.appendChild(h('div', { class: 'palette-empty', text: '添加站点，开始绘制这条线路。' }));
      draft.stations.forEach(function (station, index) {
        var entry = h('div', { class: 'route-station', 'data-route-station': station.id });
        var radio = h('input', { type: 'radio', name: 'route-current-station', value: station.id, 'aria-label': '第' + (index + 1) + '站为本站', 'data-station-current': '' });
        radio.checked = draft.currentStationId === station.id;
        radio.addEventListener('change', function () { patchLine({ currentStationId: station.id }); });
        var actions = h('div', { class: 'route-station-actions' });
        [['up', '↑', '上移站点', -1], ['down', '↓', '下移站点', 1], ['remove', '删除', '删除站点', 0]].forEach(function (definition) {
          var button = h('button', { class: 'route-station-action', text: definition[1], title: definition[2], 'aria-label': '第' + (index + 1) + '站' + definition[2], 'data-station-action': definition[0] });
          button.disabled = definition[0] === 'up' && index === 0 || definition[0] === 'down' && index === draft.stations.length - 1;
          button.addEventListener('click', function () {
            var at = draft.stations.findIndex(function (s) { return s.id === station.id; });
            draft = definition[0] === 'remove' ? Routes.removeStation(draft, station.id) : Routes.moveStation(draft, at, at + definition[3]);
            rebuildStations(); changed();
          });
          actions.appendChild(button);
        });
        entry.appendChild(h('div', { class: 'route-station-top' }, [h('strong', { text: String(index + 1).padStart(2, '0') }),
          h('label', { class: 'route-current-label' }, [radio, document.createTextNode('本站')]), actions]));
        var fields = h('div', { class: 'route-station-fields' });
        [['nameZh', '中文站名'], ['nameEn', '英文站名'], ['code', '站点编号'], ['transfers', '换乘线路']].forEach(function (definition) {
          var input = h('input', { type: 'text', value: station[definition[0]], 'aria-label': '第' + (index + 1) + '站' + definition[1], 'data-station-field': definition[0], placeholder: definition[0] === 'transfers' ? '如：1号线 / 环线' : '' });
          input.addEventListener('input', function () {
            var patch = {}; patch[definition[0]] = input.value;
            draft = Routes.updateStation(draft, station.id, patch); changed();
          });
          fields.appendChild(field(definition[1], input));
        });
        entry.appendChild(fields); stations.appendChild(entry);
      });
    }
    function loadDraft(line, origin, restoreDirty) {
      if (origin) draftOrigin = origin;
      routeSource.value = draftOrigin;
      draftDirty = !!restoreDirty;
      draft = Routes.normalizeLine(line); rememberDraft();
      nameZh.value = draft.nameZh; nameEn.value = draft.nameEn; color.value = draft.color; colorHex.value = draft.color;
      direction.value = draft.direction; layout.value = orientation;
      rebuildStations(); refreshLibrary(); drawPreview();
    }
    add.addEventListener('click', function () {
      try {
        draft = Routes.addStation(draft, { nameZh: '新站点', nameEn: '', code: String(draft.stations.length + 1).padStart(2, '0'), transfers: '' });
        rebuildStations(); changed();
        var last = stations.lastElementChild;
        if (last) { last.scrollIntoView({ block: 'nearest' }); var input = last.querySelector('input[type=text]'); if (input) { input.focus(); input.select(); } }
      } catch (error) { message(error.message, true); }
    });
    create.addEventListener('click', function () { rememberDraft(); applyRowId = null; loadDraft(Routes.createLine(), 'local'); message('已新建线路，填写名称和站点后保存。'); nameZh.focus(); nameZh.select(); });
    routeSource.addEventListener('change', function () {
      rememberDraft();
      var origin = routeSource.value, lines = origin === 'server' ? serverCatalog.lines : Routes.list();
      var resume = sourceDrafts[origin], chosen = resume || lines[0];
      var dirty = resume && rememberedRouteDirty[scopedDraftKey(origin, resume.id)];
      if (chosen) { if (!editingRow) applyRowId = null; loadDraft(chosen, origin, dirty); }
      else refreshLibrary();
      if (origin === 'server' && !serverCatalog.loaded && !serverCatalog.loading) refreshServerLines();
      message(origin === 'server' ? '选择服务器线路使用；修改和另存不会更新公共列表。' : '已切换到我的线路。');
    });
    refreshServer.addEventListener('click', refreshServerLines);
    function syncServerLibrary() {
      if (finished) return;
      if (!serverCatalog.loading && !serverCatalog.error && draftOrigin === 'server' && !draftDirty) {
        var fresh = serverCatalog.lines.find(function (line) { return line.id === draft.id; });
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(draft)) { loadDraft(fresh, 'server'); return; }
      }
      refreshLibrary();
    }
    serverCatalogListeners.push(syncServerLibrary);
    library.addEventListener('change', function () {
      var origin = routeSource.value;
      var line = (origin === 'server' ? serverCatalog.lines : Routes.list()).filter(function (item) { return item.id === library.value; })[0];
      if (line) { if (!editingRow) applyRowId = null; loadDraft(line, origin); message(origin === 'server' ? '已载入服务器线路的个人草稿。' : '已载入本地线路。'); }
    });
    function saveDraft() {
      if (Routes.withRelatedLines) draft = Routes.withRelatedLines(draft, draftOrigin === 'server' ? serverCatalog.lines : localRouteLines());
      var copied = draftOrigin === 'server';
      var saved = Routes.save(copied ? Routes.createLine(Object.assign({}, draft, { id: Core.uuid() })) : draft);
      draft = saved; draftDirty = false;
      if (copied) { draftOrigin = 'local'; routeSource.value = 'local'; }
      rememberDraft(); refreshLibrary();
      if (App.state.context && App.state.context.source !== 'server' && App.state.context.line.id === draft.id) {
        App.update(function (sign) { return State.setProjectContext(sign, { line: draft, stationId: sign.context.stationId, source: 'local' }); });
        var palette = document.getElementById('palette'); refreshBasicPalette(palette); refreshCRTCards();
      }
      refreshLinePalettes(true);
      if (copied) setPaletteCity('fictional');
      message(copied ? '已另存为新的本地线路，服务器列表未改变。' : '已保存到本地线路库。'); return draft;
    }
    function prepareForUse() {
      if (draftOrigin !== 'server') return saveDraft();
      if (Routes.withRelatedLines) draft = Routes.withRelatedLines(draft, serverCatalog.lines);
      rememberDraft(); setPaletteCity('server'); return draft;
    }
    save.addEventListener('click', function () { try { saveDraft(); } catch (error) { message(error.message, true); } });
    exportFile.addEventListener('click', function () {
      try {
        if (Routes.withRelatedLines) draft = Routes.withRelatedLines(draft, draftOrigin === 'server' ? serverCatalog.lines : localRouteLines());
        var json = Routes.serialize(draft);
        var name = (draft.nameZh || draft.nameEn || '线路').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
        global.SignStorage.download(new Blob([json], { type: 'application/json;charset=utf-8' }), name + '.railway-line.json');
        message('已导出独立线路文件。');
      } catch (error) { message(error.message, true); }
    });
    exportCatalog.addEventListener('click', function () {
      try {
        var local = Routes.list();
        var lines = local.map(function (line) { return Routes.withRelatedLines ? Routes.withRelatedLines(line, local) : line; });
        var json = global.SignLineCatalog.serialize(lines, { updatedAt: new Date().toISOString() });
        global.SignStorage.download(new Blob([json], { type: 'application/json;charset=utf-8' }), 'lines.json');
        message('已导出本地已保存的全部 ' + lines.length + ' 条线路；由管理员上传到网站 data/lines.json 后发布。');
      } catch (error) { message(error.message, true); }
    });
    importFile.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      file.text().then(function (text) {
        var imported = Routes.deserialize(text);
        imported = Routes.save(imported); applyRowId = null; apply.textContent = '保存并放入牌面';
        if (App.state.context && App.state.context.source !== 'server' && App.state.context.line.id === imported.id) {
          App.update(function (sign) { return State.setProjectContext(sign, { line: imported, stationId: sign.context.stationId, source: 'local' }); });
          var palette = document.getElementById('palette'); refreshBasicPalette(palette); refreshCRTCards();
        }
        loadDraft(imported, 'local'); refreshLinePalettes(true); message('已导入并保存线路「' + (imported.nameZh || imported.nameEn) + '」。');
      }).catch(function (error) { message(error.message, true); }).then(function () { fileInput.value = ''; });
    });
    removeLine.addEventListener('click', function () {
      SignUI.confirmDialog('删除本地线路「' + (draft.nameZh || draft.nameEn || '未命名线路') + '」？已放入的牌面会保留。', '删除线路').then(function (ok) {
        if (!ok) return;
        try { var remaining = Routes.remove(draft.id); loadDraft(remaining[0] || Routes.createLine()); refreshLinePalettes(true); message('已删除本地线路。'); }
        catch (error) { message(error.message, true); }
      });
    });
    function finish() {
      if (finished) return;
      finished = true;
      if (previewTimer) clearTimeout(previewTimer);
      rememberDraft();
      serverCatalogListeners = serverCatalogListeners.filter(function (listener) { return listener !== syncServerLibrary; });
      mask.remove(); if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
    apply.addEventListener('click', function () {
      try {
        prepareForUse();
        var result = routeContent();
        var selected = App.selection.elementId && State.findElement(App.state, App.selection.elementId);
        App.update(function (sign) {
          var options = Object.assign({}, result.options, { name: (draft.nameZh || draft.nameEn || '线路') + ' · 线路图', replaceRowId: applyRowId || undefined });
          var next = applyRowId ? State.addTemplateRow(sign, selected ? selected.rowId : null, result.elements, options)
            : addPresetBoard(sign, result.elements, options);
          var current = sign.rows.find(function (row) { return row.id === applyRowId; });
          if (current && current.referenceWidthRatio && current.widthRatio !== current.referenceWidthRatio) {
            next = State.setRowAspectRatio(next, current.id, result.options.widthRatio * current.widthRatio / current.referenceWidthRatio);
          }
          return current ? Object.assign({}, next, { widthMode: sign.widthMode }) : next;
        });
        selectAddedElements(result.elements); finish(); SignUI.toast('线路图已放入牌面，可继续单独编辑图文', 'success');
      } catch (error) { message(error.message, true); }
    });
    close.addEventListener('click', finish);
    makeStationSigns.addEventListener('click', function () {
      try {
        prepareForUse();
        App.update(function (sign) { return State.setProjectContext(sign, { line: draft, stationId: draft.currentStationId, source: draftOrigin }); });
        setPaletteCity(draftOrigin === 'server' ? 'server' : 'fictional');
        var palette = document.getElementById('palette');
        selectSignSection('horizontal'); selectPaletteTab('templates');
        refreshBasicPalette(palette); refreshCRTCards();
        finish(); SignUI.toast('已使用这条线路，选择当前车站后添加标识', 'success');
      } catch (error) { message(error.message, true); }
    });
    // 长表单只通过明确的关闭/完成动作退出，选字拖出或触碰遮罩不关闭。
    mask.addEventListener('compositionstart', function () { composing = true; });
    mask.addEventListener('compositionend', function () { composing = false; });
    mask.addEventListener('keydown', function (event) {
      // Esc 同时承担中文候选取消；部分浏览器只提供组合状态或 229 键码。
      if (event.defaultPrevented || composing || event.isComposing || event.keyCode === 229 || event.which === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
      if (event.key === 'Tab') {
        var focusable = Array.prototype.filter.call(modal.querySelectorAll('button,input,select,textarea'), function (node) { return !node.disabled && !node.hidden; });
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    loadDraft(draft, draftOrigin, draftDirty); nameZh.focus();
  }

  function buildBoxFields(root, el, live) {
    root.appendChild(h('div', { class: 'divider' }));
    root.appendChild(h('div', { class: 'section-title', text: '位置与尺寸' }));
    var grid = h('div', { class: 'box-editor' });
    [['x', '左侧位置'], ['y', '顶部位置'], ['width', '宽度'], ['height', '高度']].forEach(function (item) {
      var input = numberInput({ min: item[0] === 'x' || item[0] === 'y' ? '-64' : '0', max: '64', step: '0.01',
        'aria-label': item[1], 'data-box-key': item[0] }, function (value) {
        var box = Object.assign({}, live().props.box || { x: 0, y: 0, width: 1, height: 1 });
        box[item[0]] = Core.clamp(value, item[0] === 'x' || item[0] === 'y' ? -64 : 0, 64);
        patchProps(el.id, { box: box });
      });
      input.value = displayNumber(live().props.box ? live().props.box[item[0]] : item[0] === 'width' || item[0] === 'height' ? 1 : 0);
      bindSync(input, function () { return live().props.box ? live().props.box[item[0]] : 0; }, displayNumber);
      grid.appendChild(field(item[1], input));
    });
    root.appendChild(grid);
    root.appendChild(h('div', { class: 'hint-text', text: '数值为行高的倍数；1 = ' + App.state.rowHeight + ' px。可分别调整每个元素的摆放位置。' }));
    var layerControls = h('div', { class: 'free-layer-controls' });
    [['上移一层', 1], ['下移一层', -1]].forEach(function (item) {
      var button = h('button', { class: 'btn', text: item[0] });
      function paint() {
        var found = State.findElement(App.state, el.id);
        button.disabled = !found || (item[1] > 0 ? found.index === App.state.rows[found.rowIndex].elements.length - 1 : found.index === 0);
      }
      paint(); syncFns.push(paint);
      button.addEventListener('click', function () {
        var found = State.findElement(App.state, el.id);
        if (!found) return;
        App.update(function (sign) { return State.moveElement(sign, el.id, found.rowId, item[1] > 0 ? found.index + 2 : found.index - 1); });
      });
      layerControls.appendChild(button);
    });
    root.appendChild(layerControls);
  }

  function buildPlainTextFields(root, el, live) {
    var text = textInput({ value: live().props.text, 'aria-label': '文字内容', 'data-plain-text-content': '' }, function (value) { patchProps(el.id, { text: value }); });
    bindSync(text, function () { return live().props.text; });
    root.appendChild(field('文字内容', text));
    root.appendChild(field('排列方向', segGroup([
      { value: 'horizontal', label: '横排' }, { value: 'vertical', label: '竖排' },
    ], function () { return live().props.writingMode || 'horizontal'; }, function (value) { patchProps(el.id, { writingMode: value }); })));
    var spacing = numberInput({ min: '0', max: '4', step: '0.05', 'aria-label': '竖排字间距', 'data-vertical-spacing': '' }, function (value) {
      patchProps(el.id, { letterSpacingRatio: Core.clamp(value, 0, 4) });
    });
    spacing.value = live().props.letterSpacingRatio;
    bindSync(spacing, function () { return live().props.letterSpacingRatio; });
    var spacingField = field('竖排字间距', spacing, '相对字号的间距，整段文字会自动适配位置框。');
    function paintSpacing() { spacingField.hidden = live().props.writingMode !== 'vertical'; }
    paintSpacing(); syncFns.push(paintSpacing); root.appendChild(spacingField);
    root.appendChild(field('字体', segGroup([
      { value: 'zh', label: '中文' }, { value: 'en', label: '英文' }, { value: 'num', label: '数字' },
    ], function () { return live().props.font; }, function (value) { patchProps(el.id, { font: value }); })));
    root.appendChild(checkbox('加粗', function () { return live().props.bold; }, function (value) { patchProps(el.id, { bold: value }); }));
    var size = numberInput({ min: '0.01', max: '64', step: '0.05', 'aria-label': '字号比例' }, function (value) {
      patchProps(el.id, { fontSizeRatio: Core.clamp(value, 0.01, 64) });
    });
    size.value = live().props.fontSizeRatio;
    bindSync(size, function () { return live().props.fontSizeRatio; });
    root.appendChild(field('字号比例', size));
    root.appendChild(field('文字颜色', buildColorPicker({ value: live().props.color, getValue: function () { return live().props.color; },
      onChange: function (value) { patchProps(el.id, { color: value }); } })));
  }

  function buildShapeFields(root, el, live) {
    var definitions = {
      rect: { label: '矩形', geometry: { x: 0, y: 0, width: 100, height: 100 } },
      circle: { label: '圆形', geometry: { cx: 50, cy: 50, r: 45 } },
      line: { label: '线段', geometry: { x1: 0, y1: 50, x2: 100, y2: 50 } },
      path: { label: '路径', geometry: { d: 'M0 0H100V100H0Z' } },
      polygon: { label: '多边形', geometry: { points: '50,0 100,100 0,100' } },
    };
    var select = h('select', { 'aria-label': '图形类型' });
    Object.keys(definitions).forEach(function (key) { select.appendChild(h('option', { value: key, text: definitions[key].label })); });
    select.value = live().props.shape;
    bindSync(select, function () { return live().props.shape; });
    select.addEventListener('change', function () {
      var patch = { shape: select.value, viewBox: [0, 0, 100, 100], geometry: definitions[select.value].geometry };
      if (select.value === 'line') { patch.stroke = live().props.stroke || '#000000'; patch.strokeWidth = live().props.strokeWidth || 3; }
      patchProps(el.id, patch);
    });
    root.appendChild(field('图形类型', select));
    [['fill', '填充颜色'], ['stroke', '描边颜色']].forEach(function (item) {
      function readPaint() { return live().props[item[0]] === 'none' ? null : live().props[item[0]]; }
      root.appendChild(field(item[1], buildColorPicker({ value: readPaint(), nullable: true,
        getValue: readPaint, onChange: function (value) {
          var patch = {}; patch[item[0]] = value; patchProps(el.id, patch);
        } })));
    });
    var stroke = numberInput({ min: '0', max: '2048', step: '0.5', 'aria-label': '描边宽度' }, function (value) {
      patchProps(el.id, { strokeWidth: Core.clamp(value, 0, 2048) });
    });
    stroke.value = live().props.strokeWidth;
    bindSync(stroke, function () { return live().props.strokeWidth; });
    root.appendChild(field('描边宽度', stroke, '按图形内部坐标计量，随图形尺寸一起缩放。'));
    [['d', '路径坐标', 'path'], ['points', '顶点坐标', 'polygon']].forEach(function (item) {
      var input = h('textarea', { rows: '3', 'aria-label': item[1] });
      input.value = live().props.geometry[item[0]] || '';
      input.addEventListener('input', function () {
        var allowed = item[0] === 'd' ? /^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]*$/ : /^[0-9eE+.,\s-]*$/;
        if (!allowed.test(input.value)) return;
        var geometry = {}; geometry[item[0]] = input.value; patchProps(el.id, { geometry: geometry });
      });
      bindSync(input, function () { return live().props.geometry[item[0]] || ''; });
      var wrap = field(item[1], input);
      function paint() { wrap.hidden = live().props.shape !== item[2]; }
      paint(); syncFns.push(paint); root.appendChild(wrap);
    });
  }

  function buildLabelFields(root, el, live) {
    [['labelZh', '中文标签'], ['labelEn', '英文标签']].forEach(function (item) {
      var input = textInput({ value: live().props[item[0]], 'aria-label': item[1] }, function (value) {
        var patch = {};
        patch[item[0]] = value;
        patchProps(el.id, patch);
      });
      bindSync(input, function () { return live().props[item[0]]; });
      root.appendChild(field(item[1], input));
    });
  }

  function buildBilingualFields(root, el, live) {
    var zh = textInput({ value: el.props.textZh, placeholder: '中文文本' }, function (v) {
      patchProps(el.id, { textZh: v });
    });
    bindSync(zh, function () { return live().props.textZh; });
    root.appendChild(field('中文文本', zh));

    var en = textInput({ value: el.props.textEn, placeholder: 'English text' }, function (v) {
      patchProps(el.id, { textEn: v });
    });
    bindSync(en, function () { return live().props.textEn; });
    root.appendChild(field('英文文本', en));

    root.appendChild(field('对齐', segGroup([
      { value: 'left', label: '左对齐' },
      { value: 'center', label: '居中' },
      { value: 'right', label: '右对齐' },
    ], function () { return live().props.align; }, function (v) {
      patchProps(el.id, { align: v });
    })));

    root.appendChild(checkbox('加粗', function () { return live().props.bold; }, function (v) {
      patchProps(el.id, { bold: v });
    }));

    root.appendChild(field('颜色', buildColorPicker({
      value: el.props.color,
      getValue: function () { return live().props.color; },
      onChange: function (v) { patchProps(el.id, { color: v }); },
    })));
  }

  function buildBigNumberFields(root, el, live) {
    var t = textInput({ value: el.props.text, placeholder: '文本，如 16 / 1/2/3/4 / 16号线' }, function (v) {
      patchProps(el.id, { text: v });
    });
    bindSync(t, function () { return live().props.text; });
    root.appendChild(field('内容', t));
    root.appendChild(field('颜色', buildColorPicker({
      value: el.props.color,
      getValue: function () { return live().props.color; },
      onChange: function (v) { patchProps(el.id, { color: v }); },
    })));
  }

  /** 内容对齐分段按钮（数字线路/文字线路/出口）：元素内部左/右镜像排版，与元素对齐无关 */
  function contentAlignGroup(el, live) {
    return field('内容对齐', segGroup([
      { value: 'left', label: '左对齐' },
      { value: 'right', label: '右对齐' },
    ], function () { return live().props.align; }, function (v) {
      patchProps(el.id, { align: v });
    }));
  }

  function buildNumberLineFields(root, el, live) {
    var editor = h('div', { class: 'lines-editor' });

    /** 始终读当前状态的 lines（el 是建面板时的过期快照） */
    function lines() { return live().props.lines; }

    function updateLine(index, patch, elementPatch) {
      var next = lines().map(function (l, i) {
        return i === index ? Object.assign({}, l, patch) : l;
      });
      patchProps(el.id, Object.assign({ lines: next }, elementPatch));
    }

    function rebuildEntries() {
      editor.innerHTML = '';
      lines().forEach(function (line, idx) {
        var numInput = textInput({ value: line.number, maxlength: '2', class: 'le-number', placeholder: '号' }, function (v) {
          var digits = v.replace(/\D/g, '').slice(0, 2);
          var patch = { number: digits };
          // 开关开启且命中当前城市线路表时预填线路色（仍可手动改）
          var fictional = App.prefs.paletteCity === 'fictional' || App.prefs.paletteCity === 'server';
          var hit = App.prefs.autoLineColor && digits && (fictional ? fictionalColorFor(digits)
            : live().props.lineColorMode !== 'custom' && Core.lineColorFor(digits, App.prefs.paletteCity));
          if (hit) patch.color = hit.bg;
          updateLine(idx, patch, hit && fictional ? { lineColorMode: 'custom' } : undefined);
        });
        // 失焦时回显规范化后的数字（过滤非法字符后）
        numInput.addEventListener('blur', function () {
          var cur = lines()[idx];
          numInput.value = cur ? cur.number : '';
        });
        bindSync(numInput, function () { var cur = lines()[idx]; return cur ? cur.number : ''; });
        var removeBtn = h('button', { class: 'le-remove', text: '✕', title: '移除此线路' });
        removeBtn.addEventListener('click', function () {
          patchProps(el.id, {
            lines: lines().filter(function (_, i) { return i !== idx; }),
          });
        });
        var entry = h('div', { class: 'line-entry' }, [
          numInput,
          buildColorPicker({
            value: line.color,
            mini: true,
            getValue: function () { var cur = lines()[idx]; return cur ? cur.color : null; },
            onChange: function (v) { updateLine(idx, { color: v }); },
            onLineSelect: function (chosen) {
              if (!/^\d{1,2}$/.test(chosen.line)) {
                SignUI.toast('已应用颜色；非数字线路请使用文字线路元素。');
                return false;
              }
              updateLine(idx, { number: chosen.line, color: chosen.bg }, {
                labelZh: '号线', labelEn: 'Line', lineColorMode: /^(fictional|server)$/.test(App.prefs.paletteCity) ? 'custom' : 'auto',
              });
            },
          }),
          removeBtn,
        ]);
        var choose = buildFictionalLineSelect(true, function () { var cur = lines()[idx]; return cur ? cur.number : ''; }, function (chosen) {
          var marker = fictionalLineMarker(chosen);
          var next = lines().map(function (item, index) { return index === idx ? Object.assign({}, item, { number: marker, color: chosen.color }) : item; });
          patchProps(el.id, { lines: next, labelZh: '号线', labelEn: 'Line', lineColorMode: 'custom' });
          numInput.value = marker;
        });
        editor.appendChild(h('div', { class: 'line-entry-group' }, [entry, choose]));
      });
      var add = h('button', { class: 'le-add', text: '＋ 添加线路' });
      add.addEventListener('click', function () {
        patchProps(el.id, {
          lines: lines().concat([{ number: '', color: '#424A52' }]),
        });
      });
      editor.appendChild(add);
    }
    rebuildEntries();

    root.appendChild(field('线路列表（1–2 位数字）', editor));
    buildLabelFields(root, el, live);
    root.appendChild(contentAlignGroup(el, live));
    // 右对齐仅渲染第 1 条线路：禁用「添加线路」，多余线路保留（切回左对齐恢复显示）
    var rightOnlyHint = h('div', { class: 'hint-text', text: '右对齐仅渲染第 1 条线路；多余线路会保留，切回左对齐后恢复显示。' });
    syncFns.push(function () {
      var right = live().props.align === 'right';
      var add = editor.querySelector('.le-add');
      if (add) add.disabled = right;
      rightOnlyHint.style.display = right ? '' : 'none';
    });
    rightOnlyHint.style.display = live().props.align === 'right' ? '' : 'none'; // 构建时立即回显
    root.appendChild(rightOnlyHint);
    root.appendChild(field('文字颜色', buildColorPicker({
      value: el.props.textColor,
      onChange: function (v) { patchProps(el.id, { textColor: v }); },
    })));
  }

  function buildTextLineFields(root, el, live) {
    root.appendChild(checkbox('线路名下沉', function () { return live().props.nameSink; }, function (v) {
      patchProps(el.id, { nameSink: v });
    }));

    var t = textInput({ value: el.props.text, placeholder: '如：环 / 机场联络线' }, function (v) {
      var patch = { text: v };
      var hit = App.prefs.autoLineColor && /^(fictional|server)$/.test(App.prefs.paletteCity) && fictionalColorFor(v);
      if (hit) {
        patch.text = live().props.nameSink ? hit.name.replace(/线$/, '') : hit.name;
        patch.textEn = hit.nameEn; patch.blockColor = hit.bg; patch.lineColorMode = 'custom';
      }
      patchProps(el.id, patch);
    });
    bindSync(t, function () { return live().props.text; });
    t.addEventListener('blur', function () { t.value = live().props.text; });
    root.appendChild(field('中文线路名', t));

    var en = textInput({ value: el.props.textEn, placeholder: '如：Loop Line' }, function (v) {
      patchProps(el.id, { textEn: v });
    });
    bindSync(en, function () { return live().props.textEn; });
    root.appendChild(field('英文名称', en));
    root.appendChild(buildFictionalLineSelect(false, function () { return live().props.text; }, function (line) {
      patchProps(el.id, { text: live().props.nameSink ? line.nameZh.replace(/线$/, '') : line.nameZh,
        textEn: line.nameEn, blockColor: line.color, lineColorMode: 'custom' });
    }));

    root.appendChild(contentAlignGroup(el, live));

    root.appendChild(field('色块颜色', buildColorPicker({
      value: el.props.blockColor,
      getValue: function () { return live().props.blockColor; },
      onChange: function (v) { patchProps(el.id, { blockColor: v }); },
      onLineSelect: function (chosen) {
        patchProps(el.id, { text: live().props.nameSink ? chosen.name.replace(/线$/, '') : chosen.name,
          textEn: chosen.nameEn, blockColor: chosen.bg, lineColorMode: /^(fictional|server)$/.test(App.prefs.paletteCity) ? 'custom' : 'auto' });
      },
    })));
    root.appendChild(field('文字颜色', buildColorPicker({
      value: el.props.textColor,
      onChange: function (v) { patchProps(el.id, { textColor: v }); },
    })));
  }

  function buildCodeFields(root, el, live) {
    var c = textInput({ value: el.props.code, placeholder: '编号，如 1 / C / 1,5-22' }, function (v) {
      patchProps(el.id, { code: v });
    });
    bindSync(c, function () { return live().props.code; });
    root.appendChild(field('编号', c));
    buildLabelFields(root, el, live);
    if (el.type === 'exit') {
      root.appendChild(contentAlignGroup(el, live)); // 仅出口支持内容对齐（编号移至「出口」右侧）
    }
    root.appendChild(field('颜色', buildColorPicker({
      value: el.props.color,
      getValue: function () { return live().props.color; },
      onChange: function (v) { patchProps(el.id, { color: v }); },
    })));
    if (el.type === 'exit') {
      root.appendChild(h('div', { class: 'hint-text', text: '出口背景色固定为出口黄 #F7D917' }));
    }
  }

  function buildSpaceFields(root, el, live) {
    var w = numberInput({ min: '0.1', max: '8', step: '0.1' }, function (v) {
      patchProps(el.id, { widthRatio: Core.clamp(v, 0.1, 8) });
    });
    w.value = el.props.widthRatio;
    bindSync(w, function () { return live().props.widthRatio; });
    root.appendChild(field('宽度（× 行高的倍数）', w));
    // 背景色由通用分发器统一追加（buildElementPanel 末尾）
  }

  /**
   * 图标选择器：按当前元素图标的分类展示缩略图网格
   * （方向图标元素显示 12 向箭头，服务图标元素显示服务设施）+ 颜色。
   */
  function buildIconFields(root, el, live) {
    var lib = global.SignIcons;
    var selected = lib.ALL[live().props.icon];
    var curCat = selected ? selected.cat : 'service';
    var grid = h('div', { class: 'icon-grid' });
    var btns = [];
    var choices = [];
    Object.keys(lib.ALL).forEach(function (id) {
      if (lib.ALL[id].cat === curCat) choices.push({ id: id, icon: lib.ALL[id] });
    });
    if (curCat === 'service' && global.SignCRTSymbols) {
      var seen = [];
      Object.keys(global.SignCRTSymbols.ALL).forEach(function (id) {
        var icon = global.SignCRTSymbols.ALL[id];
        if (lib.ALL[id] || seen.indexOf(icon) !== -1) return;
        seen.push(icon);
        choices.push({ id: id, icon: icon });
      });
    }
    choices.forEach(function (choice) {
      var id = choice.id;
      var icon = choice.icon;
      var svg = document.createElementNS(Core.SVG_NS, 'svg');
      svg.setAttribute('viewBox', icon.vb);
      svg.innerHTML = icon.body;
      var b = h('button', { class: 'icon-pick', title: icon.name }, [
        h('div', { class: 'icon-thumb' }, [svg]),
      ]);
      b.addEventListener('click', function () { patchProps(el.id, { icon: id }); });
      btns.push({ b: b, id: id });
      grid.appendChild(b);
    });
    function paint() {
      var cur = live().props.icon;
      btns.forEach(function (x) { x.b.classList.toggle('active', x.id === cur); });
    }
    syncFns.push(paint);
    paint();
    root.appendChild(grid);
    root.appendChild(field('颜色', buildColorPicker({
      value: el.props.color,
      getValue: function () { return live().props.color; },
      onChange: function (v) { patchProps(el.id, { color: v }); },
    })));
    // 元素背景色由通用分发器统一追加（buildFields 末尾，space/exit 除外）
  }

  function buildBackgroundPicker(el) {
    var wrap = h('div');
    var picker = buildColorPicker({
      value: el.props.backgroundColor,
      nullable: true,
      onChange: function (v) { patchProps(el.id, { backgroundColor: v }); },
    });
    wrap.appendChild(picker);
    return field('元素背景色', wrap);
  }

  function buildPaddingEditor(el, live) {
    // 上下左右挤一行时输入框过窄（"0.25" 显示成 "0.2"）：
    // 左右一行、上下一行，两行各两框
    var wrap = h('div');
    wrap.appendChild(checkbox('左右内边距随相邻自动缩放', function () {
      return live().props.paddingAuto;
    }, function (v) {
      patchProps(el.id, { paddingAuto: v }); // v=true 时管线立即按相邻关系重算
    }));
    wrap.appendChild(h('div', {
      class: 'hint-text',
      text: '勾选时左右内边距在相邻元素一侧自动减半（0.2 ↔ 0.1）；手动修改任一侧即固定。',
    }));
    var grid = h('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px' });
    var keys = [
      { k: 'left', label: '左', max: 8 },
      { k: 'right', label: '右', max: 8 },
      { k: 'top', label: '上', max: 1 },
      { k: 'bottom', label: '下', max: 1 },
    ];
    keys.forEach(function (item) {
      var input = numberInput({ min: '0', max: String(item.max), step: '0.05', title: item.label + '内边距' }, function (v) {
        var padding = {};
        padding[item.k] = Core.clamp(v, 0, item.max);
        var patch = { padding: padding };
        // 手动修改左右任一侧 → 退出自动（钉住）
        if (item.k === 'left' || item.k === 'right') patch.paddingAuto = false;
        patchProps(el.id, patch);
      });
      input.value = el.props.padding[item.k];
      bindSync(input, function () { return live().props.padding[item.k]; });
      grid.appendChild(h('div', {}, [
        h('div', { class: 'hint-text', text: item.label, style: 'text-align:center;margin-bottom:2px' }),
        input,
      ]));
    });
    wrap.appendChild(field('内边距（相对行高比例）', grid, '左右内边距可大于 1（元素更宽）'));
    return wrap;
  }

  // ─── 预设预览面板 ──────────────────────────────────────────

  function buildPresetPreviewPanel() {
    var p = Presets.get(App.presetPreviewId);
    if (!p) return h('div', { class: 'hint-text', text: '预设不存在或已删除' });
    var root = h('div');
    root.appendChild(h('div', { class: 'section-title', text: p.name }));
    root.appendChild(h('div', { class: 'field' }, [
      h('div', { style: 'border:1px solid #edf0f3;border-radius:6px;padding:6px;background:#fff' }, [
        renderRowThumb(p.elements, 56, p.row),
      ]),
    ]));
    var use = h('button', { class: 'btn btn-primary', text: '使用预设', 'data-preset-use': p.id });
    use.addEventListener('click', function () {
      var elements = Presets.materialize(p.id);
      if (!elements || !elements.length) return;
      if (p.row && p.row.templateId) setPaletteCity('chongqing');
      App.update(function (sign) { return addPresetBoard(sign, elements, Object.assign({}, p.row, { name: p.name })); });
      selectAddedElements(elements);
      SignUI.toast('已添加预设「' + p.name + '」', 'success');
    });
    root.appendChild(use);
    var list = h('div', { class: 'field' });
    p.elements.forEach(function (el, i) {
      var desc = describeElement(el);
      list.appendChild(h('div', {
        class: 'hint-text',
        text: (i + 1) + '. ' + TYPE_NAMES[el.type] + (desc ? ' — ' + desc : ''),
      }));
    });
    root.appendChild(list);
    root.appendChild(h('div', { class: 'hint-text', text: '点击「使用预设」新建一块独立牌面；也可以拖入编辑区。' }));
    root.appendChild(h('div', { class: 'divider' }));
    var del = h('button', { class: 'btn btn-danger', text: '🗑 删除此预设' });
    del.addEventListener('click', function () {
      SignUI.confirmDialog('确定要删除预设「' + p.name + '」吗？', '删除预设').then(function (ok) {
        if (!ok) return;
        Presets.remove(p.id);
        App.previewPreset(null);
      });
    });
    root.appendChild(del);
    return root;
  }

  function describeElement(el) {
    var p = el.props;
    switch (el.type) {
      case 'arrow': return p.direction;
      case 'bilingual-text': return (p.textZh || '') + (p.textEn ? ' / ' + p.textEn : '');
      case 'big-number': return p.text;
      case 'number-line': return (p.lines || []).map(function (l) { return l.number; }).join('、') + ' 号线';
      case 'text-line': return (p.text || '') + (p.textEn ? ' / ' + p.textEn : '');
      case 'entrance': return '出入口 ' + p.code;
      case 'exit': return '出口 ' + p.code;
      case 'space': return '空白 ' + p.widthRatio + '×行高';
      case 'icon': {
        var lib = global.SignIcons;
        var icon = lib && lib.ALL[p.icon] || global.SignCRTSymbols && global.SignCRTSymbols.get(p.icon);
        return icon ? icon.name : p.icon;
      }
      case 'crt-sign': return global.SignCRT.get(p.templateId).name;
      case 'plain-text': return p.text;
      case 'shape': return { rect: '矩形', circle: '圆形', line: '线段', path: '路径', polygon: '多边形' }[p.shape] || '图形';
      default: return '';
    }
  }

  global.SignPanel = {
    categoryCount: function () { return categoriesForSection().length; },
    TYPE_NAMES: TYPE_NAMES,
    buildPalette: buildPalette,
    buildColorPicker: buildColorPicker,
    syncRightPanel: syncRightPanel,
    sampleElement: sampleElement,
    renderRowThumb: renderRowThumb,
    refreshLinePalettes: refreshLinePalettes,
    refreshServerLines: refreshServerLines,
    serverLineSnapshot: function () { return Core.deepClone({ lines: serverCatalog.lines, updatedAt: serverCatalog.updatedAt,
      loading: serverCatalog.loading, loaded: serverCatalog.loaded, error: serverCatalog.error, warnings: serverCatalog.warnings }); },
    routeLinesSnapshot: function () { return Core.deepClone(availableRouteLines()); },
    buildTemplateContent: buildTemplateContent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
