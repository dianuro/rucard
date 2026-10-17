/**
 * 符式图标与资源图标。
 * 全部是抽象记号：没有任何具象物象，只有环、裂、弧、齿。
 * 统一 viewBox 0 0 40 40，粗描边 + 圆角端点，与整体卡通风格一致。
 */

const S = (inner: string, size = 40, sw = 3.2): string =>
  `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true" class="ico">` +
  `<g fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`

/** 裂 · 一道贯穿圆环的断口 */
export function icoRift(size?: number): string {
  return S(
    `<circle cx="20" cy="20" r="15.5" stroke-dasharray="26 6 12 6" />` +
      `<path d="M13 8 L21 17 L15 20 L25 32" stroke-width="3.6" />`,
    size,
  )
}

/** 铸 · 双层六边形，内环凝聚 */
export function icoWard(size?: number): string {
  return S(
    `<path d="M20 5 L32.5 12.5 L32.5 27.5 L20 35 L7.5 27.5 L7.5 12.5 Z" />` +
      `<circle cx="20" cy="20" r="6" />`,
    size,
  )
}

/** 反 · 折返的环，末端带箭头 */
export function icoEcho(size?: number): string {
  return S(
    `<path d="M31 15.5 A12.5 12.5 0 1 0 30 26" />` +
      `<path d="M31 15.5 L31 9 L25 11.5" />` +
      `<circle cx="20" cy="20" r="3.4" fill="currentColor" stroke="none" />`,
    size,
  )
}

/** 穿 · 纵长的棱，贯入一线 */
export function icoPierce(size?: number): string {
  return S(`<path d="M20 4 L27 20 L20 36 L13 20 Z" />` + `<path d="M20 4 L20 36" stroke-width="2.6" />`, size)
}

/** 缀 · 两个交叠的环 */
export function icoLink(size?: number): string {
  return S(
    `<circle cx="14" cy="20" r="9" />` +
      `<circle cx="26" cy="20" r="9" />` +
      `<circle cx="20" cy="20" r="2.6" fill="currentColor" stroke="none" />`,
    size,
  )
}

/** 引 · 回卷的螺线 */
export function icoSpiral(size?: number): string {
  return S(
    `<path d="M20 20 A3 3 0 0 1 23 23 A6 6 0 0 1 14 23 A9 9 0 0 1 29 17 A12 12 0 0 1 11 29" />`,
    size,
  )
}

export const SYM_ICON: Record<string, (size?: number) => string> = {
  rift: icoRift,
  ward: icoWard,
  echo: icoEcho,
  pierce: icoPierce,
  link: icoLink,
  spiral: icoSpiral,
}

/* ────────────── 资源与状态 ────────────── */

export function icoLife(size = 20): string {
  return S(
    `<path d="M20 34 C8 26.5 5 21 5 15.5 C5 10.6 8.8 7 13.2 7 C16 7 18.4 8.4 20 10.6 C21.6 8.4 24 7 26.8 7 C31.2 7 35 10.6 35 15.5 C35 21 32 26.5 20 34 Z" stroke-width="3"/>`,
    size,
  )
}

export function icoEnergy(size = 20): string {
  return S(
    `<circle cx="20" cy="20" r="14.5" stroke-width="2.6"/>` +
      `<path d="M20 6 L24 16 L34 20 L24 24 L20 34 L16 24 L6 20 L16 16 Z" fill="currentColor" stroke-width="1.6"/>`,
    size,
  )
}

export function icoBlock(size = 20): string {
  return S(`<path d="M20 4 L33 11 L33 26 L20 36 L7 26 L7 11 Z" stroke-width="2.8"/>`, size)
}

export function icoShards(size = 20): string {
  return S(
    `<path d="M20 4 L33 15 L20 36 L7 15 Z" stroke-width="2.8"/>` +
      `<path d="M7 15 L33 15 M20 4 L14 15 L20 36 M20 4 L26 15 L20 36" stroke-width="1.8" opacity="0.7"/>`,
    size,
  )
}

/** 韧性 / 破绽：带裂纹的环 */
export function icoPoise(size = 20): string {
  return S(
    `<circle cx="20" cy="20" r="14.5" stroke-width="2.6" stroke-dasharray="20 5 8 5"/>` +
      `<path d="M14 9 L22 18 L15 21 L26 31" stroke-width="2.4"/>`,
    size,
  )
}

export function icoStagger(size = 20): string {
  return S(
    `<path d="M8 12 L32 12 M6 20 L34 20 M11 28 L29 28" stroke-width="3"/>` +
      `<path d="M16 6 L24 34" stroke-width="2" opacity="0.55"/>`,
    size,
  )
}

/* ────────────── 地图节点 ────────────── */

export function icoNode(kind: string, size = 34): string {
  const inner: Record<string, string> = {
    battle: `<circle cx="20" cy="20" r="14" stroke-width="2.6"/><path d="M12 12 L28 28 M28 12 L12 28" stroke-width="2.4"/>`,
    elite: `<path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" stroke-width="2.6"/><path d="M20 12 L27 24 L13 24 Z" stroke-width="2.4"/>`,
    event: `<path d="M11 15 A9.5 9.5 0 1 1 20 29.5 L20 33" stroke-width="2.8"/><circle cx="20" cy="36.5" r="1.8" fill="currentColor" stroke="none"/>`,
    rest: `<path d="M20 5 L33 20 L20 35 L7 20 Z" stroke-width="2.6"/><path d="M13 20 L27 20" stroke-width="2.6"/>`,
    shop: `<path d="M6 34 L34 34 M20 34 L20 12 M9 12 L31 12 L20 4 Z" stroke-width="2.6"/>`,
    treasure: `<rect x="6" y="11" width="28" height="22" rx="5" stroke-width="2.6"/><circle cx="20" cy="22" r="4.4" stroke-width="2.4"/>`,
    boss: `<circle cx="20" cy="20" r="15" stroke-width="2.6" stroke-dasharray="18 5 6 5"/><circle cx="20" cy="20" r="8" stroke-width="2.4"/><path d="M20 5 L20 12 M20 28 L20 35 M5 20 L12 20 M28 20 L35 20" stroke-width="2.2"/>`,
  }
  return S(inner[kind] ?? inner.battle, size)
}

/* ────────────── 顶栏小图标 ────────────── */

export function icoMap(size = 18): string {
  return S(
    `<path d="M4 11 L14 6 L26 11 L36 6 L36 29 L26 34 L14 29 L4 34 Z" stroke-width="2.6"/>` +
      `<path d="M14 6 L14 29 M26 11 L26 34" stroke-width="2.2"/>`,
    size,
  )
}

export function icoDeck(size = 18): string {
  return S(
    `<rect x="9" y="4" width="22" height="28" rx="4" stroke-width="2.6"/>` +
      `<path d="M5 9 L5 31 A4 4 0 0 0 9 35 L29 35" stroke-width="2.4"/>`,
    size,
  )
}

export function icoSound(on: boolean, size = 18): string {
  return S(
    `<path d="M7 15 L13 15 L21 8 L21 32 L13 25 L7 25 Z" stroke-width="2.4"/>` +
      (on ? `<path d="M26 14 A8 8 0 0 1 26 26 M30 10 A13 13 0 0 1 30 30" stroke-width="2.4"/>` : `<path d="M27 15 L35 25 M35 15 L27 25" stroke-width="2.4"/>`),
    size,
  )
}

export function icoRelic(size = 18): string {
  return S(
    `<circle cx="20" cy="20" r="14.5" stroke-width="2.6" stroke-dasharray="4 4"/>` +
      `<path d="M20 9 L26 20 L20 31 L14 20 Z" stroke-width="2.4"/>`,
    size,
  )
}

export function icoSkull(size = 18): string {
  return S(`<circle cx="20" cy="18" r="12" stroke-width="2.6"/><path d="M16 14 L16 20 M24 14 L24 20 M14 30 L26 30" stroke-width="2.4"/>`, size)
}
