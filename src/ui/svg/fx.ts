import { h } from '../dom'

let layer: HTMLElement | null = null
let shakeEl: HTMLElement | null = null

export function initFx(): void {
  layer = h('div', { class: 'float-layer' })
  shakeEl = h('div', { id: 'screen-shake' })
  document.body.append(layer, shakeEl)
}

export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** 飘字 */
export function floatText(
  x: number,
  y: number,
  text: string,
  cls = '',
  opts: { dy?: number; dx?: number; scale?: number; ms?: number; delay?: number } = {},
): void {
  if (!layer) return
  const el = h('div', { class: `dmg ${cls}`, text })
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  layer.append(el)
  const dx = opts.dx ?? 0
  const dy = opts.dy ?? -66
  const s = opts.scale ?? 1
  const ms = opts.ms ?? 900
  el.animate(
    [
      { transform: `translate(-50%,-50%) scale(${0.4 * s}) rotate(-8deg)`, opacity: 0 },
      { transform: `translate(-50%,-50%) scale(${1.28 * s}) rotate(3deg)`, opacity: 1, offset: 0.24 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px),calc(-50% + ${dy * 0.55}px)) scale(${1.02 * s})`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${0.86 * s})`, opacity: 0 },
    ],
    { duration: ms, delay: opts.delay ?? 0, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
  ).finished.then(() => el.remove())
}

/** 火花迸射 */
export function burst(x: number, y: number, color: string, count = 14, power = 1): void {
  if (!layer) return
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.6
    const dist = (40 + Math.random() * 110) * power
    const el = h('div', { class: 'spark' })
    const size = 5 + Math.random() * 9
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.background = color
    el.style.boxShadow = `0 0 12px ${color}`
    layer.append(el)
    const dur = 380 + Math.random() * 420
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * dist}px),calc(-50% + ${Math.sin(a) * dist + 26}px)) scale(0.15)`,
          opacity: 0,
        },
      ],
      { duration: dur, easing: 'cubic-bezier(.16,.8,.3,1)', fill: 'forwards' },
    ).finished.then(() => el.remove())
  }
}

/** 碎片崩解（用于被抵消的符式） */
export function shatter(x: number, y: number, color: string, count = 11): void {
  if (!layer) return
  for (let i = 0; i < count; i++) {
    const el = h('div', { class: 'shard' })
    const size = 7 + Math.random() * 13
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.background = color
    layer.append(el)
    const a = Math.random() * Math.PI * 2
    const dist = 30 + Math.random() * 90
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * dist}px),calc(-50% + ${Math.sin(a) * dist + 60}px)) scale(0.4) rotate(${
            (Math.random() - 0.5) * 720
          }deg)`,
          opacity: 0,
        },
      ],
      { duration: 620 + Math.random() * 380, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' },
    ).finished.then(() => el.remove())
  }
}

/** 扩散圆环 */
export function ringFx(x: number, y: number, color: string, from = 10, to = 130, ms = 520, width = 4): void {
  if (!layer) return
  const el = h('div', { class: 'ring-fx' })
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.width = `${from}px`
  el.style.height = `${from}px`
  el.style.color = color
  el.style.borderWidth = `${width}px`
  layer.append(el)
  el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.95 },
      { transform: `translate(-50%,-50%) scale(${to / from})`, opacity: 0 },
    ],
    { duration: ms, easing: 'cubic-bezier(.16,.8,.3,1)', fill: 'forwards' },
  ).finished.then(() => el.remove())
}

/** 屏幕震动 */
export function shake(power = 1): void {
  if (!shakeEl) return
  shakeEl.style.transformOrigin = '50% 50%'
  const p = Math.min(power, 2.4)
  shakeEl.animate(
    [
      { transform: 'translate(0,0) rotate(0)' },
      { transform: `translate(${-9 * p}px,${5 * p}px) rotate(${-0.4 * p}deg)` },
      { transform: `translate(${8 * p}px,${-6 * p}px) rotate(${0.45 * p}deg)` },
      { transform: `translate(${-5 * p}px,${3 * p}px) rotate(${-0.2 * p}deg)` },
      { transform: `translate(${3 * p}px,${-2 * p}px) rotate(0.1deg)` },
      { transform: 'translate(0,0) rotate(0)' },
    ],
    { duration: 340, easing: 'cubic-bezier(.3,.7,.4,1)' },
  )
}

/** 全屏横幅（僵直 / 回合切换） */
export function banner(text: string, cls = 'stagger-banner', ms = 1000): void {
  if (!layer) return
  const el = h('div', { class: cls, text })
  layer.append(el)
  el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0, filter: 'blur(14px)' },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, filter: 'blur(0)', offset: 0.26 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-50%) scale(1.16)', opacity: 0, filter: 'blur(6px)' },
    ],
    { duration: ms, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
  ).finished.then(() => el.remove())
}

/** 元素向目标飞行，返回 promise */
export function flyTo(from: Element, to: Element, ghost: HTMLElement, ms = 420): Promise<void> {
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  ghost.classList.add('card-fx')
  ghost.style.left = `${a.left}px`
  ghost.style.top = `${a.top}px`
  document.body.append(ghost)
  const kf: Keyframe[] = [
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    {
      transform: `translate(${(b.left - a.left) * 0.5}px,${(b.top - a.top) * 0.5 - 90}px) scale(0.7) rotate(-10deg)`,
      opacity: 1,
      offset: 0.55,
    },
    {
      transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(${b.width / Math.max(a.width, 1)}) rotate(0deg)`,
      opacity: 0.9,
    },
  ]
  const animation = ghost.animate(kf, { duration: ms, easing: 'cubic-bezier(.35,0,.25,1)', fill: 'forwards' })
  return animation.finished.then(() => {
    ghost.remove()
  })
}
