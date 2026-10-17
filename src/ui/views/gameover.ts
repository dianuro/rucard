import { h, clear } from '../dom'
import { cardEl } from '../components/ui'
import { glyph } from '../svg/glyph'
import { app, newRun, toTitle } from '../../core/game'
import { sfx } from '../../audio/sfx'
import type { View } from './types'

export function gameoverView(): View {
  const root = h('div', { class: 'screen fade-in' })
  let built = false

  function update(): void {
    if (built) return
    built = true
    const s = app.get()
    if (s.screen.t !== 'gameover') return
    const win = s.screen.win
    document.body.dataset.mood = win ? 'win' : 'lose'
    clear(root)

    const r = s.run
    const wrap = h('div', { class: `gameover ${win ? 'win' : 'lose'}` })
    const art = h('div', { style: { display: 'grid', placeItems: 'center', color: win ? '#f2bc46' : '#6a55c9', width: 'min(300px, 42vh)' } })
    art.innerHTML = glyph(win ? 'first-word-read' : 'unfinished-scribe', {
      size: 300,
      stroke: 'currentColor',
      accent: win ? '#f0708f' : '#a184f6',
      weight: 1.2,
      detail: 1,
    })
    wrap.append(art)
    wrap.append(h('h1', { text: win ? '读 完 了' : '写 不 下 去' }))
    wrap.append(
      h('div', {
        class: 'stats',
        text: win
          ? '最后一个字被你合上了。回廊安静下来，安静得像一整页空白。'
          : '笔断了。你写下的东西还在，只是不再有人继续写。',
      }),
    )

    if (r) {
      const all = [...r.player.drawPile, ...r.player.hand, ...r.player.discardPile]
      wrap.append(
        h('div', {
          class: 'stats',
          text: `抵达深度 ${r.depth + 1} / 15 · 碎片 ${r.player.shards} · 圣痕 ${r.relics.length} · 符卡 ${all.length}`,
        }),
      )
      if (all.length) {
        const grid = h('div', { class: 'deck-scroll scroll', style: { maxHeight: '26vh', maxWidth: '900px' } })
        for (const c of all) grid.append(cardEl(c, { variant: 'mini' }))
        wrap.append(grid)
      }
    }

    const btns = h('div', { class: 'title-btns' })
    const again = h('button', { class: 'btn gold', text: '再 进 一 次' })
    again.addEventListener('click', () => {
      sfx.ui('click')
      newRun()
    })
    const home = h('button', { class: 'btn ghost', text: '回到标题' })
    home.addEventListener('click', () => {
      sfx.ui('back')
      toTitle()
    })
    btns.append(again, home)
    wrap.append(btns)

    root.append(wrap)
  }

  return { el: root, update }
}
