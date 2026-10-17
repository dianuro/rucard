/**
 * 对撞结算机。
 *
 * 玩家在一回合内打出的卡会把符式依次「填」进阵型（formation），
 * 与敌方意图（intent）逐位对撞。下标相同的两个符式互相作用，
 * 多出的一侧则直接结算 —— 这正是本作的核心决策空间：
 * 哪个符式该去抵消，哪个认了挨打，哪个留到敌方意图之外白嫖。
 *
 * 单个下标的结算次序固定为：
 *   ① 双方的「铸」先落地成护盾 → ② 双方「裂/穿」逐位对撞 →
 *   ③ 未取消的攻击结算 → ④ 「反」抵消来袭并反弹。
 *
 * resolveClash 是纯函数：返回逐步事件 + 净变化量。
 * UI 先用它做「预演」（把结果标注在意图上），再用它驱动动画回放。
 */

import type { CardInst, IntentDef, Sym, SymKind } from './types'

export const KIND_NAME: Record<SymKind, string> = {
  rift: '裂',
  ward: '铸',
  echo: '反',
  pierce: '穿',
  link: '缀',
  spiral: '引',
}

export const KIND_DESC: Record<SymKind, string> = {
  rift: '裂 · 攻击。与敌方裂逐位对撞，值大者胜；胜者的符式同样被消耗，不造成伤害。',
  ward: '铸 · 护盾。在下标处先落地成护盾，抵挡同下标及之后的一切来袭伤害。',
  echo: '反 · 反击。抵消同下标敌方攻击，并把自身数值反弹回去。',
  pierce: '穿 · 穿刺。结算时无视敌方护盾，全额命中。',
  link: '缀 · 连结。不占位，把数值加给同一张卡的紧邻前一个符式（若是首符式则加给自己）。',
  spiral: '引 · 回引。不占位，在本卡末尾追加一次首个符式的复制。',
}

export const KIND_SHORT: Record<SymKind, string> = {
  rift: '伤害',
  ward: '护盾',
  echo: '反弹',
  pierce: '穿盾',
  link: '并入前位',
  spiral: '复制首位',
}

const isAtk = (k: SymKind) => k === 'rift' || k === 'pierce'

/** 展开一张卡的符式：缀把数值加到前一位，引复制首位。 */
export function expandSyms(syms: readonly Sym[]): Sym[] {
  const out: Sym[] = []
  let spiral = false
  for (const s of syms) {
    if (s.k === 'link') {
      if (out.length === 0) out.push({ k: 'rift', v: s.v })
      else out[out.length - 1] = { k: out[out.length - 1].k, v: out[out.length - 1].v + s.v }
      continue
    }
    if (s.k === 'spiral') {
      spiral = true
      continue
    }
    out.push({ k: s.k, v: s.v })
  }
  if (spiral && out.length > 0) out.push({ k: out[0].k, v: out[0].v })
  return out
}

export function cardSyms(card: CardInst): Sym[] {
  const base = expandSyms(card.syms)
  if (card.bonus) for (const s of base) s.v += card.bonus
  return base
}

export function intentSyms(intent: IntentDef): Sym[] {
  return expandSyms(intent.syms)
}

export type ClashOutcome =
  | 'clash-win'
  | 'clash-lose'
  | 'clash-tie'
  | 'hit'
  | 'blocked'
  | 'pierce'
  | 'echo'
  | 'gain-ward'
  | 'endure'
  | 'endured'
  | 'idle'

/** 净变化量：hp 为负表示掉血，block 为负表示被消耗 */
export interface Delta {
  hp?: number
  block?: number
  poise?: number
}

export interface ClashStep {
  i: number
  a: Sym | null
  b: Sym | null
  outcome: ClashOutcome
  enemy: Delta
  player: Delta
  /** 飘字：展示用数值（可能大于实际掉血，因为被护盾吸收了） */
  shown: { toEnemy?: number; toPlayer?: number }
  note: string
  clashWin: boolean
}

export interface ResolveResult {
  steps: ClashStep[]
  enemyHp: number
  enemyBlock: number
  enemyPoise: number
  enemyMaxPoise: number
  staggered: boolean
  playerHp: number
  playerBlock: number
  clashWins: number
}

export interface ResolveInput {
  formation: readonly Sym[]
  intent: readonly Sym[]
  enemyHp: number
  enemyBlock: number
  enemyPoise: number
  enemyMaxPoise: number
  enemyStagger: number
  playerHp: number
  playerBlock: number
}

export const STAGGER_MULT = 1.5
export const CLASH_WIN_POISE = 2
export const POISE_GROWTH = 1.45

export function resolveClash(input: ResolveInput): ResolveResult {
  const { formation, intent } = input
  let eHp = input.enemyHp
  let eBlock = input.enemyBlock
  let ePoise = input.enemyPoise
  let eMaxPoise = input.enemyMaxPoise
  let pHp = input.playerHp
  let pBlock = input.playerBlock
  let staggered = false
  let clashWins = 0

  const mult = input.enemyStagger > 0 ? STAGGER_MULT : 1
  const steps: ClashStep[] = []

  const addPoise = (v: number) => {
    ePoise += v
    if (ePoise >= eMaxPoise) {
      staggered = true
      ePoise = 0
      eMaxPoise = Math.ceil(eMaxPoise * POISE_GROWTH)
    }
  }

  const hitEnemy = (raw: number, ignoreBlock: boolean, poise: number): { hp: number; shown: number } => {
    const total = Math.max(0, Math.round(raw * mult))
    let rest = total
    if (!ignoreBlock) {
      const absorbed = Math.min(eBlock, rest)
      eBlock -= absorbed
      rest -= absorbed
    }
    eHp -= rest
    if (poise > 0 && total > 0) addPoise(poise)
    return { hp: rest, shown: total }
  }

  const hitPlayer = (raw: number, ignoreBlock: boolean): { hp: number; shown: number } => {
    const total = Math.max(0, Math.round(raw))
    let rest = total
    if (!ignoreBlock) {
      const absorbed = Math.min(pBlock, rest)
      pBlock -= absorbed
      rest -= absorbed
    }
    pHp -= rest
    return { hp: rest, shown: total }
  }

  const n = Math.max(formation.length, intent.length)

  for (let i = 0; i < n; i++) {
    const a = formation[i] ?? null
    const b = intent[i] ?? null
    if (!a && !b) continue

    const eBefore = eBlock
    const pBefore = pBlock
    const notes: string[] = []
    let outcome: ClashOutcome = 'idle'
    let clashWin = false
    let dmgToEnemyShown = 0
    let dmgToPlayerShown = 0
    let enemyHpLost = 0
    let playerHpLost = 0

    // ① 铸盾先行
    if (a?.k === 'ward') {
      pBlock += a.v
      notes.push(`铸盾 ${a.v}`)
      outcome = 'gain-ward'
    }
    if (b?.k === 'ward') {
      eBlock += b.v
      notes.push(`敌方铸盾 ${b.v}`)
      outcome = 'gain-ward'
    }

    let playerAtkLive = !!a && isAtk(a.k)
    let enemyAtkLive = !!b && isAtk(b.k)
    let playerEchoLive = a?.k === 'echo'
    let enemyEchoLive = b?.k === 'echo'

    // ② 裂与裂逐位对撞
    if (playerAtkLive && enemyAtkLive && a && b) {
      if (a.v > b.v) {
        clashWin = true
        clashWins++
        addPoise(CLASH_WIN_POISE)
        notes.push(`对撞胜出 · 抵消敌方 ${b.v}`)
        outcome = 'clash-win'
      } else if (a.v < b.v) {
        notes.push(`对撞落败 · 被抵消 ${a.v}`)
        outcome = 'clash-lose'
      } else {
        notes.push(`同归于尽 · ${a.v}`)
        outcome = 'clash-tie'
      }
      playerAtkLive = false
      enemyAtkLive = false
    }

    // ③ 反击优先抵消攻击
    if (playerAtkLive && enemyEchoLive && b) {
      playerAtkLive = false
      enemyEchoLive = false
      const r = hitPlayer(b.v, false)
      playerHpLost += r.hp
      dmgToPlayerShown = Math.max(dmgToPlayerShown, r.shown)
      notes.push(`攻击被反击取消 · 承受 ${r.shown}`)
      outcome = 'echo'
    }
    if (enemyAtkLive && playerEchoLive && a) {
      enemyAtkLive = false
      playerEchoLive = false
      const r = hitEnemy(a.v, false, a.v)
      enemyHpLost += r.hp
      dmgToEnemyShown = Math.max(dmgToEnemyShown, r.shown)
      notes.push(`反击取消敌方攻击 · 反弹 ${r.shown}`)
      outcome = 'echo'
    }

    // ④ 剩余攻击结算
    if (playerAtkLive && a) {
      const pierce = a.k === 'pierce'
      const r = hitEnemy(a.v, pierce, a.v)
      enemyHpLost += r.hp
      dmgToEnemyShown = Math.max(dmgToEnemyShown, r.shown)
      if (r.hp > 0) {
        outcome = pierce ? 'pierce' : 'hit'
        notes.push(pierce ? `穿刺 · 无视护盾命中 ${r.shown}` : `命中 ${r.shown}`)
      } else {
        outcome = 'blocked'
        notes.push(`被护盾完全吸收`)
      }
    }
    if (enemyAtkLive && b) {
      const pierce = b.k === 'pierce'
      const r = hitPlayer(b.v, pierce)
      playerHpLost += r.hp
      dmgToPlayerShown = Math.max(dmgToPlayerShown, r.shown)
      if (r.hp > 0) {
        outcome = 'endure'
        notes.push(pierce ? `穿刺贯穿 · 承受 ${r.shown}` : `承受 ${r.shown}`)
      } else if (outcome === 'idle' || outcome === 'gain-ward') {
        outcome = 'endured'
        notes.push(`完全抵挡 ${r.shown}`)
      } else {
        notes.push(`护盾挡下 ${r.shown}`)
      }
    }

    // ⑤ 双方反击互相反弹
    if (playerEchoLive && enemyEchoLive && a && b) {
      const p = hitPlayer(b.v, false)
      const e = hitEnemy(a.v, false, a.v)
      playerHpLost += p.hp
      enemyHpLost += e.hp
      dmgToPlayerShown = Math.max(dmgToPlayerShown, p.shown)
      dmgToEnemyShown = Math.max(dmgToEnemyShown, e.shown)
      notes.push(`双重反击`)
      outcome = 'echo'
    } else if (playerEchoLive && a) {
      const e = hitEnemy(a.v, false, a.v)
      enemyHpLost += e.hp
      dmgToEnemyShown = Math.max(dmgToEnemyShown, e.shown)
      notes.push(`反击 · 反弹 ${e.shown}`)
      outcome = 'echo'
    } else if (enemyEchoLive && b) {
      const p = hitPlayer(b.v, false)
      playerHpLost += p.hp
      dmgToPlayerShown = Math.max(dmgToPlayerShown, p.shown)
      notes.push(`敌方反击 · 承受 ${p.shown}`)
      outcome = 'echo'
    }

    const enemy: Delta = {}
    const player: Delta = {}
    if (enemyHpLost) enemy.hp = -enemyHpLost
    if (playerHpLost) player.hp = -playerHpLost
    if (eBlock !== eBefore) enemy.block = eBlock - eBefore
    if (pBlock !== pBefore) player.block = pBlock - pBefore
    if (clashWin) enemy.poise = CLASH_WIN_POISE

    steps.push({
      i, a, b, outcome, enemy, player,
      shown: {
        toEnemy: dmgToEnemyShown || undefined,
        toPlayer: dmgToPlayerShown || undefined,
      },
      note: notes.join(' · '),
      clashWin,
    })
  }

  return {
    steps,
    enemyHp: eHp,
    enemyBlock: eBlock,
    enemyPoise: ePoise,
    enemyMaxPoise: eMaxPoise,
    staggered,
    playerHp: pHp,
    playerBlock: pBlock,
    clashWins,
  }
}

/** 敌方下一招 */
export function nextIntent(
  intents: readonly IntentDef[],
  index: number,
  plan: 'cycle' | 'random',
  rng: { weighted: <T>(arr: readonly T[], w: (t: T) => number) => T },
): { intent: IntentDef; index: number } {
  if (plan === 'random') return { intent: rng.weighted(intents, (it) => it.w ?? 1), index }
  return { intent: intents[index % intents.length], index: (index + 1) % intents.length }
}

export function formationSummary(formation: readonly Sym[]) {
  let dmg = 0
  let block = 0
  let counter = 0
  for (const s of formation) {
    if (isAtk(s.k)) dmg += s.v
    else if (s.k === 'ward') block += s.v
    else if (s.k === 'echo') counter += s.v
  }
  return { dmg, block, counter }
}

export function symIsAtk(k: SymKind): boolean {
  return isAtk(k)
}
