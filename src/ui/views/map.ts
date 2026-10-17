import { h, clear, svgFrom } from '../dom'
import { chip } from '../components/ui'
import { icoDeck, icoEnergy, icoLife, icoNode, icoShards, icoSound } from '../svg/runes'
import { RELIC_BY_ID } from '../../core/relics'
import { LAYERS, NODE_KIND_DESC, NODE_KIND_NAME } from '../../core/run'
import { app, reachable, toggleMute, travel } from '../../core/game'
import { sfx } from '../../audio/sfx'
import type { MapNode } from '../../core/types'
import type { View } from './types'

const CANVAS_W = 1360
const PAD_TOP = 40

export function mapView(): View {
  const root = h('div', { class: 'map-screen fade-in' })

  const lifeChip = chip(icoLife(19), '0/0', 'life')
  const energyChip = chip(icoEnergy(19), '0/0', 'energy')
  const shardChip = chip(icoShards(19), '0', 'shards')
  const relicStrip = h('div', { class: 'relic-strip' })
  const deckBtn = h('button', { class: 'btn sm ghost', title: '牌组 (D)' })
  deckBtn.innerHTML = icoDeck(16) + '<span>牌组</span>'
  const soundBtn = h('button', { class: 'btn sm ghost' })
  soundBtn.innerHTML = icoSound(true, 16)

  const head = h(
    'div',
    { class: 'map-head' },
    h('h2', { text: '回 廊' }),
    lifeChip,
    energyChip,
    shardChip,
    relicStrip,
    h('div', { style: { flex: '1' } }),
    deckBtn,
    soundBtn,
  )

  const canvas = h('div', { class: 'map-canvas' })
  const scroll = h('div', { class: 'map-scroll' }, canvas)
  const tip = h('div', { class: 'map-tip' })
  root.append(head, scroll, tip)

  deckBtn.addEventListener('click', () => {
    sfx.ui('click')
    app.act((s) => void (s.screen = { t: 'deck' }))
  })
  soundBtn.addEventListener('click', toggleMute)

  function build(): void {
    const s = app.get()
    const r = s.run
    if (!r) return
    clear(canvas)
    const reach = new Set(reachable().map((n) => n.id))

    let maxX = 0
    let maxY = 0
    for (const id of Object.keys(r.map.nodes)) {
      const n = r.map.nodes[id]
      maxX = Math.max(maxX, n.x)
      maxY = Math.max(maxY, n.y)
    }
    canvas.style.width = `${Math.max(maxX + 90, CANVAS_W)}px`
    canvas.style.height = `${maxY + PAD_TOP + 90}px`

    const svg = svgFrom('<svg></svg>') as unknown as SVGSVGElement
    svg.setAttribute('class', 'edges')
    svg.setAttribute('viewBox', `0 0 ${Math.max(maxX + 90, CANVAS_W)} ${maxY + PAD_TOP + 90}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.style.width = '100%'
    svg.style.height = '100%'
    for (const id of Object.keys(r.map.nodes)) {
      const n = r.map.nodes[id]
      for (const nx of n.next) {
        const m = r.map.nodes[nx]
        if (!m) continue
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        const midY = (n.y + PAD_TOP + (m.y + PAD_TOP)) / 2
        p.setAttribute('d', `M${n.x} ${n.y + PAD_TOP} C${n.x} ${midY} ${m.x} ${midY} ${m.x} ${m.y + PAD_TOP}`)
        const active = r.pos === id && reach.has(nx)
        if (active) p.setAttribute('class', 'active')
        svg.append(p)
      }
    }
    canvas.append(svg)

    // 层数标尺
    for (let l = 0; l < r.map.layers.length; l++) {
      if (l % 2 && l !== r.map.layers.length - 1) continue
      const y = r.map.nodes[r.map.layers[l][0]]?.y ?? 0
      const mark = h('div', { class: `layer-mark${r.depth === l && r.pos ? ' here' : ''}`, text: String(l + 1) })
      mark.style.top = `${y + PAD_TOP}px`
      canvas.append(mark)
    }

    for (const id of Object.keys(r.map.nodes)) {
      const n: MapNode = r.map.nodes[id]
      const el = h('div', { class: 'mnode', dataset: { kind: n.kind } })
      el.style.left = `${n.x}px`
      el.style.top = `${n.y + PAD_TOP}px`
      el.innerHTML = icoNode(n.kind, n.kind === 'boss' ? 46 : 36)
      el.append(h('div', { class: 'badge-kind', text: NODE_KIND_NAME[n.kind] }))
      const isCurrent = r.pos === id
      const canGo = !r.pos ? n.layer === 0 : reach.has(id)
      if (isCurrent) el.classList.add('current')
      else if (n.visited) el.classList.add('visited')
      else if (canGo) el.classList.add('reach')
      else el.classList.add('locked')
      el.title = `${NODE_KIND_NAME[n.kind]} · ${NODE_KIND_DESC[n.kind]}`
      if (canGo && !isCurrent) {
        el.addEventListener('click', () => {
          sfx.ui('travel')
          travel(id)
        })
        el.addEventListener('pointerenter', () => {
          tip.textContent = `${NODE_KIND_NAME[n.kind]} —— ${NODE_KIND_DESC[n.kind]}`
        })
      }
      canvas.append(el)
    }

    // 滚到当前所在层
    requestAnimationFrame(() => {
      const y = r.pos ? r.map.nodes[r.pos].y + PAD_TOP : (r.map.nodes[r.map.layers[0][0]]?.y ?? 0) + PAD_TOP
      scroll.scrollTo({ top: Math.max(0, y - scroll.clientHeight * 0.72), behavior: 'smooth' })
    })
  }

  const onKey = (ev: KeyboardEvent): void => {
    const s = app.get()
    if (s.screen.t !== 'map') return
    if (ev.key.toLowerCase() === 'd') app.act((st) => void (st.screen = { t: 'deck' }))
    if (ev.key.toLowerCase() === 'm') toggleMute()
  }
  window.addEventListener('keydown', onKey)

  let lastSig = ''
  function update(): void {
    const s = app.get()
    const r = s.run
    if (!r) return
    const p = r.player
    const sig = `${r.pos}|${p.hp}|${p.shards}|${p.maxEnergy}|${r.relics.join(',')}|${s.muted}`
    if (sig === lastSig) return
    lastSig = sig
    document.body.dataset.mood = ''
    lifeChip.querySelector('.val')!.textContent = `${p.hp}/${p.maxHp}`
    lifeChip.classList.toggle('low', p.hp <= p.maxHp * 0.3)
    energyChip.querySelector('.val')!.textContent = `灵光 ${p.maxEnergy}`
    shardChip.querySelector('.val')!.textContent = String(p.shards)
    soundBtn.innerHTML = icoSound(!s.muted, 16)
    clear(relicStrip)
    for (const rid of r.relics) {
      const def = RELIC_BY_ID[rid]
      if (!def) continue
      const d = h('div', { class: 'relic-dot', title: `【${def.name}】${def.text}` })
      d.style.setProperty('--rc', def.color)
      d.innerHTML = `<svg viewBox="0 0 100 100" width="28" height="28" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"><circle cx="50" cy="50" r="34" stroke-dasharray="8 7"/><path d="M50 20 L65 50 L50 80 L35 50 Z"/></svg>`
      relicStrip.append(d)
    }
    tip.textContent = r.pos
      ? `第 ${r.depth + 1} / ${LAYERS} 层 —— 选择一条前往下一层的路`
      : '点击任意起始节点，开始抄写。'
    build()
  }

  return {
    el: root,
    update,
    destroy() {
      window.removeEventListener('keydown', onKey)
    },
  }
}
