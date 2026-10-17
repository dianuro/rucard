/**
 * 自验证工具：用 Playwright 打开各个界面截图，便于肉眼迭代。
 *   node tools/shot.mjs [场景名...]
 *
 * 场景通过页面内的开发期调试桥 `window.__rc` 直接驱动状态，
 * 所以每次跑出来的画面是确定的，不受随机地图影响。
 */
import { chromium } from 'playwright-core'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const EXECUTABLES = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`,
]

const exe = EXECUTABLES.find((p) => existsSync(p))
if (!exe) throw new Error('找不到 chromium 可执行文件')

const BASE = process.env.BASE ?? 'http://127.0.0.1:5188'
const OUT = resolve(process.cwd(), 'shots')
const SEED = 20261018
mkdirSync(OUT, { recursive: true })

const only = process.argv.slice(2)

/** 打开页面、清空存档、开一局固定种子的新游戏。 */
async function boot(page, { fresh = true } = {}) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__rc)
  if (fresh) await page.evaluate((seed) => window.__rc.newRun(seed), SEED)
  await page.waitForTimeout(500)
}

/** 点牌：第一下选中，第二下打出。 */
async function playCards(page, n = 3) {
  for (let i = 0; i < n; i++) {
    const card = page.locator('.hand .card.playable').first()
    if (!(await card.count())) break
    await card.click()
    await page.waitForTimeout(140)
    await page.locator('.hand .card.playable').first().click()
    await page.waitForTimeout(340)
  }
  await page.waitForTimeout(400)
}

/** 每个场景：进入方式 + 等待条件 */
const SCENES = {
  title: async (page) => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
  },
  rules: async (page) => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /规则/ }).click()
    await page.waitForTimeout(700)
  },
  map: async (page) => {
    await boot(page)
    await page.waitForTimeout(600)
  },
  mapCleared: async (page) => {
    await boot(page)
    await page.evaluate(() => {
      const rc = window.__rc
      const r = rc.run()
      rc.travel(rc.reachable()[0].id)
      for (const n of Object.values(r.map.nodes)) n.visited = true
      r.pos = Object.values(r.map.nodes).sort((a, b) => b.layer - a.layer)[0].id
      r.depth = r.map.nodes[r.pos].layer
      rc.app.act((s) => {
        s.screen = { t: 'map' }
        s.battle = null
      })
    })
    await page.waitForTimeout(900)
  },
  battle: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.fight('spin'))
    await page.waitForTimeout(1400)
  },
  boss: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.fight('firstword'))
    await page.waitForTimeout(1600)
  },
  battlePlayed: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.fight('spin'))
    await page.waitForTimeout(1200)
    await playCards(page, 3)
  },
  hand: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.fight('spin'))
    await page.waitForTimeout(1200)
    await page.locator('.hand .card').first().hover()
    await page.waitForTimeout(600)
  },
  clash: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.fight('spin'))
    await page.waitForTimeout(1200)
    await playCards(page, 3)
    await page.locator('.endturn').click({ timeout: 8000 })
    await page.waitForTimeout(520)
  },
  clashLate: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.fight('spin'))
    await page.waitForTimeout(1200)
    await playCards(page, 3)
    await page.locator('.endturn').click({ timeout: 8000 })
    await page.waitForTimeout(1150)
  },
  reward: async (page) => {
    await boot(page)
    await page.evaluate(() => {
      window.__rc.fight('spin')
      window.__rc.weakenEnemy()
      window.__rc.battleWon()
    })
    await page.waitForTimeout(900)
  },
  event: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.gotoKind('event'))
    await page.waitForTimeout(900)
  },
  eventResult: async (page) => {
    await boot(page)
    await page.evaluate(() => {
      window.__rc.gotoKind('event')
    })
    await page.waitForTimeout(400)
    await page.locator('.options .option').first().click()
    await page.waitForTimeout(900)
  },
  rest: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.gotoKind('rest'))
    await page.waitForTimeout(900)
  },
  shop: async (page) => {
    await boot(page)
    await page.evaluate(() => {
      const rc = window.__rc
      rc.run().player.shards = 480
      rc.openShop()
    })
    await page.waitForTimeout(900)
  },
  treasure: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.gotoKind('treasure'))
    await page.waitForTimeout(1000)
  },
  deck: async (page) => {
    await boot(page)
    await page.evaluate(() => window.__rc.gotoKind('battle'))
    await page.waitForTimeout(900)
    await page.locator('.topbar button', { hasText: '牌组' }).click()
    await page.waitForTimeout(800)
  },
  pick: async (page) => {
    await boot(page)
    await page.evaluate(() => {
      const rc = window.__rc
      rc.gotoKind('rest')
      rc.restUpgrade()
    })
    await page.waitForTimeout(900)
  },
  gameoverWin: async (page) => {
    await boot(page)
    await page.evaluate(() => {
      const rc = window.__rc
      rc.fight('firstword')
      rc.weakenEnemy()
      rc.battleWon()
    })
    await page.waitForTimeout(1100)
  },
  gameoverLose: async (page) => {
    await boot(page)
    await page.evaluate(() => {
      const rc = window.__rc
      rc.fight('spin')
      rc.app.act((s) => {
        s.run.player.hp = 0
      })
      rc.battleLost()
    })
    await page.waitForTimeout(1000)
  },
}

const names = only.length ? only : Object.keys(SCENES)
const unknown = names.filter((n) => !SCENES[n])
if (unknown.length) {
  console.log(`未知场景：${unknown.join(', ')}`)
  console.log(`可用场景：${Object.keys(SCENES).join(', ')}`)
  process.exit(1)
}

for (const f of ['battle.error.png', 'battlePlayed.error.png', 'clash.error.png', 'map.error.png']) {
  rmSync(`${OUT}/${f}`, { force: true })
}

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1, locale: 'zh-CN' })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(m.text())
    console.log('  [console error]', m.text())
  }
})
page.on('pageerror', (e) => {
  errors.push(e.message)
  console.log('  [pageerror]', e.message)
})

let failed = 0
for (const name of names) {
  await page.goto('about:blank')
  await page.evaluate(() => localStorage.clear()).catch(() => {})
  try {
    await SCENES[name](page)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`✓ ${name}.png`)
  } catch (e) {
    failed++
    console.log(`✗ ${name}: ${String(e.message).split('\n')[0]}`)
    await page.screenshot({ path: `${OUT}/${name}.error.png` }).catch(() => {})
  }
}

await browser.close()
if (errors.length) console.log(`\n共 ${errors.length} 条页面报错`)
console.log(failed ? `${failed} 个场景失败` : '全部场景通过')
