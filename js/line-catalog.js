/**
 * line-catalog.js — 静态公共线路目录的校验、加载与管理员导出。
 * 公共目录与本地线路库独立；本模块不读取 App 或 Storage，也不保存网络结果。
 */
(function (global) {
  'use strict';
  var FORMAT = 'railway-line-catalog';
  var VERSION = 1;
  var DEFAULT_URL = 'data/lines.json';
  var DEFAULT_TIMEOUT = 10000;

  function plain(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }
  function fail(message) { throw new Error('公共线路目录无效：' + message); }

  /** 顶层损坏拒绝；默认跳过单条损坏并报告，strict 用于管理员发布前核对。 */
  function parse(input, options) {
    var value = input;
    if (typeof input === 'string') {
      try { value = JSON.parse(input.replace(/^\uFEFF/, '')); }
      catch (_) { fail('文件不是有效的 JSON'); }
    }
    if (!plain(value) || value.format !== FORMAT) fail('文件类型必须为 ' + FORMAT);
    if (value.version !== VERSION) fail('不支持的目录版本');
    if (!Array.isArray(value.lines)) fail('lines 必须为线路数组');
    if (value.updatedAt !== undefined && typeof value.updatedAt !== 'string') fail('updatedAt 必须为字符串');
    if (!global.SignRoutes || typeof global.SignRoutes.validateLine !== 'function') fail('未加载线路模块');
    var lines = [], warnings = [], seen = new Set();
    value.lines.forEach(function (inputLine, index) {
      try {
        var line = global.SignRoutes.validateLine(inputLine);
        if (seen.has(line.id)) throw new Error('线路 ID 重复：' + line.id);
        seen.add(line.id); lines.push(line);
      } catch (error) {
        var message = '第 ' + (index + 1) + ' 条线路：' + error.message;
        if (options && options.strict) fail(message);
        warnings.push(message);
      }
    });
    return { lines: lines, updatedAt: value.updatedAt === undefined ? null : value.updatedAt, warnings: warnings };
  }

  /** 管理员将完整线路对象导出为可直接上传到 data/lines.json 的目录。 */
  function serialize(lines, options) {
    var file = { format: FORMAT, version: VERSION };
    if (options && options.updatedAt !== undefined) file.updatedAt = options.updatedAt;
    file.lines = lines;
    var checked = parse(file, { strict: true });
    file.lines = checked.lines;
    return JSON.stringify(file, null, 2) + '\n';
  }

  function resolveURL(options) {
    var url = options.url || DEFAULT_URL;
    var base = options.baseURL || global.document && global.document.baseURI || global.location && global.location.href;
    return base ? new global.URL(url, base).href : String(url);
  }

  /** 每次独立请求并禁用缓存。运行态缓存与并发响应取舍由调用方负责。 */
  async function load(options) {
    options = options || {};
    var fetcher = options.fetch || global.fetch;
    if (typeof fetcher !== 'function') throw new Error('公共线路目录加载失败：当前环境无法发送请求');
    var url = resolveURL(options);
    var timeout = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.min(options.timeoutMs, 2147483647) : DEFAULT_TIMEOUT;
    var controller = typeof global.AbortController === 'function' ? new global.AbortController() : null;
    var requestOptions = { cache: 'no-store' };
    if (controller) requestOptions.signal = controller.signal;
    var timer;
    var limit = new Promise(function (_, reject) {
      timer = global.setTimeout(function () {
        reject(new Error('公共线路目录加载超时，请重试'));
        if (controller) controller.abort();
      }, timeout);
    });
    var request = (async function () {
      var response = await fetcher.call(global, url, requestOptions);
      if (!response || !response.ok) throw new Error('公共线路目录加载失败：HTTP ' + (response && response.status || '未知'));
      var input = typeof response.text === 'function' ? await response.text() : await response.json();
      return parse(input);
    })();
    try { return await Promise.race([request, limit]); }
    finally { global.clearTimeout(timer); }
  }

  global.SignLineCatalog = {
    FORMAT: FORMAT, VERSION: VERSION, DEFAULT_URL: DEFAULT_URL, DEFAULT_TIMEOUT: DEFAULT_TIMEOUT,
    parse: parse, serialize: serialize, load: load,
  };
})(typeof window !== 'undefined' ? window : globalThis);
