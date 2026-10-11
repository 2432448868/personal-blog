# 设计约定：牢大的数字花园

> 单页多路由共用一套设计系统。改任何页面先读这里，不要另起一套。

## 方向

「庭园索引」——把博客当作一块**被人反复走过、留下记号的地**，而不是一堆卡片。
气质取「纸 + 墨 + 朱笔批注」：温暖纸底、墨黑正文、砖红作批注色，细发丝线分隔，纵向生长的索引。

## 色彩（6 套主题）

每套主题只改 token，不改组件。选择器统一用 `[data-theme="<id>"]`；`<html>` 上的 `data-theme` 与 `.dark` 由首屏内联脚本同步，避免主题闪烁。

| 模式 | 主题 | id | surface | ink | accent | 气质 |
|------|------|----|---------|-----|--------|------|
| 日间 | 宣纸 | `xuanzhi` | `#f5f2ec` | `#1c1b19` | `#b1472a` | 暖纸 + 朱笔 |
| 日间 | 苔痕 | `taichen` | `#f2f4ec` | `#1b1f16` | `#4a6b32` | 豆绿纸 + 苔绿 |
| 日间 | 靛青 | `dianqing` | `#f1f3f7` | `#191d25` | `#3a5680` | 青白纸 + 花青 |
| 夜间 | 墨夜 | `moye` | `#131418` | `#ece8e0` | `#d9755a` | 深墨 + 朱砂 |
| 夜间 | 松烟 | `songyan` | `#101413` | `#e6ebe6` | `#84b07a` | 松烟 + 苔绿 |
| 夜间 | 星野 | `xingye` | `#10131b` | `#e7e9ef` | `#d8b267` | 夜空 + 陈金 |

规则：

- 每套必须提供 `--surface / --paper / --paper-soft / --line / --line-strong / --ink / --muted / --accent / --accent-soft / --accent-line / --accent-ink`。
- `--accent-ink` 是强调色上的反白/反黑字，必须单独校验，不许在组件里写 `text-white`。
- 加主题 = `globals.css` 加一段 token + `ThemeSwitcher.tsx` 的 `THEMES` 加一条 + 首屏脚本补一个 surface 映射，再同步本文档。
- 禁用：紫蓝渐变、大面积靛蓝/天蓝、彩色投影、彩色侧边条、玻璃拟态。

## 字体

- 正文与标题：**975 圆体（`975Maru SC`）**，自托管于 `public/fonts/975maru/`（SIL OFL 1.1，按 unicode-range 切 609 片，`font-display: swap`，单页约取 60 片 ≈ 950 KB）。
- 回退链：`PingFang SC → Noto Sans SC → Microsoft YaHei UI → 微软雅黑 → system-ui`。
- 数字、日期、卷号、代码：等宽带（`Cascadia Code/JetBrains Mono/Consolas`）。
- 换字体 = 换 `--font-sans` / `--font-serif` 一行 + `public/fonts/<名字>/` 一份，别在组件里散写 family。
- 975 只发 400 一个字重，标题 600 由浏览器合成加粗；**靠字号 / 字距 / 行高**造层次，不靠换字体。

## 版式

- 版心 `max-w-5xl`，正文栏 `max-w-3xl`。
- 结构用**发丝线 + 留白**，不用「到处圆角白卡 + 同一个软阴影」。
- 卡片只给真正需要浮起的对象（表单、弹层）；列表用行。
- 数字索引只在**真的是序号**的地方出现（文章列表、归档）。

## 动效

- 只留三种：页面过渡（轻微上移淡入）、主题切换圆形揭示、按压/展开的即时反馈。
- 缓动统一 `--ease-out`；**不用回弹/overshoot**。
- 不用彩色发光、不做散布式入场、不做装饰性下划线动画。
- `prefers-reduced-motion: reduce` 下一律关闭。

## 无障碍

- 所有可点元素必须有 `:focus-visible` 可见轮廓。
- 次要文字对比度 ≥ 4.5:1。
- 键盘可达、`aria-current`/`aria-pressed` 语义正确。

## 禁止清单（AI 味最重的几个默认）

1. 全大写 + 大字距的英文 eyebrow 标签（`PERSONAL BLOG`）。
2. 每个区块同一张圆角白卡 + 同一个 `rgba(0,0,0,.1)` 软阴影。
3. 装饰性的 `01 / 02 / 03` 序号。
4. CTA 后面焊一个 `→`。
5. 彩色滤镜式发光阴影。
6. 玻璃拟态 backdrop-blur（导航除外）。
