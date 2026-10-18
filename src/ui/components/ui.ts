import { h, svgFrom } from '../dom'
import { glyph, runeStrip } from '../svg/glyph'
import { SYM_ICON, icoEnergy, icoPoise } from '../svg/runes'
import { ARCH_COLOR, ARCH_NAME, RARITY_NAME, cardSummary } from '../../core/cards'
import { KIND_DESC, KIND_NAME, KIND_SHORT, symIsAtk } from '../../core/combat'
import type { CardDef, CardInst, Sym, SymKind } from '../../core/types'
import { sfx } from '../../audio/sfx'

/* ───────────────────────── 卡牌 ───────────────────────── */

/** 把两个十六进制颜色按比例混合（t=0 为 a，t=1 为 b）。 */
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string): [number, number, number] => {
    const s = h.replace('#', '')
    const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = p(a)
  const [r2, g2, b2] = p(b)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export interface CardOpts {
  variant?: 'sm' | 'lg' | 'mini'
  playable?: boolean
  selected?: boolean
  onClick?: (el: HTMLElement) => void
  showText?: boolean
}

export function cardEl(c: CardDef | CardInst, o: CardOpts = {}): HTMLElement {
  const arch = c.arch
  const cls = ['card', o.variant === 'lg' ? 'lg' : o.variant === 'mini' ? 'mini' : '']
  if (o.playable) cls.push('playable')
  if (o.selected) cls.push('selected')
  if (o.playable === false) cls.push('unplayable')

  const el = h('div', {
    class: cls.filter(Boolean).join(' '),
    dataset: { arch, id: c.id, uid: (c as CardInst).uid ?? '' },
  })

  // 费用
  const cost = h('div', { class: `cost${c.cost === 0 ? ' free' : ''}` })
  cost.innerHTML =
    `<svg viewBox="0 0 44 44" aria-hidden="true">` +
    `<circle cx="22" cy="22" r="19" fill="currentColor" stroke="var(--edge)" stroke-width="3"/>` +
    `<circle cx="22" cy="22" r="13" fill="none" stroke="#3a2506" stroke-width="2" opacity=".35"/>` +
    `</svg>`
  cost.append(h('b', { text: c.cost === 0 ? '0' : String(c.cost) }))
  el.append(cost)

  // 稀有度
  el.append(h('div', { class: 'rarity', text: RARITY_NAME[c.rarity] }))
  if ((c as CardInst).upgraded) el.append(h('div', { class: 'upmark', text: '+2' }))

  // 符印
  const art = h('div', { class: 'art' })
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--arch-${arch}`).trim() || '#b4a9d6'
  art.innerHTML = glyph(c.id + '-' + c.name, {
    stroke: 'currentColor',
    accent: mixHex(raw, '#2a1f43', 0.42),
    weight: 1.35,
    detail: o.variant === 'mini' ? 0.6 : 1,
    core: true,
  })
  el.append(art)

  el.append(h('div', { class: 'name', text: c.name }))

  const syms = h('div', { class: 'syms' })
  const expanded = c.syms
  if (expanded.length === 0) {
    syms.append(h('span', { class: 'sym', dataset: { k: 'spiral' }, text: '无符式', style: { borderStyle: 'dashed' } }))
  }
  for (const s of expanded) {
    syms.append(symPill(s.k, s.v, s.k === 'spiral' ? '' : undefined))
  }
  el.append(syms)

  if (o.variant !== 'mini') {
    const tl: string[] = []
    if (c.fx?.length) {
      for (const f of c.fx) {
        if (f.t === 'draw') tl.push(`抽 ${f.n}`)
        else if (f.t === 'energy') tl.push(`灵光 +${f.n}`)
        else if (f.t === 'buff' && f.id === 'focus') tl.push(`蓄势 +${f.n}`)
        else if (f.t === 'stagger') tl.push(`破绽 +${f.n}`)
        else if (f.t === 'damageFromBlock') tl.push(`以护盾造成伤害`)
        else if (f.t === 'damage') tl.push(`直接 ${f.n} 伤害`)
        else if (f.t === 'heal') tl.push(`回复 ${f.n}`)
        else if (f.t === 'block') tl.push(`护盾 +${f.n}`)
      }
    }
    if (c.exhaust) tl.push('消耗')
    if (!tl.length) tl.push(c.flavor)
    el.append(h('div', { class: 'text', text: tl.join(' · ') }))
  }

  const strip = h('div', {
    class: 'strip',
    style: { position: 'absolute', left: '9px', right: '9px', bottom: '3px', opacity: '0.32', height: '7px' },
  })
  strip.innerHTML = runeStrip(c.id, o.variant === 'mini' ? 8 : 14, '#5b4a7a')
  el.append(strip)

  if (o.onClick) {
    el.addEventListener('click', () => o.onClick!(el))
    el.addEventListener('pointerenter', () => sfx.ui('hover'))
  }
  return el
}

/** 卡面上的符式药丸 */
export function symPill(k: SymKind, v: number, suffix?: string): HTMLElement {
  const el = h('span', { class: 'sym', dataset: { k } })
  el.innerHTML = SYM_ICON[k](14)
  el.append(h('b', { text: (suffix ?? String(v)) }))
  el.title = `${KIND_NAME[k]} · ${KIND_DESC[k]}`
  return el
}

/* ───────────────────────── 符式方块 ───────────────────────── */

export function slotEl(sym: Sym | null, side: 'player' | 'enemy', opts: { empty?: boolean } = {}): HTMLElement {
  if (!sym) {
    return h('div', { class: 'slot empty', dataset: { side }, html: `<svg viewBox="0 0 40 40" width="30" height="30"><path d="M20 10 L20 30 M10 20 L30 20" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg>` })
  }
  const el = h('div', { class: `slot${opts.empty ? ' ghostly' : ''}`, dataset: { k: sym.k, side } })
  el.innerHTML = SYM_ICON[sym.k](32)
  el.append(h('div', { class: 'v', text: String(sym.v) }))
  const tip = h('div', { class: 'slot-tip' })
  tip.innerHTML = `<b>${KIND_NAME[sym.k]} ${sym.v}</b> · ${KIND_SHORT[sym.k]}`
  el.title = `${KIND_NAME[sym.k]} ${sym.v} — ${KIND_DESC[sym.k]}`
  return el
}

/* ───────────────────────── 顶栏 chip ───────────────────────── */

export function chip(iconHtml: string, value: string, cls = ''): HTMLElement {
  const el = h('div', { class: `chip ${cls}` })
  el.innerHTML = iconHtml
  el.append(h('span', { class: 'val', text: value }))
  return el
}

export function barEl(kind: 'hp' | 'poise' | 'block', text: string): { root: HTMLElement; set: (v: number, max: number) => void } {
  const trail = h('div', { class: 'trail' })
  const fill = h('div', { class: 'fill' })
  const label = h('div', { class: 'label', text })
  // 血条底下拖一条「余痕」：掉血时它会慢半拍地追上来
  const root = h('div', { class: `bar ${kind}` }, ...(kind === 'hp' ? [trail] : []), fill, label)
  return {
    root,
    set(v, max) {
      const pct = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0
      fill.style.width = `${pct * 100}%`
      trail.style.width = `${pct * 100}%`
      label.textContent = text.replace('{}', `${Math.max(0, v)}/${max}`)
    },
  }
}

export { icoEnergy, icoPoise, ARCH_COLOR, ARCH_NAME, cardSummary }

export function symIsAttack(k: SymKind): boolean {
  return symIsAtk(k)
}

export function makeSvg(markup: string, cls = ''): SVGElement {
  const s = svgFrom(markup)
  if (cls) s.setAttribute('class', cls)
  return s
}
