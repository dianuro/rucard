/**
 * 不变量校验：预演 == 实打。
 *   node tools/parity.mjs [卡牌 id...]
 *
 * 「预演与实际结算永远一致」是这套结算机的核心承诺（见 AGENTS.md），
 * 靠的不是自觉，而是 `preview()` 与真打共用同一份 resolveClash。
 * 这个脚本把每张牌都真的打一遍，再把预演的数字和结算后的数字逐个比对：
 * 只要有人新加了 CardFx 却忘了折进 preview，这里就会红。
 *
 * 每张牌跑两遍：一遍身上没有「蚀」，一遍带 4 点「蚀」，
 * 后者顺带覆盖按状态结算的那类效果。
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

const only = process.argv.slice(2)

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__rc)

const rows = await page.evaluate((only) => {
  const rc = window.__rc
  const ids = (only.length ? only : rc.ALL_CARDS.map((c) => c.id))
  const out = []
  for (const id of ids) {
    const def = rc.CARD_BY_ID[id]
    if (!def) {
      out.push({ id, err: '没有这张牌' })
      continue
    }
    for (const venom of [0, 4]) {
      rc.newRun(20261018)
      rc.dismissHint()
      rc.fight('spin')
      const card = { ...def, uid: `parity-${id}`, bonus: 0 }
      rc.app.act((s) => {
        s.run.player.hand = [card]
        s.run.player.energy = 9
        s.run.player.buffs = venom ? { venom } : {}
        s.run.relics.length = 0
      })
      const before = rc.app.get()
      const pv = rc.preview((f) => f.push(...rc.cardSyms(card)), card)
      rc.playCard(card.uid)
      // 「蚀」在回合末按「打出这张牌之后」的数值结算 —— 所以它自己给的那份算数
      const venomTick = rc.app.get().run.player.buffs.venom ?? 0
      const steps = rc.prepareClash()
      for (const st of steps) rc.applyClashStep(st)
      rc.settleClash()
      const after = rc.app.get()
      out.push({
        id,
        name: def.name,
        venom,
        // 回合末的「蚀」是独立结算，不记在任何一张牌头上
        wantEnemyHp: pv.enemyHp - venomTick,
        gotEnemyHp: after.battle.enemy.hp,
        wantPlayerHp: pv.playerHp,
        gotPlayerHp: after.run.player.hp,
        wantBlock: pv.playerBlock,
        gotBlock: after.run.player.block,
        wantWins: pv.clashWins,
        gotWins: after.battle.clashWinsThisTurn,
        // 牌真的进了阵型才算打出去了
        played: after.battle.formation.length > 0 || before.run.player.hand.length === 0,
      })
    }
  }
  return out
}, only)

const fails = []
for (const r of rows) {
  if (r.err) {
    fails.push(`${r.id}: ${r.err}`)
    continue
  }
  const bad = []
  if (r.wantEnemyHp !== r.gotEnemyHp) bad.push(`敌方生命 预演 ${r.wantEnemyHp} / 实打 ${r.gotEnemyHp}`)
  if (r.wantPlayerHp !== r.gotPlayerHp) bad.push(`我方生命 预演 ${r.wantPlayerHp} / 实打 ${r.gotPlayerHp}`)
  if (r.wantBlock !== r.gotBlock) bad.push(`护盾 预演 ${r.wantBlock} / 实打 ${r.gotBlock}`)
  if (r.wantWins !== r.gotWins) bad.push(`对撞胜出 预演 ${r.wantWins} / 实打 ${r.gotWins}`)
  if (bad.length) fails.push(`${r.name}(${r.id}${r.venom ? ' · 蚀' + r.venom : ''}): ${bad.join('，')}`)
}

const cards = new Set(rows.filter((r) => !r.err).map((r) => r.id))
if (fails.length) {
  for (const f of fails) console.log(`✗ ${f}`)
  console.log(`\n${fails.length} / ${rows.length} 次比对不一致`)
} else {
  console.log(`✓ 预演与实打完全一致：${cards.size} 张牌 × 2 种状态 = ${rows.length} 次比对`)
}
if (pageErrors.length) {
  console.log(`\n页面报错 ${pageErrors.length} 条：`)
  for (const e of [...new Set(pageErrors)]) console.log('  ' + e)
}
await browser.close()
process.exit(fails.length || pageErrors.length ? 1 : 0)
