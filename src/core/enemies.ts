import type { EnemyDef } from './types'

const r = (v: number) => ({ k: 'rift' as const, v })
const w = (v: number) => ({ k: 'ward' as const, v })
const e = (v: number) => ({ k: 'echo' as const, v })
const p = (v: number) => ({ k: 'pierce' as const, v })

/**
 * 全部敌人都是「符阵造物」：没有五官、没有肢体，只有旋转的环与刻痕。
 * 强度按幕内深度缩放由 run.ts 处理。
 */
export const ENEMIES: EnemyDef[] = [
  {
    id: 'spin',
    name: '第一印·旋',
    title: '它只是转，转久了就疼',
    kind: 'normal',
    hp: [34, 40],
    poise: 22,
    color: '#8b6cf0',
    accent: '#e8b33c',
    plan: 'cycle',
    intents: [
      { name: '回旋', syms: [r(5), w(4)] },
      { name: '加速', syms: [r(4), r(4)] },
      { name: '闭合', syms: [w(7), r(3)] },
    ],
  },
  {
    id: 'hush',
    name: '静默之环',
    title: '没有声音，所以你听不见自己要来了',
    kind: 'normal',
    hp: [40, 46],
    poise: 26,
    color: '#6fd3c7',
    accent: '#f4e9d8',
    plan: 'cycle',
    intents: [
      { name: '噤声', syms: [w(6), w(6)] },
      { name: '下沉', syms: [r(7), r(5)] },
      { name: '包围', syms: [r(3), r(3), r(3)] },
    ],
  },
  {
    id: 'cipher',
    name: '无名之数',
    title: '它一直在算，算到你不存在',
    kind: 'normal',
    hp: [36, 42],
    poise: 20,
    color: '#e2688a',
    accent: '#8b6cf0',
    plan: 'random',
    intents: [
      { name: '进位', syms: [r(6), r(2)], w: 3 },
      { name: '取余', syms: [e(5)], w: 2 },
      { name: '除尽', syms: [p(6)], w: 1 },
      { name: '归零', syms: [w(8)], w: 2 },
    ],
  },
  {
    id: 'fracture',
    name: '碎裂之数',
    title: '每一块碎片都还在继续数下去',
    kind: 'normal',
    hp: [44, 50],
    poise: 30,
    color: '#e8b33c',
    accent: '#e2688a',
    plan: 'cycle',
    intents: [
      { name: '崩解', syms: [r(4), r(4), r(4)] },
      { name: '重组', syms: [w(5), r(6)] },
      { name: '再裂', syms: [p(7)] },
    ],
  },
  {
    id: 'lattice',
    name: '格',
    title: '所有格子都已填满，除了你那一格',
    kind: 'normal',
    hp: [42, 48],
    poise: 28,
    color: '#7fa7f0',
    accent: '#6fd3c7',
    plan: 'cycle',
    intents: [
      { name: '划线', syms: [r(3), w(3), r(3)] },
      { name: '交错', syms: [e(4), r(5)] },
      { name: '封格', syms: [w(10)] },
    ],
  },
  {
    id: 'mirror',
    name: '镜像符',
    title: '它抄你的笔迹，抄得比你更像你',
    kind: 'normal',
    hp: [38, 44],
    poise: 24,
    color: '#c58cf0',
    accent: '#e2688a',
    plan: 'cycle',
    intents: [
      { name: '临摹', syms: [r(5), r(5)] },
      { name: '翻面', syms: [e(6), w(4)] },
      { name: '涂改', syms: [p(5), r(3)] },
    ],
  },

  /* ── 精英 ── */
  {
    id: 'chandelier',
    name: '倒悬之仪',
    title: '灯灭了，仪式还在继续',
    kind: 'elite',
    hp: [86, 96],
    poise: 48,
    color: '#e8b33c',
    accent: '#8b6cf0',
    plan: 'cycle',
    intents: [
      { name: '垂落', syms: [r(6), r(6), r(6)] },
      { name: '供养', syms: [w(8), w(6)] },
      { name: '倾泻', syms: [p(9), r(4)] },
      { name: '熄灭', syms: [e(6), e(6)] },
    ],
  },
  {
    id: 'loom',
    name: '织律者',
    title: '它把法则纺成线，再从线上剪断你',
    kind: 'elite',
    hp: [94, 104],
    poise: 54,
    color: '#6fd3c7',
    accent: '#f4e9d8',
    plan: 'cycle',
    intents: [
      { name: '起纬', syms: [r(4), r(4), r(4)] },
      { name: '收经', syms: [w(6), w(6), w(6)] },
      { name: '断线', syms: [p(8), p(4)] },
      { name: '成匹', syms: [r(7), e(5), r(7)] },
    ],
  },
  {
    id: 'ledger',
    name: '总帐',
    title: '每一笔都要结清，包括你这一笔',
    kind: 'elite',
    hp: [100, 110],
    poise: 60,
    color: '#e2688a',
    accent: '#e8b33c',
    plan: 'cycle',
    intents: [
      { name: '催收', syms: [r(9), r(5)] },
      { name: '计息', syms: [w(12)] },
      { name: '核销', syms: [e(7), e(7)] },
      { name: '结转', syms: [p(10), r(6)] },
    ],
  },

  /* ── BOSS ── */
  {
    id: 'firstword',
    name: '最初之字',
    title: '万物都是它的抄本，而它从未被读懂',
    kind: 'boss',
    hp: [230, 230],
    poise: 90,
    color: '#e8b33c',
    accent: '#e2688a',
    plan: 'cycle',
    intents: [
      { name: '第一划', syms: [r(7), r(7), w(6)] },
      { name: '第二划', syms: [w(10), e(8)] },
      { name: '第三划', syms: [r(5), r(5), r(5), r(5)] },
      { name: '闭卷', syms: [w(14), w(8)] },
      { name: '誊写', syms: [p(9), r(8), e(6)] },
      { name: '终稿', syms: [r(10), r(10), r(10)] },
    ],
  },
]

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e2) => [e2.id, e2]))

export const NORMAL_POOL = ENEMIES.filter((e2) => e2.kind === 'normal')
export const ELITE_POOL = ENEMIES.filter((e2) => e2.kind === 'elite')
export const BOSS_POOL = ENEMIES.filter((e2) => e2.kind === 'boss')

/** 按幕内进度缩放敌人强度 */
export function scaleEnemy(def: EnemyDef, depth: number): EnemyDef {
  const k = 1 + depth * 0.14
  return {
    ...def,
    hp: [Math.round(def.hp[0] * k), Math.round(def.hp[1] * k)],
    poise: Math.round(def.poise * (1 + depth * 0.1)),
    intents: def.intents.map((it) => ({
      ...it,
      syms: it.syms.map((s) => ({ ...s, v: Math.round(s.v * (1 + depth * 0.07)) })),
    })),
  }
}
