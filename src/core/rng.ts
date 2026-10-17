/** 确定性随机：符印生成、战斗乱序、地图生成共用，保证同一名字永远得到同一图形。 */

export function hashStr(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private next: () => number

  constructor(seed: number | string) {
    this.next = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed)
  }

  /** [0,1) */
  float(): number {
    return this.next()
  }

  /** [min,max) 浮点 */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** [min,max] 整数 */
  int(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1))
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /** 以权重挑选 */
  weighted<T>(arr: readonly T[], weight: (t: T) => number): T {
    let total = 0
    for (const a of arr) total += Math.max(0, weight(a))
    let r = this.next() * total
    for (const a of arr) {
      r -= Math.max(0, weight(a))
      if (r <= 0) return a
    }
    return arr[arr.length - 1]
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

let uidCounter = 0
export function uid(prefix = 'u'): string {
  uidCounter += 1
  return `${prefix}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}
