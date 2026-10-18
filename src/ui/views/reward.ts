import { h, clear } from '../dom'
import { cardEl, chip } from '../components/ui'
import { icoShards } from '../svg/runes'
import { relicMark } from '../svg/glyph'
import { RELIC_BY_ID } from '../../core/relics'
import { ARCH_NAME } from '../../core/cards'
import { app, deckLean, leaveReward, takeRewardCard, takeRewardRelic } from '../../core/game'
import { sfx } from '../../audio/sfx'
import { burst, centerOf } from '../svg/fx'
import type { View } from './types'

export function rewardView(): View {
  const root = h('div', { class: 'screen fade-in' })
  const overlay = h('div', { class: 'overlay' })
  root.append(overlay)

  const cardEls = new Map<string, HTMLElement>()
  const relicEls = new Map<string, HTMLElement>()
  let built = false
  let lastTaken = ''

  function build(): void {
    const s = app.get()
    const o = s.offer
    const r = s.run
    if (!o || !r) return
    clear(overlay)
    cardEls.clear()
    relicEls.clear()

    const title = s.screen.t === 'reward' ? (s.screen.kind === 'elite' ? '仪典已破' : '残响散去') : '回廊'
    const sheet = h('div', { class: 'panel sheet' })
    const head = h('div', { class: 'head' }, h('h2', { text: title }), chip(icoShards(18), `+${o.shards}`, 'on-panel'))
    const pickTitle = h('h3', { text: '取走一张符卡' })
    // 奖励卡池按牌组已有的流派加权，这里明说一句，玩家才知道自己在被往哪儿推
    const lean = deckLean(r.player)
    if (lean.length) {
      pickTitle.append(
        h('span', {
          class: 'lean',
          text: `牌组倾向 · ${lean.map((a) => ARCH_NAME[a]).join(' / ')}`,
          title: '奖励卡池会优先给出与牌组流派相符的牌',
        }),
      )
    }
    sheet.append(head, pickTitle)

    const row = h('div', { class: 'cardrow' })
    for (const def of o.cards) {
      const el = cardEl(def, { variant: 'lg' })
      el.addEventListener('click', () => {
        const cur = app.get().offer
        if (!cur || cur.takenCards.length) return
        takeRewardCard(def)
        const p = centerOf(el)
        burst(p.x, p.y - 50, '#ffe9a8', 18, 1.15)
        sfx.ui('click')
      })
      el.addEventListener('pointerenter', () => sfx.ui('hover'))
      cardEls.set(def.id, el)
      row.append(el)
    }
    sheet.append(row)

    if (o.relics.length) {
      sheet.append(h('h3', { text: '圣痕' }))
      const rrow = h('div', { class: 'cardrow' })
      for (const rid of o.relics) {
        const def = RELIC_BY_ID[rid]
        if (!def) continue
        const card = h('div', {
          class: 'panel',
          style: { padding: '18px 22px', display: 'flex', gap: '14px', alignItems: 'center', maxWidth: '430px', cursor: 'pointer' },
        })
        const icon = h('div', { style: { color: def.color } })
        icon.innerHTML = relicMark(rid, 54)
        const txt = h(
          'div',
          {},
          h('div', { style: { fontSize: '18px', fontWeight: '900' }, text: def.name }),
          h('div', { style: { fontSize: '13.5px', color: 'var(--panel-sub)', lineHeight: '1.6' }, text: def.text }),
        )
        card.append(icon, txt)
        card.addEventListener('click', () => {
          const cur = app.get().offer
          if (!cur || cur.takenRelics.length) return
          takeRewardRelic(rid)
          const p = centerOf(card)
          burst(p.x, p.y, def.color, 20, 1.2)
          sfx.ui('click')
        })
        relicEls.set(rid, card)
        rrow.append(card)
      }
      sheet.append(rrow)
    }

    const leave = h('button', { class: 'btn gold', text: '回到回廊' })
    leave.addEventListener('click', () => {
      sfx.ui('back')
      leaveReward()
    })
    sheet.append(h('div', { class: 'hint', text: '每份奖励只能取走一张符卡。' }), h('div', { class: 'rowbtns' }, leave))
    overlay.append(sheet)
    sheet.animate([{ opacity: 0, transform: 'translateY(22px) scale(0.96)' }, { opacity: 1, transform: 'none' }], {
      duration: 340,
      easing: 'cubic-bezier(.34,1.56,.64,1)',
    })
  }

  function update(): void {
    const s = app.get()
    const o = s.offer
    if (!o) return
    if (!built) {
      built = true
      build()
      return
    }
    const taken = `${o.takenCards.map((c) => c.id).join(',')}|${o.takenRelics.join(',')}|${o.shards}`
    if (taken === lastTaken) return
    lastTaken = taken
    const locked = o.takenCards.length > 0
    for (const [id, el] of cardEls) {
      const isTaken = o.takenCards.some((c) => c.id === id)
      el.classList.toggle('unplayable', locked && !isTaken ? true : !locked ? false : isTaken)
      el.classList.toggle('selected', isTaken)
      el.style.pointerEvents = locked ? 'none' : 'auto'
    }
    const relicLocked = o.takenRelics.length > 0
    for (const [id, el] of relicEls) {
      const isTaken = o.takenRelics.includes(id)
      el.style.opacity = isTaken ? '0.4' : relicLocked ? '0.35' : '1'
      el.style.pointerEvents = relicLocked ? 'none' : 'auto'
    }
  }

  return { el: root, update }
}
