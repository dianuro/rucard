import { h, clear } from '../dom'
import { backgroundMandala } from '../svg/sigilRing'
import { glyph } from '../svg/glyph'
import { SYM_ICON } from '../svg/runes'
import { sfx } from '../../audio/sfx'
import { app, clearSave, continueRun, loadSave, newRun } from '../../core/game'
import type { View } from './types'
import { openModal } from './modal'
import { KIND_DESC, KIND_NAME } from '../../core/combat'

export function titleView(): View {
  const root = h('div', { class: 'title-screen fade-in' })

  const sig = h('div', { class: 'title-sigil' })
  const r1 = h('div', { class: 'r1' })
  const r2 = h('div', { class: 'r2' })
  const r3 = h('div', { class: 'r3' })
  r1.innerHTML = glyph('rucard-title-outer', { stroke: 'currentColor', weight: 1.5, detail: 1, size: 320 })
  r2.innerHTML = glyph('rucard-title-inner', { stroke: 'currentColor', weight: 1.2, detail: 0.9, size: 320, rotate: 18 })
  r3.innerHTML = glyph('rucard-title-core', { stroke: 'currentColor', weight: 1, detail: 0.7, size: 320, rotate: -30 })
  sig.append(r2, r1, r3)

  const hasSave = !!loadSave()
  const contBtn = h('button', { class: 'btn teal', text: '继续回廊' })
  const newBtn = h('button', { class: 'btn gold', text: '进入回廊' })
  const ruleBtn = h('button', { class: 'btn ghost', text: '规则' })

  contBtn.addEventListener('click', () => {
    sfx.ui('click')
    if (!continueRun()) newRun()
  })
  newBtn.addEventListener('click', () => {
    sfx.ui('click')
    const sv = loadSave()
    if (sv) {
      const ok = h('button', { class: 'btn rose', text: '覆盖并重开' })
      const no = h('button', { class: 'btn ghost', text: '取消' })
      const bg = h('div', { class: 'modal-bg' })
      const sheet = h(
        'div',
        { class: 'panel sheet', style: { maxWidth: '460px' } },
        h('h2', { text: '还有一份未完成的抄本' }),
        h('p', { text: '开始新的回廊会抹去现有的进度。' }),
        h('div', { class: 'rowbtns' }, no, ok),
      )
      bg.append(sheet)
      no.addEventListener('click', () => bg.remove())
      ok.addEventListener('click', () => {
        bg.remove()
        clearSave()
        newRun()
      })
      document.body.append(bg)
      return
    }
    newRun()
  })
  ruleBtn.addEventListener('click', () => {
    sfx.ui('click')
    const body = h('div', { style: { maxHeight: '60vh' } , class: 'scroll' })
    body.append(
      h('h3', { text: '一 · 对撞' }),
      h('p', {
        text: '你在一回合内打出的所有牌，会按顺序「编入阵型」，符式从下标 0 开始占据位置。敌方也会亮出一串意图符式。结算时，下标相同的两个符式互相作用 —— 多出来的一侧则无人阻拦地直接命中。编入顺序，就是你的战术。',
      }),
    )
    const list = h('div', { style: { marginTop: '10px' } })
    for (const k of ['rift', 'ward', 'echo', 'pierce', 'link', 'spiral'] as const) {
      const t = h('div', { class: 'sym-tip on-panel' })
      t.innerHTML = SYM_ICON[k](24)
      const box = h('div', { class: 't' })
      box.append(h('b', { text: `${KIND_NAME[k]}  ` }), document.createTextNode(KIND_DESC[k]))
      t.append(box)
      list.append(t)
    }
    body.append(h('h3', { text: '二 · 六种符式', style: { marginTop: '14px' } }), list)
    body.append(
      h('h3', { text: '三 · 僵直', style: { marginTop: '14px' } }),
      h('p', {
        text: '伤害会累积「破绽」。破绽填满韧性条时敌人进入僵直：跳过下回合的行动，并且受到的伤害提高 50%。每次僵直后，韧性阈值都会提高。',
      }),
      h('h3', { text: '四 · 护盾', style: { marginTop: '14px' } }),
      h('p', {
        text: '「铸」会先于同下标的攻击落地成护盾，抵挡该下标及之后的一切来袭；对撞结束时护盾清空。对撞胜出会额外累积破绽，所以用低值符式去换掉对方的高值是划算的。',
      }),
      h('h3', { text: '五 · 操作', style: { marginTop: '14px' } }),
      h('p', { text: '点击手牌选中 → 再次点击该牌或点击战场打出。悬停任意手牌可查看预演结果。' }),
      h('div', { style: { marginTop: '8px' }, html: '<span class="kbd">1-9</span> 选牌 · <span class="kbd">空格</span> 结束回合 · <span class="kbd">D</span> 牌组 · <span class="kbd">M</span> 静音' }),
    )
    openModal('规则', '符铭回廊', body)
  })

  const btns = h('div', { class: 'title-btns' }, hasSave ? contBtn : null, newBtn, ruleBtn)

  root.append(
    sig,
    h('h1', { class: 'title-h', text: '符 铭 回 廊' }),
    h('div', { class: 'title-sub', text: 'SIGIL CLASH' }),
    h('div', {
      class: 'title-desc',
      text: '你是一位没有名字的抄写者。回廊里没有生物，没有面孔，只有印、环、数与裂 —— 它们排成行，等着和你写下的东西逐位相撞。',
    }),
    btns,
  )

  const bg = document.getElementById('bg')
  if (bg && !bg.querySelector('.rings')) {
    const rings = h('div', { class: 'rings' })
    rings.innerHTML = backgroundMandala()
    bg.append(rings)
  }

  return {
    el: root,
    update() {
      /* 标题页无需增量刷新 */
    },
  }
}
