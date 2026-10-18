import type { EventDef, EventEffect } from './types'

const fx = (e: EventEffect) => e

/** 回廊岔口。每个事件提供 2~3 个带代价的选项。 */
export const EVENTS: EventDef[] = [
  {
    id: 'scribe',
    name: '誊抄者',
    text: '一个没有面孔的轮廓坐在桌前，桌上摊着一页写满的纸。它把笔推向你，纸上的字正慢慢变淡。',
    options: [
      {
        label: '替它抄完',
        detail: '失去 6 点生命，获得一张稀有卡牌。',
        effects: [fx({ t: 'hurt', n: 6 }), fx({ t: 'card', count: 1, rarity: 'rare' })],
      },
      {
        label: '撕掉那页',
        detail: '获得 60 碎片。',
        effects: [fx({ t: 'shards', n: 60 })],
      },
      {
        label: '只是看着',
        detail: '回复 8 点生命。',
        effects: [fx({ t: 'heal', n: 8 })],
      },
    ],
  },
  {
    id: 'well',
    name: '无底之井',
    text: '井口是一圈刻满刻度的环，往下看不见水，只看得见你自己在往下看。',
    options: [
      {
        label: '投下碎片',
        detail: '失去全部碎片，生命上限 +12 并回满。',
        effects: [fx({ t: 'well' })],
        require: (s) => s.shards > 0,
      },
      {
        label: '打水',
        detail: '回复 14 点生命。',
        effects: [fx({ t: 'heal', n: 14 })],
      },
      {
        label: '在井沿刻字',
        detail: '获得一张特殊卡牌。',
        effects: [fx({ t: 'specialCard' })],
      },
    ],
  },
  {
    id: 'lamp',
    name: '长明灯',
    text: '一盏灯悬在回廊中央，灯焰没有温度。靠近时，你的影子开始自己写字。',
    options: [
      {
        label: '把手伸进火焰',
        detail: '失去 9 点生命，获得一件圣痕。',
        effects: [fx({ t: 'hurt', n: 9 }), fx({ t: 'relic' })],
      },
      {
        label: '把灯吹灭',
        detail: '回复 20 点生命，失去 40 碎片。',
        effects: [fx({ t: 'heal', n: 20 }), fx({ t: 'shards', n: -40 })],
        require: (s) => s.shards >= 40,
      },
      {
        label: '借一点火',
        detail: '获得一张「灼痕」与 25 碎片。',
        effects: [fx({ t: 'addCard', id: 'scorch' }), fx({ t: 'shards', n: 25 })],
      },
    ],
  },
  {
    id: 'gap',
    name: '断口',
    text: '回廊在这里断掉了。断口另一侧的路还在，只是中间少了一段——不是塌了，是从来就没写过。',
    options: [
      {
        label: '跳过去',
        detail: '失去 12 点生命，获得 90 碎片与一次强化。',
        effects: [fx({ t: 'hurt', n: 12 }), fx({ t: 'shards', n: 90 }), fx({ t: 'upgrade' })],
      },
      {
        label: '绕远路',
        detail: '失去 3 点生命上限，获得一件圣痕。',
        effects: [fx({ t: 'maxHp', n: -3 }), fx({ t: 'relic' })],
      },
      {
        label: '在断口边坐下',
        detail: '回复 10 点生命，删除一张牌。',
        effects: [fx({ t: 'heal', n: 10 }), fx({ t: 'remove' })],
      },
    ],
  },
  {
    id: 'copyist',
    name: '抄本的抄本',
    text: '一本翻开的册子，每一页都写着上一页的内容，字迹一页比一页潦草。最后一页几乎是空的。',
    options: [
      {
        label: '在第一页落笔',
        detail: '复制牌组中的一张牌。',
        effects: [fx({ t: 'duplicate' })],
      },
      {
        label: '合上册子',
        detail: '获得 45 碎片。',
        effects: [fx({ t: 'shards', n: 45 })],
      },
      {
        label: '撕下最后一页',
        detail: '删除一张牌，回复 6 点生命。',
        effects: [fx({ t: 'remove' }), fx({ t: 'heal', n: 6 })],
      },
    ],
  },
  {
    id: 'dial',
    name: '刻度盘',
    text: '一个巨大的刻度盘嵌在墙上，指针停在一个没有标记的格子上。你可以拨动它。',
    options: [
      {
        label: '拨回一格',
        detail: '回复 16 点生命，生命上限 −4。',
        effects: [fx({ t: 'heal', n: 16 }), fx({ t: 'maxHp', n: -4 })],
      },
      {
        label: '拨前一格',
        detail: '生命上限 +8，失去 10 点生命。',
        effects: [fx({ t: 'maxHp', n: 8 }), fx({ t: 'hurt', n: 10 })],
      },
      {
        label: '让它停在原地',
        detail: '获得 70 碎片。',
        effects: [fx({ t: 'shards', n: 70 })],
      },
    ],
  },
  {
    id: 'procession',
    name: '游行',
    text: '一列符号排成队，沿着回廊缓慢移动。它们没有看向你，但你经过时，队形里空出了一个位置。',
    options: [
      {
        label: '走进那个位置',
        detail: '失去 15 点生命，获得一张稀有卡牌与一件圣痕。',
        effects: [fx({ t: 'hurt', n: 15 }), fx({ t: 'card', count: 1, rarity: 'rare' }), fx({ t: 'relic' })],
      },
      {
        label: '站到一边等它们过去',
        detail: '失去 30 碎片。',
        effects: [fx({ t: 'shards', n: -30 })],
        require: (s) => s.shards >= 30,
      },
      {
        label: '跟着走一段',
        detail: '回复 12 点生命。',
        effects: [fx({ t: 'heal', n: 12 })],
      },
    ],
  },
  {
    id: 'mirrorpool',
    name: '镜池',
    text: '一潭静止的黑色液体，映出的不是你，而是你牌组里那些字的排列方式。',
    options: [
      {
        label: '把手按进去',
        detail: '删除一张牌，获得 20 碎片。',
        effects: [fx({ t: 'remove' }), fx({ t: 'shards', n: 20 })],
      },
      {
        label: '往里面丢一粒石子',
        detail: '获得一张「镜面回廊」。',
        effects: [fx({ t: 'addCard', id: 'mirrorhall' })],
      },
      {
        label: '喝一口',
        detail: '失去 8 点生命，强化两张牌。',
        effects: [fx({ t: 'hurt', n: 8 }), fx({ t: 'upgrade' }), fx({ t: 'upgrade' })],
      },
    ],
  },
  {
    id: 'booth',
    name: '换字的摊',
    text: '一个摊子，没有摊主。台面上摆着一排空格子，旁边压着一张价目表，字迹被水泡过，只看得出数字。',
    options: [
      {
        label: '交 80 碎片，换走一个空',
        detail: '失去 80 碎片，删除一张牌。',
        effects: [fx({ t: 'shards', n: -80 }), fx({ t: 'remove' })],
        require: (s) => s.shards >= 80,
      },
      {
        label: '留下一点血，让它刻深些',
        detail: '失去 8 点生命，强化一张牌。',
        effects: [fx({ t: 'hurt', n: 8 }), fx({ t: 'upgrade' })],
      },
      {
        label: '只看不换',
        detail: '回复 5 点生命。',
        effects: [fx({ t: 'heal', n: 5 })],
      },
    ],
  },
  {
    id: 'kiln',
    name: '窑',
    text: '回廊侧面开着一孔窑，里面是暗红色的。靠近时，你牌组里有一张牌开始发烫——它在问你愿不愿意。',
    options: [
      {
        label: '把那张牌扔进去',
        detail: '删除一张牌，获得 45 碎片（灰烬是可以卖的）。',
        effects: [fx({ t: 'remove' }), fx({ t: 'shards', n: 45 })],
      },
      {
        label: '把手伸进去',
        detail: '失去 14 点生命，获得一件圣痕。',
        effects: [fx({ t: 'hurt', n: 14 }), fx({ t: 'relic' })],
      },
      {
        label: '封上窑口',
        detail: '回复 12 点生命，生命上限 −2。',
        effects: [fx({ t: 'heal', n: 12 }), fx({ t: 'maxHp', n: -2 })],
      },
    ],
  },
  {
    id: 'echo',
    name: '回声壁',
    text: '一堵弧形的墙。你还没出声，它已经在等了——它总是比你早半个字。',
    options: [
      {
        label: '喊一个最短的音',
        detail: '获得一张「无字」。',
        effects: [fx({ t: 'addCard', id: 'nullword' })],
      },
      {
        label: '喊长的',
        detail: '失去 7 点生命，获得一张异等卡牌。',
        effects: [fx({ t: 'hurt', n: 7 }), fx({ t: 'card', count: 1, rarity: 'uncommon' })],
      },
      {
        label: '不出声',
        detail: '回复 7 点生命，获得 20 碎片。',
        effects: [fx({ t: 'heal', n: 7 }), fx({ t: 'shards', n: 20 })],
      },
    ],
  },
  {
    id: 'scales',
    name: '天平',
    text: '一架天平，两端都空着。你站上去，它就往下沉——原来它称的不是重量。',
    options: [
      {
        label: '把自己放上去',
        detail: '失去 12 点生命，生命上限 +16。',
        effects: [fx({ t: 'hurt', n: 12 }), fx({ t: 'maxHp', n: 16 })],
      },
      {
        label: '把行囊放上去',
        detail: '获得 100 碎片，删除一张牌。',
        effects: [fx({ t: 'shards', n: 100 }), fx({ t: 'remove' })],
      },
      {
        label: '走开',
        detail: '回复 8 点生命。',
        effects: [fx({ t: 'heal', n: 8 })],
      },
    ],
  },
]

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]))
