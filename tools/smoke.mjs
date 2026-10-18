/**
 * 自动跑通验证 + 平衡探针。
 *   node tools/smoke.mjs [时长秒数] [random|greedy]
 *
 * 默认用「贪心」策略：每回合对每张能打出的牌跑一次 preview，
 * 挑净收益最高的那张，重复到没有正收益的牌为止，然后结束回合。
 * 它会真的走地图、选事件、买东西、开匣子，所以任何「只在某个界面才炸」的问题都逃不掉；
 * 同时累计每一局的深度与胜负，用来判断数值是不是明显失衡。
 *
 * 计数器放在页面里（window.__sm），避免每回合的往返开销。
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const EXECUTABLES = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`,
]
const exe = EXECUTABLES.find((p) => existsSync(p))
if (!exe) throw new Error('找不到 chromium 可执行文件')
const BASE = process.env.BASE ?? 'http://127.0.0.1:5188'
const BUDGET = Number(process.argv[2] ?? 180) * 1000
const POLICY = process.argv[3] === 'random' ? 'random' : 'greedy'

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
// 无头 Chromium 没有声卡，WebAudio 偶尔会抱怨一句；这不是游戏的错。
const HARMLESS = /AudioContext encountered an error/
page.on('console', (m) => {
  if (m.type() === 'error' && !HARMLESS.test(m.text())) errors.push('console: ' + m.text())
})
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__rc)
await page.evaluate((policy) => {
  window.__rc.toggleMute()
  window.__sm = { policy, runs: 0, turns: 0, battles: 0, wins: 0, losses: 0, nodes: 0, deepest: 0, victory: 0 }
  window.__rc.newRun(Math.floor(Math.random() * 1e9))
  window.__sm.runs = 1
}, POLICY)

/** 在页面里执行一步，返回下一步要做的事 */
const step = () =>
  page.evaluate((policy) => {
    const rc = window.__rc
    const sm = window.__sm
    const note = (d) => {
      sm.deepest = Math.max(sm.deepest, d)
    }
    const s = rc.app.get()
    const run = s.run
    const depth = run?.depth ?? 0
    const screen = s.screen.t
    const reset = () => {
      note(depth)
      sm.runs++
      rc.toTitle()
      rc.newRun(Math.floor(Math.random() * 1e9))
    }

    if ((screen === 'gameover' && s.screen.win) || s.screen.win === true) {
      sm.victory++
      reset()
      return 'victory'
    }
    if (screen === 'gameover') {
      sm.losses++
      reset()
      return 'dead'
    }
    if (!run) {
      reset()
      return 'noRun'
    }

    if (s.pick) {
      const p = run.player
      const purpose = s.pick.purpose
      // 「删除」只认抽牌堆与手牌；其余用途看整副牌组
      const pool =
        purpose === 'remove' ? [...p.drawPile, ...p.hand] : [...p.drawPile, ...p.hand, ...p.discardPile]
      const target = (purpose === 'upgrade' ? pool.find((c) => !c.upgraded) : pool[0]) ?? pool[0]
      if (target) rc.pickCard(target.uid)
      else rc.cancelPick()
      return 'pick:' + purpose
    }

    if (screen === 'battle') {
      const b = s.battle
      if (!b) return 'battleNone'
      if (b.phase === 'won') {
        sm.wins++
        rc.battleWon()
        return 'battleWon'
      }
      if (b.phase === 'lost') {
        sm.losses++
        rc.battleLost()
        return 'battleLost'
      }
      if (b.phase !== 'player') return 'wait'

      sm.turns++
      const p = run.player
      for (let i = 0; i < 8; i++) {
        const pool = p.hand.filter((c) => rc.cardCost(c) <= p.energy)
        if (!pool.length) break
        if (policy === 'random') {
          if (!rc.playCard(pool[Math.floor(Math.random() * pool.length)].uid)) break
          continue
        }
        let best = null
        // 基准：这一轮不再加牌时的结算；边际收益必须相对它来算
        const base = rc.preview()
        const baseDealt = b.enemy.hp - base.enemyHp
        const baseTaken = p.hp - base.playerHp
        for (const c of pool) {
          const res = rc.preview((f) => f.push(...rc.cardSyms(c)))
          const score =
            (b.enemy.hp - res.enemyHp - baseDealt) +
            (baseTaken - (p.hp - res.playerHp)) * 2.2 +
            res.playerBlock * 0.25 +
            (res.clashWins - base.clashWins) * 1.6 +
            (res.staggered && !base.staggered ? 8 : 0)
          if (!best || score > best.score) best = { uid: c.uid, score }
        }
        if (!best || best.score <= 0) break
        if (!rc.playCard(best.uid)) break
      }
      const steps = rc.prepareClash()
      for (const st of steps) rc.applyClashStep(st)
      const res = rc.settleClash()
      if (res.won) {
        sm.wins++
        rc.battleWon()
        return 'battleWon'
      }
      if (res.lost) {
        sm.losses++
        rc.battleLost()
        return 'battleLost'
      }
      // 视图负责编排的收尾阶段，这里照抄一遍
      rc.enemyPhase()
      rc.startPlayerTurn()
      return 'turn'
    }

    if (screen === 'reward') {
      const o = s.offer
      if (!o) {
        rc.leaveReward()
        return 'rewardNone'
      }
      // 碎片在 battleWon 里已经入账，这里只需要挑走一张牌/一件圣痕再离开
      if (o.cards.length && !o.takenCards.length) {
        rc.takeRewardCard(o.cards[0])
        return 'rewardCard'
      }
      if (o.relics.length && !o.takenRelics.length) {
        rc.takeRewardRelic(o.relics[0])
        return 'rewardRelic'
      }
      rc.leaveReward()
      return 'rewardLeave'
    }

    if (screen === 'event') {
      if (s.eventChosen === null) {
        // 照抄界面的逻辑：选第一个满足 require 的选项
        const ev = rc.EVENT_BY_ID[s.screen.id]
        const idx = ev.options.findIndex(
          (o) => !o.require || o.require({ shards: run.player.shards, hp: run.player.hp }),
        )
        rc.chooseEventOption(idx < 0 ? 0 : idx)
        return 'eventChoose'
      }
      if (s.pick) return 'eventPick'
      rc.closeEventResult()
      return 'eventClose'
    }

    if (screen === 'rest') {
      const p = run.player
      if (p.hp < p.maxHp * 0.6) rc.restHeal()
      else rc.restUpgrade()
      return 'rest'
    }

    if (screen === 'shop') {
      const item = s.shop.items.find((it) => !it.sold && it.price <= run.player.shards)
      if (item) rc.buyItem(s.shop.items.indexOf(item))
      else rc.leaveShop()
      return 'shop'
    }

    if (screen === 'treasure') {
      // 匣子的视图挂载时就会自己 openTreasure，这里只需要离开
      rc.leaveTreasure()
      return 'treasure'
    }

    if (screen === 'map') {
      const list = rc.reachable()
      if (!list.length) {
        reset()
        return 'mapEnd'
      }
      const rank = { rest: 0, shop: 1, treasure: 1, elite: 3, event: 3, battle: 4, boss: 9 }
      const p = run.player
      const sorted = [...list].sort((a, b) => (rank[a.kind] ?? 5) - (rank[b.kind] ?? 5))
      const node = p.hp < p.maxHp * 0.5 ? sorted[0] : sorted[sorted.length - 1]
      sm.nodes++
      rc.travel(node.id)
      if (rc.app.get().screen.t === 'battle') sm.battles++
      return 'travel:' + node.kind
    }

    return 'idle:' + screen
  }, POLICY)

/** settleClash 之后如果不补上后续阶段，游戏会停在 battle 里 —— 让页面自己推一步 */
async function advance() {
  await page.evaluate(() => {
    const rc = window.__rc
    const s = rc.app.get()
    if (s.screen.t !== 'battle') return
    if (s.battle && s.battle.phase === 'player') return
    if (s.battle?.phase === 'won') rc.battleWon()
    else if (s.battle?.phase === 'lost') rc.battleLost()
  })
}

const t0 = Date.now()
const counts = {}
let guard = 0
let last = ''
let streak = 0
while (Date.now() - t0 < BUDGET && ++guard < 20000) {
  try {
    const kind = await step()
    counts[kind] = (counts[kind] ?? 0) + 1
    if (kind === last) streak++
    else {
      last = kind
      streak = 1
    }
    // 同一种动作连续太久说明状态机卡住了，把现场打出来并重开
    // （长战斗里连续 turn 是正常的，阈值放宽）
    if (streak >= (kind === 'turn' ? 300 : 60)) {
      const dump = await page.evaluate(() => {
        const s = window.__rc.app.get()
        return JSON.stringify({
          screen: s.screen,
          pick: s.pick ? { left: s.pick.left?.length ?? 0 } : null,
          eventChosen: s.eventChosen,
          eventResult: s.eventResult,
          offer: s.offer ? { cards: s.offer.cards.length, taken: s.offer.takenCards.length } : null,
          phase: s.battle?.phase ?? null,
        })
      })
      errors.push(`卡在 ${kind} 上：${dump}`)
      break
    }
    await advance()
  } catch (e) {
    errors.push('driver: ' + e.message)
    break
  }
}

const sm = await page.evaluate(() => window.__sm)
const battles = sm.wins + sm.losses
const secs = Math.round((Date.now() - t0) / 1000)
console.log(`策略 ${sm.policy} · 用时 ${secs}s`)
console.log(
  `开局 ${sm.runs} · 推进节点 ${sm.nodes} · 遇到战斗 ${battles} · 打赢 ${sm.wins}（${battles ? Math.round((sm.wins / battles) * 100) : 0}%）· 战死 ${sm.losses} · 通关 ${sm.victory}`,
)
console.log(`玩家回合 ${sm.turns} · 抵达最深第 ${sm.deepest + 1} / 15 层`)
console.log(`动作分布 ${JSON.stringify(counts)}`)
if (errors.length) {
  console.log(`\n发现 ${errors.length} 条报错：`)
  for (const e of [...new Set(errors)].slice(0, 20)) console.log('  -', e)
  process.exitCode = 1
} else {
  console.log('\n无运行期报错。')
}
await browser.close()
