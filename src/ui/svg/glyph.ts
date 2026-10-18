/**
 * 程序化符印生成器。
 *
 * 所有「图像」都由路径现场生成：没有任何位图，也没有任何具象形状。
 * 同一个名字（种子）永远得到同一个符印，因此卡牌、敌人、圣痕的身份是稳定的。
 *
 * 构造方式：
 *   外层环  —— 实线圆 / 虚线圆 / 内接多边形 / 齿环 / 双环
 *   刻度盘  —— 沿环随机跳格的短刻线（像未校准的量表）
 *   核心    —— 低透明度的实心多边形
 *   笔画    —— n 次旋转对称的折线 / 弧 / 弦 / 钩
 *   点缀    —— 端点圆点、跳过的小符
 */

import { Rng } from '../../core/rng'

export interface GlyphOpts {
  size?: number
  stroke?: string
  accent?: string
  fill?: string
  /** 是否绘制实心核心 */
  core?: boolean
  /** 额外旋转（角度） */
  rotate?: number
  /** 笔画线宽倍率 */
  weight?: number
  /** 细节程度 0..1 */
  detail?: number
}

const rad = (a: number) => (a * Math.PI) / 180
const px = (r: number, a: number): [number, number] => [50 + r * Math.cos(rad(a)), 50 + r * Math.sin(rad(a))]
const f = (n: number) => Math.round(n * 100) / 100

function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = px(r, a0)
  const [x1, y1] = px(r, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}`
}

function line(r0: number, a0: number, r1: number, a1: number): string {
  const [x0, y0] = px(r0, a0)
  const [x1, y1] = px(r1, a1)
  return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`
}

function poly(pts: [number, number][]): string {
  return 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z'
}

function circlePath(r: number): string {
  return `M50 ${f(50 - r)}A${f(r)} ${f(r)} 0 1 1 49.99 ${f(50 - r)}`
}

function regular(n: number, r: number, offset = -90): string {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) pts.push(px(r, offset + (360 / n) * i))
  return poly(pts)
}

/** 一段弧 + 一条弦，构成「半开的眼」式符号（不指向任何真实物象） */
function wedgeStroke(rng: Rng, r: number): string {
  const kind = rng.int(0, 5)
  const a = rng.range(0, 360)
  switch (kind) {
    case 0: {
      const span = rng.range(40, 150) * (rng.chance(0.5) ? 1 : -1)
      return arc(rng.range(r * 0.45, r * 0.9), a, a + span)
    }
    case 1: {
      const r2 = rng.range(r * 0.25, r * 0.95)
      return line(rng.range(r * 0.2, r * 0.5), a, r2, a + rng.range(-38, 38))
    }
    case 2: {
      const a2 = a + rng.range(25, 95)
      return (
        line(rng.range(r * 0.3, r * 0.7), a, rng.range(r * 0.3, r * 0.85), a2) +
        line(rng.range(r * 0.3, r * 0.85), a2, rng.range(r * 0.15, r * 0.55), a2 + rng.range(30, 80) * (rng.chance(0.5) ? 1 : -1))
      )
    }
    case 3: {
      const r0 = rng.range(r * 0.5, r)
      const r1 = rng.range(r * 0.5, r)
      const a2 = a + rng.range(50, 110)
      return line(r0, a, r1, a2) + arc(r * 0.22, a, a2)
    }
    case 4: {
      const a2 = a + rng.range(30, 70)
      const [x0, y0] = px(rng.range(r * 0.3, r * 0.9), a)
      const [x1, y1] = px(rng.range(r * 0.3, r * 0.9), a2)
      const [cx, cy] = px(rng.range(r * 0.1, r * 0.5), (a + a2) / 2)
      return `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`
    }
    default: {
      return regular(rng.int(3, 4), rng.range(r * 0.3, r * 0.75), a)
    }
  }
}

/**
 * 生成一个符印，返回完整的 <svg> 字符串（viewBox 0 0 100 100）。
 */
export function glyph(seed: string, o: GlyphOpts = {}): string {
  const rng = new Rng(seed)
  const size = o.size ?? 96
  const sw = (1.5 + rng.float() * 1.1) * (o.weight ?? 1)
  const stroke = o.stroke ?? 'currentColor'
  const accent = o.accent ?? stroke
  const detail = o.detail ?? 1

  const fold = rng.pick([3, 3, 4, 5, 6, 2])
  const outerR = rng.range(38, 44)
  const parts: string[] = []

  // 核心
  if (o.core !== false && rng.chance(0.55 * detail)) {
    const cr = rng.range(6, 15)
    const n = rng.int(3, 6)
    parts.push(
      `<path d="${regular(n, cr, rng.range(0, 360))}" fill="${o.fill ?? stroke}" opacity="0.14" stroke="${o.fill ?? stroke}" stroke-width="${f(sw * 0.7)}" stroke-linejoin="round"/>`,
    )
  }

  // 外层环
  const ringStyle = rng.int(0, 5)
  if (ringStyle !== 0) {
    if (ringStyle === 1) {
      parts.push(`<circle cx="50" cy="50" r="${f(outerR)}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}"/>`)
    } else if (ringStyle === 2) {
      parts.push(
        `<circle cx="50" cy="50" r="${f(outerR)}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-dasharray="${f(rng.range(3, 7))} ${f(rng.range(3, 9))}" stroke-linecap="round"/>`,
      )
    } else if (ringStyle === 3) {
      parts.push(
        `<path d="${regular(rng.pick([3, 5, 6, 8]), outerR)}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`,
      )
      parts.push(`<circle cx="50" cy="50" r="${f(outerR * 0.72)}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.7)}" opacity="0.6"/>`)
    } else if (ringStyle === 4) {
      parts.push(`<circle cx="50" cy="50" r="${f(outerR)}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}"/>`)
      parts.push(`<circle cx="50" cy="50" r="${f(outerR - 5)}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.6)}" opacity="0.55"/>`)
    } else {
      parts.push(`<circle cx="50" cy="50" r="${f(outerR)}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.8)}" opacity="0.8"/>`)
    }
  }

  // 刻度盘：沿环随机跳格
  if (rng.chance(0.7 * detail)) {
    const ticks = rng.pick([18, 24, 30, 36])
    const r0 = outerR + 1.5
    const r1 = r0 + rng.range(2.4, 4.6) * (o.weight ?? 1)
    let d = ''
    for (let i = 0; i < ticks; i++) {
      if (rng.chance(0.42)) continue
      const a = (360 / ticks) * i + rng.range(-1.4, 1.4)
      const [x0, y0] = px(r0, a)
      const [x1, y1] = px(r1 + (rng.chance(0.22) ? 2.4 : 0), a)
      d += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`
    }
    parts.push(`<path d="${d}" stroke="${accent}" stroke-width="${f(sw * 0.8)}" stroke-linecap="round" fill="none" opacity="0.85"/>`)
  }

  // 对称笔画
  const layers = rng.int(1, detail > 0.8 ? 3 : 2)
  for (let l = 0; l < layers; l++) {
    const rr = outerR * (l === 0 ? 0.92 : rng.range(0.5, 0.8))
    const inner = rng.int(1, 2)
    let d = ''
    for (let k = 0; k < inner; k++) d += wedgeStroke(rng, rr)
    const useAccent = rng.chance(0.25)
    const segs = Array.from(
      { length: fold },
      (_, i) => `<path d="${d}" transform="rotate(${f((360 / fold) * i)} 50 50)"/>`,
    ).join('')
    parts.push(
      `<g fill="none" stroke="${useAccent ? accent : stroke}" stroke-width="${f(sw * (l === 0 ? 1 : 0.78))}"` +
        ` stroke-linecap="round" stroke-linejoin="round" transform="rotate(${f(rng.range(-8, 8))} 50 50)">${segs}</g>`,
    )
  }

  // 端点圆点
  if (rng.chance(0.5 * detail)) {
    const dots = rng.int(2, 5)
    for (let i = 0; i < dots; i++) {
      const a = (360 / dots) * i + rng.range(-14, 14)
      const rr = rng.range(outerR * 0.62, outerR * 0.98)
      const [x, y] = px(rr, a)
      parts.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rng.range(1.4, 2.6))}" fill="${accent}"/>`)
    }
  }

  const rot = o.rotate ?? 0
  return (
    `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" style="overflow:visible">` +
    `<g transform="rotate(${f(rot)} 50 50)">${parts.join('')}</g>` +
    `</svg>`
  )
}

/** 圣痕的印记：同一个 id 永远得到同一个符印。
 *  线宽必须随显示尺寸反比放大 —— 符印是 100×100 的坐标系，
 *  缩到 28px 还按原线宽画的话，一路乘下来只剩零点几个像素，等于看不见。 */
export function relicMark(id: string, size = 28, color = 'currentColor'): string {
  const weight = Math.max(0.95, Math.min(3.4, 92 / size))
  const body = glyph(`relic:${id}`, { size: 100, detail: 1.1, weight })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
  return (
    `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" style="overflow:visible" ` +
    `fill="none" stroke="${color}" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`
  )
}

/** 一列不可读的短记号，用作卡片底部的「铭文」装饰 */
export function runeStrip(seed: string, count = 14, color = 'currentColor'): string {
  const rng = new Rng(seed + '-strip')
  let d = ''
  let x = 0
  for (let i = 0; i < count; i++) {
    const w = rng.range(3, 8)
    const h = rng.range(5, 12)
    const k = rng.int(0, 4)
    const y0 = rng.range(-h / 2, h / 2)
    if (k === 0) d += `M${f(x)} ${f(y0)}L${f(x + w)} ${f(y0)}`
    else if (k === 1) d += `M${f(x)} ${f(y0)}L${f(x)} ${f(y0 + h)}M${f(x)} ${f(y0 + h / 2)}L${f(x + w)} ${f(y0 + h / 2)}`
    else if (k === 2) d += `M${f(x)} ${f(y0)}L${f(x + w)} ${f(y0 + h)}M${f(x + w)} ${f(y0)}L${f(x)} ${f(y0 + h)}`
    else if (k === 3) d += `M${f(x)} ${f(y0)}L${f(x + w)} ${f(y0)}L${f(x + w / 2)} ${f(y0 + h)}Z`
    else d += `M${f(x)} ${f(y0 + h)}A${f(w / 2)} ${f(h / 2)} 0 0 1 ${f(x + w)} ${f(y0 + h)}`
    x += w + rng.range(3, 7)
  }
  const width = x
  return (
    `<svg viewBox="0 0 ${f(width)} 24" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<g transform="translate(0 12)" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.75">` +
    `<path d="${d}"/></g></svg>`
  )
}

/** 符印的轮廓掩膜路径，用于把任意元素裁进符印内 */
export function glyphMaskId(seed: string): string {
  return 'gm-' + seed.replace(/[^a-zA-Z0-9]/g, '_')
}
