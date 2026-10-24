/**
 * crt-catalog.js — 重庆 DBJ50/T-274-2024 矩形标识牌目录。
 * source.page 使用 PDF 页码（正文印刷页码 + 10）。尺寸单位 mm；
 * 原文要求实测、EQ 或未给总尺寸的项目在 source.note 中明确标记编辑用比例。
 * 目录提供可编辑版式，线网、地图、时刻及地名示例不代表当前运营数据。
 */
(function (global) {
  'use strict';

  var WHITE = '#FFFFFF', BLACK = '#000000', GRAY = '#333F48';
  var YELLOW = '#F7D917', GREEN = '#00843D', RED = '#C8102E', BLUE = '#005EB8';
  var ALL = [];
  function field(key, label, value, multiline) {
    var f = { key: key, label: label, value: String(value == null ? '' : value) };
    if (multiline) f.multiline = true;
    return f;
  }
  function title(zh, en) {
    var f = [field('title', '中文名称', zh)];
    if (en != null) f.push(field('subtitle', '英文名称', en));
    return f;
  }
  function source(page, figure, section, note) {
    var s = { page: page, figure: figure, section: section };
    if (note) s.note = note;
    return s;
  }
  function add(id, name, group, layout, width, height, fields, src, options) {
    var t = {
      id: id, name: name, group: group, layout: layout, variant: layout,
      width: width, height: height, background: WHITE, color: BLACK,
      accent: GRAY, fields: fields, source: src
    };
    Object.keys(options || {}).forEach(function (k) { t[k] = options[k]; });
    ALL.push(t);
    return t;
  }
  var EDIT = '标准总尺寸依现场实测或等分布置；此尺寸仅为编辑用比例，不作为施工尺寸。';
  var MAP = '地图、线网及站点内容须按实际运营资料录入；本项提供可编辑信息区，未重建扫描示例地图。';
  function lineFields(line, en) {
    return [field('line', '线路', line || '1'), field('lineEn', '线路英文', en || 'Line 1')];
  }
  function guide(id, name, page, figure, fields, options) {
    return add(id, name, '进站与乘车', 'guide', 2100, 400, fields,
      source(page, figure + ' / XG-03', '4.1', '采用附录 XG-03 的 2100 × 400 规格；另有其他宽度。'), options);
  }
  function facility(id, zh, en, icon, page, figure, height) {
    return add(id, zh, '服务设施', 'facility', 1800, height || 320, title(zh, en),
      source(page, figure, '4.4', EDIT), { icon: icon, background: GRAY, color: WHITE });
  }

  add('station-name', '地下站车站站名', '站名与出入口', 'station', 900, 1200,
    title('石油路', 'Shiyoulu').concat(lineFields()).concat([field('code', '车站编号', '08')]),
    source(51, '4.4.11-2 / FZ-20', '4.4.11', '另有 600 × 800 规格。'), { variant: 'station-portrait' });
  add('station-name-vertical', '高架站车站站名', '站名与出入口', 'station', 280, 1600,
    title('八公里', 'Bagongli').concat(lineFields('3', 'Line 3')).concat([field('code', '车站编号', '10')]),
    source(51, '4.4.11-1 / FZ-19', '4.4.11'), { variant: 'station-vertical' });
  add('entrance-identity', '出入口确认矩形附牌', '站名与出入口', 'station', 1400, 660,
    title('两路口站', 'Lianglukou Station').concat(lineFields('1/3', 'Line 1/3')).concat([field('code', '出入口编号', '1')]),
    source(25, '4.1.3-2', '4.1.3', '仅收录下方 1400 × 660 矩形信息附牌；上方圆形 CRT 灯箱不在本项内。'),
    { icon: 'crt', background: GREEN, color: WHITE, variant: 'entrance-identity' });
  add('entrance-lintel', '出入口门楣', '站名与出入口', 'guide', 3600, 600,
    title('八公里', 'Bagongli').concat(lineFields('3', 'Line 3')).concat([field('code', '出入口编号', '1/2'), field('footer', '出入口标签', '出入口 Entrance')]),
    source(26, '4.1.4-1～3 / FZ-03', '4.1.4'), { icon: 'train', variant: 'doorhead' });

  guide('entrance-guide', '通道进站引导', 27, '4.1.5', lineFields(), { direction: 'up', width: 2000, height: 200,
    source: source(27, '4.1.5 / XG-02', '4.1.5', '采用附录 XG-02 的 2000 × 200 规格；另有 1000/3000 宽、400 高规格。') });
  guide('ticket-guide', '自助售票引导', 27, '4.1.6', title('自助售票 加值处', 'Self-service Tickets').concat(lineFields('3', 'Line 3')), { icon: 'tickets', direction: 'right' });
  guide('gate-guide', '进闸引导', 28, '4.1.7', title('自动检票', 'Automatic Check-in').concat(lineFields('3', 'Line 3')), { icon: 'check_in', direction: 'right' });
  guide('train-guide', '乘车引导', 28, '4.1.8', title('乘车', 'Trains').concat(lineFields()), { icon: 'train', direction: 'down' });
  guide('platform-direction', '侧式站台分向', 33, '4.1.10-3', title('观音桥 举人坝方向', 'To Guanyinqiao, Jurenba'), { direction: 'up', background: BLUE, color: WHITE, variant: 'direction' });
  guide('platform-direction-split', '岛式站台分向', 33, '4.1.10-1', title('璧山方向', 'To Bishan').concat(lineFields()).concat([field('destination', '另一侧方向', '朝天门方向'), field('destinationEn', '另一侧英文', 'To Chaotianmen')]),
    { variant: 'direction-split', background: '#E4002B', color: WHITE, width: 3600, height: 320,
      source: source(33, '4.1.10-1', '4.1.10', '正文未标总宽（两侧EQ等宽）；内容高由60+200+60得320，3600×320仅编辑用比例，不作为施工尺寸。') });
  guide('platform-direction-single', '侧式站台分向（单侧）', 33, '4.1.10-1（单侧衍生）', title('璧山方向', 'To Bishan').concat(lineFields()),
    { variant: 'direction-single', background: '#E4002B', color: WHITE, width: 2000, height: 320, directional: false,
      source: source(33, '4.1.10-1（单侧衍生）', '4.1.10', '用户补充版式：保留岛式分向牌的左侧方向与白色线路号块，移除右侧方向。2000×320为编辑用比例，并非PDF另行规定的侧式施工尺寸。') });
  guide('platform-direction-multiline', '同站台多线分向', 33, '4.1.10-2', title('沙坪坝方向', 'To Shapingba').concat(lineFields('环/5', 'Loop Line / Line 5')).concat([
    field('destination', '另一侧方向', '大石坝方向'), field('destinationEn', '另一侧英文', 'To Dashiba'),
    field('leftQualifier', '左侧方向小标题', '内环'), field('leftQualifierEn', '左侧小标题英文', 'Clockwise Loop'),
    field('rightQualifier', '右侧方向小标题', ''), field('rightQualifierEn', '右侧小标题英文', '')]),
    { variant: 'direction-split', width: 3600, height: 320,
      source: source(33, '4.1.10-2', '4.1.10', '正文未标总宽；编辑时统一采用3600×320参考比例，不作为施工尺寸。') });
  add('route-vertical', '单向直行线路图', '线路图', 'route', 600, 1800,
    title('石油路', 'Shiyoulu').concat(lineFields()).concat([field('stations', '站点（中文|英文|编号，每行一站）', '石油路|Shiyoulu|08\n大坪|Daping|07\n鹅岭|Eling|06\n两路口|Lianglukou|05', true)]),
    source(29, '4.1.9-1 / FZ-04', '4.1.9', '示例站点可编辑；另有 900 × 1800 规格。'), { variant: 'route' });
  add('route-vertical-double', '双向直行线路图', '线路图', 'route', 900, 1800,
    title('长福路', 'Changfulu').concat(lineFields('3', 'Line 3')).concat([field('stations', '站点（中文|英文|编号，每行一站）', '长福路|Changfulu|15\n八公里|Bagongli|10\n两路口|Lianglukou|05', true)]),
    source(32, '4.1.9-4 / FZ-04', '4.1.9', '双向站名与换乘信息由用户按实际线路录入。'), { variant: 'route-double' });
  add('train-route', '列车运行方向', '线路图', 'route', 4700, 540,
    title('石油路', 'Shiyoulu').concat(lineFields()).concat([field('stations', '站点（中文|英文|编号，每行一站）', '歇台子|Xietaizi|09\n石油路|Shiyoulu|08\n大坪|Daping|07', true)]),
    source(34, '4.1.11-1 / FZ-05', '4.1.11'), { variant: 'route-horizontal' });
  add('train-route-branch', '支线列车运行方向', '线路图', 'route', 4700, 540,
    title('列车运行方向', 'Train Direction').concat(lineFields()).concat([field('stations', '站点（中文|英文|编号，每行一站）', '起点站||01\n换乘站||02\n支线终点站||03', true)]),
    source(35, '4.1.11-2 / FZ-05', '4.1.11', '支线示意站名为可编辑占位内容。'), { variant: 'route-horizontal-branch' });

  function exitGuide(id, name, page, figure, fields, variant) {
    return add(id, name, '出站引导', 'guide', 2100, 400, fields,
      source(page, figure + ' / XG-03', '4.2', '采用附录 XG-03 的 2100 × 400 规格；另有其他宽度。'), { background: YELLOW, icon: 'exit', direction: 'left', variant: variant || 'exit' });
  }
  exitGuide('platform-exit', '站台出站引导', 36, '4.2.2', title('出口', 'Exit'));
  exitGuide('concourse-exit', '站厅出站引导', 37, '4.2.3-1～2', title('出口', 'Exit').concat([field('code', '出口编号', '1/2')]));
  exitGuide('passage-exit', '通道出站引导', 41, '4.2.6', title('出口', 'Exit').concat([field('code', '出口编号', '4A'), field('destination', '邻近地点', '出口邻近地点'), field('destinationEn', '地点英文', '')]));
  add('exit-information', '站厅出口信息', '出站引导', 'information', 660, 1860,
    title('出口', 'Exit').concat([field('code', '出口编号', '1/4'), field('body', '出口与周边地点（每行一项）', '1 出口\n江南大道 Jiangnan Ave.\n工贸大厦 Gongmao Building\n4 出口\n江南大道 Jiangnan Ave.', true)]),
    source(38, '4.2.4 / FZ-06', '4.2.4'), { background: YELLOW, variant: 'portrait', direction: 'left' });
  add('exit-doorhead', '站厅出口门套横梁', '出站引导', 'guide', 3600, 600,
    title('出口', 'Exit').concat([field('code', '出口编号', '1')]),
    source(39, '4.2.5-1 / FZ-07～08', '4.2.5', '标准横梁高度 600；宽度依出口实测，此处宽度为编辑用比例。'), { background: YELLOW, variant: 'doorhead-exit' });
  add('exit-doorpost', '高架站出口门套信息', '出站引导', 'information', 1200, 3600,
    title('出口', 'Exit').concat([field('code', '出口编号', '1/2'), field('body', '出口邻近地点', '江南大道\n出口邻近地点', true)]),
    source(40, '4.2.5-2 / FZ-09', '4.2.5', '标准宽度 1200；高度按门套实测，此处高度仅为编辑用比例。' + MAP), { background: YELLOW, variant: 'portrait' });

  add('transfer-wall', '墙面换乘', '换乘引导', 'guide', 2400, 320,
    title('换乘 3 号线', 'Transfer to Line 3').concat(lineFields('3', 'Line 3')),
    source(42, '4.3.3-1～2 / FZ-11', '4.3.3', EDIT), { variant: 'transfer', direction: 'left' });
  add('transfer-column', '柱面换乘', '换乘引导', 'guide', 900, 1200,
    title('换乘 3 号线', 'Transfer to Line 3').concat(lineFields('3', 'Line 3')),
    source(43, '4.3.4 / FZ-12', '4.3.4', '另有 600 × 800 规格。'), { variant: 'transfer-column', direction: 'up' });
  add('transfer-guide', '分向换乘', '换乘引导', 'guide', 2400, 320,
    title('换乘', 'Transfer').concat(lineFields('3/1', 'Line 3 / Line 1')),
    source(44, '4.3.5', '4.3.5', EDIT), { variant: 'transfer', direction: 'up' });
  add('transfer-doorhead', '换乘通道门套横梁', '换乘引导', 'guide', 2400, 400,
    title('换乘', 'Transfer').concat(lineFields('5', 'Line')).concat([field('labelZh', '线路单位（留空自动）', '')]),
    source(44, '4.3.6（用途参考） / FZ-13', '4.3.6', '依据用户提供的门套实物补充横梁；PDF正文与FZ-13仅示例立柱，未规定此横梁版式。2400×400仅编辑用比例，实际宽度依通道实测。'),
    { variant: 'transfer-portrait', directional: false });
  add('transfer-doorpost', '换乘通道门套立柱（单线）', '换乘引导', 'guide', 600, 2320,
    title('换乘', 'Transfer').concat(lineFields('3', 'Line')).concat([field('labelZh', '线路单位（留空自动）', '')]),
    source(44, '4.3.6-1 / FZ-13', '4.3.6', '柱宽600或现场实测；单线底色为线路专色30%色值，大号置于完整线路色块中。高度依门套实测，此处2320为编辑参考。'), { variant: 'transfer-portrait', direction: 'up' });
  add('transfer-doorpost-multiline', '换乘通道门套立柱（多线）', '换乘引导', 'guide', 600, 2320,
    title('换乘', 'Transfer').concat(lineFields('1/2/6', 'Line 1/2/6')).concat([field('labelZh', '线路单位（留空自动）', '')]),
    source(45, '4.3.6-2 / FZ-13', '4.3.6', '白底、多线竖排，每条线路各用完整线路色块。柱宽600或现场实测；此处2320高仅为编辑用比例。'), { variant: 'transfer-portrait', direction: 'up' });

  facility('ticket-office', '自助售票 加值处', 'Self-service Tickets', 'tickets', 46, '4.4.2');
  facility('customer-service', '乘客服务中心', 'Customer Service Center', 'customer_service', 46, '4.4.3', 240);
  facility('lost-found', '失物招领', 'Lost And Found', 'lost_found', 47, '4.4.4');
  facility('restroom', '卫生间', 'Toilet', 'restroom', 47, '4.4.5', 240);
  facility('accessible-restroom', '无障碍卫生间', 'Accessible Toilet', 'accessible_restroom', 47, '4.4.5', 240);
  facility('nursing-room', '哺乳室', 'Nursing Room', 'nursing', 48, '4.4.6', 240);
  facility('accessible-elevator', '无障碍电梯', 'Accessible Elevator', 'elevator', 49, '4.4.7', 318);
  facility('waiting-room', '等候室', 'Waiting Room', 'waiting', 49, '4.4.7', 318);
  add('elevator-film', '无障碍电梯矩形贴膜', '服务设施', 'guide', 2400, 400,
    title('沙坪坝', 'Shapingba').concat(lineFields()),
    source(49, '4.4.8 / FZ-16', '4.4.8', '仅收录顶部矩形线路站名信息带；长宽依玻璃实测，此尺寸为编辑用比例。'), { icon: 'elevator', variant: 'doorhead' });
  add('waiting-room-film', '空调候车室矩形贴膜', '服务设施', 'facility', 4850, 1700,
    title('八公里', 'Bagongli'), source(50, '4.4.9 / FZ-17', '4.4.9', '作为整片矩形玻璃贴膜的信息布局；图文总宽由正文尺寸链 420+620+210+620+2980 得出。'),
    { icon: 'waiting', variant: 'waiting-film' });
  add('room-name', '科室牌', '服务设施', 'information', 285, 140,
    [field('code', '房间编号', '048'), field('title', '房间名称', '客运服务室')], source(53, '4.4.13 / FZ-22', '4.4.13'), { variant: 'room' });
  add('gate-indicator', '自动检票机通行状态', '服务设施', 'information', 2400, 400,
    [field('title', '状态信息', '自动检票'), field('body', '各通道状态（每行一项）', '禁止通行\n允许通行\n无障碍通道', true)],
    source(53, '4.4.14', '4.4.14', '标准高度 400；宽度根据实际通道数量设置，此宽度仅为编辑用比例。'), { background: GRAY, color: WHITE, variant: 'gate-indicator' });
  add('security-check', '安全检查立柱', '服务设施', 'facility', 390, 1750,
    title('安全检查', 'Security Check'), source(54, '4.4.15 / BF-02', '4.4.15'), { icon: 'security_check', background: GRAY, color: WHITE, variant: 'security-portrait' });
  add('security-prohibited-goods', '安检危险品组合牌', '服务设施', 'notice', 740, 600,
    title('严禁携带易燃易爆等危险品进站', 'Dangerous Articles Prohibited').concat([field('footer', '底部提示', '通过安检时，请您保管好自己的物品。')]),
    source(54, '4.4.15 / BF-01', '4.4.15', '正文图示宽 700；附录 BF-01 成品宽 740，目录采用附录成品尺寸。'), { icon: 'dangerous_goods', background: GRAY, color: WHITE, variant: 'dangerous-goods' });

  add('first-last-train', '首末车时刻表', '综合信息', 'information', 660, 880,
    title('运营服务时间', 'Service Hours').concat([field('code', '出口编号', '1A'), field('body', '线路|方向|首班|末班（每行一项）', '1号线|往璧山|--:--|--:--\n1号线|往朝天门|--:--|--:--', true)]),
    source(55, '4.5.2 / FZ-24', '4.5.2', '本站立体图位置保留；时刻须按实际运营信息填写。'), { variant: 'timetable' });
  add('fare-information', '票价表', '综合信息', 'information', 1804, 960,
    title('全线价格表', 'Fare Table').concat([field('body', '站名|票价（每行一项）', '目的车站|票价\n请填写站名|请填写金额', true)]),
    source(56, '4.5.3 / XG-05', '4.5.3', '采用有效面板尺寸 1804 × 960；工程箱体 1840 × 1000。' + MAP), { variant: 'fare' });
  add('network-map', '单面线网信息', '综合信息', 'information', 2280, 2300,
    title('八公里', 'Bagongli').concat(lineFields('3', 'Line 3')).concat([field('body', '信息区内容', '轨道交通线网图\n车站平面示意图\n车站立体示意图\n车站出口信息', true), field('footer', '底部服务指引', '卫生间　无障碍电梯　等候室')]),
    source(57, '4.5.4-1', '4.5.4', MAP), { variant: 'map' });
  add('network-map-double', '双面线网信息（单侧牌面）', '综合信息', 'information', 1300, 2300,
    title('长福路', 'Changfulu').concat(lineFields('3', 'Line 3')).concat([field('body', '该侧信息区内容', '轨道交通线网图\n车站平面示意图\n车站出口信息', true)]),
    source(57, '4.5.4-2', '4.5.4', '采用单侧有效牌面宽 1300、高 200+30+1270+800；立柱及另一侧可另加元素。' + MAP), { variant: 'map' });
  add('street-map', '车站周边街区信息', '综合信息', 'information', 1800, 1800,
    title('车站周边街区信息', 'Station Area Information').concat([field('body', '信息区内容', '车站平面示意图\n车站立体示意图\n周边街区地图\n出口信息', true)]),
    source(58, '4.5.5 / FZ-25', '4.5.5', '附录预留方形信息区 1800 × 1800；外板按现场实测。' + MAP), { variant: 'map' });
  add('bulletin', '公告栏', '综合信息', 'information', 2380, 1030,
    title('公告栏', 'Notice Board').concat([field('body', '公告内容', '车站公告\n公交接驳信息\n温馨提示', true)]),
    source(59, '4.5.6-1', '4.5.6', '采用正文地下站双栏总宽 2380、高 1030；现场公告内容可编辑。'), { variant: 'bulletin' });
  add('four-sided-guide', '四方体悬挂标识（单面）', '综合信息', 'guide', 4370, 1050,
    [field('body', '左方向中文|English|线路|右方向中文|English（每行一排）', '沙坪坝方向|To Shapingba|环|四公里方向|To Sigongli\n园博中心方向|To The EXPO Garden Center|5|跳磴方向|To Tiaodeng\n北碚方向|To Beibei|6|茶园方向|To Chayuan', true)],
    source(60, '4.5.7 / XG-06', '4.5.7', '以一块矩形侧面为单位编辑，采用附录单面 4370 × 1050，三排信息带；其余侧面可分别添加。'), { variant: 'four-sided' });

  function notice(id, zh, en, icon, page, figure, variant, width, height) {
    return add(id, zh, '安全标识', 'notice', width || 200, height || 300, title(zh, en),
      source(page, figure, '4.6'), { icon: icon, variant: variant, accent: variant === 'warning' ? YELLOW : RED });
  }
  notice('dangerous-goods', '严禁携带危险品', 'Dangerous Articles Prohibited', 'dangerous_goods', 61, '4.6.2 / FZ-27', 'dangerous-goods', 880, 880);
  [
    ['no-smoking', '禁止吸烟', 'No Smoking', 'no_smoking'],
    ['no-throwing', '禁止抛物', 'No Tossing', 'no_throwing'],
    ['no-jumping-down', '禁止跳下', 'No Jumping Down', 'no_jumping_down'],
    ['no-leaning', '禁止倚靠', 'No Leaning', 'no_leaning'],
    ['no-stacking', '禁止堆放', 'No Stacking', 'no_stacking'],
    ['no-littering', '请勿丢弃废弃物', 'Do Not Litter Here', 'no_littering'],
    ['no-sitting', '请勿坐卧', 'No Sitting', 'no_sitting'],
    ['no-touching', '请勿触摸', 'No Touching', 'no_touching'],
    ['no-pets', '请勿携带宠物', 'No Pets Allowed', 'no_pets'],
    ['no-thoroughfare', '请勿通过', 'No thoroughfare', 'no_thoroughfare'],
    ['no-playing', '请勿玩耍', 'No Playing', 'no_playing'],
    ['no-crossing', '请勿翻越', 'No Crossing', 'no_crossing'],
    ['no-head-out', '请勿探头', 'Keep Your Head Inside', 'no_head_out'],
    ['no-spitting', '请勿随地吐痰', 'No Spitting', 'no_spitting'],
    ['no-jumping', '请勿跳跃', 'No Jumping', 'no_jumping']
  ].forEach(function (a) { notice(a[0], a[1], a[2], a[3], 62, '4.6.3 / FZ-28', 'prohibition'); });
  [
    ['warning', '注意安全', 'Warning Danger', 'warning'],
    ['warning-electric-shock', '当心触电', 'Warning Electric Shock', 'electric_shock'],
    ['warning-cable', '当心电缆', 'Warning Cable', 'cable'],
    ['warning-overhead', '当心碰头', 'Warning Overhead Obstacles', 'overhead_obstacles'],
    ['warning-hands', '当心夹手', 'Warning Hands Pinching', 'hands_pinching'],
    ['warning-drop', '当心坠落', 'Warning Drop Down', 'drop_down'],
    ['warning-gap', '当心缝隙', 'Warning Gap', 'gap'],
    ['warning-slippery', '当心滑倒', 'Warning Slippery Surface', 'slippery_surface']
  ].forEach(function (a) { notice(a[0], a[1], a[2], a[3], 63, '4.6.4 / FZ-29', 'warning'); });
  add('escalator-safety', '安全乘梯（火情提示）', '安全标识', 'notice', 300, 200,
    title('发现火情', 'Discovering Fire').concat([field('body', '安全提示（中文|英文，每行一项）', '禁止使用电梯|Do not use elevators\n请使用逃生楼梯|Please use the escape stairs', true)]),
    source(63, '4.6.5 / FZ-30', '4.6.5'), { icon: 'fire', variant: 'escalator', accent: RED });
  notice('emergency-stop-button', '紧急停车按钮', 'Emergency Stop Button', 'emergency_stop', 64, '4.6.6 / FZ-31', 'stop-button', 250, 250);
  notice('emergency-stop-cover', '紧急停车按钮说明', 'Emergency Stop Button', 'emergency_stop', 64, '4.6.6 / FZ-31', 'stop-button', 350, 600);

  [
    ['fire-alarm-button', '火灾报警按钮', 'Fire Alarm Button', 'alarm_button'],
    ['fire-alarm-call', '火灾报警电话', 'Fire Alarm Call', 'alarm_call'],
    ['fire-hydrant', '消火栓', 'Fire Hydrant', 'hydrant'],
    ['fire-extinguisher', '灭火器箱', 'Fire Extinguisher Box', 'extinguisher'],
    ['gas-fire-control-panel', '气体消防控制盘', 'Gas Fire Control Panel', 'gas_control'],
    ['fire-alarm-controller', '消防主机', 'Fire Alarm Controller', 'fire_control'],
    ['gas-fire-controller', '气体消防主机', 'Gas Fire Controller', 'gas_controller']
  ].forEach(function (a) {
    add(a[0], a[1], '消防与疏散', 'facility', 400, 150, title(a[1], a[2]),
      source(65, '4.7.2 / FZ-32', '4.7.2', '设备主牌 400 × 150；方向箭头为独立 80 × 150 牌。'),
      { icon: a[3], variant: 'fire', background: RED, color: WHITE, accent: RED });
  });
  add('evacuation-map', '消防疏散示意图', '消防与疏散', 'information', 340, 240,
    title('消防疏散示意图', 'Fire Evacuation Plan').concat([field('body', '疏散信息', '当前位置\n疏散路线\n安全出口', true)]),
    source(66, '4.7.4 / FZ-34', '4.7.4', MAP), { variant: 'evacuation-map', accent: GREEN });
  add('emergency-exit', '紧急出口', '消防与疏散', 'notice', 330, 120,
    title('紧急出口', 'Emergency Exit'), source(67, '4.7.6 / FZ-36', '4.7.6'),
    { icon: 'emergency_exit', variant: 'emergency-exit', background: GREEN, color: WHITE, accent: GREEN });

  add('interconnection-timetable', '互联互通时刻表', '互联互通', 'information', 900, 600,
    title('列车时刻表', 'Train Timetable').concat([field('body', '小时|平日分钟列表|双休日分钟列表（每行一项）', '小时|平日时刻表|双休日时刻表\n06|--|--\n07|--|--\n08|--|--\n09|--|--', true)]),
    source(68, '4.8.2 / FZ-37', '4.8.2', '普通车与直快车运营信息分开填写；默认不填入运营时刻。'), { variant: 'timetable' });
  add('interconnection-route', '互联互通直行线路图', '互联互通', 'route', 900, 1800,
    title('直行线路图', 'Route Map').concat(lineFields('环', 'Loop Line')).concat([field('stations', '站点（中文|英文|编号，每行一站）', '普通车停靠站||01\n换乘车站||02\n直快车停靠站||03', true)]),
    source(69, '4.8.3 / FZ-04', '4.8.3', '普通车与直快车停靠信息由用户填写。'), { variant: 'route-double' });
  add('interconnection-transfer', '互联互通换乘', '互联互通', 'guide', 900, 1200,
    title('换乘', 'Transfer').concat(lineFields('环', 'Loop Line')).concat([field('body', '线路中文|English|方向中文|English（每行一项）', '换乘4号线|Transfer to Line 4|唐家沱方向（普通列车）/重庆图书馆方向（直快列车）|To Tangjiatuo (Local Train) / Chongqing Library (Express Train)\n换乘环线|Transfer to Loop Line|重庆北站南广场方向（内环）|To Chongqing North Station South Square (Clockwise Loop)\n换乘4号线|Transfer to Line 4|唐家沱方向（直快列车）|To Tangjiatuo (Express Train)', true)]),
    source(71, '4.8.4 / FZ-38', '4.8.4'), { variant: 'transfer-column', direction: 'up' });
  add('interconnection-line-guide', '互联互通列车运行方向', '互联互通', 'route', 4700, 540,
    title('列车运行方向', 'Train Direction').concat(lineFields('环', 'Loop Line')).concat([field('stations', '站点（中文|英文|编号，每行一站）', '普通车停靠站||01\n换乘车站||02\n直快车停靠站||03', true)]),
    source(72, '4.8.5 / FZ-05', '4.8.5', '沿用矩形屏蔽门顶部牌，普通车与直快车停靠内容可编辑。'), { variant: 'route-horizontal' });
  add('protection-post', '轨道交通控制保护区警示桩（正面）', '保护区标识', 'notice', 150, 1000,
    [field('title', '竖排名称', '轨道保护区域'), field('body', '管理信息', '监管管理信息\n管理单位及联系方式', true)],
    source(76, '4.9.3 / LD-11', '4.9.3', '仅绘制露出地面 1000 高的正面矩形信息面；桩体总长 1500，地下部分不在牌面内。'), { icon: 'crt', variant: 'protection-post', accent: GREEN });
  add('protection-notice', '轨道交通控制保护区提示牌', '保护区标识', 'notice', 1500, 1000,
    [field('title', '提示名称', '轨道保护区域'), field('body', '提示内容', '严禁违法施工', true), field('footer', '管理信息', '监管管理信息及联系方式')],
    source(77, '4.9.4 / LD-12', '4.9.4', '仅绘制 1500 × 1000 牌面；支架不在牌面内。管理信息由责任单位填写。'),
    { icon: 'crt', variant: 'protection-notice', background: BLUE, color: WHITE, accent: BLUE });

  var BY_ID = Object.create(null);
  var LINE_COLORS = { '1': '#E4002B', '3': '#003DA5', '环': '#F2A900' };
  ALL.forEach(function (t) {
    if (t.id === 'station-name' || t.id === 'station-name-vertical' || t.id === 'platform-direction-split' || t.id === 'platform-direction-single') {
      t.fields = t.fields.filter(function (f) { return f.key !== 'lineEn'; });
    }
    if (t.layout === 'guide' || t.layout === 'station' || t.layout === 'route') {
      t.colorEditable = true;
      var lf = t.fields.filter(function (f) { return f.key === 'line'; })[0];
      var firstLine = lf && lf.value.split('/')[0];
      if (LINE_COLORS[firstLine]) t.accent = LINE_COLORS[firstLine];
    }
    if ((t.layout === 'guide' || t.variant === 'fire' || t.variant === 'emergency-exit') && t.directional !== false) t.directional = true;
    if (t.layout === 'information') t.colorEditable = true;
    if (t.variant === 'map' || t.variant === 'evacuation-map') {
      t.fields.push(field('schematicLabel', '示意图区名称', '示意图 / Schematic'));
    }
    if (t.variant === 'stop-button') {
      t.fields = title('非紧急情况禁止使用，违者将追究法律责任', 'For emergency use only. Misuse will incur legal liability.');
      t.background = RED;
      t.color = WHITE;
      if (t.id === 'emergency-stop-cover') t.source.note = '按附录 FZ-31 的 350 × 600 成品尺寸；中部为长圆开孔。';
    }
    BY_ID[t.id] = t;
  });
  function get(id) { return BY_ID[id] || BY_ID['station-name']; }
  function defaultFields(id) {
    var values = {};
    get(id).fields.forEach(function (f) { values[f.key] = f.value; });
    return values;
  }
  function createProps(id) {
    var t = get(id);
    return {
      templateId: t.id, fields: defaultFields(t.id), widthRatio: t.width / t.height,
      lineColor: t.accent, direction: t.direction || 'right', paddingAuto: false,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      elementAlign: 'left', backgroundColor: null
    };
  }
  // 只从新增库移除；历史定义与 BY_ID 保留，旧项目仍按原 ID 恢复。
  var REMOVED_IDS = [
    'first-last-train', 'interconnection-timetable', 'network-map', 'network-map-double', 'street-map', 'evacuation-map',
    'entrance-identity', 'gate-indicator', 'fare-information'
  ];
  var active = ALL.filter(function (template) { return REMOVED_IDS.indexOf(template.id) === -1; });
  global.SignCRT = { ALL: active, LEGACY_ALL: ALL, REMOVED_IDS: REMOVED_IDS, get: get, defaultFields: defaultFields, createProps: createProps };
})(typeof window !== 'undefined' ? window : globalThis);
