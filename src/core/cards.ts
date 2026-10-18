import type { CardDef, CardInst, CardFx, Archetype, Rarity } from './types'
import { uid } from './rng'

const r = (v: number) => ({ k: 'rift' as const, v })
const w = (v: number) => ({ k: 'ward' as const, v })
const e = (v: number) => ({ k: 'echo' as const, v })
const p = (v: number) => ({ k: 'pierce' as const, v })
const ln = (v: number) => ({ k: 'link' as const, v })
const sp = (v = 0) => ({ k: 'spiral' as const, v })

interface Def extends CardDef {}

function def(
  id: string,
  name: string,
  arch: Archetype,
  rarity: Rarity,
  cost: number,
  syms: CardDef['syms'],
  flavor: string,
  fx?: CardFx[],
  extra?: Partial<CardDef>,
): Def {
  return { id, name, arch, rarity, cost, syms, flavor, fx, ...extra }
}

/* ────────────────────────── 基础牌 ────────────────────────── */

export const STARTER: Def[] = [
  def('cut', '刻痕', 'none', 'common', 1, [r(6)], '一刀一痕，痕痕有记。'),
  def('ring', '铸环', 'none', 'common', 1, [w(6)], '先画圆，再谈其他。'),
]

/* ────────────────────────── 裂痕 · 直伤与穿刺 ────────────────────────── */

export const RIFT_CARDS: Def[] = [
  def('sharp', '锐锋', 'rift', 'common', 0, [r(3)], '起手的一笔，往往最锋利。', undefined),
  def('bifid', '双歧', 'rift', 'common', 1, [r(3), r(3)], '两条路都通向同一个终点。'),
  def('cleave', '断章', 'rift', 'common', 2, [r(4), r(4)], '断句即断章，断章即断命。'),
  def('impale', '贯穿之铭', 'rift', 'common', 1, [p(5)], '它不认墙，只认方向。'),
  def('scorch', '灼痕', 'rift', 'common', 1, [r(4)], '烧不掉的字，会烧掉别的。', [{ t: 'stagger', n: 3 }]),
  def('deepen', '裂隙加深', 'rift', 'uncommon', 2, [r(5), ln(3)], '你把它挖得更深，它就认得了你。'),
  def('rend', '撕裂', 'rift', 'uncommon', 1, [r(4), r(4)], '两笔之间空出来的地方最疼。'),
  def('sentence', '断罪', 'rift', 'uncommon', 2, [r(9)], '判词只有一句，且不留上诉。'),
  def('combo', '连斩', 'rift', 'uncommon', 1, [r(3), r(3), ln(2)], '第一下是问，第二下是答。'),
  def('hone', '锋锐', 'rift', 'uncommon', 1, [r(2)], '磨刀不误刻字。', [{ t: 'buff', id: 'focus', n: 3 }]),
  def('volley', '穿刺·矢', 'rift', 'uncommon', 2, [p(4), p(4)], '两支都找得到缝隙。'),
  def('finale', '终焉', 'rift', 'rare', 3, [r(6), r(6), r(6)], '写完这三个字，纸就没有了。'),
  def('annihilate', '抹除', 'rift', 'rare', 3, [r(14)], '不是覆盖，是让那一行从未存在。', undefined, { exhaust: true }),
  def('lances', '万箭', 'rift', 'rare', 2, [p(3), p(3), p(3)], '缝隙够多，就不需要门。'),
  // ── 蚀：慢，但会自己长 ──
  def('etch', '蚀刻', 'rift', 'common', 1, [r(3)], '刻下去的字会自己往里长。', [{ t: 'buff', id: 'venom', n: 2 }]),
  def('corrode', '蛀', 'rift', 'uncommon', 1, [p(3)], '它不撞门，它把门吃掉。', [{ t: 'buff', id: 'venom', n: 2 }]),
  def('hemorrhage', '渗血', 'rift', 'uncommon', 2, [r(7)], '伤口自己会数数。', [{ t: 'damage', n: 4 }]),
  def('whetstone', '砺石', 'rift', 'common', 0, [], '磨刀不误刻字。', [{ t: 'buff', id: 'focus', n: 2 }]),
  def('severance', '断念', 'rift', 'rare', 3, [r(5), r(5), ln(4)], '念断了，字才有地方落。'),
]

/* ────────────────────────── 回环 · 护盾与反击 ────────────────────────── */

export const LOOP_CARDS: Def[] = [
  def('calm', '静水', 'loop', 'common', 0, [w(3)], '静水最能藏字。'),
  def('buckle', '环扣', 'loop', 'common', 1, [w(4), w(4)], '扣上，再扣上。'),
  def('ripple', '涟漪', 'loop', 'common', 1, [e(4)], '碰它，它就记住你的形状。'),
  def('reinforce', '补壁', 'loop', 'common', 1, [w(5), ln(2)], '墙不是砌出来的，是补出来的。'),
  def('bulwark', '铁壁', 'loop', 'common', 2, [w(9)], '厚到听不见外面的声音。'),
  def('counterwall', '回响之壁', 'loop', 'uncommon', 2, [w(5), e(3)], '先立一道墙，再把墙变成回声。'),
  def('twinmirror', '双镜', 'loop', 'uncommon', 2, [e(4), e(4)], '两面镜子之间没人。'),
  def('shockwave', '反震', 'loop', 'uncommon', 1, [e(2), e(2), e(2)], '抖一抖，把力还回去。'),
  def('transmute', '守转攻', 'loop', 'uncommon', 1, [w(6)], '守得越久，还手越重。', [{ t: 'damageFromBlock', ratio: 0.5 }]),
  def('mirrorhall', '镜面回廊', 'loop', 'uncommon', 2, [e(3), e(3), w(3)], '走廊没有尽头，只有你的倒影在替你挡。'),
  def('fortress', '壁垒', 'loop', 'rare', 2, [w(7), w(7)], '两道墙之间的空间，也算安全。'),
  def('judgement', '天平坠落', 'loop', 'rare', 3, [w(8), e(6)], '秤盘落地的那一声，就是判决。', undefined, { exhaust: true }),
  def('aegis', '不动之环', 'loop', 'rare', 2, [w(12)], '不动，是因为无处可动。'),
  // ── 生 / 守：把护盾与回复变成每回合都会自己回来的东西 ──
  def('sanctum', '内殿', 'loop', 'uncommon', 2, [w(3)], '里面小得只坐得下一个人，但外面的都进不来。', [{ t: 'buff', id: 'warden', n: 2 }]),
  def('springwater', '泉眼', 'loop', 'uncommon', 1, [w(2)], '它一直在漏，漏出来的都是好的。', [{ t: 'buff', id: 'regen', n: 2 }]),
  def('bastion', '坚垒', 'loop', 'common', 2, [w(4), w(4)], '一层不够，就再砌一层。', [{ t: 'block', n: 4 }]),
  def('retort', '反唇', 'loop', 'uncommon', 1, [e(2), r(2), ln(2)], '是你先说的。'),
  def('caldron', '熔炉', 'loop', 'rare', 3, [w(5), w(5)], '扔进去的东西，出来时都变了个样。', [{ t: 'buff', id: 'warden', n: 2 }]),
]

/* ────────────────────────── 共鸣 · 编排与滚雪球 ────────────────────────── */

export const RESO_CARDS: Def[] = [
  def('echoic', '同调', 'reso', 'common', 1, [r(3), r(3), ln(2)], '第二笔跟着第一笔的节奏走。'),
  def('copy', '复写', 'reso', 'common', 1, [r(4), sp()], '抄一遍，就算记住了。'),
  def('transcribe', '抄录', 'reso', 'common', 0, [], '先记下来，之后再想。', [{ t: 'draw', n: 1 }]),
  def('longline', '长句', 'reso', 'common', 2, [r(2), r(2), r(2), r(2)], '一句话说得越长，越像咒文。'),
  def('chamber', '共鸣腔', 'reso', 'common', 1, [w(3), w(3), ln(2)], '空腔越大，回音越厚。'),
  def('vein', '涌泉', 'reso', 'uncommon', 1, [], '灵光是会自己找上门的。', [{ t: 'energy', n: 1 }, { t: 'draw', n: 1 }]),
  def('triplet', '三连铃', 'reso', 'uncommon', 2, [r(3), r(3), r(3), ln(3)], '第三声才是真的。'),
  def('recall', '回引', 'reso', 'uncommon', 2, [r(6), sp()], '你写过的，都会回来找你。'),
  def('invoke', '引律', 'reso', 'uncommon', 1, [r(3), sp(), ln(2)], '把第一位请回来，再加一点。'),
  def('frenzy', '抄写狂热', 'reso', 'uncommon', 1, [r(2)], '手比脑子快的时候，字更好看。', [{ t: 'draw', n: 2 }], { exhaust: true }),
  def('coda', '无尽抄本', 'reso', 'rare', 3, [r(4), r(4), sp()], '本子翻不完，句子也写不完。'),
  def('ember', '灵光余烬', 'reso', 'rare', 0, [], '灰里还剩一点光。', [{ t: 'energy', n: 2 }], { exhaust: true }),
  def('chorus', '众声', 'reso', 'rare', 2, [r(3), r(3), r(3), r(3), ln(4)], '所有人一起念，数值就变了。'),
  // ── 涌：把「打得长」变成收益 ──
  def('overtone', '泛音', 'reso', 'common', 1, [r(3), r(3)], '一个音里藏着好几个。', [{ t: 'buff', id: 'surge', n: 3 }]),
  def('cascade', '层叠', 'reso', 'uncommon', 2, [r(3), r(3), r(3)], '每一层都在往下一层倒。', [{ t: 'buff', id: 'surge', n: 2 }]),
  def('cadence', '节拍', 'reso', 'common', 1, [w(3), w(3)], '先定拍子，再定别的。', [{ t: 'draw', n: 1 }]),
  def('reprise', '复奏', 'reso', 'uncommon', 2, [r(5), sp(), ln(2)], '再来一遍，这次重一点。'),
  def('ledgerline', '谱线', 'reso', 'common', 0, [r(2), ln(1)], '写在最下面的那一行，只有懂的人会看。'),
]

/* ────────────────────────── 事件 / 特殊 ────────────────────────── */

export const SPECIAL_CARDS: Def[] = [
  def('paradox', '悖论', 'none', 'special', 1, [r(5), e(5)], '既是攻，也是守，取决于谁先碰它。'),
  def('nullword', '无字', 'none', 'special', 0, [w(4)], '什么都没写，所以什么都不能被抹掉。'),
  def('hollow', '空铭', 'none', 'special', 2, [r(3), r(3), ln(3)], '空的地方，正好可以刻更深的东西。'),
  def('chime', '钟摆', 'none', 'special', 1, [e(3), w(3)], '来回一次，时间就用掉一格。'),
  def('shatter', '碎律', 'none', 'special', 2, [p(5), sp()], '规则碎了，就没人管你打几下。'),
  def('vigil', '守夜', 'none', 'special', 1, [w(4), w(4), ln(2)], '夜里画的圆，天亮才闭。'),
]

export const ALL_CARDS: Def[] = [
  ...STARTER,
  ...RIFT_CARDS,
  ...LOOP_CARDS,
  ...RESO_CARDS,
  ...SPECIAL_CARDS,
]

export const CARD_BY_ID: Record<string, Def> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]))

export const ARCH_NAME: Record<Archetype, string> = {
  rift: '裂痕',
  loop: '回环',
  reso: '共鸣',
  none: '无属',
}

export const ARCH_COLOR: Record<Archetype, string> = {
  rift: 'var(--arch-rift)',
  loop: 'var(--arch-loop)',
  reso: 'var(--arch-reso)',
  none: 'var(--arch-none)',
}

export const RARITY_NAME: Record<Rarity, string> = {
  common: '常',
  uncommon: '异',
  rare: '秘',
  special: '特',
}

/** 把 Def 实例化为带 uid 的实例 */
export function instantiate(d: CardDef, upgraded = false): CardInst {
  return { ...d, uid: uid('c'), bonus: upgraded ? 2 : 0, upgraded }
}

export function starterDeck(): CardInst[] {
  const deck: CardInst[] = []
  for (let i = 0; i < 5; i++) deck.push(instantiate(CARD_BY_ID['cut']))
  for (let i = 0; i < 4; i++) deck.push(instantiate(CARD_BY_ID['ring']))
  deck.push(instantiate(CARD_BY_ID['bifid']))
  return deck
}

export function rollRarity(): Rarity {
  const rnd = Math.random()
  if (rnd < 0.06) return 'rare'
  if (rnd < 0.36) return 'uncommon'
  return 'common'
}

/** 单张卡的显示文本：把符式序列渲染成人类可读的短句 */
export function cardSummary(c: CardDef): string {
  const parts: string[] = []
  const cnt: Record<string, number[]> = {}
  for (const s of c.syms) {
    ;(cnt[s.k] ??= []).push(s.v)
  }
  const order: [string, string][] = [
    ['rift', '裂'],
    ['pierce', '穿'],
    ['ward', '铸'],
    ['echo', '反'],
    ['link', '缀'],
    ['spiral', '引'],
  ]
  for (const [k, label] of order) {
    if (cnt[k]) parts.push(`${label} ${cnt[k].map((v) => (k === 'spiral' ? '' : v)).join('/')}`.trim())
  }
  return parts.join(' · ')
}
