import { h, clear, wait } from '../dom'
import { glyph } from '../svg/glyph'
import { app, leaveTreasure, openTreasure } from '../../core/game'
import { sfx } from '../../audio/sfx'
import { burst, centerOf, ringFx } from '../svg/fx'
import type { View } from './types'

export function treasureView(): View {
  const root = h('div', { class: 'screen fade-in' })
  let opened = false

  async function open(btn: HTMLButtonElement, art: HTMLElement): Promise<void> {
    if (opened) return
    opened = true
    sfx.ui('click')
    const p = centerOf(art)
    ringFx(p.x, p.y, '#f2bc46', 20, 260, 620, 6)
    burst(p.x, p.y, '#ffe9a8', 26, 1.4)
    art.animate([{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.22) rotate(8deg)' }, { transform: 'scale(1) rotate(0)' }], {
      duration: 520,
      easing: 'cubic-bezier(.34,1.56,.64,1)',
    })
    btn.setAttribute('disabled', '')
    await wait(320)
    openTreasure()
    update()
  }

  let lastSig = '!'
  function update(): void {
    const s = app.get()
    const r = s.run
    if (!r) return
    const sig = `${opened}|${s.eventResult ?? ''}|${r.player.shards}|${r.relics.length}`
    if (sig === lastSig) return
    lastSig = sig
    clear(root)
    const overlay = h('div', { class: 'overlay' })
    const sheet = h('div', { class: 'panel sheet', style: { maxWidth: '640px' } })
    const art = h('div', { style: { display: 'grid', placeItems: 'center', color: '', marginTop: '-4px' } })
    art.style.color = opened ? '#7ba833' : '#5b4a7a'
    art.innerHTML = glyph('treasure-chest', { size: 148, stroke: 'currentColor', accent: '#f2bc46', weight: 1.1 })
    sheet.append(art, h('h2', { text: '遗 匣', style: { textAlign: 'center' } }))

    if (!r.player.shards && !r.relics.length) {
      sheet.append(h('p', { text: '一只没有锁的匣子，静静躺在回廊的凹槽里。' }))
    } else {
      sheet.append(h('p', { text: '一只没有锁的匣子，静静躺在回廊的凹槽里。' }))
    }

    if (s.eventResult) {
      const res = h('div', { class: 'result-banner' })
      res.append(document.createTextNode(s.eventResult))
      sheet.append(res)
      const go = h('button', { class: 'btn gold', text: '继续前行' })
      go.addEventListener('click', () => {
        sfx.ui('back')
        leaveTreasure()
      })
      sheet.append(h('div', { class: 'rowbtns' }, go))
    } else {
      const btn = h('button', { class: 'btn gold', text: '打开匣子' }) as HTMLButtonElement
      btn.addEventListener('click', () => void open(btn, art))
      sheet.append(h('div', { class: 'rowbtns' }, btn))
    }

    overlay.append(sheet)
    root.append(overlay)
  }

  return { el: root, update }
}
