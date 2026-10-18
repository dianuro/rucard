import type { RelicDef } from './types'

/** 圣痕：跨战斗生效的被动。效果在 store.ts 中以 id 分支实现。 */
export const RELICS: RelicDef[] = [
  { id: 'first_ring', name: '初环', text: '每场战斗开始时，额外抽 1 张牌。', color: '#8b6cf0' },
  { id: 'prism', name: '静默棱镜', text: '每回合打出的第一张牌，若只含 1 个符式，其灵光消耗 −1。', color: '#6fd3c7' },
  { id: 'crackbox', name: '裂纹之匣', text: '每场战斗开始时，获得 5 点护盾。', color: '#e2688a' },
  { id: 'pipes', name: '共鸣管', text: '每次打出含 3 个及以上符式的牌时，抽 1 张牌。', color: '#7fa7f0' },
  { id: 'ringfinger', name: '无名指环', text: '灵光上限 +1；每回合结束时失去 1 点生命。', color: '#e8b33c' },
  { id: 'ashcodex', name: '灰烬抄本', text: '战斗结束时若未损失生命，回复 5 点生命。', color: '#c58cf0' },
  { id: 'balance', name: '破碎天平', text: '每次对撞胜出时，对敌方额外造成 2 点伤害。', color: '#e2688a' },
  { id: 'corridor_key', name: '回廊钥匙', text: '每场战斗首次令敌人僵直时，获得 2 点灵光。', color: '#6fd3c7' },
  { id: 'needle', name: '抄写员之针', text: '每场战斗开始时，随机一张攻击牌的数值 +2。', color: '#e8b33c' },
  { id: 'dumbbell', name: '哑铃形符', text: '每场战斗开始时，获得 1 回合「蓄势 3」。', color: '#7fa7f0' },
  { id: 'inkstone', name: '墨石', text: '休息处回复量 +10%。', color: '#8b6cf0' },
  { id: 'abacus', name: '静默算盘', text: '战斗胜利获得的碎片 +12。', color: '#e8b33c' },
  { id: 'poisonpen', name: '蚀笔', text: '每场战斗开始时，敌方获得 4 点「蚀」。', color: '#7fd48a' },
  { id: 'inkveil', name: '墨幕', text: '每场战斗开始时，获得 3 点「守」。', color: '#7fa7f0' },
  { id: 'oilstone', name: '磨石', text: '每场战斗开始时，获得「蓄势 3」。', color: '#e8b33c' },
  { id: 'hollowpen', name: '空心笔', text: '每回合打出的第一张 0 灵光的牌，抽 1 张牌。', color: '#6fd3c7' },
]

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]))

export function rollRelic(owned: string[]): RelicDef | null {
  const pool = RELICS.filter((r) => !owned.includes(r.id))
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
