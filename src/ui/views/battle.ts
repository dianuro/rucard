import { h, anim, clear, wait } from '../dom'
import { barEl, cardEl, chip, slotEl } from '../components/ui'
import { STAGGER_MULT, cardSyms, formationSummary, intentSyms, symIsAtk } from '../../core/combat'
import { RELIC_BY_ID } from '../../core/relics'
import { STAGGER_INTENT } from '../../core/game'
import type { ClashStep } from '../../core/combat'
import type { CardInst, Sym } from '../../core/types'
import { enemySigil, orbitMarks } from '../svg/sigilRing'
import { banner, burst, centerOf, floatText, ringFx, shake, shatter } from '../svg/fx'
import { icoBlock, icoDeck, icoEnergy, icoLife, icoMap, icoShards, icoSound } from '../svg/runes'
import { sfx } from '../../audio/sfx'
import {
  app,
  applyClashStep,
  battleLost,
  battleWon,
  cardCost,
  enemyPhase,
  playCard,
  prepareClash,
  preview,
  save,
  settleClash,
  startPlayerTurn,
  toggleMute,
} from '../../core/game'
import type { View } from './types'
import { openModal } from './modal'

const PITCH = 74
const KIND_HEX: Record<string, string> = {
  rift: '#ef6c8f',
  ward: '#5fd4c4',
  echo: '#b58cf7',
  pierce: '#f2bc46',
  link: '#abd95f',
  spiral: '#7fb0f7',
}

export function battleView(): View {
  let selected: string | null = null
  let hovered: string | null = null
  let busy = false
  let handSig = ''
  let intentSig = ''
  let formSig = ''
  let relicSig = ''
  const formationEls = new Map<number, HTMLElement>()
  const intentEls = new Map<number, HTMLElement>()

  const root = h('div', { class: 'battle fade-in' })

  /* ── 顶栏 ── */
  const lifeChip = chip(icoLife(19), '0/0', 'life')
  const energyChip = chip(icoEnergy(19), '0/0', 'energy')
  const shardChip = chip(icoShards(19), '0', 'shards')
  const relicStrip = h('div', { class: 'relic-strip' })
  const deckBtn = h('button', { class: 'btn sm ghost', title: '查看牌组 (D)' })
  deckBtn.innerHTML = icoDeck(16) + '<span>牌组</span>'
  const mapBtn = h('button', { class: 'btn sm ghost', title: '返回回廊' })
  mapBtn.innerHTML = icoMap(16) + '<span>回廊</span>'
  const soundBtn = h('button', { class: 'btn sm ghost', title: '静音 (M)' })
  soundBtn.innerHTML = icoSound(true, 16)

  const topbar = h(
    'div',
    { class: 'topbar' },
    lifeChip,
    energyChip,
    shardChip,
    relicStrip,
    h('div', { class: 'spacer' }),
    deckBtn,
    mapBtn,
    soundBtn,
  )
  root.append(topbar)

  /* ── 战场 ── */

  // 左：敌方铭牌。与中央符阵分离，让符阵拿满纵向空间。
  const sigilEl = h('div', { class: 'enemy-sigil' })
  const enemyName = h('div', { class: 'enemy-name' })
  const enemyTitle = h('div', { class: 'enemy-title' })
  const hpBar = barEl('hp', '生命 {}')
  const poiseBar = barEl('poise', '韧性 {}')
  const badgeWrap = h('div', { class: 'bar-wrap' })
  const bars = h('div', { class: 'bars' }, h('div', { class: 'bar-wrap' }, hpBar.root), h('div', { class: 'bar-wrap' }, poiseBar.root), badgeWrap)
  const enemyPlate = h(
    'div',
    { class: 'enemy-plate' },
    h('div', { class: 'ep-kind', text: '符阵造物' }),
    enemyName,
    enemyTitle,
    bars,
  )

  const enemyZone = h('div', { class: 'enemy-zone', title: '点击此处打出选中的牌' }, sigilEl, enemyPlate)

  const axisCount = h('div', { class: 'count' })
  const axisGlyph = h('div', { class: 'glyphph' })
  axisGlyph.innerHTML = `<svg viewBox="0 0 40 40" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 5 L33 20 L20 35 L7 20 Z"/><path d="M20 12 L27 20 L20 28 L13 20 Z" stroke-width="2"/></svg>`
  const axis = h('div', { class: 'axis' }, h('div', { class: 'rail' }), axisGlyph, axisCount)

  // 中：敌方意图与己方阵型共用同一组下标列，逐位对撞才在视觉上成立。
  const intentName = h('div', { class: 'intent-name' })
  const intentLine = h('div', { class: 'line abs' })
  const intentWrap = h('div', { class: 'intent-wrap' }, intentName, intentLine)

  const formLine = h('div', { class: 'line abs' })
  const formZone = h('div', { class: 'formation-zone', title: '点击此处打出选中的牌' }, formLine)

  const board = h('div', { class: 'board' }, intentWrap, axis, formZone)

  const forecast = h('div', { class: 'forecast', style: { display: 'none' } })
  const battleLog = h('div', { class: 'battle-log' })
  const tipbar = h('div', { class: 'tipbar' })

  const field = h('div', { class: 'field' }, enemyZone, board, forecast, battleLog, tipbar)
  root.append(field)

  /* ── 手牌区 ── */
  const hand = h('div', { class: 'hand' })
  const drawPileEl = h('button', { class: 'pile', title: '抽牌堆' })
  const discardPileEl = h('button', { class: 'pile', title: '弃牌堆' })
  const exhaustPileEl = h('button', { class: 'pile', title: '已消耗' })
  const piles = h('div', { class: 'piles' }, drawPileEl, discardPileEl, exhaustPileEl)
  const endBtn = h('button', { class: 'btn gold endturn' })
  endBtn.innerHTML = '<span>结束回合</span><span class="kbd">空格</span>'
  const handZone = h('div', { class: 'hand-zone' }, hand, piles, endBtn)
  root.append(handZone)

  /* ─────────── 事件 ─────────── */

  endBtn.addEventListener('click', () => void runClashSequence())
  mapBtn.addEventListener('click', () => {
    if (busy) return
    app.act((st) => void (st.screen = { t: 'map' }))
  })
  deckBtn.addEventListener('click', () => {
    if (busy) return
    app.act((st) => void (st.screen = { t: 'deck' }))
  })
  soundBtn.addEventListener('click', toggleMute)
  drawPileEl.addEventListener('click', () => showPile('抽牌堆', 'drawPile'))
  discardPileEl.addEventListener('click', () => showPile('弃牌堆', 'discardPile'))
  exhaustPileEl.addEventListener('click', () => showPile('已消耗', 'exhaustPile'))
  enemyZone.addEventListener('click', () => selected && confirmPlay(selected))
  formZone.addEventListener('click', () => selected && confirmPlay(selected))

  function showPile(title: string, key: 'drawPile' | 'discardPile' | 'exhaustPile'): void {
    const s = app.get()
    if (!s.run) return
    sfx.ui('click')
    const list = s.run.player[key]
    const grid = h('div', { class: 'deck-scroll scroll', style: { maxHeight: '60vh' } })
    for (const c of list) grid.append(cardEl(c, { variant: 'mini' }))
    if (!list.length) grid.append(h('div', { class: 'hint', text: '空。' }))
    openModal(title, `${list.length} 张`, grid)
  }

  function selectCard(uid: string): void {
    if (busy) return
    const s = app.get()
    if (!s.battle || s.battle.phase !== 'player') return
    selected = selected === uid ? null : uid
    hovered = null
    if (selected) sfx.ui('click')
    update()
  }

  function confirmPlay(uid: string): void {
    if (busy) return
    const b = app.get().battle
    if (!b || b.phase !== 'player') return
    const el = hand.querySelector<HTMLElement>(`.card[data-uid="${uid}"]`)
    if (el) {
      el.animate(
        [
          { transform: 'translateY(-26px) scale(1.08)', opacity: 1 },
          { transform: 'translateY(70px) scale(0.5) rotate(-8deg)', opacity: 0 },
        ],
        { duration: 230, easing: 'cubic-bezier(.4,0,.7,.4)', fill: 'forwards' },
      )
    }
    const before = b.formation.length
    selected = null
    hovered = null
    const ok = playCard(uid)
    if (ok) {
      sfx.ui('click')
      requestAnimationFrame(() => {
        update()
        const added = (app.get().battle?.formation.length ?? 0) - before
        for (let i = 0; i < added; i++) {
          const el2 = formationEls.get(before + i)
          if (el2) {
            anim(
              el2,
              [
                { transform: `${el2.style.transform} scale(0.2) rotate(-30deg)`, opacity: 0 },
                { transform: `${el2.style.transform} scale(1.18) rotate(5deg)`, opacity: 1, offset: 0.65 },
                { transform: el2.style.transform, opacity: 1 },
              ],
              { duration: 380, delay: i * 60, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' },
            )
          }
        }
      })
    }
  }

  /* ─────────── 对撞演出 ─────────── */

  async function runClashSequence(): Promise<void> {
    const s0 = app.get()
    const b = s0.battle
    if (!b || busy || b.phase !== 'player') return
    busy = true
    selected = null
    hovered = null
    endBtn.setAttribute('disabled', '')
    update()
    sfx.ui('click')

    const steps = prepareClash()
    update()
    await wait(200)
    const enemyPos = centerOf(sigilEl)
    const axisPos = centerOf(axis)

    for (const step of steps) {
      await playStep(step, enemyPos, axisPos)
      applyClashStep(step)
      update()
      await wait(50)
    }

    const { won, lost } = settleClash()
    update()

    if (won) {
      await victorySequence()
      busy = false
      battleWon()
      return
    }
    if (lost) {
      await defeatSequence()
      busy = false
      battleLost()
      return
    }

    await wait(240)
    if (app.get().pending?.staggered) {
      banner('僵 直', 'stagger-banner', 1250)
      sigilEl.classList.add('staggered')
      sfx.stagger()
      await wait(760)
    }
    enemyPhase()
    update()
    await wait(360)
    startPlayerTurn()
    update()
    sigilEl.classList.toggle('staggered', (app.get().battle?.enemy.stagger ?? 0) > 0)
    banner(`第 ${app.get().battle!.turn} 回合`, 'turn-banner', 880)
    sfx.draw()
    busy = false
    update()
    saveSafe()
  }

  async function playStep(step: ClashStep, enemyPos: { x: number; y: number }, axisPos: { x: number; y: number }): Promise<void> {
    const aEl = formationEls.get(step.i)
    const bEl = intentEls.get(step.i)
    const a = step.a
    const b = step.b
    if (!a && !b) return

    if (a && b) {
      const bothAtk = symIsAtk(a.k) && symIsAtk(b.k)
      const ap = aEl ? centerOf(aEl) : axisPos
      const bp = bEl ? centerOf(bEl) : axisPos
      const dx = axisPos.x - ap.x
      const dy = axisPos.y - ap.y
      const ex = axisPos.x - bp.x
      const ey = axisPos.y - bp.y
      const T = (x: number, y: number, s: number) => `translate(${x}px,${y}px) scale(${s})`

      if (bothAtk) {
        aEl?.animate([{ transform: T(0, 0, 1) }, { transform: T(dx * 0.18, dy * 0.18, 1.2) }], {
          duration: 110, fill: 'forwards', easing: 'cubic-bezier(.3,0,.6,1)',
        })
        bEl?.animate([{ transform: T(0, 0, 1) }, { transform: T(ex * 0.18, ey * 0.18, 1.2) }], {
          duration: 110, fill: 'forwards', easing: 'cubic-bezier(.3,0,.6,1)',
        })
        await wait(96)
      }
      aEl?.animate([{ transform: T(dx * 0.18, dy * 0.18, 1.2) }, { transform: T(dx, dy, 0.9) }], {
        duration: 150, fill: 'forwards', easing: 'cubic-bezier(.7,0,.9,.4)',
      })
      bEl?.animate([{ transform: T(ex * 0.18, ey * 0.18, 1.2) }, { transform: T(ex, ey, 0.9) }], {
        duration: 150, fill: 'forwards', easing: 'cubic-bezier(.7,0,.9,.4)',
      })
      await wait(146)

      const power = bothAtk ? Math.max(a.v, b.v) : Math.max(a.v, b.v) * 0.6
      sfx.clash(step.outcome === 'clash-win', step.outcome === 'clash-tie', power)
      ringFx(axisPos.x, axisPos.y, bothAtk ? '#ffe9a8' : '#c9b6ff', 12, bothAtk ? 200 : 128, 500, bothAtk ? 6 : 4)
      burst(axisPos.x, axisPos.y, step.clashWin ? '#ffe9a8' : a.k === 'ward' ? '#8ef0e2' : '#d9c6ff', bothAtk ? 18 : 10, bothAtk ? 1.3 : 0.8)
      shake(bothAtk ? Math.min(0.5 + power / 13, 1.5) : 0.34)
      await wait(64)

      const gone = (el: HTMLElement | undefined, x: number, y: number, up: boolean, ms: number) => {
        if (!el) return
        el.animate(
          [{ opacity: 1 }, { opacity: 0, transform: T(x, y + (up ? -30 : 0), 1.35) }],
          { duration: ms, fill: 'forwards', easing: 'cubic-bezier(.2,.7,.4,1)' },
        )
      }
      if (step.outcome === 'clash-win') {
        if (bEl) shatter(bp.x + ex, bp.y + ey, '#b9a6e8', 12)
        gone(aEl, dx, dy, true, 300)
        gone(bEl, ex, ey, false, 220)
      } else if (step.outcome === 'clash-lose') {
        if (aEl) shatter(ap.x + dx, ap.y + dy, '#f0a8bd', 12)
        gone(aEl, dx, dy, false, 220)
        gone(bEl, ex, ey, true, 300)
      } else if (step.outcome === 'clash-tie') {
        shatter(ap.x + dx, ap.y + dy, '#f0a8bd', 11)
        shatter(bp.x + ex, bp.y + ey, '#b9a6e8', 11)
        gone(aEl, dx, dy, false, 260)
        gone(bEl, ex, ey, false, 260)
      } else {
        gone(aEl, dx * 0.5, dy * 0.5, false, 300)
        gone(bEl, ex * 0.5, ey * 0.5, false, 300)
      }

      if (step.shown.toPlayer) floatText(axisPos.x + 140, axisPos.y + 6, `-${step.shown.toPlayer}`, 'hurt', { dx: -24, delay: 50 })
      if (step.shown.toEnemy) floatText(axisPos.x - 140, axisPos.y - 6, `-${step.shown.toEnemy}`, 'onward', { dx: 24, delay: 50, scale: 1 })
      if (step.outcome === 'echo') floatText(axisPos.x, axisPos.y - 46, '反 击', 'counter', { scale: 0.85, dy: -54 })
      if (step.outcome === 'clash-win') floatText(axisPos.x, axisPos.y - 46, '抵 消', 'shield', { scale: 0.78, dy: -50 })
      if (step.player.block && step.player.block > 0) {
        floatText(axisPos.x + 168, axisPos.y + 40, `+${step.player.block}`, 'shield', { dy: -42 })
        sfx.block()
      } else if (step.enemy.block && step.enemy.block > 0) {
        floatText(axisPos.x - 168, axisPos.y - 40, `铸 ${step.enemy.block}`, 'shield', { dy: -38, scale: 0.8 })
        sfx.block()
      }
      await wait(230)
      return
    }

    // ── 单侧结算
    const el = a ? aEl : bEl
    const dest = a ? enemyPos : { x: axisPos.x, y: axisPos.y + 80 }
    if (el) {
      const p = centerOf(el)
      el.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${dest.x - p.x}px,${dest.y - p.y}px) scale(1.28)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${(dest.x - p.x) * 0.45}px,${(dest.y - p.y) * 0.7}px) scale(0.35)`, opacity: 0 },
        ],
        { duration: 400, fill: 'forwards', easing: 'cubic-bezier(.4,0,.2,1)' },
      )
    }
    await wait(240)

    if (a) {
      if (symIsAtk(a.k)) {
        sfx.hit(Math.min(4, a.v / 3))
        burst(enemyPos.x, enemyPos.y, '#ffd7e2', 13, 0.95)
        ringFx(enemyPos.x, enemyPos.y, '#ff9fb8', 22, 158, 440, 4)
        jolt()
        shake(0.4)
      } else if (a.k === 'echo') {
        sfx.echo()
        burst(enemyPos.x, enemyPos.y, '#c9a8ff', 14, 1)
        ringFx(enemyPos.x, enemyPos.y, '#b58cf7', 22, 140, 460, 4)
        jolt()
      } else {
        sfx.block()
        ringFx(axisPos.x, axisPos.y, '#8ef0e2', 22, 128, 440, 4)
      }
    } else if (b) {
      sfx.hit(3)
      shake(0.55)
      ringFx(axisPos.x, axisPos.y + 70, '#ff9fb8', 22, 158, 440, 4)
      burst(axisPos.x, axisPos.y + 70, '#ff9fb8', 12, 0.9)
    }

    if (step.shown.toEnemy) floatText(enemyPos.x + rnd(-50, 50), enemyPos.y - 20, `-${step.shown.toEnemy}`, 'onward')
    if (step.shown.toPlayer) floatText(axisPos.x + rnd(-40, 40), axisPos.y + 46, `-${step.shown.toPlayer}`, 'hurt')
    if (step.player.block && step.player.block > 0) floatText(axisPos.x + 110, axisPos.y + 16, `+${step.player.block}`, 'shield', { dy: -42 })
    if (step.enemy.block && step.enemy.block > 0 && !a) floatText(enemyPos.x, enemyPos.y - 52, `铸 ${step.enemy.block}`, 'shield', { dy: -38, scale: 0.8 })
    await wait(190)
  }

  function jolt(): void {
    sigilEl.classList.remove('hurt')
    void sigilEl.offsetWidth
    sigilEl.classList.add('hurt')
    window.setTimeout(() => sigilEl.classList.remove('hurt'), 470)
  }

  async function victorySequence(): Promise<void> {
    const p = centerOf(sigilEl)
    const cols = ['#ffe9a8', '#f2bc46', '#5fd4c4', '#f0708f', '#a184f6']
    for (let i = 0; i < cols.length; i++) {
      ringFx(p.x, p.y, cols[i], 30, 300 + i * 70, 900, 5)
      await wait(85)
    }
    shatter(p.x, p.y, '#f2bc46', 28)
    burst(p.x, p.y, '#ffe9a8', 28, 1.7)
    shake(1.1)
    sigilEl.animate([{ opacity: 1, transform: 'scale(1) rotate(0)' }, { opacity: 0, transform: 'scale(1.8) rotate(35deg)' }], {
      duration: 760, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards',
    })
    banner('崩 解', 'stagger-banner', 1150)
    await wait(1080)
  }

  async function defeatSequence(): Promise<void> {
    shake(1.7)
    const p = centerOf(sigilEl)
    burst(p.x, p.y, '#ef6c8f', 24, 1.5)
    await wait(950)
  }

  /* ─────────── 渲染 ─────────── */

  function renderLine(
    container: HTMLElement,
    syms: (Sym | null)[],
    side: 'player' | 'enemy',
    cache: Map<number, HTMLElement>,
    ghosts: (Sym | null)[] = [],
  ): void {
    const n = syms.length + ghosts.length
    container.style.width = `${Math.max(n, 1) * PITCH - 8}px`
    clear(container)
    cache.clear()
    for (let i = 0; i < n; i++) {
      const isGhost = i >= syms.length
      const s = isGhost ? ghosts[i - syms.length] : syms[i]
      const el = slotEl(s, side)
      if (isGhost) el.classList.add('ghostly')
      el.style.transform = `translateX(${i * PITCH}px)`
      container.append(el)
      if (!isGhost) cache.set(i, el)
    }
  }

  function renderForecast(el: HTMLElement, uid: string, hoverOnly: boolean): void {
    const s = app.get()
    const b = s.battle
    const r = s.run
    if (!b || !r) return
    const card = r.player.hand.find((c) => c.uid === uid)
    if (!card) {
      el.style.display = 'none'
      return
    }
    const cost = cardCost(card)
    const affordable = r.player.energy >= cost
    const base = preview()
    const after = preview((f) => {
      f.push(...cardSyms(card as CardInst))
    })

    el.style.display = 'flex'
    clear(el)
    el.append(h('h4', { text: hoverOnly ? '预 演 · 悬停' : '预 演' }))
    const row = (k: string, v: string, cls = '') => {
      el.append(h('div', { class: 'row' }, h('div', { class: 'k', text: k }), h('div', { class: `v ${cls}`, text: v })))
    }
    row('编入后阵型', `${b.formation.length} → ${b.formation.length + cardSyms(card as CardInst).length} 位`)
    row('灵光', `${cost} 点`, affordable ? '' : 'bad')
    const dmg = Math.max(0, b.enemy.hp - after.enemyHp)
    const hpLoss = Math.max(0, r.player.hp - after.playerHp)
    row('对敌方造成', dmg > 0 ? `${dmg}` : '—', dmg > 0 ? 'good' : '')
    row('自身承受', hpLoss > 0 ? `${hpLoss}` : '无伤', hpLoss > 0 ? 'bad' : 'good')
    if (after.playerBlock > 0) row('铸盾', `+${after.playerBlock}`, 'warn')
    if (after.clashWins > 0) row('对撞胜出', `${after.clashWins} 次`, 'good')
    if (after.staggered && !base.staggered) row('将触发', '僵 直', 'warn')
    if (b.enemy.stagger > 0) row('僵直加成', `伤害 ×${STAGGER_MULT}`, 'warn')
  }

  function update(): void {
    const s = app.get()
    const b = s.battle
    const r = s.run
    if (!b || !r) return
    const p = r.player

    document.body.dataset.mood = b.enemy.def.kind === 'boss' ? 'boss' : 'battle'

    lifeChip.querySelector('.val')!.textContent = `${Math.max(0, p.hp)}/${p.maxHp}`
    lifeChip.classList.toggle('low', p.hp <= p.maxHp * 0.3)
    energyChip.querySelector('.val')!.textContent = `${p.energy}/${p.maxEnergy}`
    shardChip.querySelector('.val')!.textContent = String(p.shards)
    soundBtn.innerHTML = icoSound(!s.muted, 16)

    const rsig = r.relics.join(',')
    if (relicSig !== rsig) {
      relicSig = rsig
      clear(relicStrip)
      for (const rid of r.relics) {
        const def = RELIC_BY_ID[rid]
        if (!def) continue
        const d = h('div', { class: 'relic-dot', title: `【${def.name}】${def.text}` })
        d.style.setProperty('--rc', def.color)
        d.innerHTML = `<svg viewBox="0 0 100 100" width="28" height="28" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"><circle cx="50" cy="50" r="34" stroke-dasharray="8 7"/><path d="M50 20 L65 50 L50 80 L35 50 Z"/><path d="M50 34 L50 66" stroke-width="2.4"/></svg>`
        relicStrip.append(d)
      }
    }

    const e = b.enemy
    const sig = `${e.def.id}:${r.depth}:${e.maxHp}`
    if (sigilEl.dataset.sig !== sig) {
      sigilEl.dataset.sig = sig
      clear(sigilEl)
      sigilEl.style.setProperty('--ec', e.def.color)
      const l1 = h('div', { class: 'layer rot-a' })
      const l2 = h('div', { class: 'layer orbit rot-c' })
      l1.innerHTML = enemySigil(e.seed, e.def.color, e.def.accent)
      l2.innerHTML = orbitMarks(e.seed)
      l2.style.color = e.def.accent
      sigilEl.append(l1, l2)
    }
    enemyName.textContent = e.def.name
    enemyTitle.textContent = e.def.title
    hpBar.set(Math.max(0, e.hp), e.maxHp)
    poiseBar.set(e.poise, e.maxPoise)

    const bsig = `${e.stagger}|${e.block}|${Math.round(e.hp)}`
    if (badgeWrap.dataset.sig !== bsig) {
      badgeWrap.dataset.sig = bsig
      clear(badgeWrap)
      if (e.stagger > 0) {
        const bd = h('div', { class: 'badge stagger', title: '僵直：跳过行动，且受到的伤害提高 50%' })
        bd.innerHTML = `<svg viewBox="0 0 40 40" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"><path d="M8 13 L32 13 M6 20 L34 20 M11 27 L29 27"/></svg>`
        bd.append(h('span', { text: `僵直 · ×${STAGGER_MULT}` }))
        badgeWrap.append(bd)
      }
      if (e.block > 0) {
        const bd = h('div', { class: 'badge', title: '护盾：先于生命被消耗，在对撞结束时清空' })
        bd.innerHTML = icoBlock(14)
        bd.append(h('span', { text: `${e.block}` }))
        badgeWrap.append(bd)
      }
      badgeWrap.style.display = badgeWrap.children.length ? 'flex' : 'none'
    }

    const isStagger = e.intent === STAGGER_INTENT
    const isyms = intentSyms(e.intent)
    const cols = Math.max(isyms.length, b.formation.length, 1)
    const padTo = (list: (Sym | null)[]): (Sym | null)[] =>
      list.length >= cols ? list : [...list, ...Array(cols - list.length).fill(null)]
    const isig = `${e.intent.name}|${isyms.map((x) => `${x.k}${x.v}`).join(',')}|${e.stagger}|${cols}`
    if (intentSig !== isig) {
      intentSig = isig
      intentName.textContent = isStagger ? '— 僵 直 —' : e.intent.name
      renderLine(intentLine, padTo(isyms), 'enemy', intentEls)
      intentWrap.style.opacity = isStagger ? '0.5' : '1'
      intentWrap.style.visibility = isyms.length ? 'visible' : 'hidden'
    }

    const fsig = b.formation.map((x) => `${x.k}${x.v}`).join(',') + `|${cols}`
    if (formSig !== fsig) {
      formSig = fsig
      renderLine(formLine, padTo(b.formation), 'player', formationEls)
    }

    const sum = formationSummary(b.formation)
    axisCount.textContent = b.formation.length
      ? `裂 ${sum.dmg} · 铸 ${sum.block}${sum.counter ? ` · 反 ${sum.counter}` : ''}`
      : ''

    const hsig = p.hand.map((c) => `${c.uid}${cardCost(c)}${c.bonus}`).join('|') + `|${b.phase}|${p.energy}`
    if (handSig !== hsig) {
      handSig = hsig
      clear(hand)
      const n = p.hand.length
      const mid = (n - 1) / 2
      p.hand.forEach((c, i) => {
        const wrap = h('div', { class: 'card-slot' })
        const playable = b.phase === 'player' && p.energy >= cardCost(c)
        const off = i - mid
        wrap.style.transform = `rotate(${off * 2.3}deg) translateY(${Math.abs(off) * 6}px)`
        wrap.style.zIndex = String(20 + i)
        const card = cardEl(c, {
          playable,
          selected: selected === c.uid,
          onClick: () => {
            if (busy) return
            if (selected === c.uid) confirmPlay(c.uid)
            else selectCard(c.uid)
          },
        })
        card.addEventListener('pointerenter', () => {
          if (busy || b.phase !== 'player') return
          hovered = c.uid
          renderForecast(forecast, c.uid, !selected)
        })
        card.addEventListener('pointerleave', () => {
          if (hovered === c.uid) hovered = null
          if (!selected) forecast.style.display = 'none'
          else renderForecast(forecast, selected, false)
        })
        wrap.append(card)
        hand.append(wrap)
      })
      requestAnimationFrame(() => {
        ;[...hand.children].forEach((node, i) => {
          const el = node as HTMLElement
          anim(el, [{ transform: 'translateY(130px) scale(0.65)', opacity: 0 }, { transform: el.style.transform, opacity: 1 }], {
            duration: 360,
            delay: i * 32,
            easing: 'cubic-bezier(.34,1.56,.64,1)',
            fill: 'none',
          })
        })
      })
    } else {
      for (const el of hand.querySelectorAll<HTMLElement>('.card')) {
        const uid = el.dataset.uid!
        el.classList.toggle('selected', selected === uid)
        const card = p.hand.find((c) => c.uid === uid)
        if (card) {
          const playable = b.phase === 'player' && p.energy >= cardCost(card)
          el.classList.toggle('playable', playable)
          el.classList.toggle('unplayable', !playable)
        }
      }
    }

    if (selected) renderForecast(forecast, selected, false)

    const pile = (node: HTMLElement, label: string, count: number, off = false) => {
      clear(node)
      node.append(h('div', { class: 'cap', text: label }), h('div', { class: 'n', text: String(count) }))
      if (off) node.setAttribute('disabled', '')
      else node.removeAttribute('disabled')
    }
    pile(drawPileEl, '抽牌', p.drawPile.length, p.drawPile.length === 0)
    pile(discardPileEl, '弃牌', p.discardPile.length, p.discardPile.length === 0)
    pile(exhaustPileEl, '消耗', p.exhaustPile.length, p.exhaustPile.length === 0)

    if (b.phase === 'player' && !busy) endBtn.removeAttribute('disabled')
    else endBtn.setAttribute('disabled', '')

    const lsig = b.log.length + '|' + (b.log[0]?.text ?? '')
    if (battleLog.dataset.sig !== lsig) {
      battleLog.dataset.sig = lsig
      clear(battleLog)
      for (const l of b.log.slice(0, 7)) battleLog.append(h('div', { class: l.tone ?? '', text: l.text }))
    }

    tipbar.textContent = b.formation.length
      ? '裂 与 裂 逐位对撞 · 铸 先落地成盾 · 反 抵消来袭并反弹 · 穿 无视护盾'
      : '点击手牌编入符式 · 编入顺序决定下标 · 下标相同的符式才会互相作用'
  }

  const onKey = (ev: KeyboardEvent): void => {
    const s = app.get()
    if (s.screen.t !== 'battle' || busy) return
    const b = s.battle
    if (!b || b.phase !== 'player') return
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault()
      void runClashSequence()
    } else if (ev.key === 'Escape') {
      selected = null
      forecast.style.display = 'none'
      update()
    } else if (ev.key >= '1' && ev.key <= '9') {
      const card = s.run!.player.hand[Number(ev.key) - 1]
      if (!card) return
      if (selected === card.uid) confirmPlay(card.uid)
      else selectCard(card.uid)
    } else if (ev.key.toLowerCase() === 'd') {
      app.act((st) => void (st.screen = { t: 'deck' }))
    } else if (ev.key.toLowerCase() === 'm') {
      toggleMute()
    }
  }
  window.addEventListener('keydown', onKey)

  return {
    el: root,
    update,
    destroy() {
      window.removeEventListener('keydown', onKey)
      document.body.dataset.mood = ''
    },
  }
}

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

let saveTimer = 0
function saveSafe(): void {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(save, 60)
}
