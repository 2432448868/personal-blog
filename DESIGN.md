# 设计约定：Kale的数字花园

> 共用双主题系统；首页是花园扉页，文章页优先阅读。不要另起一套颜色或交互规则。

## 方向

「生长中的数字花园」：宽幅 Kale 字标、行内 GitHub 头像、原创几何植物，构成专属视觉。
不用模板营销口号、假评价、假数据、随机图库或装饰编号。文章与统计均来自现有数据库。
保留线性 K 品牌标识与圆滑边角；不把所有内容包装成卡片。

## 两套主题

| 主题 | id | 模式 | 底色 | 撞色 | 强调色上文字 |
|---|---|---|---|---|---|
| 夜航 | moye | 冷暗 | #142126 | 酸橙 #d5f578 | #192519 |
| 日光 | dianqing | 暖浅 | #f0ecdf | 钴蓝 #284ab3 | #f9fafc |

- 仅这两个有效主题；全站组件使用 --surface / --paper / --paper-soft / --line / --line-strong / --ink / --muted / --accent / --accent-soft / --accent-line / --accent-ink。
- 跟随系统：深色选夜航、浅色选日光；首屏内联脚本与 React 控件使用同一映射，同步 dark、color-scheme 和 theme-color。
- 旧偏好迁移：xuanzhi、songyan、dark → moye；taichen、xingye、light → dianqing。首屏更新存储，保留手动选择语义。
- 禁止渐变光晕、彩色投影、第三套隐藏主题和正文上透明度动效。

## 字体与版式

- 本地打包 Outfit Variable；中文回退 PingFang SC / Noto Sans SC / Microsoft YaHei UI，无第三方字体请求。
- 首页 Kale 为超大英文，中文站名为第二行，宽容器避免长标题窄栏折成多行。
- 版心最大 100rem，总边距 clamp(2rem, 6vw, 7rem)；文章正文保留 max-w-3xl 和 65ch 阅读宽度。
- 扉页非对称两列：字标 + 植物画面；639px 以下单列。统计和公告在扉页之外的细线栏。
- 最近文章：左侧章节索引 + 右侧真实文章列表；1023px 以下单列，不固定章节索引。
- 兴趣入口三项横向连续展开，无空白格；手机纵向排列。
- 末尾以撞色留言区收束，保留真实园主短句，不新增虚构社交证明。

## 圆角

- 控件、封面、代码块 10px；主题面板、搜索容器、Mermaid 18px。
- 阅读和留言按钮使用胶囊形；行内头像为胶囊裁切；植物画面为拱形。
- 留言区桌面 24px、手机 18px。文章仍然是细线行，不加阴影。

## GSAP 与 ScrollTrigger

- 首页 GardenMotion 使用 @gsap/react 的 useGSAP 管理生命周期，gsap.matchMedia 管理响应式和 reduced-motion。
- 桌面 ScrollTrigger 固定左侧章节索引，终点根据列表与索引真实高度计算；不强行延长页面。
- 植物随滚动缩放、轻微转动和淡出；文章行仅做小幅位移，不降低文字对比度。
- 留言短句字符透明度随滚动 scrub，进入后完整显示。
- 精细指针：按钮最多横移 6px / 纵移 4px；悬停离开及失焦复位。
- 三入口：横向展开、图形旋转缩放、箭头位移；同样提供键盘焦点反馈。
- 移动端无 pin 和磁吸；所有输入始终使用原生链接，不拦截导航。
- 减少动态效果时撤销 ScrollTrigger 与 GSAP 内联样式，正文全可见，无固定占位；不自动滚动。
- 卸载、断点切换和偏好变化回收动画、ScrollTrigger 和事件监听；图片加载后刷新测量。

## 功能与无障碍

- 站名 Kale的数字花园；头像保持 GitHub 2432448868 的真实头像。
- 主题支持方向键、Home/End、Escape 与 Tab；手动选择刷新保留，跟随系统可恢复。
- 320px 起无横向溢出；键盘可达，所有可点击元素保留 focus-visible。
- 所有静态正文和按钮对比度不低于 4.5:1；装饰 SVG 不承担交互。
- 搜索保留清空、加载、空态、失败重试；文章、归档、分类、标签、留言、工具箱路由不变。
- Mermaid fenced 代码块按需自动渲染，主题变化串行重绘，保持 strict 安全模式。
- Mermaid 语法错误或资源失败时显示原始代码，不产生空图。

## 验收证据

证据：~/.agents/evidence/personal-blog/garden-gsap-verification-20261013.json
