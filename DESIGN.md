# 已实现的界面设计

## 概览

这是给任务发布者使用的单页成本工具。页面以浅灰背景、白色输入区和深蓝结果区组织信息，用同一组对齐边缘连接参数与计算结果。没有营销首屏：产品名称下紧接可编辑输入及“载入示例 / 清空”。

桌面采用左输入、右结果；手机遵循输入、结果、公式、提示的自然阅读顺序。结果先展示毛利，再展示总成本与客户收费，最后解释执行量、成本明细和盈亏平衡收费。全部实现来自 `index.html`、`src/main.ts` 和 `src/style.css`，没有隐藏的组件库或主题。

## 颜色

定义位于 `src/style.css:9` 的 `:root`。基础色使用 hex；组件读取语义 token。只实现浅色页面，深蓝结果区是强调区域，不是暗色主题。

| 语义 token | 实际颜色 | 用途 |
| --- | --- | --- |
| `--page-bg` | `#f5f7f9` | 页面背景 |
| `--surface` | `#ffffff` | 页眉、输入面板、输入框 |
| `--text-primary` / `--result-bg` | `#182d42` | 主要文字 / 结果底色 |
| `--text-secondary` | `#526175` | 提示、单位、次要说明 |
| `--border` | `#dfe5eb` | 装饰性面板边界和分组线 |
| `--control-border` | `#8190a1` | 输入框与清空按钮的可识别边界 |
| `--surface-hover` | `#edf1f5` | 次要按钮悬停 |
| `--accent` / `--focus` | `#315ed0` | 主操作底色 / 焦点环 |
| `--accent-hover` | `#2349aa` | 主操作悬停 |
| `--on-accent` | `#ffffff` | 主操作文字 |
| `--result-text` | `#f5f8fc` | 结果区主要文字 |
| `--result-muted` | `#b7c7d6` | 结果区提示与单位 |
| `--result-border` | `#3e5165` | 结果明细分隔线 |
| `--positive-text` / `--positive-bg` | `#a4eccd` / `#244c46` | 盈利标签 |
| `--negative-text` / `--negative-bg` | `#ffb9b3` / `#573b44` | 亏损标签 |
| `--balanced-text` / `--balanced-bg` | `#d7e2f2` / `#354960` | 盈亏平衡标签 |
| `--error-text` / `--error-bg` | `#b4232c` / `#fff5f4` | 字段错误文字和背景 |

三个 6px 成本标记使用 `#a5bfff`、`#b7c7d6`、`#e1d1b8`；它们只是装饰性分类线索，每项均有完整文字标签。选择文字的背景为 `#dce6fc`。状态总是以文字、符号与颜色同时区分。

实测文字对比度：提示文字/白底 6.31:1；结果次要文字/深蓝底 8.14:1；盈利、亏损、平衡标签分别 7.04:1、6.07:1、7.06:1；错误文字/白底 6.53:1。控件边框/白底为 3.26:1，蓝色焦点环/白底为 5.77:1。测量取自生产浏览器的计算样式，详细颜色对见 `artifacts/browser-results.json`。

## 字体与排版

`src/style.css:1` 加载本地 `public/fonts/noto-sans-sc-subset.woff2`，别名 `IMD Chinese`，238 个中文及标点字符，400–600 可变字重。拉丁字母及数字使用系统字体回退：`-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, sans-serif`。没有运行时远程字体请求。

| Token | 默认值 | 使用 |
| --- | --- | --- |
| `--text-xs` | 12px / 0.75rem | 提示、单位、辅助说明 |
| `--text-sm` | 14px / 0.875rem | 字段标签、按钮、公式与明细 |
| `--text-base` | 16px / 1rem | 输入、结果区标题、基础文字 |
| `--text-section` | 20px / 1.25rem | 区段标题、执行量、盈亏平衡金额 |
| `--text-title` | 32px / 2rem；480px 以下为 24px | 页面标题、总成本及收入 |
| `--text-display` | 48px / 3rem | 主要毛利金额 |

每个视口为六档尺寸，只使用 400 与 600 两种字重。根文字大小 16px，输入在手机上也不小于 16px。一般正文行高 1.6，标签与按钮 1.5，标题 1.4，毛利金额 1.25。主标题字距 `-0.025em`，大金额 `-0.03em`，其他内容自然字距。

动态数字使用 `font-variant-numeric: tabular-nums`。关键金额不省略、不裁切，长数字可换行；原生文本输入仍可横向移动光标编辑完整值。标题使用 `text-wrap: balance`，重要说明可自然折行。没有正文全大写或额外小字眉题。

## 布局与响应式

页面最大宽度 `--page-width: 73rem`（1168px，含两侧 padding）。常规左右内边距 16px。空间 token 对应 4、8、12、16、20、24、28、32、40px：控件内部常用 8px，字段横向 12–20px，组间 28px，区段间 40px。

`src/style.css:99` 的 `.workspace` 为 `1.25fr 1fr` 双列、间距 24px；面板默认 padding 28px。所有 grid 列使用 `minmax(0, ...)`，关键数字允许自然扩展。

| 条件 | 已实现行为 |
| --- | --- |
| 宽度 ≤ 62rem / 992px | 双列比例改为 1.2:1，面板 padding 20px，间距 20px |
| 宽度 ≤ 51rem / 816px | 工作区改单列；内容最大 42rem；输入后接结果 |
| 宽度 ≤ 30rem / 480px | 标题 24px、页眉最小 64px；公式改单列；提示与免责声明重排 |
| 宽度 ≤ 22rem / 352px | 字段改单列，面板 padding 16px，收起页眉辅助品牌文字 |
| 输入面板内容宽度 ≤ 18rem | 容器查询将字段改单列，适用于文字放大后空间不足的情况 |

容器由 `.input-panel { container-type: inline-size }` 定义。面板标题与动作可换行，按钮文字保持完整；成本明细行也能换行。没有固定或粘性控件覆盖正文。实测宽度为 320、390、768、820、1024、1440px，另验证 390px 下 200% 文字放大，均无横向页面滚动。

## 层次与形状

界面采用平面结构，不使用投影、渐变或卡片内嵌卡片。白色输入面板使用 1px 边框，结果面板通过深色底与留白建立层级。深色结果中的水平线用于算式和明细分组。

`--radius-panel: 16px` 用于两个主面板；`--radius-control: 8px` 用于输入与按钮。状态标签 6px，标记点 2px。结果数字不设置 `overflow: hidden` 或省略号。

## 组件与状态

这些是当前 HTML/CSS 模式，并非虚构的导出组件 API。

| 模式 | 源码 | 用法与状态 |
| --- | --- | --- |
| `.button` | `src/style.css:103`、`index.html:46` | 最小 44px；primary 蓝底仅用于“载入示例”；plain 为清空；light 为暗底错误恢复 |
| `.field` / `.input-wrap` | `index.html:56`、`src/style.css:112` | 显式 label、说明、单位与独立错误；输入高至少 48px；N/R numeric 键盘，其余 decimal |
| `.result-panel` | `index.html`、`src/main.ts:32` | `data-state` 为 profit/loss/balanced/invalid；每次输入即时切换 |
| `.status-badge` | `src/style.css:132` | 盈利 ↗、亏损 ↘、平衡 =；附中文状态，不能仅依赖色彩 |
| `.invalid-results` | `src/main.ts:54`、`src/style.css:159` | 隐藏并清空旧结果，显示恢复说明；“前往修改”聚焦第一处错误 |
| `.formula-group` | `index.html`、`src/style.css:169` | 直接显示六条公式及模型假设，默认展开 |
| `.skip-link` / `#announcements` | `index.html:21`、`src/main.ts:61` | 键盘跳至表单；稳定的 polite live region 在输入停顿 350ms 后播报摘要 |

键盘沿原生 DOM 顺序移动；按钮支持 Enter/Space。焦点环为 3px、偏移 3px，深色错误恢复按钮使用浅色环，强制色彩模式使用系统 Highlight。字段错误通过 `aria-invalid` 和 `aria-describedby` 关联，修复后立即移除错误状态。

没有异步加载状态；所有计算同步完成。默认是虚构案例 A，归零状态仍是有效的盈亏平衡状态。关闭 JavaScript 时，仅显示启用提示，不显示虚构的计算结果。

只在 `prefers-reduced-motion: no-preference` 下启用按钮 120ms 的背景/transform 反馈，按下比例 0.96。减少动态效果时无过渡；无自动播放或循环动画。触摸环境不应用 hover 样式。

## 延续设计的规则

- 新内容使用现有 `.page`、`.section-heading`、`.field` 及六档字号，优先遵循当前阅读顺序。
- 需要突出一个操作时使用 primary；状态颜色只表示盈亏或错误，不作为额外营销装饰。
- 新增数值输出继续使用精确计算与统一格式化函数，不能从已显示的四舍五入数字重新计算。
- 不隐藏长金额、恢复路径或输入说明；扩展文案时同时检查 320px、390px 和文字放大。
- 若增加中文字符，更新本地字体子集并保留 OFL，再重建生产导出和截图。

## 参考归属与验证边界

应用了任务给定的 Better Interface 六个领域；审查覆盖、修复和限制位于 `artifacts/validation.md`。设计依据改编自 Jakub Krehel 的 [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface)，MIT，commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`。文档方法参考 Paul Bakaus 的 [Impeccable document reference](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md)，Apache-2.0，commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`。版权及许可证保留在 `artifacts/design-guide-LICENSE.txt`。

未执行真实屏幕阅读器、真实手机、Safari/Firefox 或浏览器原生 200% 缩放会话；不据此声称完全无障碍或所有浏览器兼容。RTL 和暗色主题未纳入本产品范围。
