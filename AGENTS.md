# AGENTS.md — 符铭回廊 · Sigil Clash

一款 Vite + TypeScript 的浏览器卡牌对战游戏。神秘学主题，玩法融合《杀戮尖塔》的
能量/抽牌/遗物/地图与《废墟图书馆》的**符式逐位对撞**。

## 铁律

1. **零运行时依赖**。生产依赖必须为空。渲染层是手写的 DOM，不引入 React/Vue/Svelte。
2. **全矢量，零位图**。所有「图像」都由 SVG 路径现场生成（见 `src/ui/svg/`）。
   禁止引入 png/jpg/gif/webp，也不要用 emoji 当图标。
3. **不出现具象生物**。没有脸、没有手脚、没有怪物剪影。敌人是旋转的符阵造物，
   卡面是程序化符印。任何新素材都要能通过「这是不是一个看不懂的符号」的检验。
4. **音频全部合成**。`src/audio/sfx.ts` 用 WebAudio 现场合成，禁止音频文件。
5. **界面文案用中文**，风格克制、略带疏离感（参考 `cards.ts` / `events.ts` 的文案调性）。

## 命令

```bash
mise exec -- npm run dev      # 开发服务器 http://127.0.0.1:5188
mise exec -- npm run build    # 先 tsc --noEmit 再 vite build
mise exec -- npx tsc --noEmit # 只做类型检查
mise exec -- node tools/shot.mjs [场景名...]  # 截图自验证 → shots/
mise exec -- node tools/probe.mjs             # 打印关键元素的布局尺寸
mise exec -- node tools/smoke.mjs [秒数]      # 随机策略自动跑通，捕获运行期报错
mise exec -- node tools/audio.mjs             # 验证每种音效都真的在合成波形
```

Node 版本由 `mise.toml` 固定，**一律用 `mise exec --` 前缀执行**。
npm 已指向 npmmirror 镜像；GitHub 链接需换成 `gh-proxy.org` 前缀。

## 目录

```
src/
  main.ts              挂载、toast、环境音开关
  core/                纯逻辑，不碰 DOM
    rng.ts             mulberry32 种子随机 + hashStr + uid
    types.ts           全部接口定义
    combat.ts          ★ 对撞结算机（纯函数）+ 符式语义常量
    game.ts            ★ 全局状态 store + 所有动作 + 存档
    cards.ts           40+ 张卡（裂痕/回环/共鸣 三流派）+ 起始牌组
    enemies.ts         10 个符阵造物（普通/精英/BOSS）+ 强度缩放
    relics.ts          12 件圣痕（效果在 game.ts 里按 id 分支）
    events.ts          8 个岔口事件（效果用 EventEffect DSL 描述）
    run.ts             地图生成（15 层分支路径）
    store.ts           ~40 行状态容器：act() 原地改 + 微任务广播
  audio/sfx.ts         全合成音效引擎（FM 钟 + 噪声 + 卷积混响 + 低鸣）
  ui/
    dom.ts             h() 元素构造器、anim()、wait()、tween()
    render.ts          视图路由：屏幕类型变化才重建，否则只调 update()
    components/ui.ts   cardEl() 卡牌、slotEl() 符式方块、barEl() 血条、chip()
    svg/
      glyph.ts         ★ 程序化符印生成器（种子 → 镜像对称的路径组合）
      sigilRing.ts     背景法阵 + 敌方三层符阵 + 环绕小符
      runes.ts         六种符式图标 + 资源/节点图标（viewBox 40×40，粗描边）
      fx.ts            飘字、火花、碎片、扩散环、震屏、飞行
    views/             每个屏幕一个 view，导出 { el, update, destroy? }
  styles/
    tokens.css         设计令牌（配色/圆角/描边/硬投影）+ 背景法阵 + 通用组件
    card.css battle.css map.css misc.css
tools/
  shot.mjs             Playwright 截图各界面 → shots/*.png
  probe.mjs            打印 .bar / .enemy-sigil 等元素的 boundingRect，排查布局
  smoke.mjs            随机策略自动打完整局，检查运行期报错
  audio.mjs            在音效总线上挂 Analyser，逐个确认不是静默
```

## 架构约定

**状态**：`src/core/game.ts` 里的 `app = createStore<AppState>(...)`。
状态允许原地修改，`app.act(fn)` 改完后在微任务里广播一次。
视图订阅由 `ui/render.ts` 统一处理，业务代码不要自己订阅。

**视图**：每个 view 导出 `{ el, update, destroy? }`。
`el` 只构建一次，`update()` 负责增量刷新，**必须用签名比对避免整棵重建**
（否则 WAAPI 动画会被打断）。现有写法：`let sig = ''` 存上一次的字符串签名。

**战斗流程**（`views/battle.ts`）：回合由视图编排，核心只提供纯函数：

```
prepareClash()  → 纯计算，返回 ClashStep[]，并把 phase 置为 'clash'
  for step of steps:  playStep(step) 播放动画 → applyClashStep(step) 落地增量
settleClash()   → 用 ResolveResult 的权威快照覆盖数值，判定胜负
enemyPhase()    → 僵直推进 / 清空阵型与护盾 / 抽下一招
startPlayerTurn() → 护盾清零、灵光回满、抽牌
```

`preview(mutator?)` 复用同一套 `resolveClash`，所以**预演结果与实际结算永远一致**。
改动结算规则时不需要动 UI。

## 对撞规则（改 combat.ts 前必读）

玩家打出的牌按顺序「编入阵型」，符式从下标 0 起占据位置；敌方意图也是一串符式。
结算时下标相同的两个符式互相作用，多出的一侧无人阻拦地直接命中。
**编入顺序就是核心决策空间。**

单个下标内的固定次序：

1. 双方的「铸」先落地成护盾
2. 「裂/穿」逐位对撞：值大者胜，胜者符式被消耗不造成伤害；平局同归于尽
3. 未取消的攻击结算（「穿」无视护盾）
4. 「反」抵消同下标来袭攻击并反弹自身数值

| 符式 | 含义 |
|---|---|
| 裂 rift | 攻击 |
| 铸 ward | 先落地成护盾，抵挡该下标及之后的一切来袭 |
| 反 echo | 抵消同下标敌方攻击并反弹 |
| 穿 pierce | 无视护盾的攻击 |
| 缀 link | 不占位，数值加给同卡紧邻前一个符式 |
| 引 spiral | 不占位，在末尾追加首个符式的复制 |

- 护盾在对撞中被消耗，回合结束清空。
- 伤害累积破绽；填满韧性条 → 僵直：跳过下回合行动，受到伤害 ×1.5，阈值 ×1.45。
- 对撞胜出额外 +2 破绽。

`resolveClash` **必须是纯函数**，返回 `ClashStep[]`（含净变化量 delta）。
UI 的预演与动画回放都依赖这个性质。不要在里面读全局状态。

## 视觉风格

圆角卡通：`--r-card: 20px`、`--r-panel: 26px`，元素统一
`border: 3px solid var(--edge)` + `box-shadow: 0 5px 0 var(--edge)` 的硬投影。
配色见 `tokens.css`：深靛底 + 羊皮纸面板 + 金/青/玫/紫强调色。

**字体栈**优先使用「站酷快乐体 / 霞鹜文楷 / 思源黑体」，这些在开发机上存在，
但用户机器上可能回退，所以不要依赖特殊字重来传达信息。

**程序化符印**（`glyph.ts`）的构造：外层环（实线/虚线/多边形/双环）+ 随机跳格的
刻度盘 + n 次旋转对称的路径（弧/弦/折线/贝塞尔）+ 端点圆点。
种子取自 `id + name`，所以同一张牌永远得到同一个符印。

**动画**优先用 WAAPI（`el.animate(...)`）而不是改类名，因为要 `await ... .finished`
来串演出。CSS keyframes 只用于常驻循环（旋转、呼吸、流动）。

## 自验证

改完 UI 后跑 `node tools/shot.mjs`，用 `read` 看 `shots/*.png` 再迭代。
`probe.mjs` 用来定位「元素尺寸是 0」「被 flex 压扁」这类看不见的布局问题。
改完逻辑后跑 `node tools/smoke.mjs`，它会真的点手牌、走地图、选事件，捕获运行期报错。
改了 `audio/sfx.ts` 就跑 `node tools/audio.mjs` —— 它会在音效总线上挂 Analyser，
逐个测量 RMS，静默的音效会被标出来（无头 Chromium 需要 `--autoplay-policy=no-user-gesture-required`）。
不要只靠 `tsc` 通过就认为改完了。

`shot.mjs` 的场景通过页面内的开发期调试桥 `window.__rc` 直接驱动状态
（在 `src/core/game.ts` 末尾，仅 `import.meta.env.DEV` 时挂载），
所以每次截图都是确定的，不受随机地图影响。新增界面时给它加一个场景，用 `__rc` 跳过去。

## 提交

用 Angular 规范：`feat(core): ...` / `fix(battle): ...` / `style(card): ...`。
