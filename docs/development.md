# 开发指南

面向后续开发者（含 AI 代理）的完整技术说明。领域术语见根目录 [CONTEXT.md](../CONTEXT.md)，渲染引擎选型见 [adr/0001-svg-rendering-engine.md](adr/0001-svg-rendering-engine.md)，移动端适配决策见 [adr/0002-mobile-support.md](adr/0002-mobile-support.md)。

## 总览

零依赖纯前端：vanilla JS IIFE 模块 + 浏览器内置能力，无框架、无构建、无包管理。加载顺序（`index.html`）：

```
core.js → icons.js → crt-symbols.js → crt-catalog.js → crt-render.js
→ state.js → render.js → composition.js → routes.js → line-catalog.js → workspace.js → sign-content.js → ui.js → presets.js
→ storage.js → exporters.js → panel.js → interact.js → main.js
```

除 `App`（ui.js 导出的全局可变上下文）与各 `Sign*` 命名空间外无全局状态。除 `render.js` 的 draw 函数、`panel.js`、`interact.js` 外均不依赖 DOM，可在 Node 中直接加载测试。

## 核心数据流

```
用户操作
  → App.update(pureFn)            # ui.js：唯一变更入口，pureFn(state) → 新 state（不可变）
    → App.renderAll()             # renderSignInto（SVG 原地重绘）+ overlay + syncRightPanel
      → storage.scheduleAutosave  # 防抖 500ms 写 localStorage，beforeunload 兜底
```

工作区管理多块独立标识牌，编辑器的 `App.state` 仍以当前牌面的 Sign 为入口，其他牌面作为工作区快照保存。顶部牌面卡片切换当前 Sign；添加组合预设建立新的独立牌面，普通「添加行」只修改当前 Sign。牌面宽度、行高与图片导出在当前 Sign 内计算，不能用同一 Sign 的多行代替工作区里的多块牌面。项目 JSON 保存整个工作区，线路和当前车站信息共享。

`workspace.js` 的 `SignWorkspace` 使用 `sign.workspace = {activeId, boards}`。当前条目只保存 `{id, name}`，非当前条目保存 `{id, name, sign}`；快照移除自身 `workspace` 和共享的 `context`，避免递归或重复数据。`select` 先保存离开的牌面快照，再恢复目标牌面并附回共享上下文；`addPreset`、`addBlank`、`rename`、`remove` 都返回新状态。`list` 给界面返回包含当前完整 Sign 的只读牌面描述。

项目导入由 `State.deserializeSign` 调用 `SignWorkspace.restore` 或 `migrate`。旧项目若有至少两行带明确 `templateId` 或 `route` 来源，会迁移成独立牌面；普通手工多行保持原样。工作区快照恢复时使用 `skipWorkspace` 防止重复迁移，自动保存与项目导出仍走原状态序列化入口。

- 状态模型（state.js）：`SignState { widthMode, width, rowHeight, aspectLocked, backgroundColor, rows, context?, workspace? }`，`Row { id, elements, layout?, widthRatio?, referenceWidthRatio?, templateId?, backgroundColor?, route?, fourSided? }`，`Element { id, type, props }`。缺省为横向流式行；`layout: 'free'` 的行使用 `props.box {x,y,width,height}`，各值均为行高的比例。所有操作（增删行/元素、移动、属性合并、序列化/反序列化校验）都是纯函数。
- 项目当前线路和车站保存在 `sign.context = {line, stationId}`；`State.setProjectContext` 规范化线路和站点 ID。`composition.contextOverrides` 按预设语义填入新牌的线路、站名、站号和方向；`contextProps` 为新加的基础线路／站名元素提供默认值。自建线路使用自定颜色，不自动套用重庆线路色。切站只改变以后添加的默认信息，既有元素不批量改写。
- 线路图行另存 `row.route = {line, orientation}`，保留该图自己的完整线路快照；项目导入时经 `SignRoutes.normalizeLine` 复核。项目当前车站与某张线路图的本站可以不同。
- 标准线路图传 `routeLine` 完整数据给 CRT metrics，由 `Routes.forContext` 按站点 ID 确定本站，保留方向、换乘和相关线路配色；不能再仅将站表转成文字。单牌来源另存 `row.stationContext = {line, stationId, source?, transferLineIds?}`，经 `State.setRowStationContext` 规范化，并随项目及我的预设保存。
- `sign-content.js` 的 `SignContent.build` 为模板点击、拖入和更换选站提供统一配方；`replaceRow` / `replaceBoards` 保留原行 ID、牌型、手调比例与宽度模式，批量操作恢复原活动牌和共享当前车站。选站窗口优先读相同来源与 ID 的最新线路库，缺失才使用快照；线路编辑草稿按来源、线路 ID 和牌面行 ID 隔离。
- `App.layout` 缓存最近一次 `layoutSign` 结果，供交互层（落点指示、gap 计算）与设置面板复用。
- 相邻自动内边距：元素属性 `paddingAuto`（新建默认 true，旧存档缺省 false 钉住）。`applyPaddingAuto` 在 App.update 管线中幂等重算——paddingAuto 元素的左/右侧在同行同通道紧邻其他元素（空白占位不算）时取 0.1，否则 0.2；经 `updateElementProps` 写入左右内边距视为手动编辑并钉住（false）。space 恒为 false。
- 选中态（`App.selection.elementId`）不属于 SignState，驱动右栏面板模式（元素属性 / 预设预览 / 标识牌设置）。
- 编辑器偏好（`App.prefs`：`autoLineColor` 自动配色开关、`paletteCity` 配色来源，含 `server` 服务器线路、`fictional` 我的线路及三个城市）同样不属于 SignState（不进项目 JSON），存于 localStorage `sign-prefs`（storage.js `loadPrefs`/`savePrefs`）。来源切换时所有打开中的颜色选择器经 panel.js 的 `paletteCityFns` 观察者同步重建色板；`Core.lineColorFor(号, 城市)` 与 `Core.citySwatches(城市)` 为纯函数，城市表见 core.js `CITY_PALETTES`。

## render.js：metrics / draw 双轨

每个元素类型实现两个函数：

1. **metrics**（纯几何，输入 `(element, rowHeight, measure)`，Node 可测）：输出宽度与该元素全部绘制坐标（基线、色条矩形、分割位置等）。
2. **draw**（消费 metrics 生成 SVG DOM）：签名 `(g, el, mt)`，`mt` 是 `renderElement` 已算好的该元素 metrics。**draw 内不得再调用 metrics 函数**——每个元素每次渲染只测量一次文本，且绘制坐标只有 metrics 一套来源（两处各算一遍迟早漂移）。

两轨共享同一套公式是"所见即所得"的根基——改排版只改 metrics，draw 自动跟随。排版常量移植自参考实现 `sign_jr.py`。

### 排版关键点

- **墨区度量**（core.js `measure.ink` / `measure.ascent` / `measure.descent`）：基于 canvas `actualBoundingBox*`。数字线路的多位排版（`digitLayout`）全部按墨区：首位墨左锚定基准边距 `M=(s−adv₃)/2+lsb₃`、相邻墨区间距 `g=lsb₃+rsb₃`、右侧留白 M——「1」等窄字与其他数字视觉间距一致。数字基线 = 「号线」标签墨区顶 + 自身墨区上升高（顶对齐）。所有文本类元素的大文本统一经 `inkTextLayout`（大文本策略，元素旧名「大数字」，内部类型 id 仍为 `big-number`）排版：多位文本逐字按墨区间距 g 紧排（任意相邻字符间保持 g，混排不重叠），单字符按自身前进宽居中。两种边缘锚定由调用方选择——`edge='lsb'`（首位墨区锚自身字距边距 lsb，独立文本：大数字/编号/文本线路大字）、`edge='margin'`（首位/末位各留基准墨边距 M，紧贴色条：数字线路）。`digitLayout` 为其底层（带字体参数）；FONT_NUM 栈末尾含思源黑体，大文本等元素的中文经栈回退以思源渲染（数字/拉丁仍为 Frutiger）。
- **垂直解剖锚定**（render.js 排版解剖常数）：全文本类元素的**首行墨区顶**统一为 `内容顶 + INK_TOP_LEADING(0.036)×s`，基线 = 墨区顶 + 各自上伸部（中文 CJK_ASC 0.84、英文 cap EN_CAP 0.72、数字 NUM_ASC 0.70，均实测）。双语元素的中文字号 = 字面高意图(0.58s) ÷ 思源墨高比(0.92)（与 506/800 恒等）；同顶内边距 ⇒ 各类型墨区顶齐平（F2）。
- **双语文本对齐**（`bilingualAlignX`）：对齐基准是纯文本区宽度（metrics 的 `textW`），不是含 padding 的元素宽度；英文左右对齐带 `s/30` 光学缩进（移植自参考实现）。
- **箭头**（兼容保留的类型）：8 方向。斜向 = 轴向基底在 `√2s − t` 长的虚拟盒内构建后旋转 ±45°，箭尖锚在盒角、几何不越界；箭柄为四点多边形。
- **图标**：嵌套 `<svg viewBox>` 缩放到内容盒，`fill="black"` 替换为元素颜色（白色保留，tile 风格图标换色正确）。不依赖字体，导出自包含。

### 布局（layoutSign）

- 动态宽度：带 `widthRatio` 的行按 `rowHeight × widthRatio` 取宽；普通流式行按元素宽度之和取宽，自由行缺省按定位盒右边界取宽。整牌采用最宽行，允许窄竖牌宽度小于行高。
- 带参考比例的流式行：原生元素先统一测量，内容超出该行牌宽时整组等比缩小；富余宽度保留为牌面留白。`referenceWidthRatio` 保留参考值，`widthRatio` 保存当前值，不按长文本悄悄改变参考比例。
- 普通流式行在固定宽度模式下支持元素对齐（`props.elementAlign`，left/center/right）——三条独立通道：贴左流式、贴右从右缘流式、居中成组；通道间允许重叠（设计之内，用户调大牌宽解决）。
- 自由行：逐个按 `box` 定位，以同一缩放因子容纳元素，metrics 缓存在 slot 中，draw 直接消费；命中框仅覆盖该元素定位盒。自由行不应用相邻自动内边距。拖动改变定位盒，前后层级仍由 `elements` 顺序决定。
- `State.setRowAspectRatio` 收敛比例到 `0.1～64`；自由行同步缩放元素的横坐标与盒宽，保留纵坐标和盒高，字形仍等比适配。当前比例、参考比例、预设 ID、底色、线路图快照和四方体逐排编辑数据随项目保存，行预设也经 `SignPresets.save(..., rowOptions)` 保留这些元数据。
- 右栏独立「输出」区支持「导出此牌 SVG／PNG」：仅取当前行，以该行的 `widthRatio` 输出单张图片。标识牌设置中的原导出入口输出当前独立牌面的所有行，不拼接其他牌面；两者使用相同的内嵌字体与 SVG 光栅化管线。
- `measureFragment(type, props, rowHeight, measure)` 为无 ID、无 DOM 的共用测量入口；`drawMeasuredElement` 仅消费其结果。内置预设与手工添加的同类型元素共享这套公式。

## 面板刷新：签名 + syncFns

右栏三种模式：元素属性 / 预设预览 / 标识牌设置。`syncRightPanel()` 比较"结构签名"：

- 签名变化 → 重建 DOM（`syncFns` 清空重注册）；
- 签名不变 → 依次执行 `syncFns`（值回显，跳过焦点元素）。

**签名只能含结构性信息**（元素 id、类型、数字线路条数；预设 id 与数量）。设置面板签名是常量 `"settings"`——宽度模式等纯值变化必须走 syncFns 回显。

需要按值回显的控件工厂（`segGroup`/`checkbox`/`bindSync`/颜色选择器）都在**构建时立即 paint 一次**再注册 syncFns——重建路径不执行 syncFns，漏掉构建时 paint 就会出现"改了值但控件无选中态"。

**元素引用过期问题**：面板构建时拿到的 `el` 是快照，任何一次 patch 后即过期（不可变更新）。所有回调与取值必须经 `live()`（按 id 重查 `State.findElement`），否则后一次编辑会用旧值覆盖前一次（历史上正是"数字线路改号跳回默认"的根因）。

## 交互层（interact.js）

- 覆盖层（HTML div）承载行手柄/行按钮/落点指示器，SVG 保持纯净可导出。
- 元素拖拽：mousedown 记录 → 移动超 5px 激活（幽灵副本 + 落点指示）→ mouseup 提交 `State.moveElement`（gap 语义：落点间隙序号，同行向后自动回退一位）。
- 拖拽落点 `dropTargetAt` 按**被拖元素自身**的「元素对齐」通道计算：左/中通道数组序 = 视觉序，按「中点在指针左侧」计数；贴右通道数组序与视觉序相反，按「中点在指针右侧」计数并映射回数组间隙（指示线取通道边界）。混合通道行不可跨通道混算。
- 键盘：Del/Backspace 删除选中元素并取消选中；焦点在输入控件内或模态打开时不拦截。
- 空行删除免确认（无内容可丢）；含元素的行删除仍弹确认对话框。
- 拖拽结束设 `suppressClick` 吞掉紧跟的 click，并用 `setTimeout(0)` 立即过期——若落点与按下点不同元素，浏览器不产生 click，标志不能残留吞掉下一次点击。
- 编辑区显示 `App.fitSignDisplay`：适配画布宽度但缩放不超过 100%（窄标识牌不放大），canvas-wrap 尺寸变化由 ResizeObserver 触发重算。
- 相邻同背景色元素的无缝：元素背景与命中框宽度向上取整、平移向下取整，边界落在整数像素上相互覆盖，消除抗锯齿透明缝。
- 面板头部叉键等用 `hidden` 属性控制的元素，需配套显式 CSS 规则（`.icon-btn` 的 display 会覆盖 UA 的 hidden 规则），新增时同步加 `[hidden]` 样式。

## 移动端适配（≤768px）

断点、布局形态、Pointer 化与缩放的决策记录见 [adr/0002-mobile-support.md](adr/0002-mobile-support.md)。要点：

- **判定**：`App.isMobileView()`（ui.js，`matchMedia('(max-width: 768px)')`），与 style.css 媒体查询、main.js `watchBreakpoint` 共用同一数值。断点跨越时重建 palette、复位 `canvasZoom`、互清理两端折叠态（桌面 `collapsed` ≠ 移动 `band-collapsed`）。断点检测三路兜底：mq change + window resize + `documentElement` ResizeObserver（部分嵌入环境视口变化不派发事件），共用同一幂等检查。
- **布局**：纵向三段式——`#left-panel` 变顶部 chip 行 + 横向卡片条（panel.js `buildPaletteMobile`，`activeCategory` 为模块态跨重建保留；桌面/移动共用 `buildItemCard`/`buildPresetCards` 工厂）。**切换分类只翻 chip 的 active 态 + 就地替换卡片条（panel.js `selectPaletteCategory`），不整树重建 palette**——chip 行结构不随分类变化，重建会归零它的 `scrollLeft`（chip 行滑到右侧点选分类后弹回最左、刚点中的分类飞出视口，e2e S40 回归覆盖）；`buildPalette` 的结构重建路径（存/删预设、断点跨越）另显式保留该 `scrollLeft`；`#right-panel` 变底部属性带（40vh、`.band-collapsed` 折成 48px，`#right-collapse` 兼作把手），选中元素/进预览时 syncRightPanel 自动展开。**仅移动端**点击卡片添加后自动选中新元素（创建元素移到 `App.update` 之前以捕获 id）。移动块内 `#center-panel` 必须 `min-height: 0`：纵向 flex item 默认按内容取最小高度，多行/动态宽的高牌面会把它撑破、把底部属性带挤出视口（删除按钮不可达）——去掉该行即复发（e2e S39 回归覆盖）。
- **事件层**：拖拽（元素/行）全部 Pointer Events，会话锁定 `pointerId`（move/up/cancel 校验一致才处理）；`click` 处理器保留。触屏不在 pointerdown 上 `preventDefault`（防个别浏览器吞 click），滚动抑制靠 `touch-action`（`.hitbox`/`.row-handle` 为 none、卡片 manipulation、移动块内 `#canvas-scroll` 为 none）。**移动端禁用卡片 HTML5 拖拽**（`draggable` 按断点置 false + dragstart preventDefault，见 panel.js `wireCardDrag`）——触屏长按会唤起浏览器原生拖拽会话（卡片置灰、页面收不了场表现为卡死），添加一律走点击。
- **行控件外置**：≤768px 行带内不渲染手柄/按钮（会与牌面元素互相叠加），改由牌面下方 `#row-strip` 行管理条承接（interact.js `renderRowStrip`，每行一枚芯片：▲▼ 按钮调序 / 存预设 / 删行）；断点切换经 `watchBreakpoint` 的 `App.renderAll()` 重渲染。
- **手势**（interact.js 手势段，仅移动布局 + `pointerType === 'touch'`）：`#canvas-scroll` 的 `touch-action: none` 使原生滚动由手势层接管——单指空白拖动=平移（scrollLeft/Top）、双指=pinch（0.5x–4x，锚定两指中点）、空白双击=复位。冲突规则：已激活拖拽会话无视第二指；未激活会话在第二指落下时取消转 pinch。`App.canvasZoom` 是会话态（不持久化），乘进 `fitSignDisplay` 的适配宽度；缩放徽标 `#zoom-badge` 仅移动布局显示。`setPointerCapture` 到滚动容器保证手势期间 DOM 重建不丢事件（合成事件下会抛错，已 try/catch）。
- **生命周期**：自动存档刷盘与实例心跳释放挂在 `beforeunload` + `pagehide` + `visibilitychange(hidden)`（移动端切后台不触发 beforeunload），`visible` 恢复心跳。
- **hover 替代**：`@media (hover: none)` 下行手柄/行按钮常显、手柄内移 `left:8px`、触控目标 44px——该规则实际服务于**宽视口触屏**（如平板的桌面布局）；≤768px 移动布局行控件已外置（见上条），此块对移动端无效（移动 media 块在其后以 display:none 压制）。注意 `hover` 媒体特性反映设备输入能力——带鼠标的桌面机即使窗口 <768px 也不命中；媒体查询无法在桌面仿真验证，e2e 覆盖的是断点逻辑而非 hover:none。

## 测试约定

三套互补，改动后必须全绿：

1. **Node（`node --test`，test/*.mjs）**：状态模型纯函数 + render.js 纯几何。使用确定性假 measurer：`width = len×size×0.9`、`ascent = len×size×0.8`、`ink = { abl:−0.05s, abr:0.85s, adv:0.9s }`。断言按假 measurer 的公式推导。
2. **test.html（浏览器 DOM）**：真实字体下的结构渲染、墨区级间距/对齐断言（墨区顶 = 基线 `y` 属性 − `measure.ascent`；**不能用 getBBox**——Chromium 对 `<text>` 返回行盒）、导出字符串、颜色选择器。需要 getBBox 的用例先把节点挂到 `#fixture`。
3. **e2e.html（iframe 驱动）**：真实交互流（合成 PointerEvent 拖拽、DataTransfer 拖放、模态对话框），覆盖选中/拖拽排序/跨行/预设/面板回显/导出/实例守卫/缩放管线/pagehide 刷盘/移动壳层（S38 收窄 iframe 视口驱动 palette 分支与触屏手势；S39 多行/动态宽高牌面下底部属性带仍在视口内且删除按钮可达；S40 切换元素分类不重置 chip 行横向滑动位置）等，结果写 localStorage `e2e-results` 并反映在标题。视口切换处补发 `resize` 事件直达断点检查（嵌入浏览器 iframe 视口变化的事件派发可能被节流推迟，真实设备不受影响）。

HTTP 缓存坑：改完 js 后浏览器可能仍跑旧代码（症状：失败值与修复前逐字节相同）。在页面里 `fetch(url, {cache:'reload'})` 全部改动文件后 reload。

## 新增元素类型清单

### 四个专区与基础元素组合预设

左栏以横牌、竖牌、线路图、安全牌为四个专区，每区包含基础元素、组合预设与我的预设，共用左侧的线路管理入口。专区切换保持导航、搜索框和页签节点，更新卡片内容；移动端基础分类切换同样保留 chip 行及滚动位置。

`crt-catalog.js` 中 `SignCRT.ALL` 提供当前 82 款预设。`LEGACY_ALL` 保留完整91款记录，即初次整理89款，加实物补充的 `transfer-doorhead` 横梁及 `platform-direction-single` 单侧站台牌；`REMOVED_IDS` 列出已移出的九款：两个时刻表、四个地图，以及 `entrance-identity`（出入口确认矩形附牌）、`gate-indicator`（自动检票机通行状态）、`fare-information`（票价表）。`get(id)`、`defaultFields` 和 `createProps` 仍按原 ID 恢复旧项目，不能为恢复兼容而重新显示已移除项目。来源见 [重庆标准覆盖记录](chongqing-standard.md)。

`composition.js` 的 `materialize` 将预设转换为普通元素，新增操作不保留完整 `crt-sign` 元素。简单横牌直接组合原有的箭头、线路、双语文本与出口等类型；复杂牌面将几何指令转换为文字、图标、图形及原有元素，并附加 `props.box`。界面中的新增组合预设通过工作区入口建立独立牌面。`State.addTemplateRow(sign, preferredRowId, elements, options)` 是单块 Sign 内部的行操作，按定位盒识别流式或自由行，并从 `options` 接收参考比例、预设来源与线路图快照；不能直接用它把多个独立预设追加为当前牌面的多行。更新已有线路图可用 `replaceRowId` 明确替换目标行。

新增 `plain-text`（文字：字体、粗细、颜色、字号比例、`writingMode` 横／竖排、`letterSpacingRatio` 竖排字距）和 `shape`（矩形、圆形、线段、路径、多边形：安全几何属性、viewBox、填充及描边）。竖排 metrics 计算完整文字的逐字墨区位置，draw 使用同一结果输出一个带 tspan 的 text，不拆成多个元素。导入时校验这些属性与定位盒；合法数据应保持 JSON 往返一致。新增符号在 `crt-symbols.js`，通过原有 `icon` 类型选择，不修改生成物 `icons.js`。数字线路、出入口及出口的双语标签可编辑，仍走原有排版。

绑定背景的文字或图标以 `contrastSourceId` 指向同一行的背景 `shape`。更新其 `fill` 时，状态函数自动重算 `autoContrast: true` 的文字／图标颜色；手动改色设置 `autoContrast: false`，右栏「随背景自动黑白」可恢复。项目导入、复制和我的预设重新添加时重映射背景 ID，避免关联到另一块牌。门套数字色块通过编译指令的 `contrastKey`／`contrastOf` 建立关联，元数据不写入 SVG。

`crt-render.js` 的 metrics 指令是复杂预设转换的中间表示，也承担旧 `crt-sign` 存档的兼容绘制；draw 只消费 metrics，不再测量。旧整牌可在右栏转换为基础元素：单元素行原位转换，混合行中的复杂整牌另起自由行，保留其余原有元素。行预设保存所有基础元素及定位盒，预览和拖入均恢复自由排版。来源与范围见 [重庆标准覆盖记录](chongqing-standard.md)。

### 四方体逐排编辑

四方体导向仍由普通基础元素组成，`row.fourSided = {entries, props, referenceRowRatio}` 另存编辑数据。`entries` 限制 1～12 排，各排保存稳定 `id` 及 `leftZh/leftEn/line/lineEn/rightZh/rightEn`。右栏「编辑各排内容与顺序」支持实时改字、增删和上下排序；状态变更经 `updateFourSidedEntry`、`addFourSidedEntry`、`removeFourSidedEntry`、`moveFourSidedEntry` 纯函数重新组合，并显式接收 measurer。

参考比例按 `referenceRowRatio / 排数` 计算，重排时保留 `widthRatio / referenceWidthRatio` 的手调倍率，再收敛到合法范围。同一排同一用途的基础元素通过 `fourSidedEntryId/fourSidedRole` 复用 ID；独立修改的方向文字和线路回写排数据。项目导入和 `SignPresets.save(..., rowOptions)` 保留 `fourSided`、当前及参考比例，预设复用后仍可逐排编辑，也可继续独立编辑基础元素。

### 自建线路与独立线路文件

`routes.js` 为无 DOM 的线路模型。`Line {id, nameZh, nameEn, color, stations, currentStationId, direction}`；`Station {id, nameZh, nameEn, code, transfers}`，换乘为可编辑字符串，运行方向为 `forward|backward`。`createLine`、`patchLine`、`addStation`、`updateStation`、`removeStation`、`moveStation` 均返回副本；站点排序通过 ID 保持本站，删除本站后选相邻站。默认站名为通用占位，不填真实重庆车站。

`panel.js` 的线路色条／色块选择器使用 `onLineSelect`，由 `Core.uniqueLineForColor(color, candidates)` 判断颜色是否唯一对应一条线路。数字线路只填规范的 1～2 位编号及颜色；文本线路按 `nameSink` 填中文名、英文名及色块颜色。通用色、HEX 手输和前景色控件只改色；同色多线不猜测身份，保留文字并提示单独选择线路。各条数字线路通过 `live()` 和值同步独立更新，不以可编辑值重建面板。

独立文件为 `{format:'railway-line', version:1, line}`。`serialize`／`deserialize` 与项目 JSON 分开；导入严格核对格式、版本、字段类型、颜色、唯一站点 ID 及本站引用。宽容入口 `normalizeLine` 供项目恢复使用，不能替代线路文件的严格验证。`list`／`save`／`remove` 使用本地库 `railway-line-library-v1`，可注入 Storage 供 Node 测试。

`materialize(line, orientation, measure)` 返回 `{elements, widthRatio, route:{line, orientation}}`，其中 `orientation` 为 `horizontal|vertical`。所有元素均可单独编辑；默认高亮本站，已过区段变灰，箭头随运行方向改变。最多 256 站，参考比例随站数变化并收敛至 `0.1～64`；密集站点按站距缩小，过小的竖向双语改为同一行分栏，避免墨区取整导致覆盖。`test/routes.test.mjs` 覆盖不可变操作、独立文件、线路库、图形位置、密集站点及线路放入项目后的完整往返。使用步骤见 [虚构线路入门](fictional-lines.md)。

### 服务器公共线路列表

`line-catalog.js` 的 `SignLineCatalog` 处理静态 `{format:'railway-line-catalog', version:1, updatedAt?, lines}`，其中每项为完整的 `SignRoutes` 线路对象。`parse` 默认跳过损坏单条并返回 `warnings`，顶层格式错误拒绝；`serialize` 严格核对全部线路及唯一 ID。模块不读写本地 Storage，已有 `relatedLines` 快照随序列化保留。

`load({url?, baseURL?, fetch?, timeoutMs?})` 默认相对页面请求 `data/lines.json`，每次使用 `cache:'no-store'`，默认10秒超时。公共列表在界面运行态管理，不自动写入本地线路库；访客明确另存本地后才建立个人副本。管理员由编辑器导出完整列表，再通过网站部署权限替换静态文件，不设置客户端管理密码。文件 schema 与发布步骤见[服务器线路管理](server-lines.md)。

### 通用扩展步骤

1. `state.js`：`ELEMENT_TYPES` 加类型；`DEFAULT_PROPS` 加默认 props（含 `elementAlign`、`padding`）；**必须在 `sanitizeElement` 为新属性补校验**——反序列化是外部数据（导入 JSON / 存档）进入渲染层的唯一闸门，凡渲染层假定过的形状（数组、数值、枚举、字符串）都要收敛，否则一份手改 JSON 就能让整牌渲染崩溃（历史教训见 [code-review-2026-09.md](code-review-2026-09.md) P1-1）。校验对合法值必须是恒等变换，保证 serialize → deserialize 往返不变。
2. `render.js`：metrics 函数 + draw 函数，注册进 `METRICS_FNS` / `DRAW_FNS`。
3. `panel.js`：`TYPE_NAMES` 加名称；类型 switch 加 `build*Fields`（属性控件，取值一律经 `live()`）；需要进左栏则加 `CATEGORIES`；`describeElement` 加描述。
4. `exporters.js`：如使用文本，`collectUsedFonts` 补字体收集。
5. 测试：Node metrics 用例 + test.html 渲染用例（必要时 e2e 场景）。

## 字体管线（构建产物，勿手编）

`fonts/` 与 `fonts-data.js` 由外部原型仓库的 TTF 生成：思源黑体子集化为 GB2312 全量字符（fonttools `subset`，输出 woff2），Helvetica / Frutiger 为数字与西文（TTF）。`fonts-data.js` 是 base64 内嵌数据（约 7MB），导出时懒加载并按需收集 @font-face；编辑态通过 `document.fonts.load` 预载八种字面（font-family 回退栈见 core.js `FONT_LOAD_SPECS`）。

## 图标管线

`js/icons.js` 由 `gen-icons.mjs` 从外部 SVG 目录生成：

```bash
node gen-icons.mjs <图标源目录>   # 源目录含服务设施 *.svg 与 arrows/*.svg
```

生成时剥离 `<defs>` 与 `clip-path`（源文件均为整幅矩形裁剪，视觉无操作）、给无 fill 的绘制元素补 `fill="black"`、`#000` 变体归一。渲染时 `fill="black"` 替换为元素颜色，`fill="white"` 保留（tile 风格图标换色正确）。图标 id→中文名映射在生成脚本的 `NAMES` 表中维护。方向图标（`arrow_*`，12 个）作为左栏「方向指示」卡片；服务设施（19 个，含出口三向变体）在「服务图标」元素的属性面板中选择。

**旋转派生变体**：`ROTATED_VARIANTS` 表声明由源图标绕 viewBox 中心旋转派生的方向变体（旋转为纯函数 `rotatePathData`，H/V 命令改写为 L，Node 可测）。当前仅出口：`exit`（向上）→ `exit_right`（顺时针 90°）、`exit_left`（逆时针 90°），对应 CRT 导视标准中出口图标可整体旋转适配出站方向。变体紧随源图标写入生成物，UI 图标选择器按库内顺序自动展示，无需改前端。

**arrow 映射勿按文件名理解**：arrows/ 源文件名与图形实际朝向不一致（如 `upright.svg` 画的是「前方向右」），`ARROW_IDS` 按 icons.js 提交态的视觉修正结果校准（历史提交 d864911、13f1bec）。按文件名字面含义改映射会使再生成翻转五个箭头朝向。改动生成脚本后必须重跑生成并确认与提交的 `js/icons.js` 一致（`test/gen-icons.test.mjs` 锁定旋转纯函数与生成物一致性）。
