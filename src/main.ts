import './styles/tokens.css'
import './styles/card.css'
import './styles/battle.css'
import './styles/map.css'
import './styles/misc.css'

import { h } from './ui/dom'
import { initRenderer } from './ui/render'
import { app } from './core/game'
import { bindAudioGesture, sfx } from './audio/sfx'
import { toast } from './core/game'

const root = document.getElementById('app') ?? h('div', { id: 'app' })
if (!root.parentElement) document.body.append(root)
const host = h('div', { class: 'screen' })
root.append(host)

bindAudioGesture()
initRenderer(host)

// 环境低鸣只在战斗中出现
let droneState = false
app.subscribe((s) => {
  if (s.muted && droneState) {
    sfx.droneOff()
    droneState = false
    return
  }
  const want = !s.muted && s.screen.t === 'battle'
  if (want !== droneState) {
    droneState = want
    if (want) sfx.droneOn()
    else sfx.droneOff()
  }
})

// toast 展示
let lastToastId = 0
const toastWrap = h('div', { class: 'toast-wrap' })
document.body.append(toastWrap)
app.subscribe((s) => {
  if (!s.toast || s.toast.id === lastToastId) return
  lastToastId = s.toast.id
  const el = h('div', { class: `toast ${s.toast.tone}`, text: s.toast.text })
  toastWrap.append(el)
  window.setTimeout(() => {
    el.classList.add('leaving')
    window.setTimeout(() => el.remove(), 320)
  }, 1800)
})

document.addEventListener('contextmenu', (ev) => {
  const t = ev.target as HTMLElement
  if (t.closest('.card, .slot, .mnode')) ev.preventDefault()
})

window.addEventListener('error', (ev) => {
  toast(`出了点问题：${ev.message}`, 'bad')
})

sfx.setMuted(app.get().muted)
