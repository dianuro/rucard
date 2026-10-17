/**
 * 音频自验证：确认每一种音效都真的在合成波形，而不是静默。
 *   node tools/audio.mjs
 *
 * 做法是在 sfx 的总线上挂一个 AnalyserNode，逐个触发音效并测量 RMS 峰值。
 * 无头 Chromium 默认会因为「没有用户手势」挂起 AudioContext，
 * 所以启动时带上 --autoplay-policy=no-user-gesture-required。
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

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__rc)

const result = await page.evaluate(async () => {
  const { sfx } = await import('/src/audio/sfx.ts')
  const anySfx = sfx
  const ctx = anySfx.ctx ?? anySfx.ensure()
  await ctx.resume()
  const an = ctx.createAnalyser()
  an.fftSize = 2048
  anySfx.master.connect(an)
  const buf = new Float32Array(an.fftSize)

  const measure = async (fn, ms) => {
    fn()
    let peak = 0
    const t0 = performance.now()
    while (performance.now() - t0 < ms) {
      an.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      peak = Math.max(peak, Math.sqrt(sum / buf.length))
      await new Promise((r) => setTimeout(r, 16))
    }
    return peak
  }

  const CASES = [
    ['start', () => sfx.start(), 700],
    ['ui(hover)', () => sfx.ui('hover'), 300],
    ['ui(click)', () => sfx.ui('click'), 300],
    ['ui(back)', () => sfx.ui('back'), 300],
    ['ui(travel)', () => sfx.ui('travel'), 700],
    ['ui(shred)', () => sfx.ui('shred'), 700],
    ['playCard', () => sfx.playCard('rift', 2), 800],
    ['clash(win)', () => sfx.clash(true, false, 3), 900],
    ['clash(lose)', () => sfx.clash(false, false, 2), 900],
    ['clash(tie)', () => sfx.clash(false, true, 1), 900],
    ['hit', () => sfx.hit(2), 700],
    ['block', () => sfx.block(), 700],
    ['pierce', () => sfx.pierce(), 700],
    ['echo', () => sfx.echo(), 700],
    ['cancel', () => sfx.cancel(), 700],
    ['stagger', () => sfx.stagger(), 1200],
    ['energy', () => sfx.energy(), 700],
    ['heal', () => sfx.heal(), 900],
    ['draw', () => sfx.draw(), 500],
    ['deny', () => sfx.deny(), 500],
    ['cardGet', () => sfx.cardGet(), 700],
    ['relic', () => sfx.relic(), 900],
    ['treasure', () => sfx.treasure(), 900],
    ['purchase', () => sfx.purchase(), 700],
    ['battleStart', () => sfx.battleStart(), 1400],
    ['victory', () => sfx.victory(), 1800],
    ['defeat', () => sfx.defeat(), 1800],
  ]

  const out = []
  for (const [name, fn, ms] of CASES) {
    try {
      out.push([name, await measure(fn, ms)])
    } catch (e) {
      out.push([name, 'ERR:' + e.message])
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  // 环境音（战斗低鸣）：增益用 3.5s 指数渐入，必须等它到顶再测
  anySfx.droneOn()
  await new Promise((r) => setTimeout(r, 4200))
  out.push(['droneOn(持续)', await measure(() => {}, 700)])
  anySfx.droneOff()
  await new Promise((r) => setTimeout(r, 1600))
  out.push(['!droneOff 应为静音', await measure(() => {}, 700)])
  return { sampleRate: ctx.sampleRate, state: ctx.state, out }
})

console.log(`AudioContext: ${result.state} @ ${result.sampleRate}Hz`)
let silent = 0
for (const [name, peak] of result.out) {
  const expectSilent = name.startsWith('!')
  const ok = expectSilent ? true : typeof peak === 'number' && peak > 0.0008
  if (!expectSilent && !ok) silent++
  const bar = typeof peak === 'number' ? '█'.repeat(Math.min(28, Math.round(peak * 120))) : ''
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(16)} ${typeof peak === 'number' ? peak.toFixed(5) : peak}  ${bar}`)
}
if (silent) {
  console.log(`\n${silent} 个音效是静默的（或音量过低）。`)
  process.exitCode = 1
} else {
  console.log('\n全部音效都有实际波形输出。')
}
await browser.close()
