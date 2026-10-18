import { Rng } from './rng'
import type { MapNode, NodeKind, RunMap } from './types'

export const LAYERS = 15
export const NODE_W = 150
export const NODE_H = 104

/** 每层的节点数量分布（第 0 层为起点，最后一层为 BOSS）。
 *  随机源必须和连线用的是同一条流 —— 用 Math.random 的话同一个种子每次开出来的地图都不一样。 */
function layerSizes(layer: number, rng: Rng): number {
  if (layer === 0) return 2
  if (layer === LAYERS - 1) return 1
  if (layer === LAYERS - 2) return 2
  const rnd = rng.float()
  if (rnd < 0.34) return 2
  if (rnd < 0.78) return 3
  return 4
}

function kindFor(layer: number, rng: Rng): NodeKind {
  if (layer === LAYERS - 1) return 'boss'
  if (layer === 0) return 'battle'
  if (layer === LAYERS - 2) return 'rest'
  const roll = rng.float()
  if (layer <= 2) {
    if (roll < 0.82) return 'battle'
    return 'event'
  }
  if (roll < 0.46) return 'battle'
  if (roll < 0.60) return 'event'
  if (roll < 0.72) return 'elite'
  if (roll < 0.82) return 'rest'
  if (roll < 0.92) return 'shop'
  return 'treasure'
}

export function generateMap(seed: number): RunMap {
  const rng = new Rng(seed)
  const nodes: Record<string, MapNode> = {}
  const layers: string[][] = []
  const CENTER = 640
  const STEP = 300

  for (let l = 0; l < LAYERS; l++) {
    const count = layerSizes(l, rng)
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      const id = `n${l}_${i}`
      const jitter = count > 1 ? rng.range(-14, 14) : 0
      // 以中线对称展开，避免少节点层缩在左侧
      const x = CENTER + (i - (count - 1) / 2) * STEP + jitter
      const y = 60 + (LAYERS - 1 - l) * NODE_H + rng.range(-9, 9)
      nodes[id] = {
        id,
        layer: l,
        index: i,
        kind: l === LAYERS - 1 ? 'boss' : kindFor(l, rng),
        x,
        y,
        next: [],
      }
      ids.push(id)
    }
    layers.push(ids)
  }

  // 连线：保证每个节点至少有一条入边与一条出边
  for (let l = 0; l < LAYERS - 1; l++) {
    const cur = layers[l]
    const nxt = layers[l + 1]
    for (const id of cur) {
      const i = nodes[id].index
      const t = cur.length === 1 ? (nxt.length - 1) / 2 : (i / (cur.length - 1)) * (nxt.length - 1)
      const cands = nxt
        .map((nid) => ({ nid, d: Math.abs(nodes[nid].index - t) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
      nodes[id].next = cands.map((c) => c.nid)
    }
    // 反向补边
    for (const nid of nxt) {
      const hasIn = cur.some((cid) => nodes[cid].next.includes(nid))
      if (!hasIn) {
        const j = nodes[nid].index
        const t = nxt.length === 1 ? (cur.length - 1) / 2 : (j / (nxt.length - 1)) * (cur.length - 1)
        const src = cur.reduce((best, cid) =>
          Math.abs(nodes[cid].index - t) < Math.abs(nodes[best].index - t) ? cid : best,
        )
        nodes[src].next.push(nid)
      }
    }
  }

  return { nodes, layers, seed, start: layers[0] }
}

export const NODE_KIND_NAME: Record<NodeKind, string> = {
  battle: '残响',
  elite: '仪典',
  event: '岔口',
  rest: '静室',
  shop: '市集',
  treasure: '遗匣',
  boss: '终章',
}

export const NODE_KIND_DESC: Record<NodeKind, string> = {
  battle: '与一个符阵造物对撞。',
  elite: '强大的仪典守卫，但回报丰厚。',
  event: '回廊中的岔口，选择你的代价。',
  rest: '休整，或铭刻一张牌。',
  shop: '用碎片换取卡牌与圣痕。',
  treasure: '打开一只无名之匣。',
  boss: '这一层的最初之字。',
}
