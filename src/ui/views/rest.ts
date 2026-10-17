import { h, clear } from '../dom'
import { glyph } from '../svg/glyph'
import { icoEnergy, icoLife } from '../svg/runes'
import { app, backToMap, restHeal, restUpgrade } from '../../core/game'
import { sfx } from '../../audio/sfx'
import type { View } from './types'

export function restView(): View {
  const root = h('div', { class: 'screen fade-in' })
  let built = false

  function update(): void {
    if (built) return
    built = true
    const s = app.get()
    const r = s.run
    if (!r) return
    const p = r.player
    const heal = Math.round(p.maxHp * (r.relics.includes('inkstone') ? 0.4 : 0.3))

    const overlay = h('div', { class: 'overlay' })
    const sheet = h('div', { class: 'panel sheet', style: { maxWidth: '700px' } })
    const art = h('div', { style: { display: 'grid', placeItems: 'center', color: '#5b4a7a' } })
    art.innerHTML = glyph('rest-site', { size: 140, stroke: 'currentColor', accent: '#abd95f', weight: 1.1 })
    sheet.append(
      art,
      h('h2', { text: '静 室', style: { textAlign: 'center' } }),
      h('p', {
        text: '一间什么都没有的房间。墙上有一道被反复描过的痕迹，桌面是干净的。你可以在这里坐一会儿，或者把某张牌刻得更深一些。',
      }),
    )

    const opts = h('div', { class: 'options' })
    const healBtn = h('button', { class: 'option' })
    healBtn.append(
      h('div', { class: 'lbl', text: `休 整  ·  回复 ${heal} 点生命` }),
      h('div', { class: 'dt', text: `当前 ${p.hp} / ${p.maxHp}` }),
    )
    healBtn.addEventListener('click', () => {
      sfx.ui('click')
      restHeal()
    })

    const upBtn = h('button', { class: 'option' })
    upBtn.append(
      h('div', { class: 'lbl', text: '铭 刻  ·  强化一张牌' }),
      h('div', { class: 'dt', text: '选中牌的所有符式数值 +2，永久生效。' }),
    )
    upBtn.addEventListener('click', () => {
      sfx.ui('click')
      restUpgrade()
    })

    const leaveBtn = h('button', { class: 'option' })
    leaveBtn.append(h('div', { class: 'lbl', text: '离 开  ·  什么也不做' }), h('div', { class: 'dt', text: '保持现状，继续前行。' }))
    leaveBtn.addEventListener('click', () => {
      sfx.ui('back')
      backToMap()
    })

    opts.append(healBtn, upBtn, leaveBtn)
    sheet.append(opts)
    overlay.append(sheet)
    root.append(overlay)
    void icoLife
    void icoEnergy
  }

  return { el: root, update }
}
