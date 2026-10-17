import { Rng, uid } from './rng'
import { createStore } from './store'
import {
  ALL_CARDS,
  ARCH_COLOR,
  CARD_BY_ID,
  SPECIAL_CARDS,
  instantiate,
  starterDeck,
} from './cards'
import { BOSS_POOL, ELITE_POOL, ENEMIES, ENEMY_BY_ID, NORMAL_POOL, scaleEnemy } from './enemies'
import { RELIC_BY_ID, rollRelic } from './relics'
import { EVENT_BY_ID, EVENTS } from './events'
import { LAYERS, generateMap } from './run'
import {
  cardSyms,
  intentSyms,
  nextIntent,
  resolveClash,
  type ClashStep,
  type ResolveResult,
} from './combat'
import type {
  CardDef,
  CardInst,
  EnemyDef,
  EnemyState,
  EventEffect,
  IntentDef,
  LogEntry,
  MapNode,
  NodeKind,
  PickPurpose,
  PlayerState,
  RunMap,
  Screen,
  Sym,
} from './types'
import { sfx } from '../audio/sfx'

export interface RunState {
  seed: number
  map: RunMap
  pos: string | null
  depth: number
  player: PlayerState
  relics: string[]
  usedEvents: string[]
  battleHpLost: number
  ended: boolean
}

export interface Offer {
  cards: CardDef[]
  relics: string[]
  shards: number
  takenCards: CardDef[]
  takenRelics: string[]
}

export interface ShopItem {
  kind: 'card' | 'relic'
  card?: CardDef
  relic?: string
  price: number
  sold: boolean
}

export interface ShopState {
  items: ShopItem[]
  removals: number
  removalPrice: number
}

export interface PickState {
  purpose: PickPurpose
  returnTo: Screen
  rest: EventEffect[]
}

export interface AppState {
  screen: Screen
  run: RunState | null
  battle: BattleState | null
  pending: ResolveResult | null
  pick: PickState | null
  offer: Offer | null
  shop: ShopState | null
  eventResult: string | null
  eventChosen: number | null
  toast: { id: number; text: string; tone: 'good' | 'bad' | 'info' } | null
  log: LogEntry[]
  muted: boolean
  hintDismissed: boolean
}

export interface BattleState {
  enemy: EnemyState
  turn: number
  phase: 'player' | 'clash' | 'won' | 'lost'
  log: LogEntry[]
  formation: Sym[]
  playedThisTurn: number
  playedThisBattle: number
  clashWinsThisTurn: number
  staggeredThisBattle: boolean
  usedPrismThisTurn: boolean
}

export const STAGGER_INTENT: IntentDef = { name: '僵直', syms: [] }

const emptyPlayer = (): PlayerState => ({
  hp: 70,
  maxHp: 70,
  block: 0,
  energy: 3,
  maxEnergy: 3,
  shards: 0,
  drawPile: [],
  hand: [],
  discardPile: [],
  exhaustPile: [],
  buffs: {},
  handSize: 5,
})

function initial(): AppState {
  return {
    screen: { t: 'title' },
    run: null,
    battle: null,
    pending: null,
    pick: null,
    offer: null,
    shop: null,
    eventResult: null,
    eventChosen: null,
    toast: null,
    log: [],
    muted: false,
    hintDismissed: !!localStorage.getItem('rucard.hint'),
  }
}

export const app = createStore<AppState>(initial())

/* ─────────────────────────── 工具 ─────────────────────────── */

let toastId = 0
export function toast(text: string, tone: 'good' | 'bad' | 'info' = 'info'): void {
  app.act((s) => {
    s.toast = { id: ++toastId, text, tone }
  })
}

function pushLog(text: string, tone: LogEntry['tone'] = 'neutral'): void {
  const s = app.get()
  if (s.battle) {
    s.battle.log.unshift({ text, tone })
    if (s.battle.log.length > 40) s.battle.log.length = 40
  }
}

export function hasRelic(id: string): boolean {
  return !!app.get().run?.relics.includes(id)
}

function run(): RunState {
  const r = app.get().run
  if (!r) throw new Error('no run')
  return r
}

function allCards(p: PlayerState): CardInst[] {
  return [...p.drawPile, ...p.hand, ...p.discardPile]
}

/* ─────────────────────────── 存档 ─────────────────────────── */

export function save(): void {
  const s = app.get()
  if (!s.run) return
  try {
    localStorage.setItem('rucard.save', JSON.stringify({ run: s.run, screen: s.screen }))
  } catch {
    /* 忽略 */
  }
}

export function loadSave(): { run: RunState; screen: Screen } | null {
  try {
    const raw = localStorage.getItem('rucard.save')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem('rucard.save')
}

/* ─────────────────────────── 流程 ─────────────────────────── */

export function toTitle(): void {
  app.act((s) => {
    s.screen = { t: 'title' }
    s.battle = null
    s.pending = null
  })
  sfx.ui('back')
}

export function continueRun(): boolean {
  const sv = loadSave()
  if (!sv) return false
  app.act((s) => {
    s.run = sv.run
    s.screen = sv.screen.t === 'battle' ? { t: 'map' } : sv.screen
    s.battle = null
  })
  return true
}

export function newRun(forcedSeed?: number): void {
  const seed = forcedSeed ?? Math.floor(Math.random() * 2 ** 31)
  const map = generateMap(seed)
  const p = emptyPlayer()
  p.drawPile = new Rng(seed + 7).shuffle(starterDeck())
  app.act((s) => {
    s.run = {
      seed,
      map,
      pos: null,
      depth: 0,
      player: p,
      relics: [],
      usedEvents: [],
      battleHpLost: 0,
      ended: false,
    }
    s.screen = { t: 'map' }
    s.battle = null
    s.offer = null
    s.shop = null
    s.pick = null
    s.log = []
  })
  sfx.start()
  clearSave()
}

export function reachable(): MapNode[] {
  const r = app.get().run
  if (!r) return []
  const ids = r.pos ? (r.map.nodes[r.pos]?.next ?? []) : r.map.start
  return ids.map((id) => r.map.nodes[id]).filter(Boolean)
}

/* ─────────────────────────── 战斗 ─────────────────────────── */

function chooseEnemy(kind: NodeKind, depth: number): EnemyDef {
  const rng = new Rng(run().seed + depth * 977 + Math.floor(Math.random() * 9999))
  const pool = kind === 'elite' ? ELITE_POOL : kind === 'boss' ? BOSS_POOL : NORMAL_POOL
  const base = rng.pick(pool)
  return scaleEnemy(base, depth)
}

export function startBattle(def: EnemyDef, depth: number): void {
  const r = run()
  const p = r.player
  const rng = new Rng(`${def.id}-${depth}-${p.hp}`)
  const maxHp = rng.int(def.hp[0], def.hp[1])
  const enemy: EnemyState = {
    def,
    hp: maxHp,
    maxHp,
    block: 0,
    poise: 0,
    maxPoise: def.poise,
    stagger: 0,
    intent: def.intents[0],
    intentIndex: 1,
    buffs: {},
    seed: `${def.id}:${depth}`,
  }
  const battle: BattleState = {
    enemy,
    turn: 1,
    phase: 'player',
    log: [],
    formation: [],
    playedThisTurn: 0,
    playedThisBattle: 0,
    clashWinsThisTurn: 0,
    staggeredThisBattle: false,
    usedPrismThisTurn: false,
  }
  r.battleHpLost = 0
  p.block = 0
  p.energy = p.maxEnergy
  p.hand = []
  p.discardPile = []
  p.exhaustPile = []
  p.buffs = {}
  p.drawPile = new Rng(`${def.id}${r.seed}` + depth).shuffle(allCards(p))
  const p2 = { ...p }

  // 圣痕：战斗开始
  let bonusDraw = 0
  if (r.relics.includes('first_ring')) bonusDraw += 1
  if (r.relics.includes('crackbox')) p2.block += 5
  if (r.relics.includes('dumbbell')) p2.buffs.focus = (p2.buffs.focus ?? 0) + 3
  if (r.relics.includes('needle')) {
    const atks = p2.drawPile.filter((c) => cardSyms(c).some((s) => s.k === 'rift' || s.k === 'pierce'))
    if (atks.length) atks[Math.floor(Math.random() * atks.length)].bonus += 2
  }

  app.act((s) => {
    s.battle = battle
    s.screen = { t: 'battle' }
    s.pending = null
    s.run!.player = p2
  })
  drawCards(5 + bonusDraw)
  app.act((s) => {
    if (s.battle) s.battle.phase = 'player'
  })
  sfx.battleStart()
  pushLog(`【${def.name}】浮现。`, 'special')
  save()
}

export function drawCards(n: number): void {
  const r = run()
  const p = r.player
  app.act(() => {
    for (let i = 0; i < n; i++) {
      if (!p.drawPile.length) {
        if (!p.discardPile.length) break
        p.drawPile = new Rng(uid('s')).shuffle(p.discardPile)
        p.discardPile = []
      }
      const c = p.drawPile.pop()
      if (!c) break
      if (p.hand.length >= 10) {
        p.discardPile.push(c)
        continue
      }
      p.hand.push(c)
    }
  })
}

/** 灵感预演：把当前牌库与阵型算一遍，返回结算结果 */
export function preview(mutator?: (f: Sym[]) => void): ResolveResult {
  const b = app.get().battle!
  const r = run()
  const f = b.formation.map((s) => ({ ...s }))
  mutator?.(f)
  const focus = r.player.buffs.focus ?? 0
  if (focus) for (const s of f) if (s.k === 'rift' || s.k === 'pierce') s.v += focus
  return resolveClash({
    formation: f,
    intent: intentSyms(b.enemy.intent),
    enemyHp: b.enemy.hp,
    enemyBlock: b.enemy.block,
    enemyPoise: b.enemy.poise,
    enemyMaxPoise: b.enemy.maxPoise,
    enemyStagger: b.enemy.stagger,
    playerHp: r.player.hp,
    playerBlock: r.player.block,
  })
}

export function cardCost(c: CardInst): number {
  const b = app.get().battle
  const r = app.get().run
  let cost = c.cost
  if (b && r && !b.usedPrismThisTurn && r.relics.includes('prism')) {
    const expanded = cardSyms(c)
    if (expanded.length === 1) cost = Math.max(0, cost - 1)
  }
  return cost
}

export function canPlay(c: CardInst): boolean {
  const s = app.get()
  if (!s.battle || s.battle.phase !== 'player') return false
  return run().player.energy >= cardCost(c)
}

export function playCard(uidStr: string): boolean {
  const s = app.get()
  const b = s.battle
  if (!b || b.phase !== 'player') return false
  const r = run()
  const p = r.player
  const idx = p.hand.findIndex((c) => c.uid === uidStr)
  if (idx < 0) return false
  const card = p.hand[idx]
  const cost = cardCost(card)
  if (p.energy < cost) {
    sfx.deny()
    toast('灵光不足', 'bad')
    return false
  }

  const syms = cardSyms(card).map((x) => ({ ...x }))
  const focus = p.buffs.focus ?? 0
  if (focus) for (const x of syms) if (x.k === 'rift' || x.k === 'pierce') x.v += focus
  if ((p.buffs.surge ?? 0) > 0 && syms.length >= 3) for (const x of syms) if (x.k !== 'link' && x.k !== 'spiral') x.v += p.buffs.surge

  app.act(() => {
    p.hand.splice(idx, 1)
    p.energy -= cost
    b.formation.push(...syms)
    b.playedThisTurn++
    b.playedThisBattle++
    if (!b.usedPrismThisTurn && r.relics.includes('prism') && cardSyms(card).length === 1) {
      b.usedPrismThisTurn = true
    }
  })
  sfx.playCard(card.arch, syms.length)
  pushLog(`打出「${card.name}」` + (syms.length ? ` → ${syms.map((x) => `${nameOf(x.k)}${x.v}`).join(' ')}` : ''), 'neutral')

  // 一次性效果
  if (card.fx?.length) applyCardFx(card.fx)
  if ((p.buffs.surge ?? 0) > 0) delete p.buffs.surge

  // 圣痕：共鸣管
  if (r.relics.includes('pipes') && syms.length >= 3) drawCards(1)

  // 去向
  app.act(() => {
    if (card.exhaust) p.exhaustPile.push(card)
    else p.discardPile.push(card)
  })
  save()
  return true
}

function nameOf(k: Sym['k']): string {
  return { rift: '裂', ward: '铸', echo: '反', pierce: '穿', link: '缀', spiral: '引' }[k]
}

function applyCardFx(fxs: NonNullable<CardInst['fx']>): void {
  const r = run()
  const p = r.player
  const b = app.get().battle
  if (!b) return
  for (const f of fxs) {
    switch (f.t) {
      case 'draw':
        drawCards(f.n)
        break
      case 'energy':
        app.act(() => {
          p.energy += f.n
        })
        sfx.energy()
        break
      case 'block':
        app.act(() => {
          p.block += f.n
        })
        break
      case 'damage': {
        app.act(() => {
          b.enemy.hp -= f.n
        })
        break
      }
      case 'damageFromBlock': {
        const d = Math.round(p.block * f.ratio)
        if (d > 0) {
          app.act(() => {
            b.enemy.hp -= d
            b.enemy.poise += d
          })
          sfx.hit(Math.min(3, Math.floor(d / 4)))
          pushLog(`守转攻 · 以护盾造成 ${d} 伤害`, 'good')
        }
        break
      }
      case 'heal':
        app.act(() => {
          p.hp = Math.min(p.maxHp, p.hp + f.n)
        })
        sfx.heal()
        break
      case 'stagger':
        app.act(() => {
          b.enemy.poise += f.n
        })
        break
      case 'buff':
        app.act(() => {
          p.buffs[f.id] = (p.buffs[f.id] ?? 0) + f.n
        })
        break
    }
  }
}

/** 结束回合：纯计算，返回可逐步回放的对撞事件 */
export function prepareClash(): ClashStep[] {
  const s = app.get()
  const b = s.battle!
  const res = preview()
  app.act((st) => {
    st.pending = res
    st.battle!.phase = 'clash'
  })
  pushLog(`— 第 ${b.turn} 回合 · 对撞 —`, 'special')
  return res.steps
}

/** 回放单步：只做表现层的增量，最终值以 settleClash 的权威快照为准 */
export function applyClashStep(step: ClashStep): void {
  app.act((s) => {
    const b = s.battle
    if (!b) return
    const r = s.run!
    if (step.enemy.poise) {
      b.enemy.poise += step.enemy.poise
      if (b.enemy.poise >= b.enemy.maxPoise) {
        b.enemy.poise = 0
        b.enemy.maxPoise = Math.ceil(b.enemy.maxPoise * 1.45)
      }
    }
    if (step.note) pushLog(`${step.a ? `${nameOf(step.a.k)}${step.a.v}` : '—'} ⚔ ${step.b ? `${nameOf(step.b.k)}${step.b.v}` : '—'} · ${step.note}`, step.outcome === 'clash-win' ? 'good' : 'neutral')
    void r
  })
}

/** 落定对撞结果，返回是否获胜/落败 */
export function settleClash(): { won: boolean; lost: boolean } {
  const s = app.get()
  const b = s.battle
  const res = s.pending
  if (!b || !res) return { won: false, lost: false }
  const r = run()
  const p = r.player

  app.act(() => {
    b.enemy.hp = res.enemyHp
    b.enemy.block = res.enemyBlock
    b.enemy.poise = res.enemyPoise
    b.enemy.maxPoise = res.enemyMaxPoise
    p.hp = res.playerHp
    p.block = res.playerBlock
    b.clashWinsThisTurn = res.clashWins
  })

  // 圣痕：破碎天平
  if (res.clashWins > 0 && r.relics.includes('balance')) {
    app.act(() => {
      b.enemy.hp -= res.clashWins * 2
    })
    pushLog(`破碎天平 · 对撞胜出 ${res.clashWins} 次，额外 ${res.clashWins * 2} 伤害`, 'good')
  }

  // 僵直
  if (res.staggered && !b.staggeredThisBattle) {
    app.act(() => {
      b.staggeredThisBattle = true
    })
    if (r.relics.includes('corridor_key')) {
      app.act(() => {
        p.energy += 2
      })
      pushLog('回廊钥匙 · 首次僵直，灵光 +2', 'good')
    }
    sfx.stagger()
    pushLog(`【${b.enemy.def.name}】僵直！受到伤害 +50%`, 'special')
  } else if (res.staggered) {
    sfx.stagger()
  }

  const lost = p.hp <= 0
  const won = b.enemy.hp <= 0
  if (won) {
    sfx.victory()
    app.act((st) => {
      st.battle!.phase = 'won'
    })
  } else if (lost) {
    sfx.defeat()
    app.act((st) => {
      st.battle!.phase = 'lost'
    })
  }
  return { won, lost }
}

/** 敌方阶段：僵直推进、状态结算、抽取下一招 */
export function enemyPhase(): void {
  const s = app.get()
  const b = s.battle
  if (!b) return
  const r = run()
  const p = r.player

  app.act(() => {
    b.formation = []
    b.playedThisTurn = 0
    b.clashWinsThisTurn = 0
    b.usedPrismThisTurn = false
    b.enemy.block = 0
    p.block = 0
  })

  if (s.pending?.staggered) {
    app.act(() => {
      b.enemy.stagger = 1
      b.enemy.intent = STAGGER_INTENT
    })
    return
  }
  if (b.enemy.stagger > 0) {
    app.act(() => {
      b.enemy.stagger = 0
    })
  }

  const rng = new Rng(`${b.enemy.def.id}-${b.turn}-${r.seed}`)
  const def = b.enemy.def
  const ni = nextIntent(def.intents, b.enemy.intentIndex, def.plan ?? 'cycle', rng)
  app.act(() => {
    b.enemy.intent = ni.intent
    b.enemy.intentIndex = ni.index
  })
}

/** 玩家阶段开始 */
export function startPlayerTurn(): void {
  const s = app.get()
  const b = s.battle
  if (!b) return
  const r = run()
  const p = r.player
  app.act(() => {
    b.turn++
    b.phase = 'player'
    b.enemy.block = 0
    p.energy = p.maxEnergy
    p.buffs = {}
  })
  drawCards(p.handSize)
  if (r.relics.includes('ringfinger')) {
    app.act(() => {
      p.hp -= 1
    })
  }
}

export function battleWon(): void {
  const s = app.get()
  const b = s.battle
  const r = s.run
  if (!b || !r) return
  const kind = b.enemy.def.kind
  const depth = r.depth
  let shards = kind === 'boss' ? 200 : kind === 'elite' ? 85 : 38
  shards = Math.round(shards * (1 + depth * 0.05))
  if (r.relics.includes('abacus')) shards += 12

  // 圣痕：灰烬抄本
  if (r.battleHpLost === 0 && r.relics.includes('ashcodex')) {
    app.act(() => {
      r.player.hp = Math.min(r.player.maxHp, r.player.hp + 5)
    })
  }

  app.act(() => {
    r.player.shards += shards
    r.player.hp = Math.max(1, r.player.hp)
  })

  if (kind === 'boss') {
    app.act((st) => {
      st.screen = { t: 'gameover', win: true }
      st.run!.ended = true
    })
    clearSave()
    return
  }

  const pool = ALL_CARDS.filter((c) => c.rarity !== 'special' && c.id !== 'cut' && c.id !== 'ring')
  const rng = new Rng(`${r.seed}-${r.depth}-reward-${b.playedThisBattle}`)
  const cards: CardDef[] = []
  const wantRare = kind === 'elite' ? 0.3 : 0.06
  while (cards.length < 3) {
    const roll = rng.float()
    const rarity = roll < wantRare ? 'rare' : roll < wantRare + 0.35 ? 'uncommon' : 'common'
    const c = rng.pick(pool.filter((x) => x.rarity === rarity))
    if (c && !cards.includes(c)) cards.push(c)
    else if (cards.length >= 3) break
    else if (cards.length > 8) break
  }
  const relicIds: string[] = []
  if (kind === 'elite') {
    const rel = rollRelic(r.relics)
    if (rel) relicIds.push(rel.id)
  }
  app.act((st) => {
    st.offer = { cards, relics: relicIds, shards, takenCards: [], takenRelics: [] }
    st.screen = { t: 'reward', kind: kind === 'normal' ? 'battle' : kind }
    st.battle = null
  })
  save()
}

export function battleLost(): void {
  app.act((s) => {
    s.screen = { t: 'gameover', win: false }
    if (s.run) s.run.ended = true
  })
  clearSave()
  sfx.defeat()
}

/* ─────────────────────────── 奖励 ─────────────────────────── */

export function takeRewardCard(def: CardDef): void {
  const r = run()
  app.act((s) => {
    r.player.discardPile.push(instantiate(def))
    s.offer!.takenCards.push(def)
  })
  sfx.cardGet()
  save()
}

export function takeRewardRelic(id: string): void {
  const r = run()
  app.act((s) => {
    if (!r.relics.includes(id)) r.relics.push(id)
    s.offer!.takenRelics.push(id)
  })
  sfx.relic()
  pushLog(`获得圣痕「${RELIC_BY_ID[id].name}」`, 'good')
  save()
}

export function leaveReward(): void {
  app.act((st) => {
    st.offer = null
    st.screen = { t: 'map' }
  })
  advance()
}

/* ─────────────────────────── 地图 ─────────────────────────── */

export function travel(nodeId: string): void {
  const r = run()
  const node = r.map.nodes[nodeId]
  if (!node) return
  app.act((s) => {
    r.pos = nodeId
    r.depth = node.layer
    s.screen = { t: 'map' }
  })
  sfx.ui('travel')
  enterNode(node)
}

function enterNode(node: MapNode): void {
  const r = run()
  switch (node.kind) {
    case 'battle':
    case 'elite':
    case 'boss':
      startBattle(chooseEnemy(node.kind, node.layer), node.layer)
      break
    case 'event': {
      const avail = EVENTS.filter((e) => !r.usedEvents.includes(e.id))
      const pool = avail.length ? avail : EVENTS
      const e = pool[Math.floor(Math.random() * pool.length)]
      app.act((s) => {
        s.screen = { t: 'event', id: e.id }
        s.eventResult = null
        s.eventChosen = null
        if (!r.usedEvents.includes(e.id)) r.usedEvents.push(e.id)
      })
      break
    }
    case 'rest':
      app.act((s) => {
        s.screen = { t: 'rest' }
      })
      break
    case 'shop': {
      openShop()
      break
    }
    case 'treasure': {
      app.act((s) => {
        s.screen = { t: 'treasure' }
      })
      break
    }
  }
  save()
}

function advance(): void {
  const r = run()
  if (!r.pos) return
  const node = r.map.nodes[r.pos]
  node.visited = true
}

/* ─────────────────────────── 事件 ─────────────────────────── */

export function chooseEventOption(index: number): void {
  const s = app.get()
  const r = run()
  if (s.eventChosen !== null) return
  const ev = EVENT_BY_ID[(s.screen as { t: 'event'; id: string }).id]
  const opt = ev.options[index]
  app.act(() => {
    s.eventChosen = index
  })
  const msgs = applyEffects(opt.effects, { t: 'event', id: ev.id })
  if (msgs) app.act(() => {
    s.eventResult = msgs
  })
  save()
}

/** 事件结果留白一处，等玩家读完再回到地图 */
export function closeEventResult(): void {
  const s = app.get()
  if (s.eventChosen === null) return
  if (s.pick) return
  app.act((st) => {
    st.screen = { t: 'map' }
    st.eventResult = null
    st.eventChosen = null
  })
  advance()
}

/* ─────────────────────────── 效果 ─────────────────────────── */

function applyEffects(effects: EventEffect[], returnTo: Screen): string {
  const r = run()
  const p = r.player
  const msgs: string[] = []
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i]
    switch (e.t) {
      case 'heal':
        app.act(() => {
          p.hp = Math.min(p.maxHp, p.hp + e.n)
        })
        msgs.push(`回复 ${e.n} 点生命`)
        break
      case 'hurt':
        app.act(() => {
          p.hp -= e.n
        })
        msgs.push(`失去 ${e.n} 点生命`)
        break
      case 'shards':
        app.act(() => {
          p.shards = Math.max(0, p.shards + e.n)
        })
        msgs.push(e.n >= 0 ? `获得 ${e.n} 碎片` : `失去 ${-e.n} 碎片`)
        break
      case 'maxHp':
        app.act(() => {
          p.maxHp = Math.max(20, p.maxHp + e.n)
          p.hp = Math.min(p.hp, p.maxHp)
        })
        msgs.push(e.n >= 0 ? `生命上限 +${e.n}` : `生命上限 ${e.n}`)
        break
      case 'relic': {
        const rel = rollRelic(r.relics)
        if (rel) {
          app.act(() => {
            r.relics.push(rel.id)
          })
          msgs.push(`获得圣痕「${rel.name}」`)
          sfx.relic()
        } else msgs.push('再无新的圣痕')
        break
      }
      case 'card': {
        const pool = ALL_CARDS.filter((c) => c.rarity === (e.rarity ?? 'common'))
        for (let k = 0; k < e.count; k++) {
          const d = pool[Math.floor(Math.random() * pool.length)]
          app.act(() => {
            p.discardPile.push(instantiate(d))
          })
          msgs.push(`获得卡牌「${d.name}」`)
        }
        sfx.cardGet()
        break
      }
      case 'specialCard': {
        const d = SPECIAL_CARDS[Math.floor(Math.random() * SPECIAL_CARDS.length)]
        app.act(() => {
          p.discardPile.push(instantiate(d))
        })
        msgs.push(`获得卡牌「${d.name}」`)
        sfx.cardGet()
        break
      }
      case 'addCard': {
        const d = CARD_BY_ID[e.id]
        app.act(() => {
          p.discardPile.push(instantiate(d))
        })
        msgs.push(`获得卡牌「${d.name}」`)
        sfx.cardGet()
        break
      }
      case 'well': {
        const spent = p.shards
        app.act(() => {
          p.shards = 0
          p.maxHp += 12
          p.hp = p.maxHp
        })
        msgs.push(`投入 ${spent} 碎片 · 生命上限 +12 并回满`)
        break
      }
      case 'remove':
      case 'upgrade':
      case 'duplicate': {
        const purpose: PickPurpose = e.t === 'remove' ? 'remove' : e.t === 'upgrade' ? 'upgrade' : 'duplicate'
        app.act((st) => {
          st.pick = { purpose, returnTo, rest: effects.slice(i + 1) }
        })
        if (msgs.length) app.act((st) => {
          st.eventResult = msgs.join('，')
        })
        return msgs.join('，')
      }
    }
  }
  return msgs.join('，')
}

/* ─────────────────────────── 选牌 ─────────────────────────── */

export function pickCard(uidStr: string): void {
  const s = app.get()
  const pick = s.pick
  if (!pick) return
  const r = run()
  const p = r.player
  if (pick.purpose === 'remove') {
    const idx = p.drawPile.findIndex((c) => c.uid === uidStr) 
    const inHand = p.hand.findIndex((c) => c.uid === uidStr)
    if (idx >= 0) app.act(() => void p.drawPile.splice(idx, 1))
    else if (inHand >= 0) app.act(() => void p.hand.splice(inHand, 1))
    sfx.ui('shred')
    toast('一张牌被抹去了', 'info')
  } else if (pick.purpose === 'upgrade') {
    const all = allCards(p)
    const c = all.find((x) => x.uid === uidStr)
    if (c && !c.upgraded) {
      app.act(() => {
        c.upgraded = true
        c.bonus += 2
      })
      sfx.relic()
      toast(`「${c.name}」已铭刻 +2`, 'good')
    }
  } else {
    const all = allCards(p)
    const c = all.find((x) => x.uid === uidStr)
    if (c) {
      app.act(() => {
        p.drawPile.push(instantiate(c, c.upgraded))
      })
      sfx.cardGet()
      toast(`抄写了「${c.name}」`, 'good')
    }
  }
  const rest = pick.rest
  const returnTo = pick.returnTo
  app.act((st) => {
    st.pick = null
  })
  save()
  if (rest.length) {
    const msg = applyEffects(rest, returnTo)
    if (!app.get().pick) {
      app.act((st) => {
        st.eventResult = [st.eventResult, msg].filter(Boolean).join('，')
      })
    }
  }
  if (returnTo.t === 'map') {
    app.act((st) => {
      st.screen = { t: 'map' }
    })
    advance()
  }
}

export function cancelPick(): void {
  const s = app.get()
  if (!s.pick) return
  const returnTo = s.pick.returnTo
  app.act((st) => {
    st.pick = null
    st.screen = returnTo
  })
}

/* ─────────────────────────── 休整 / 商店 / 遗匣 ─────────────────────────── */

export function restHeal(): void {
  const r = run()
  const p = r.player
  let amount = Math.round(p.maxHp * 0.3)
  if (r.relics.includes('inkstone')) amount = Math.round(p.maxHp * 0.4)
  app.act(() => {
    p.hp = Math.min(p.maxHp, p.hp + amount)
  })
  sfx.heal()
  toast(`回复 ${amount} 点生命`, 'good')
  app.act((s) => {
    s.screen = { t: 'map' }
  })
  advance()
}

export function restUpgrade(): void {
  app.act((s) => {
    s.pick = { purpose: 'upgrade', returnTo: { t: 'map' }, rest: [] }
  })
}

export function closePickToMap(): void {
  app.act((s) => {
    s.screen = { t: 'map' }
  })
  advance()
}

export function openShop(): void {
  const r = run()
  const rng = new Rng(`${r.seed}-${r.depth}-shop`)
  const pool = ALL_CARDS.filter((c) => c.rarity !== 'special' && c.id !== 'cut' && c.id !== 'ring')
  const items: ShopItem[] = []
  const usedRarities = ['common', 'common', 'uncommon', 'uncommon', 'rare'] as const
  for (const rar of usedRarities) {
    const c = rng.pick(pool.filter((x) => x.rarity === rar))
    if (!c) continue
    const price = rar === 'rare' ? rng.int(130, 165) : rar === 'uncommon' ? rng.int(78, 98) : rng.int(45, 58)
    items.push({ kind: 'card', card: c, price, sold: false })
  }
  for (let i = 0; i < 2; i++) {
    const rel = rollRelic([...r.relics, ...items.filter((x) => x.relic).map((x) => x.relic!)])
    if (!rel) break
    items.push({ kind: 'relic', relic: rel.id, price: rng.int(140, 190), sold: false })
  }
  app.act((s) => {
    s.shop = { items, removals: 0, removalPrice: 65 }
    s.screen = { t: 'shop' }
  })
}

export function buyItem(index: number): void {
  const s = app.get()
  const shop = s.shop
  const r = run()
  if (!shop) return
  const it = shop.items[index]
  if (!it || it.sold) return
  if (r.player.shards < it.price) {
    sfx.deny()
    toast('碎片不足', 'bad')
    return
  }
  app.act(() => {
    r.player.shards -= it.price
    it.sold = true
    if (it.kind === 'card' && it.card) r.player.discardPile.push(instantiate(it.card))
    else if (it.kind === 'relic' && it.relic && !r.relics.includes(it.relic)) r.relics.push(it.relic)
  })
  sfx.purchase()
  save()
}

export function buyRemoval(): void {
  const s = app.get()
  const r = run()
  if (!s.shop) return
  if (r.player.shards < s.shop.removalPrice) {
    sfx.deny()
    toast('碎片不足', 'bad')
    return
  }
  const shop = s.shop
  app.act(() => {
    r.player.shards -= shop.removalPrice
    shop.removals++
    shop.removalPrice += 35
  })
  app.act((st) => {
    st.pick = { purpose: 'remove', returnTo: { t: 'shop' }, rest: [] }
  })
}

export function leaveShop(): void {
  app.act((s) => {
    s.shop = null
    s.screen = { t: 'map' }
  })
  advance()
}

export function openTreasure(): void {
  const r = run()
  const rel = rollRelic(r.relics)
  const shards = 60 + Math.floor(Math.random() * 50)
  app.act((s) => {
    if (rel) r.relics.push(rel.id)
    r.player.shards += shards
    s.eventResult = rel ? `获得圣痕「${rel.name}」与 ${shards} 碎片` : `获得 ${shards} 碎片`
  })
  sfx.treasure()
  save()
}

export function leaveTreasure(): void {
  const s = app.get()
  app.act((st) => {
    st.eventResult = null
    st.screen = { t: 'map' }
  })
  advance()
  void s
}

/* ─────────────────────────── 杂项 ─────────────────────────── */

export function toggleMute(): void {
  const s = app.get()
  app.act((st) => {
    st.muted = !st.muted
  })
  sfx.setMuted(app.get().muted)
}

export function dismissHint(): void {
  app.act((s) => {
    s.hintDismissed = true
  })
  localStorage.setItem('rucard.hint', '1')
}

export function backToMap(): void {
  app.act((s) => {
    s.screen = { t: 'map' }
    s.battle = null
  })
  save()
}

/* ─────────────────── 开发期调试桥（仅 dev 构建） ─────────────────── */

/** 跳到地图上第一个指定类型的节点，用于截图/调试时稳定复现界面。 */
export function gotoKind(kind: NodeKind): boolean {
  const r = app.get().run
  if (!r) return false
  const list = Object.values(r.map.nodes).filter((n) => n.kind === kind)
  if (!list.length) return false
  // 优先取中段层数，避免 0 层的敌人过于孱弱
  const mid = list.sort((a, b) => Math.abs(a.layer - 4) - Math.abs(b.layer - 4))[0]
  travel(mid.id)
  return true
}

/** 直接与指定敌人开战。 */
export function fight(enemyId: string): boolean {
  const def = ENEMY_BY_ID[enemyId]
  if (!def) return false
  startBattle(def, def.kind === 'boss' ? 14 : def.kind === 'elite' ? 9 : 4)
  return true
}

/** 把当前敌人血量压到 1，方便一键验证胜利流程。 */
export function weakenEnemy(): void {
  const b = app.get().battle
  if (!b) return
  app.act(() => {
    b.enemy.hp = 1
  })
}

if (import.meta.env.DEV) {
  Object.assign(globalThis, {
    __rc: {
      app,
      preview,
      run,
      reachable,
      toTitle,
      newRun,
      startBattle,
      gotoKind,
      fight,
      weakenEnemy,
      battleWon,
      battleLost,
      travel,
      openShop,
      openTreasure,
      leaveShop,
      leaveReward,
      takeRewardCard,
      takeRewardRelic,
      pickCard,
      cancelPick,
      closePickToMap,
      restHeal,
      restUpgrade,
      toggleMute,
      dismissHint,
      // 战斗流程（供自动跑通脚本使用）
      cardCost,
      canPlay,
      playCard,
      prepareClash,
      applyClashStep,
      settleClash,
      enemyPhase,
      startPlayerTurn,
      // 事件与商店
      chooseEventOption,
      closeEventResult,
      buyItem,
      buyRemoval,
      ENEMIES,
      ENEMY_BY_ID,
      ALL_CARDS,
      CARD_BY_ID,
      EVENT_BY_ID,
      RELIC_BY_ID,
    },
  })
}

export { LAYERS }
