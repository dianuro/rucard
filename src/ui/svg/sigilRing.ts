import { Rng } from '../../core/rng'

const rad = (a: number) => (a * Math.PI) / 180
const px = (r: number, a: number, c = 500): [number, number] => [c + r * Math.cos(rad(a)), c + r * Math.sin(rad(a))]
const f = (n: number) => Math.round(n * 100) / 100

function ringPath(r: number, c = 500): string {
  return `M${c} ${f(c - r)}A${f(r)} ${f(r)} 0 1 1 ${f(c - 0.01)} ${f(c - r)}`
}

function ticks(count: number, r0: number, r1: number, skip = 0.35, seed = 'tick'): string {
  const rng = new Rng(seed)
  let d = ''
  for (let i = 0; i < count; i++) {
    if (rng.chance(skip)) continue
    const a = (360 / count) * i
    const [x0, y0] = px(r0, a)
    const [x1, y1] = px(r1 + (rng.chance(0.18) ? 14 : 0), a)
    d += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`
  }
  return d
}

function ngon(n: number, r: number, offset = -90): string {
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const [x, y] = px(r, offset + (360 / n) * i)
    pts.push(`${f(x)} ${f(y)}`)
  }
  return 'M' + pts.join('L') + 'Z'
}

/**
 * 背景法阵：多层同心环 + 刻度 + 内接多边形 + 环绕的小符。
 * 各层以不同速度反向旋转，产生缓慢的机械呼吸感。
 */
export function backgroundMandala(): string {
  const rng = new Rng('rucard-mandala')
  const outer = 470

  // 环绕的小符
  let marks = ''
  const n = 24
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + 7
    const [x, y] = px(outer - 44, a)
    const kind = rng.int(0, 3)
    const s = 1.6
    if (kind === 0) marks += `<path d="M${f(x - 6)} ${f(y)}L${f(x + 6)} ${f(y)}M${f(x)} ${f(y - 6)}L${f(x)} ${f(y + 6)}" stroke-width="2"/>`
    else if (kind === 1) marks += `<path d="M${f(x - 6)} ${f(y + 5)}L${f(x)} ${f(y - 6)}L${f(x + 6)} ${f(y + 5)}Z" stroke-width="2"/>`
    else if (kind === 2) marks += `<circle cx="${f(x)}" cy="${f(y)}" r="4" stroke-width="2"/>`
    else marks += `<path d="M${f(x - 6)} ${f(y - 5)}L${f(x + 6)} ${f(y + 5)}M${f(x + 6)} ${f(y - 5)}L${f(x - 6)} ${f(y + 5)}" stroke-width="${f(s)}"/>`
  }

  return `
<svg viewBox="0 0 1000 1000" width="100%" height="100%" fill="none" stroke="currentColor">
  <g class="spin-slow">
    <path d="${ringPath(outer)}" stroke-width="2" opacity="0.55"/>
    <path d="${ringPath(outer - 14)}" stroke-width="1.4" stroke-dasharray="10 12" opacity="0.7"/>
    <path d="${ticks(72, outer - 30, outer - 16, 0.4, 'm1')}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
    <path d="${ngon(7, outer - 78)}" stroke-width="1.6" opacity="0.4"/>
    <g opacity="0.5">${marks}</g>
  </g>
  <g class="spin-rev">
    <path d="${ringPath(outer - 108)}" stroke-width="2.2" stroke-dasharray="3 16" stroke-linecap="round" opacity="0.75"/>
    <path d="${ticks(48, outer - 130, outer - 118, 0.5, 'm2')}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    <path d="${ngon(5, outer - 158)}" stroke-width="1.6" opacity="0.35"/>
  </g>
  <g class="spin-slow" style="animation-duration:150s">
    <path d="${ringPath(210)}" stroke-width="2" opacity="0.5"/>
    <path d="${ringPath(184)}" stroke-width="1.4" stroke-dasharray="6 10" opacity="0.6"/>
    <path d="${ticks(36, 200, 212, 0.35, 'm3')}" stroke-width="2.6" stroke-linecap="round" opacity="0.6"/>
    <path d="${ngon(3, 150)}" stroke-width="1.6" opacity="0.3"/>
  </g>
  <g class="pulse">
    <path d="${ringPath(120)}" stroke-width="2" opacity="0.6"/>
    <path d="${ngon(9, 100)}" stroke-width="1.6" opacity="0.4"/>
    <path d="${ngon(9, 100)}" stroke-width="1.6" opacity="0.4" transform="rotate(20 500 500)"/>
  </g>
</svg>`.trim()
}

/** 敌方的三层符阵主体（viewBox 1000×1000，主体占据 ~85%） */
export function enemySigil(seed: string, color: string, accent: string): string {
  const rng = new Rng(seed)
  const C = 500

  // 外层：厚刻度环
  const n1 = rng.pick([36, 44, 52])
  let ticksOuter = ''
  for (let i = 0; i < n1; i++) {
    if (rng.chance(0.34)) continue
    const a = (360 / n1) * i
    const len = rng.chance(0.16) ? 62 : 34
    const [x0, y0] = px(438, a, C)
    const [x1, y1] = px(438 + len, a, C)
    ticksOuter += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`
  }
  const outer =
    `<g class="rot-a" style="color:${color}">` +
    `<path d="${ringPath(430, C)}" stroke="currentColor" stroke-width="7"/>` +
    `<path d="${ringPath(398, C)}" stroke="currentColor" stroke-width="3" stroke-dasharray="16 12" opacity="0.85"/>` +
    `<path d="${ticksOuter}" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="${ngon(rng.pick([5, 7, 8]), 360)}" fill="none" stroke="${accent}" stroke-width="5" opacity="0.7" stroke-linejoin="round"/>` +
    `</g>`

  // 中层：断续弧 + 交点圆
  const n2 = rng.pick([6, 8, 10, 12])
  let arcs = ''
  let dots = ''
  for (let i = 0; i < n2; i++) {
    const a0 = (360 / n2) * i + rng.range(0, 8)
    const span = rng.range(12, 30)
    const [x0, y0] = px(280, a0, C)
    const [x1, y1] = px(280, a0 + span, C)
    arcs += `M${f(x0)} ${f(y0)}A280 280 0 0 1 ${f(x1)} ${f(y1)}`
    if (rng.chance(0.5)) {
      const [dx, dy] = px(280, a0 + span / 2, C)
      dots += `<circle cx="${f(dx)}" cy="${f(dy)}" r="9"/>`
    }
  }
  const mid =
    `<g class="rot-b" style="color:${accent}">` +
    `<path d="${arcs}" stroke="currentColor" stroke-width="16" stroke-linecap="round" fill="none"/>` +
    `<g fill="currentColor">${dots}</g>` +
    `<path d="${ringPath(220, C)}" stroke="currentColor" stroke-width="3.5" opacity="0.6" fill="none"/>` +
    `</g>`

  // 内层核心：n 次对称笔画
  const fold = rng.pick([3, 4, 6])
  let coreD = ''
  for (let k = 0; k < 3; k++) {
    const a = rng.range(0, 360)
    const r0 = rng.range(40, 175)
    const r1 = rng.range(40, 175)
    const [x0, y0] = px(r0, a, C)
    const [x1, y1] = px(r1, a + rng.range(50, 150), C)
    const [cx, cy] = px(rng.range(10, 90), a + rng.range(20, 70), C)
    coreD += rng.chance(0.5)
      ? `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`
      : `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`
  }
  const segs = Array.from(
    { length: fold },
    (_, i) => `<path d="${coreD}" transform="rotate(${f((360 / fold) * i)} ${C} ${C})"/>`,
  ).join('')
  const core =
    `<g class="rot-c" style="color:${color}">` +
    `<path d="${ngon(4, 178)}" fill="none" stroke="currentColor" stroke-width="4" opacity="0.5" stroke-linejoin="round"/>` +
    `<g stroke="currentColor" stroke-width="9" stroke-linecap="round" fill="none">${segs}</g>` +
    `<circle cx="${C}" cy="${C}" r="26" fill="${accent}" opacity="0.95"/>` +
    `<circle cx="${C}" cy="${C}" r="48" fill="none" stroke="${accent}" stroke-width="4" opacity="0.7"/>` +
    `</g>`

  return (
    `<svg viewBox="0 0 1000 1000" fill="none" aria-hidden="true">` +
    `<g stroke-linejoin="round">${outer}${mid}${core}</g></svg>`
  )
}

/** 悬浮在敌人周围的随机小符。
 *  独立 viewBox（1200），比符阵本体大一档，否则轨道会撞上裁剪边界。 */
export const ORBIT_VIEW = 1200
export function orbitMarks(seed: string, count = 9): string {
  const rng = new Rng(seed + '-orbit')
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const a = (360 / count) * i + rng.range(-11, 11)
    const r = rng.range(478, 556)
    const [x, y] = px(r, a, 0)
    const s = rng.range(14, 28)
    const k = rng.int(0, 2)
    const stroke = `stroke-width="7" stroke-linecap="round" fill="none"`
    if (k === 0) parts.push(`<path d="M${f(x - s)} ${f(y + s)}L${f(x)} ${f(y - s)}L${f(x + s)} ${f(y + s)}" ${stroke}/>`)
    else if (k === 1)
      parts.push(`<path d="M${f(x)} ${f(y - s)}A${f(s)} ${f(s)} 0 1 1 ${f(x - 0.1)} ${f(y - s)}" ${stroke} stroke-dasharray="9 10"/>`)
    else parts.push(`<path d="M${f(x - s)} ${f(y)}L${f(x)} ${f(y - s)}L${f(x + s)} ${f(y)}L${f(x)} ${f(y + s)}Z" ${stroke}/>`)
  }
  const h = ORBIT_VIEW / 2
  return `<svg viewBox="${-h} ${-h} ${ORBIT_VIEW} ${ORBIT_VIEW}" fill="none" stroke="currentColor" aria-hidden="true">${parts.join('')}</svg>`
}
