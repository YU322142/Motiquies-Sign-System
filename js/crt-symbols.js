/**
 * crt-symbols.js — 重庆矩形标识牌内使用的补充矢量符号。
 *
 * 参照 DBJ50/T-274-2024 的扫描图近似重绘。此文件是独立维护的
 * SVG 几何源，不修改由 gen-icons.mjs 生成的 icons.js。
 * black 可由牌面渲染器替换为前景色，white 保留；不含字体、位图或外链。
 */
(function (global) {
  'use strict';

  var ALL = Object.create(null);
  function add(id, name, body) {
    ALL[id] = Object.freeze({ name: name, vb: '0 0 100 100', body: body });
  }
  function path(d, fill) {
    return '<path d="' + d + '" fill="' + (fill || 'black') + '"/>';
  }
  function line(d, width, color) {
    return '<path d="' + d + '" fill="none" stroke="' + (color || 'black') +
      '" stroke-width="' + (width || 5) + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function circle(cx, cy, r, fill) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (fill || 'black') + '"/>';
  }
  function rect(x, y, w, h, fill, radius) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (radius || 0) + '" fill="' + (fill || 'black') + '"/>';
  }
  function framed(body) {
    return '<rect x="4" y="4" width="92" height="92" rx="8" fill="none" stroke="black" stroke-width="4"/>' + body;
  }
  // Standard 4.6.3 uses a rounded square with a diagonal prohibition band.
  // RGB safety colors are screen approximations; 3.4.4 refers to GB 2893.
  function forbidden(body) {
    return rect(3, 3, 94, 94, 'white', 9) +
      '<rect x="3" y="3" width="94" height="94" rx="9" fill="none" stroke="#C8102E" stroke-width="3"/>' +
      body.replace(/black/g, '#111111') + line('M10 10L90 90', 10, '#C8102E');
  }
  function warning(body) {
    return path('M50 5L97 92H3Z', '#111111') + path('M50 19L85 84H15Z', '#FFD700') +
      body.replace(/black/g, '#111111');
  }
  var walk = circle(51, 17, 8) + path('M43 29L56 27L67 42L80 46L77 54L61 49L56 42L55 57L71 83L62 89L45 65L39 87L28 85L35 55L38 39L27 49L19 44L32 31Z');
  var seated = circle(40, 22, 8) + path('M32 34H47V55H68V68H44Q32 68 32 57Z') + line('M25 42V74H67V88M42 76H59', 6);
  var hand = path('M34 85L20 65Q17 58 23 55Q27 53 31 59L36 65V24Q36 19 40 19Q44 19 44 24V49H46V16Q46 11 50 11Q54 11 54 16V49H56V21Q56 16 60 16Q64 16 64 21V50H66V29Q66 24 70 24Q74 24 74 29V67L66 87Z');
  var cigarette = rect(17, 63, 58, 9) + rect(78, 63, 5, 9) + line('M57 54C38 40 73 42 57 25M75 54C60 42 86 38 72 20', 4);
  var flame = path('M51 8C53 28 31 31 34 49C39 40 43 38 45 32C48 48 64 44 62 62C70 57 73 47 72 39C93 65 77 91 51 92C21 93 12 67 23 49C22 66 33 71 35 68C24 46 42 34 51 8Z');
  var stairs = line('M8 86H26V73H43V60H60V47H77V34H94', 6);
  var elevator = '<rect x="23" y="23" width="54" height="64" rx="3" fill="none" stroke="black" stroke-width="5"/>' +
    circle(50, 40, 6) + path('M43 49H57V65H54V81H48V65H44V81H38V57Q38 49 43 49Z') +
    line('M33 16V5M26 11L33 4L40 11M67 5V16M60 10L67 17L74 10', 4);
  var train = '<rect x="19" y="10" width="62" height="68" rx="15" fill="none" stroke="black" stroke-width="7"/>' +
    rect(28, 25, 44, 26, 'black', 3) + circle(33, 65, 5) + circle(67, 65, 5) + line('M31 79L19 94M69 79L81 94', 6);

  // Industry mark, simplified from the construction grid in PDF page 175.
  add('crt', '重庆轨道交通',
    '<g transform="translate(1 30) scale(.178)">' +
    '<path d="M126 28H282L229 85H186L167 104H189V188H34Q5 188 20 165Z' +
    'M56 166H165V123H117L169 65H214L230 47H145Z" fill="black" fill-rule="evenodd"/>' +
    path('M211 104H240L321 28H391L329 104H278V188H211Z') +
    path('M422 28H549L481 104H440L367 188H290Z') + '</g>');
  add('customer_service', '乘客服务中心', framed(
    circle(31, 22, 8) + circle(68, 22, 8) +
    path('M20 36H42V64H37V88H29V59H26V88H18V43Q18 36 20 36Z') +
    line('M58 59V39Q58 34 64 34H72Q79 34 79 40V59M69 37V54M46 66H90', 5)));
  add('lost_found', '失物招领', framed(
    '<path d="M19 43H64V83H19ZM31 43V33H51V43" fill="none" stroke="black" stroke-width="5"/>' +
    circle(73, 33, 13) + line('M81 43L90 53', 6) + line('M37 59H46M41 55V64', 4)));
  add('security_check', '安全检查', framed(
    rect(16, 19, 68, 55) + rect(25, 27, 50, 37, 'white') +
    rect(37, 42, 26, 19, 'black', 2) + line('M44 42V36H56V42', 3) +
    line('M11 80H89M18 89H82', 5)));
  add('air_conditioned', '空调候车室', framed(
    circle(72, 22, 15, 'white') + line('M72 10V34M60 22H84M64 14L80 30M80 14L64 30', 3) +
    circle(34, 28, 7) + path('M26 40H42V60H61V70H32Q26 70 26 64Z') +
    line('M19 47V78H59V90M44 73H57V87', 5)));
  add('train_direction', '列车运行方向', train);
  add('fire', '火情', flame);
  add('stairs_fire', '逃生楼梯', stairs + '<g transform="translate(23 5) scale(.63)">' + walk + '</g>');
  add('no_elevator', '禁止使用电梯', forbidden(elevator));
  add('alarm_button', '火灾报警按钮', framed(
    '<rect x="32" y="11" width="36" height="26" rx="3" fill="none" stroke="black" stroke-width="4"/>' +
    circle(50, 24, 7) + path('M33 87L24 64Q21 57 27 54L38 65V37Q38 30 44 30Q49 30 49 37V55H55V48Q55 43 61 46L76 57V79L68 88Z')));
  add('alarm_call', '火灾报警电话', framed(
    path('M24 12L39 28L30 40Q40 62 61 71L72 62L88 77L78 91Q75 95 69 93C35 83 13 60 7 27Q6 21 11 17Z') +
    line('M60 13Q82 17 86 40M57 25Q70 27 74 40', 4)));
  add('hydrant', '消火栓', framed(
    '<rect x="15" y="16" width="44" height="68" rx="3" fill="none" stroke="black" stroke-width="5"/>' +
    line('M24 23V75M33 23V75M42 23V75M51 23V75', 3) +
    line('M59 45H80V65H70M73 35V54M66 44H82', 5)));
  add('extinguisher', '灭火器箱', framed(
    '<rect x="19" y="32" width="30" height="56" rx="8" fill="none" stroke="black" stroke-width="5"/>' +
    rect(27, 20, 11, 13) + line('M30 20H48Q62 20 62 39M29 48H40M25 59H43', 4) +
    '<g transform="translate(50 34) scale(.43 .55)">' + flame + '</g>'));
  var control = framed('<rect x="15" y="19" width="70" height="65" rx="4" fill="none" stroke="black" stroke-width="5"/>' +
    rect(24, 28, 52, 25) + circle(29, 66, 4) + circle(43, 66, 4) + circle(57, 66, 4) + circle(71, 66, 4));
  add('gas_control', '气体消防控制盘', control);
  add('fire_control', '消防主机', control);
  add('gas_controller', '气体消防主机', control);
  add('emergency_stop', '紧急停车按钮', framed(
    '<circle cx="50" cy="48" r="30" fill="none" stroke="black" stroke-width="6"/>' +
    rect(28, 37, 44, 20, 'black', 5) + rect(42, 57, 16, 13) + line('M24 85H76', 5)));
  add('emergency_exit', '紧急出口',
    path('M8 4H51V14H18V88H51V98H8Z') +
    '<g transform="translate(15 7) scale(.83 .86)">' + walk + '</g>');

  add('no_smoking', '禁止吸烟', forbidden(cigarette));
  add('no_throwing', '禁止抛物', forbidden(
    path('M51 15L72 23L65 43L54 41L48 51L42 47L49 34L42 44L37 40L45 26Z') +
    rect(35, 58, 9, 12) + path('M24 80L35 76L38 87L27 91Z') + line('M43 52L36 59', 3)));
  add('no_jumping_down', '禁止跳下', forbidden(
    circle(49, 24, 7) + line('M43 38L57 48L70 29M46 43L30 32M54 47L58 67L73 82M58 66L40 81', 8) +
    line('M76 44H89V85', 4)));
  add('no_leaning', '禁止倚靠', forbidden(
    circle(50, 22, 8) + path('M42 34H55L64 61L60 85H51V62H47L41 85H31L39 55Z') + line('M68 19V87', 5)));
  add('no_stacking', '禁止堆放', forbidden(
    '<path d="M16 26H84V78H16ZM26 26V78M73 26V78M16 39H84M16 64H84" fill="none" stroke="black" stroke-width="5"/>' +
    rect(37, 35, 25, 14) + rect(37, 53, 25, 14)));
  add('no_littering', '请勿丢弃废弃物', forbidden(
    '<g transform="translate(18 0) scale(.85)">' + walk + '</g>' +
    path('M18 64L29 69L24 78L15 74Z') + line('M13 83L30 66M14 65L31 82', 5)));
  add('no_sitting', '请勿坐卧', forbidden(seated));
  add('no_touching', '请勿触摸', forbidden(hand + rect(19, 9, 62, 7)));
  add('no_pets', '请勿携带宠物', forbidden(
    path('M17 46H58L68 32L78 37L80 52L69 59L65 82H57V61H34V82H25V56L16 61L10 49L14 45L21 51Z') +
    path('M73 34L69 19L84 30Z') + circle(75, 42, 2, 'white')));
  add('no_thoroughfare', '请勿通过', forbidden(walk));
  add('no_entry', '禁止进入', forbidden(walk));
  add('no_playing', '请勿玩耍', forbidden(
    line('M8 42H28V32H48V22H69V12H91', 4) +
    '<g transform="translate(24 31) scale(.57)">' + walk + '</g>' + circle(23, 83, 6)));
  add('no_crossing', '请勿翻越', forbidden(
    circle(43, 20, 7) + line('M40 34L29 49L43 59L63 53M42 33L57 43L72 44M44 60L39 84M63 53L73 76', 8) +
    rect(12, 61, 77, 9)));
  add('no_head_out', '请勿探头', forbidden(
    circle(52, 22, 8) + path('M43 34L59 31L66 46L57 51L53 42V77H39V57L27 45L32 37L41 44Z') +
    line('M67 17V86H88', 4)));
  add('no_spitting', '请勿随地吐痰', forbidden(
    circle(49, 23, 8) + path('M43 36H57V60H54V85H44V60H39V44Z') +
    path('M29 42L34 49L27 53ZM24 65L29 71L22 76Z')));
  add('no_jumping', '请勿跳跃', forbidden(
    stairs + circle(43, 22, 7) + line('M39 35L51 46L69 39M43 39L28 46M51 47L55 63L76 73M53 62L40 77', 7)));

  add('warning', '注意安全', warning(rect(46, 34, 8, 29, 'black', 3) + circle(50, 74, 5)));
  add('electric_shock', '当心触电', warning(path('M55 28L36 56H48L41 78L67 46H54L64 28Z')));
  add('cable', '当心电缆', warning(
    '<g transform="translate(23 28) scale(.48)">' + walk + '</g>' + line('M22 76Q35 66 48 76T77 76', 4)));
  add('overhead_obstacles', '当心碰头', warning(
    line('M30 41H70V50H61', 6) + circle(52, 55, 6) +
    line('M49 64L42 74L31 76M49 64L62 72L65 80', 6)));
  add('hands_pinching', '当心夹手', warning(
    rect(31, 36, 6, 44) + '<g transform="translate(34 35) scale(.44 .48)">' + hand + '</g>' +
    line('M70 43V78M66 58L76 58', 4)));
  add('drop_down', '当心坠落', warning(
    line('M20 77H48V66H76', 5) + circle(46, 37, 6) +
    line('M46 48L55 60L69 61M50 51L33 58M55 60L51 74', 6)));
  add('gap', '当心缝隙', warning(
    path('M19 77H44V65H19ZM58 65H81V77H58Z') + circle(44, 34, 6) +
    line('M43 44L47 57L63 59M46 55L34 69M58 60L55 79', 5)));
  add('slippery_surface', '当心滑倒', warning(
    circle(63, 36, 6) + line('M56 45L47 58L30 60M55 48L69 55M46 58L57 71L75 72M47 60L33 78', 6) +
    line('M20 83H80', 3)));

  // Eight restricted-article pictograms used as a two-by-four matrix in 4.6.2.
  add('danger_balloon', '气球', forbidden(
    circle(36, 34, 16) + circle(59, 30, 16) + circle(53, 52, 16) + line('M35 51L48 86L59 48', 3)));
  add('danger_radioactive', '放射性物品', forbidden(
    circle(51, 46, 7) + path('M47 36L35 14Q23 23 21 40L43 44ZM61 43L86 41Q85 24 71 15L58 36ZM46 58L34 80Q51 91 69 79L57 58Z')));
  add('danger_barrel', '危险液体', forbidden(
    '<path d="M28 20Q50 10 72 20V78Q50 89 28 78ZM28 20Q50 31 72 20M28 42Q50 54 72 42M28 64Q50 76 72 64" fill="none" stroke="black" stroke-width="5"/>'));
  add('danger_flammable', '易燃物品', forbidden(
    rect(21, 39, 26, 48) + rect(27, 28, 14, 11) + rect(57, 22, 19, 65, 'black', 2) +
    '<g transform="translate(25 51) scale(.20 .28)">' + flame.replace(/black/g, 'white') + '</g>'));
  add('danger_weapons', '枪械刀具', forbidden(
    path('M16 28H70V41H51V49H35L29 67H17L23 46H16Z') +
    path('M76 35L83 41L59 75L48 87L43 83L53 70Z')));
  add('danger_explosive', '爆炸物品', forbidden(
    path('M47 15L52 38L70 18L63 42L87 37L69 54L88 70L63 67L63 91L48 72L33 90L35 67L12 69L29 53L12 36L37 40Z') +
    circle(49, 54, 12, 'white')));
  add('danger_fireworks', '烟花爆竹', forbidden(
    line('M50 12V83M29 24L50 34L71 24M26 42L50 52L74 42M25 61L50 72L75 61', 7)));
  add('danger_toxic', '有毒腐蚀物品', forbidden(
    circle(49, 49, 17) + circle(43, 45, 5, 'white') + circle(56, 45, 5, 'white') +
    path('M45 58H55V68H45Z') + line('M27 73L72 88M72 73L27 88', 6) +
    path('M32 17L59 15L62 23L34 27Z') + path('M70 27L75 35L68 39Z')));
  var articles = ['danger_balloon', 'danger_radioactive', 'danger_barrel', 'danger_flammable',
    'danger_weapons', 'danger_explosive', 'danger_fireworks', 'danger_toxic'];
  add('dangerous_goods', '严禁携带危险品', articles.map(function (id, i) {
    return '<g transform="translate(' + ((i % 4) * 25) + ' ' + (Math.floor(i / 4) * 26 + 25) +
      ') scale(.24)">' + ALL[id].body + '</g>';
  }).join(''));

  // Naming aliases keep catalog ids readable while sharing the same geometry.
  ALL.fire_extinguisher = ALL.extinguisher;
  ALL.fire_hydrant = ALL.hydrant;
  ALL.fire_alarm = ALL.alarm_button;
  ALL.gas_fire_control = ALL.gas_control;
  ALL.gas_fire_controller = ALL.gas_controller;
  ALL.fire_alarm_controller = ALL.fire_control;
  ALL.emergency_stairs = ALL.stairs_fire;
  ALL.safety_check = ALL.security_check;
  Object.freeze(ALL);
  global.SignCRTSymbols = Object.freeze({
    ALL: ALL,
    get: function (id) { return Object.prototype.hasOwnProperty.call(ALL, id) ? ALL[id] : null; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
