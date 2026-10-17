# 符铭回廊 · Sigil Clash

一款浏览器里跑的**矢量卡牌对战游戏**。神秘学主题，玩法融合《杀戮尖塔》的能量 / 抽牌 / 圣痕 / 地图，
与《废墟图书馆》的**符式逐位对撞**。

> 回廊里没有生物，没有面孔，只有印、环、数与裂 —— 它们排成行，等着和你写下的东西逐位相撞。

## 快速开始

```bash
mise exec -- npm install      # 首次
mise exec -- npm run dev      # http://127.0.0.1:5188
mise exec -- npm run build    # 类型检查 + 生产构建 → dist/
```

Node 版本由 `mise.toml` 固定（24.22.0），所有命令都走 `mise exec --` 前缀。

## 怎么玩

**编入阵型。** 一回合内打出的所有牌会按顺序排进你的「阵型」，符式从下标 0 起占据位置。
敌方也会亮出一串意图符式。结算时**下标相同的两个符式互相作用**，多出来的一侧无人阻拦地直接命中。

所以真正的决策不是「打哪张牌」，而是**按什么顺序打**。

单个下标内的固定次序：

1. 双方的「铸」先落地成护盾
2. 「裂 / 穿」逐位对撞：值大者胜，胜者符式被消耗但不造成伤害；平局同归于尽
3. 未取消的攻击结算（「穿」无视护盾）
4. 「反」抵消同下标来袭攻击，并反弹自身数值

| 符式 | 含义 |
|---|---|
| 裂 rift | 攻击 |
| 铸 ward | 先落地成护盾，抵挡该下标及之后的一切来袭 |
| 反 echo | 抵消同下标敌方攻击并反弹 |
| 穿 pierce | 无视护盾的攻击 |
| 缀 link | 不占位，数值加给同卡紧邻前一个符式 |
| 引 spiral | 不占位，在末尾追加首个符式的复制 |

伤害累积**破绽**；填满韧性条 → **僵直**：跳过下回合行动，受到伤害 ×1.5，阈值 ×1.45。
对撞胜出额外 +2 破绽。

**操作**：点击手牌选中 → 再次点击该牌或点击战场打出。悬停任意手牌看预演。
快捷键 `1-9` 选牌、`空格` 结束回合、`D` 牌组、`M` 静音、`Esc` 取消。

## 技术约束

这四件事是项目的铁律，改代码前请先读 `AGENTS.md`：

1. **零运行时依赖** —— 生产依赖为空。渲染层是手写 DOM，没有 React/Vue/Svelte。
2. **全矢量，零位图** —— 所有「图像」由 SVG 路径现场生成，没有 png/jpg/gif/webp，也不用 emoji 当图标。
3. **不出现具象生物** —— 敌人是旋转的符阵造物，卡面是程序化符印。新素材要能通过「这是不是一个看不懂的符号」的检验。
4. **音频全部合成** —— `src/audio/sfx.ts` 用 WebAudio 现场合成（FM 钟 + 噪声 + 生成式卷积混响），没有音频文件。

构建产物约 107 KB JS / 29 KB CSS（gzip 38 / 7 KB）。

## 目录

```
src/
  main.ts              挂载、toast、环境音开关
  core/                纯逻辑，不碰 DOM
    rng.ts             mulberry32 种子随机 + hashStr + uid
    types.ts           全部接口定义
    combat.ts          ★ 对撞结算机（纯函数）+ 符式语义常量
    game.ts            ★ 全局状态 store + 所有动作 + 存档
    cards.ts           40+ 张卡（裂痕 / 回环 / 共鸣 三流派）+ 起始牌组
    enemies.ts         10 个符阵造物（普通 / 精英 / BOSS）+ 强度缩放
    relics.ts          12 件圣痕
    events.ts          8 个岔口事件（EventEffect DSL）
    run.ts             地图生成（15 层分支路径）
    store.ts           ~40 行状态容器：act() 原地改 + 微任务广播
  audio/sfx.ts         全合成音效引擎
  ui/
    dom.ts             h() 元素构造器、anim()、wait()、tween()
    render.ts          视图路由：屏幕类型变化才重建，否则只调 update()
    components/ui.ts   卡牌、符式方块、血条、chip
    svg/
      glyph.ts         ★ 程序化符印生成器（种子 → 镜像对称的路径组合）
      sigilRing.ts     背景法阵 + 敌方三层符阵 + 环绕小符
      runes.ts         六种符式图标 + 资源 / 节点图标
      fx.ts            飘字、火花、碎片、扩散环、震屏、飞行
    views/             每个屏幕一个 view，导出 { el, update, destroy? }
  styles/              tokens / card / battle / map / misc
tools/
  shot.mjs             Playwright 截图各界面 → shots/*.png
  probe.mjs            打印关键元素的 boundingRect，排查布局问题
  smoke.mjs            随机策略自动跑通一整局，捕获运行期报错
  audio.mjs            在音效总线上挂 Analyser，逐个确认不是静默
```

## 自验证

```bash
mise exec -- node tools/shot.mjs            # 全部场景截图 → shots/*.png
mise exec -- node tools/shot.mjs battle map # 只截指定场景
mise exec -- node tools/probe.mjs battle    # 打印关键元素的 boundingRect
mise exec -- node tools/smoke.mjs 180       # 随机策略自动打 180 秒，检查运行期报错
mise exec -- node tools/audio.mjs           # 验证 27 种音效都真的在合成波形
```

改完 UI 后请跑 `shot.mjs`，用 `read` 看 `shots/*.png` 再迭代 —— 只让 `tsc` 通过不算改完。

`shot.mjs` 的场景通过页面内的开发期调试桥 `window.__rc` 直接驱动状态
（在 `src/core/game.ts` 末尾，仅 `import.meta.env.DEV` 时挂载），
所以每次截出来的画面是确定的，不受随机地图影响。

## 架构约定

**状态**：`src/core/game.ts` 里的 `app = createStore<AppState>(...)`。
状态允许原地修改，`app.act(fn)` 改完后在微任务里广播一次。视图订阅由 `ui/render.ts` 统一处理。

**视图**：导出 `{ el, update, destroy? }`。`el` 只构建一次，`update()` 必须用**字符串签名比对**
避免整棵重建，否则 WAAPI 动画会被打断。

**战斗流程**由视图编排，核心只提供纯函数：

```
prepareClash()    → 纯计算，返回 ClashStep[]，并把 phase 置为 'clash'
  for step:  playStep(step) 播放动画 → applyClashStep(step) 落地增量
settleClash()     → 用权威快照覆盖数值，判定胜负
enemyPhase()      → 僵直推进 / 清空阵型与护盾 / 抽下一招
startPlayerTurn() → 护盾清零、灵光回满、抽牌
```

`preview(mutator?)` 复用同一套 `resolveClash`，所以**预演结果与实际结算永远一致**。
`resolveClash` 必须是纯函数，不要在里面读全局状态。

**视觉**：圆角卡通。元素统一 `border: 3px solid var(--edge)` + `box-shadow: 0 5px 0 var(--edge)` 的硬投影。
动画优先用 WAAPI 而不是改类名，因为要 `await ... .finished` 来串演出；CSS keyframes 只用于常驻循环。

## 提交

Angular 规范：`feat(core): ...` / `fix(battle): ...` / `style(card): ...`
