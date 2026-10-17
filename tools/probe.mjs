/**
 * 布局排查工具：打印关键元素的 boundingRect，用于定位「尺寸为 0 / 被 flex 压扁」这类问题。
 *   node tools/probe.mjs [场景]
 * 场景：battle（默认）| card | map | shop
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const EXECUTABLES = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`,
]
const exe = EXECUTABLES.find((p) => existsSync(p))
const BASE = process.env.BASE ?? 'http://127.0.0.1:5188'
const scene = process.argv[2] ?? 'battle'

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__rc)
await page.evaluate(() => window.__rc.newRun(20261018))
await page.waitForTimeout(400)

const SELECTORS = {
  battle: [
    '.field',
    '.enemy-zone',
    '.enemy-sigil',
    '.enemy-name',
    '.enemy-title',
    '.bars',
    '.bar.hp',
    '.bar.poise',
    '.intent-wrap',
    '.intent-wrap .line.abs',
    '.axis',
    '.formation-zone',
    '.formation-zone .line.abs',
    '.hand-zone',
    '.hand',
    '.forecast',
    '.pile',
    '.battle-log',
    '.tipbar',
  ],
  card: ['.hand .card', '.hand .card .art', '.hand .card .name', '.hand .card .syms', '.hand .card .text', '.hand .card .sym'],
  map: ['.map', '.map-scroll', '.mnode', '.map-edges'],
  shop: ['.shop', '.shop-grid', '.card.lg'],
}

if (scene === 'card' || scene === 'battle') {
  await page.evaluate(() => window.__rc.fight('spin'))
  await page.waitForTimeout(1300)
} else if (scene === 'map') {
  await page.waitForTimeout(600)
} else if (scene === 'shop') {
  await page.evaluate(() => {
    window.__rc.run().player.shards = 480
    window.__rc.openShop()
  })
  await page.waitForTimeout(700)
}

const out = await page.evaluate((sel) => {
  const res = {}
  for (const s of sel) {
    const list = [...document.querySelectorAll(s)]
    if (!list.length) {
      res[s] = 'MISSING'
      continue
    }
    res[s] = list
      .slice(0, 3)
      .map((e) => {
        const r = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} [${cs.display}/flex:${cs.flex}]`
      })
      .join('  |  ')
  }
  const svg = document.querySelector('.enemy-sigil .rot-a svg')
  res['__sigilSVG'] = svg ? svg.getAttribute('viewBox') : 'none'
  res['__bodyScroll'] = `${document.body.scrollWidth}x${document.body.scrollHeight}`
  return res
}, SELECTORS[scene] ?? SELECTORS.battle)

console.log(`场景：${scene}`)
for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(26)} ${v}`)
await browser.close()
