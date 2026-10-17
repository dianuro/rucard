/**
 * 自动跑通验证：用随机策略把一整局打到底，捕获运行期报错。
 *   node tools/smoke.mjs [时长秒数]
 *
 * 它会真的点手牌、结束回合、走地图、选事件、买东西，
 * 所以任何「只在某个界面才炸」的问题都逃不掉。
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const EXECUTABLES = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`,
]
const exe = EXECUTABLES.find((p) => existsSync(p))
const BASE = process.env.BASE ?? 'http://127.0.0.1:5188'
const BUDGET = Number(process.argv[2] ?? 180) * 1000

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__rc)

// 静音，避免音频上下文在无头环境里报错干扰
await page.evaluate(() => window.__rc.toggleMute())

const stats = { turns: 0, battles: 0, nodes: 0, wins: 0, deaths: 0 }
const t0 = Date.now()

await page.evaluate(() => window.__rc.newRun(777))

while (Date.now() - t0 < BUDGET) {
  const st = await page.evaluate(() => {
    const s = window.__rc.app.get()
    const f = (a) => a[Math.floor(Math.random() * a.length)]
    return { screen: s.screen.t, phase: s.battle?.phase ?? null, pick: !!s.pick, ended: !!s.run?.ended, hp: s.run?.player.hp ?? 0 }
  })
  if (st.ended) {
    stats.deaths++
    await page.evaluate(() => {
      window.__rc.toTitle()
      window.__rc.newRun(Math.floor(Math.random() * 1e9))
    })
    await page.waitForTimeout(200)
    continue
  }

  try {
    if (st.screen === 'battle' && st.phase === 'player') {
      // 随机打出 0~3 张能打出的牌，然后结束回合
      const n = Math.floor(Math.random() * 4)
      for (let i = 0; i < n; i++) {
        const ok = await page.evaluate(() => {
          const s = window.__rc.app.get()
          const b = s.battle
          if (!b || b.phase !== 'player') return false
          const playable = s.run.player.hand.filter((c) => window.__rc.cardCost(c) <= s.run.player.energy)
          if (!playable.length) return false
          const c = playable[Math.floor(Math.random() * playable.length)]
          const idx = s.run.player.hand.indexOf(c)
          return window.__rc.playCard(c.uid) ? idx : false
        })
        if (ok === false) break
      }
      stats.turns++
      await page.evaluate(() => {
        const rc = window.__rc
        const steps = rc.prepareClash()
        for (const s of steps) rc.applyClashStep(s)
        const res = rc.settleClash()
        if (res.won) rc.battleWon()
        else if (res.lost) rc.battleLost()
        else {
          rc.enemyPhase()
          rc.startPlayerTurn()
        }
      })
      stats.battles++
      await page.waitForTimeout(60)
      continue
    }

    if (st.pick) {
      await page.evaluate(() => {
        const s = window.__rc.app.get()
        const all = [...s.run.player.drawPile, ...s.run.player.hand, ...s.run.player.discardPile]
        if (all.length) window.__rc.pickCard(all[0].uid)
        else window.__rc.cancelPick()
      })
      await page.waitForTimeout(60)
      continue
    }

    if (st.screen === 'reward') {
      stats.wins++
      await page.evaluate(() => {
        const s = window.__rc.app.get()
        const o = s.offer
        if (o?.cards.length) window.__rc.takeRewardCard(o.cards[0])
      })
      await page.waitForTimeout(60)
      await page.evaluate(() => window.__rc.leaveReward())
      continue
    }

    if (st.screen === 'event') {
      await page.evaluate(() => {
        const rc = window.__rc
        const s = rc.app.get()
        if (s.pick) rc.cancelPick()
        else if (s.eventChosen === null) rc.chooseEventOption(0)
        else rc.closeEventResult()
      })
      await page.waitForTimeout(60)
      continue
    }

    if (st.screen === 'rest') {
      await page.evaluate(() => (Math.random() < 0.5 ? window.__rc.restHeal() : window.__rc.restUpgrade()))
      await page.waitForTimeout(80)
      await page.evaluate(() => window.__rc.cancelPick())
      await page.waitForTimeout(60)
      continue
    }

    if (st.screen === 'shop') {
      await page.evaluate(() => {
        const rc = window.__rc
        rc.run().player.shards += 200
        const s = rc.app.get()
        const item = s.shop.items.find((i) => !i.sold && i.price <= rc.run().player.shards)
        if (item) rc.buyItem(s.shop.items.indexOf(item))
        else rc.leaveShop()
      })
      await page.waitForTimeout(60)
      continue
    }

    if (st.screen === 'treasure') {
      await page.evaluate(() => {
        const rc = window.__rc
        if (rc.app.get().eventResult) rc.leaveTreasure()
        else rc.openTreasure()
      })
      await page.waitForTimeout(60)
      continue
    }

    if (st.screen === 'map') {
      const moved = await page.evaluate(() => {
        const rc = window.__rc
        const list = rc.reachable()
        if (!list.length) return false
        rc.travel(list[Math.floor(Math.random() * list.length)].id)
        return true
      })
      if (moved) stats.nodes++
      else await page.evaluate(() => window.__rc.toTitle())
      await page.waitForTimeout(60)
      continue
    }

    if (st.screen === 'gameover' || st.screen === 'title' || st.screen === 'deck') {
      await page.evaluate(() => {
        window.__rc.toTitle()
        window.__rc.newRun(Math.floor(Math.random() * 1e9))
      })
      await page.waitForTimeout(120)
      continue
    }
  } catch (e) {
    errors.push('driver: ' + e.message)
    break
  }
  await page.waitForTimeout(40)
}

console.log(`用时 ${Math.round((Date.now() - t0) / 1000)}s`)
console.log(`回合 ${stats.turns} · 推进节点 ${stats.nodes} · 战斗 ${stats.battles} · 胜利 ${stats.wins}`)
if (errors.length) {
  console.log(`\n发现 ${errors.length} 条报错：`)
  for (const e of [...new Set(errors)].slice(0, 20)) console.log('  -', e)
  process.exitCode = 1
} else {
  console.log('\n无运行期报错。')
}
await browser.close()
