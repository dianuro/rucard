import { h, clear } from '../dom'
import { cardEl, chip } from '../components/ui'
import { icoShards } from '../svg/runes'
import { RELIC_BY_ID } from '../../core/relics'
import { app, buyItem, buyRemoval, leaveShop } from '../../core/game'
import { sfx } from '../../audio/sfx'
import { burst, centerOf } from '../svg/fx'
import type { View } from './types'

export function shopView(): View {
  const root = h('div', { class: 'screen fade-in' })
  const overlay = h('div', { class: 'overlay' })
  root.append(overlay)
  let sig = ''

  function update(): void {
    const s = app.get()
    const shop = s.shop
    const r = s.run
    if (!shop || !r) return
    const next = `${r.player.shards}|${shop.items.map((i) => i.sold).join(',')}|${shop.removals}`
    if (next === sig) return
    sig = next
    clear(overlay)

    const sheet = h('div', { class: 'panel sheet' })
    sheet.append(
      h(
        'div',
        { class: 'head' },
        h('h2', { text: '市 集' }),
        chip(icoShards(18), String(r.player.shards), 'on-panel'),
        h('div', { style: { flex: '1' } }),
      ),
    )
    sheet.append(h('p', { text: '一个没有摊主的摊位。价格写在纸牌背面，付款方式写在你的口袋深度里。' }))

    const grid = h('div', { class: 'shopgrid' })
    shop.items.forEach((it, i) => {
      const wrap = h('div', { class: `shop-item${it.sold ? ' sold' : ''}` })
      if (it.kind === 'card' && it.card) {
        const el = cardEl(it.card, { variant: 'lg' })
        el.addEventListener('click', () => {
          if (it.sold) return
          const before = app.get().run!.player.shards
          buyItem(i)
          if (app.get().run!.player.shards !== before) {
            const p = centerOf(el)
            burst(p.x, p.y - 40, '#5fd4c4', 14, 1)
          }
        })
        el.addEventListener('pointerenter', () => sfx.ui('hover'))
        wrap.append(el)
      } else if (it.kind === 'relic' && it.relic) {
        const def = RELIC_BY_ID[it.relic]
        const box = h('div', {
          class: 'panel',
          style: {
            width: '176px',
            height: '250px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            textAlign: 'center',
            cursor: 'pointer',
          },
        })
        const ico = h('div', { style: { color: def.color } })
        ico.innerHTML = `<svg viewBox="0 0 100 100" width="92" height="92" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"><circle cx="50" cy="50" r="36" stroke-dasharray="8 7"/><path d="M50 18 L66 50 L50 82 L34 50 Z"/><path d="M50 36 L50 64" stroke-width="2.4"/><circle cx="50" cy="50" r="7" fill="currentColor" stroke="none" opacity=".8"/></svg>`
        box.append(ico, h('div', { style: { fontSize: '17px', fontWeight: '900' }, text: def.name }), h('div', { style: { fontSize: '12.5px', color: 'var(--panel-sub)', lineHeight: '1.55' }, text: def.text }))
        box.addEventListener('click', () => {
          if (it.sold) return
          const before = app.get().run!.player.shards
          buyItem(i)
          if (app.get().run!.player.shards !== before) {
            const p = centerOf(box)
            burst(p.x, p.y, def.color, 18, 1.15)
          }
        })
        wrap.append(box)
      }
      const price = h('div', { class: 'price' })
      price.innerHTML = icoShards(16)
      price.append(h('span', { text: it.sold ? '已售出' : String(it.price) }))
      wrap.append(price)
      grid.append(wrap)
    })
    sheet.append(grid)

    const rm = h('button', { class: 'option', style: { maxWidth: '520px' } })
    rm.append(
      h('div', { class: 'lbl', text: `抹 去  ·  删除一张牌（${shop.removalPrice} 碎片）` }),
      h('div', { class: 'dt', text: `本店已抹去 ${shop.removals} 次，价格会持续上涨。` }),
    )
    if (r.player.shards < shop.removalPrice) rm.setAttribute('disabled', '')
    rm.addEventListener('click', () => {
      sfx.ui('click')
      buyRemoval()
    })
    sheet.append(h('h3', { text: '抹 去' }), rm)

    const leave = h('button', { class: 'btn gold', text: '离开市集' })
    leave.addEventListener('click', () => {
      sfx.ui('back')
      leaveShop()
    })
    sheet.append(h('div', { class: 'rowbtns' }, leave))
    overlay.append(sheet)
  }

  return { el: root, update }
}
