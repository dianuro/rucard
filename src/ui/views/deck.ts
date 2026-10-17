import { h, clear } from '../dom'
import { cardEl, chip } from '../components/ui'
import { icoDeck, icoShards } from '../svg/runes'
import { app, backToMap, cancelPick, pickCard } from '../../core/game'
import { ARCH_NAME } from '../../core/cards'
import { sfx } from '../../audio/sfx'
import type { CardInst } from '../../core/types'
import type { View } from './types'

const PURPOSE_TEXT: Record<string, { title: string; sub: string }> = {
  remove: { title: '抹 去 一 张 牌', sub: '点击要抹去的牌 —— 它会被永久删除。' },
  upgrade: { title: '铭 刻 一 张 牌', sub: '点击要强化的牌 —— 其所有符式数值 +2。' },
  duplicate: { title: '抄 写 一 张 牌', sub: '点击要复制的牌 —— 你会得到它的另一个副本。' },
}

export function deckView(): View {
  const root = h('div', { class: 'screen fade-in' })
  let sig = ''

  function update(): void {
    const s = app.get()
    const r = s.run
    if (!r) return
    const pick = s.pick
    const all = [...r.player.drawPile, ...r.player.hand, ...r.player.discardPile]
    const next = `${pick?.purpose ?? 'view'}|${all.length}|${all.map((c) => c.uid + c.bonus).join(',')}`
    if (next === sig) return
    sig = next
    clear(root)

    const overlay = h('div', { class: 'overlay' })
    const sheet = h('div', { class: 'panel sheet' })
    const info = pick ? PURPOSE_TEXT[pick.purpose] : { title: '牌 组', sub: '全部符卡。' }
    const head = h('div', { class: 'head' }, h('h2', { text: info.title }), h('div', { class: 'sub', text: info.sub }))
    const shardChip = chip(icoShards(18), String(r.player.shards), 'on-panel')
    const deckIcon = h('div', { class: 'sub' })
    deckIcon.innerHTML = icoDeck(18)
    deckIcon.style.color = 'var(--panel-sub)'
    head.append(h('div', { style: { flex: '1' } }), shardChip, deckIcon, h('span', { class: 'sub', text: `${all.length} 张` }))
    sheet.append(head)

    const groups: Record<string, CardInst[]> = {}
    for (const c of all) (groups[c.arch] ??= []).push(c)

    const scroll = h('div', { class: 'scroll', style: { maxHeight: '58vh' } })
    for (const arch of ['rift', 'loop', 'reso', 'none']) {
      const list = groups[arch]
      if (!list?.length) continue
      const label = h('h3', { style: { marginTop: '10px' }, text: `${ARCH_NAME[arch as keyof typeof ARCH_NAME]} · ${list.length}` })
      scroll.append(label)
      const grid = h('div', { class: 'deck-scroll' })
      for (const c of list) {
        const el = cardEl(c, {
          variant: 'mini',
          playable: !!pick,
          onClick: pick
            ? () => {
                sfx.ui('click')
                pickCard(c.uid)
              }
            : undefined,
        })
        if (pick) el.style.cursor = 'pointer'
        grid.append(el)
      }
      scroll.append(grid)
    }
    sheet.append(scroll)

    const btns = h('div', { class: 'rowbtns' })
    if (pick) {
      const cancel = h('button', { class: 'btn ghost', text: '取消' })
      cancel.addEventListener('click', () => {
        sfx.ui('back')
        cancelPick()
      })
      btns.append(cancel)
    } else {
      const back = h('button', { class: 'btn gold', text: '返回' })
      back.addEventListener('click', () => {
        sfx.ui('back')
        const st = app.get()
        if (st.battle) app.act((x) => void (x.screen = { t: 'battle' }))
        else backToMap()
      })
      btns.append(back)
    }
    sheet.append(btns)
    overlay.append(sheet)
    root.append(overlay)
  }

  return { el: root, update }
}
