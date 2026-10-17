type Props = Record<string, unknown>

/** 极简元素构造器 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue
      if (k === 'class') el.className = String(v)
      else if (k === 'html') el.innerHTML = String(v)
      else if (k === 'text') el.textContent = String(v)
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
      else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v as object)
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
      } else if (k === 'disabled' || k === 'checked') {
        if (v) el.setAttribute(k, '')
      } else el.setAttribute(k, String(v))
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

export function svgFrom(markup: string): SVGElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup.trim()
  return wrap.firstElementChild as SVGElement
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild)
}

export function qs<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector(sel)
  if (!el) throw new Error(`not found: ${sel}`)
  return el as T
}

/** 播放一次 WAAPI 动画并等待结束 */
export function anim(el: Element, keyframes: Keyframe[], opts: KeyframeAnimationOptions): Animation {
  return el.animate(keyframes, { fill: 'none', ...opts })
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

/** 稳定的数值滚动（用于生命值等） */
export function tween(from: number, to: number, ms: number, cb: (v: number) => void, done?: () => void): void {
  const t0 = performance.now()
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms)
    const e = 1 - Math.pow(1 - k, 3)
    cb(Math.round(from + (to - from) * e))
    if (k < 1) requestAnimationFrame(step)
    else done?.()
  }
  requestAnimationFrame(step)
}
