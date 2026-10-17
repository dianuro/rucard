import { h, clear } from './dom'
import { app } from '../core/game'
import { initFx } from './svg/fx'
import type { View } from './views/types'
import { titleView } from './views/title'
import { mapView } from './views/map'
import { battleView } from './views/battle'
import { rewardView } from './views/reward'
import { eventView } from './views/event'
import { restView } from './views/rest'
import { shopView } from './views/shop'
import { treasureView } from './views/treasure'
import { deckView } from './views/deck'
import { gameoverView } from './views/gameover'
import { backgroundMandala } from './svg/sigilRing'

type Factory = () => View

const FACTORIES: Record<string, Factory> = {
  title: titleView,
  map: mapView,
  battle: battleView,
  reward: rewardView,
  event: eventView,
  rest: restView,
  shop: shopView,
  treasure: treasureView,
  deck: deckView,
  gameover: gameoverView,
}

let current: View | null = null
let currentKey = ''

export function initRenderer(root: HTMLElement): void {
  initFx()
  const bg = h('div', { id: 'bg' })
  const rings = h('div', { class: 'rings' })
  rings.innerHTML = backgroundMandala()
  const dust = h('div', { class: 'dust' })
  for (let i = 0; i < 26; i++) {
    const d = h('i', {})
    d.style.left = `${Math.random() * 100}%`
    d.style.bottom = `${-10 - Math.random() * 20}%`
    d.style.animationDuration = `${14 + Math.random() * 26}s`
    d.style.animationDelay = `${-Math.random() * 30}s`
    d.style.opacity = String(0.1 + Math.random() * 0.3)
    const size = 2 + Math.random() * 4
    d.style.width = `${size}px`
    d.style.height = `${size}px`
    dust.append(d)
  }
  bg.append(rings, dust)
  document.body.prepend(bg)

  // 鼠标视差
  let px = 0
  let py = 0
  let cx = 0
  let cy = 0
  window.addEventListener('pointermove', (ev) => {
    px = (ev.clientX / window.innerWidth - 0.5) * 34
    py = (ev.clientY / window.innerHeight - 0.5) * 34
  })
  const loop = (): void => {
    cx += (px - cx) * 0.045
    cy += (py - cy) * 0.045
    rings.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  app.subscribe(() => render(root))
  render(root)
}

function render(root: HTMLElement): void {
  const s = app.get()
  // 选牌流程优先于一切
  const key = s.pick ? 'deck' : s.screen.t

  if (key !== currentKey) {
    current?.destroy?.()
    clear(root)
    const factory = FACTORIES[key] ?? titleView
    current = factory()
    currentKey = key
    root.append(current.el)
    current.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' })
  }
  current?.update()
}
