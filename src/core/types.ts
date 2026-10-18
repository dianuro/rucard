/** 全局类型定义。 */

/** 符式种类：六种，玩家与敌人共用同一套词汇。 */
export type SymKind =
  | 'rift' // 裂 — 攻击
  | 'ward' // 铸 — 护盾
  | 'echo' // 反 — 抵消来袭并反弹
  | 'pierce' // 穿 — 无视护盾的攻击
  | 'link' // 缀 — 把数值加给前一个符式
  | 'spiral' // 引 — 追加本卡首个符式一次

export interface Sym {
  k: SymKind
  v: number
}

export type Archetype = 'rift' | 'loop' | 'reso' | 'none'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'special'

export interface CardDef {
  id: string
  name: string
  /** 一句话风味文本 */
  flavor: string
  arch: Archetype
  rarity: Rarity
  cost: number
  /** 原始符式序列，出牌时会被 link / spiral 展开 */
  syms: Sym[]
  /** 打出后的一次性效果，用关键字描述 */
  fx?: CardFx[]
  /** 消耗：本场战斗不再回到牌堆 */
  exhaust?: boolean
  /** 无法在战斗中获取 */
  token?: boolean
}

export type CardFx =
  | { t: 'draw'; n: number }
  | { t: 'energy'; n: number }
  | { t: 'block'; n: number }
  | { t: 'damage'; n: number } // 直接伤害，不参与对撞
  | { t: 'damageFromBlock'; ratio: number } // 以当前护盾为基数造成伤害
  | { t: 'heal'; n: number }
  | { t: 'stagger'; n: number } // 直接破绽
  | { t: 'venomBurst'; mult: number } // 立即结算：按当前「蚀」造成 mult 倍伤害
  | { t: 'damagePerSym'; mult: number } // 按阵型里的符式总数造成伤害
  | { t: 'buff'; id: BuffId; n: number }

export type BuffId =
  | 'focus' // 蓄势：本回合内所有裂/穿 +n
  | 'venom' // 蚀：敌方每回合结束损失 n
  | 'regen' // 生：玩家每回合开始回复 n
  | 'warden' // 守：每回合开始获得 n 护盾
  | 'surge' // 涌：本回合大卡（3+符式）额外 +n 数值

export interface CardInst extends CardDef {
  uid: string
  /** 本场战斗内被圣痕/事件修改过的数值加成 */
  bonus: number
  upgraded?: boolean
}

export type EnemyKind = 'normal' | 'elite' | 'boss'

export interface EnemyDef {
  id: string
  name: string
  /** 风味短句 */
  title: string
  kind: EnemyKind
  hp: [number, number]
  /** 韧性阈值：累计破绽到达后僵直 */
  poise: number
  /** 意图循环，按顺序取用 */
  intents: IntentDef[]
  /** 意图选取策略 */
  plan?: 'cycle' | 'random'
  color: string
  accent: string
  /** 招式的符式数量随层数成长的强度系数 */
  scale?: number
}

export interface IntentDef {
  name: string
  syms: Sym[]
  /** 敌人自己获得护盾等附带效果 */
  fx?: CardFx[]
  /** 权重，仅 random 策略下有效 */
  w?: number
}

export interface EnemyState {
  def: EnemyDef
  hp: number
  maxHp: number
  block: number
  poise: number
  maxPoise: number
  stagger: number
  intent: IntentDef
  intentIndex: number
  buffs: Record<string, number>
  /** 演示用：动画定位 */
  seed: string
}

export interface PlayerState {
  hp: number
  maxHp: number
  block: number
  energy: number
  maxEnergy: number
  shards: number
  drawPile: CardInst[]
  hand: CardInst[]
  discardPile: CardInst[]
  exhaustPile: CardInst[]
  buffs: Record<string, number>
  handSize: number
}

export type NodeKind = 'battle' | 'elite' | 'event' | 'rest' | 'shop' | 'treasure' | 'boss'

export interface MapNode {
  id: string
  layer: number
  index: number
  kind: NodeKind
  x: number
  y: number
  next: string[]
  visited?: boolean
}

export interface RunMap {
  nodes: Record<string, MapNode>
  layers: string[][]
  seed: number
  start: string[]
}

export interface RelicDef {
  id: string
  name: string
  text: string
  color: string
}

export type EventEffect =
  | { t: 'heal'; n: number }
  | { t: 'hurt'; n: number }
  | { t: 'shards'; n: number }
  | { t: 'maxHp'; n: number }
  | { t: 'relic' }
  | { t: 'card'; count: number; rarity?: Rarity }
  | { t: 'specialCard' }
  | { t: 'addCard'; id: string }
  | { t: 'remove' }
  | { t: 'upgrade' }
  | { t: 'duplicate' }
  | { t: 'well' }

export interface EventOption {
  label: string
  detail: string
  effects: EventEffect[]
  require?: (s: { shards: number; hp: number }) => boolean
}

export interface EventDef {
  id: string
  name: string
  text: string
  options: EventOption[]
}

export type Screen =
  | { t: 'title' }
  | { t: 'map' }
  | { t: 'battle' }
  | { t: 'reward'; kind: 'battle' | 'elite' | 'boss' }
  | { t: 'event'; id: string }
  | { t: 'rest' }
  | { t: 'shop' }
  | { t: 'treasure' }
  | { t: 'deck' }
  | { t: 'gameover'; win: boolean }

export type PickPurpose = 'remove' | 'upgrade' | 'duplicate'

export type BattlePhase = 'intro' | 'player' | 'clash' | 'enemy' | 'won' | 'lost'

export interface LogEntry {
  text: string
  tone?: 'good' | 'bad' | 'neutral' | 'special'
}

export interface BattleState {
  enemy: EnemyState
  turn: number
  phase: BattlePhase
  formation: Sym[]
  log: LogEntry[]
  /** 本场战斗已打出的符式计数（圣痕用） */
  playedCards: number
  clashWinThisTurn: boolean
  firstCardThisTurn: boolean
  usedStaggerBonus: boolean
  target: { hp: number; poise: number } | null
}
