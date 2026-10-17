import { h, clear } from '../dom'
import { glyph } from '../svg/glyph'
import { EVENT_BY_ID } from '../../core/events'
import { app, chooseEventOption, closeEventResult } from '../../core/game'
import { sfx } from '../../audio/sfx'
import type { View } from './types'

export function eventView(): View {
  const root = h('div', { class: 'screen fade-in' })
  let sig = ''
  let shownResult = false

  function update(): void {
    const s = app.get()
    if (s.screen.t !== 'event') return
    const ev = EVENT_BY_ID[s.screen.id]
    if (!ev) return
    const r = s.run
    if (!r) return
    const next = `${ev.id}|${s.eventChosen}|${s.eventResult ?? ''}|${r.player.hp}|${r.player.shards}`
    if (next === sig) return
    sig = next
    clear(root)

    const overlay = h('div', { class: 'overlay' })
    const sheet = h('div', { class: 'panel sheet', style: { maxWidth: '760px' } })
    const art = h('div', { style: { display: 'grid', placeItems: 'center', color: '#5b4a7a', marginTop: '-6px' } })
    art.innerHTML = glyph('event-' + ev.id, { size: 132, stroke: 'currentColor', accent: '#a184f6', detail: 1, weight: 1.1 })
    sheet.append(art, h('h2', { text: ev.name, style: { textAlign: 'center' } }), h('p', { text: ev.text }))

    if (s.eventChosen === null) {
      const opts = h('div', { class: 'options' })
      ev.options.forEach((opt, i) => {
        const enabled = !opt.require || opt.require({ shards: r.player.shards, hp: r.player.hp })
        const btn = h('button', { class: 'option' })
        btn.append(h('div', { class: 'lbl', text: opt.label }), h('div', { class: 'dt', text: opt.detail }))
        if (!enabled) btn.setAttribute('disabled', '')
        btn.addEventListener('click', () => {
          sfx.ui('click')
          chooseEventOption(i)
        })
        btn.addEventListener('pointerenter', () => sfx.ui('hover'))
        opts.append(btn)
      })
      sheet.append(opts)
    } else {
      const chosen = ev.options[s.eventChosen]
      const res = h('div', { class: `result-banner${s.eventResult?.includes('失去') && !s.eventResult?.includes('获得') ? ' bad' : ''}` })
      res.append(h('div', { style: { fontWeight: '900', marginBottom: '4px' }, text: `你选择了：${chosen.label}` }))
      res.append(h('div', { text: s.eventResult ?? '……什么也没有发生。' }))
      sheet.append(res)
      if (!s.pick) {
        const go = h('button', { class: 'btn gold', text: '继续前行' })
        go.addEventListener('click', () => {
          sfx.ui('back')
          closeEventResult()
        })
        sheet.append(h('div', { class: 'rowbtns' }, go))
      }
      if (!shownResult) {
        shownResult = true
        requestAnimationFrame(() =>
          res.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
            duration: 340,
            easing: 'cubic-bezier(.34,1.56,.64,1)',
          }),
        )
      }
    }

    overlay.append(sheet)
    root.append(overlay)
    sheet.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' })
  }

  return { el: root, update }
}
