// 装备词条（2026-09-06）— 玩家侧随机乘区/附加，不改动装备固定数值（数据铁律）
// 词条**绑定到装备本身（item id）**：同一件装备的词条一旦掷出就固定下来，
// 「卸下再穿」「换穿别的再换回来」都不重掷，**花金币洗练出的结果永久生效**；
// 只有洗练（rerollGearMod）会重掷。同 id 的多件共享同一套词条 ——
// 与强化（upgrades[itemId]）、宝石插槽（gemSockets[slot]）的现有口径一致。
// ⚠️ 2026-09-18 之前是按「槽位 + 装备 id」存的（`{ [slot]: { itemId, mods } }`），
// 那个形态下换穿同槽位另一件会毁掉洗练结果；旧档由 migrateGearMods 迁移。
// 未穿戴的词条不生效（equippedStats 只累加「仍穿戴同一件」的记录）。

import { getItem } from './items.js'

/** 品质 → 词条数量区间（普通 0-1 条…神话 3 条） */
export const MOD_COUNT_RANGE = {
  普通: [0, 1],
  精良: [1, 1],
  稀有: [1, 2],
  史诗: [2, 2],
  传说: [2, 3],
  神话: [3, 3],
}

/** 词条类型池（weighted 抽取，不重复） */
export const MOD_TYPES = [
  { stat: 'attack', label: '攻击', weight: 22 },
  { stat: 'defense', label: '防御', weight: 16 },
  { stat: 'accuracy', label: '命中', weight: 14 },
  { stat: 'hpBonus', label: '生命', weight: 12 },
  { stat: 'evasion', label: '闪避', weight: 10 },
  { stat: 'speedBonus', label: '攻速', weight: 10 },
  { stat: 'critChance', label: '暴击', weight: 8 },
  { stat: 'goldPct', label: '金币', weight: 8 },
]

/** 无基准值时的等级基准（按装备 tier） */
function tierBase(stat, tier) {
  switch (stat) {
    case 'attack': return 0.6 + tier * 0.5
    case 'defense': return 0.5 + tier * 0.45
    case 'accuracy': return 0.4 + tier * 0.3
    case 'evasion': return 0.2 + tier * 0.15
    case 'critChance': return 0.005 + tier * 0.0004
    case 'speedBonus': return 0.02 + tier * 0.002
    case 'hpBonus': return 1 + tier * 0.8
    case 'goldPct': return 0.5 + tier * 0.05
    default: return 1
  }
}

function rand(a, b) { return a + Math.random() * (b - a) }

function roundTo(v, d) { return Number(v.toFixed(d)) }

/** 生成一条词条（优先以装备自身同属性为基准，±50% 浮动） */
function rollOne(statDef, item, tier) {
  const { stat, label } = statDef
  const base = item?.stats?.[stat] != null ? Number(item.stats[stat]) : tierBase(stat, tier)
  const v = base * rand(0.5, 1.5)
  const value = roundTo(v, stat === 'critChance' ? 3 : 2)
  return { stat, label, value }
}

/**
 * 掷词条（穿戴新装备时调用）
 * @param {object} item 装备对象（来自 ITEMS）
 * @returns {Array<{stat,label,value}>}
 */
export function rollGearMods(item) {
  if (item?.type !== 'equipment') return []
  const [min, max] = MOD_COUNT_RANGE[item.quality] ?? [0, 1]
  const count = Math.floor(rand(min, max + 1))
  const pool = [...MOD_TYPES]
  const mods = []
  for (let i = 0; i < count && pool.length; i++) {
    const total = pool.reduce((a, t) => a + t.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight
      if (r <= 0) { idx = j; break }
    }
    const def = pool.splice(idx, 1)[0]
    mods.push(rollOne(def, item, item.tier ?? 1))
  }
  return mods
}

/** 洗练费用（金币）按品质 */
export const REROLL_COST = {
  普通: 400,
  精良: 800,
  稀有: 2000,
  史诗: 5000,
  传说: 12000,
  神话: 30000,
}

/** 词条记录最多保留多少件装备（超出按「最近掷出」剪掉；当前穿戴的永远保留）。
 *  取值只影响存档体积（每条约 75 字节 ⇒ 上限约 9KB）与「很久没碰过的装备会不会被遗忘」，不影响平衡。 */
export const GEAR_MODS_MAX = 120

/**
 * 词条存档迁移：把**旧形态**（按槽位存：`{ [slot]: { itemId, mods } }`）转成**新形态**
 * （按装备存：`{ [itemId]: { mods, at } }`）。
 * 为什么换成按装备存：旧形态下「换穿同槽位的另一件 → 再换回」会重掷词条，
 * 于是**花金币洗练出的结果会被换装抹掉**（2026-09-18 用户实测报出）。
 * 迁移是**幂等**的：新形态的值没有 `itemId` 字段，原样保留。
 * @param {object} raw 存档里的 gearMods（新旧形态混合也吃得下）
 * @returns {object} 新形态
 */
export function migrateGearMods(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw)) {
    if (!v) continue
    if (Array.isArray(v)) { out[k] = { mods: v, at: 0 }; continue } // 裸数组形态（防御，历史版本未用过）
    if (v.itemId) { out[v.itemId] = { mods: v.mods ?? [], at: 0 }; continue } // 旧形态：键是槽位，值带 itemId
    out[k] = { mods: v.mods ?? [], at: v.at ?? 0 }
  }
  return out
}

/** 词条展示文案（暴击/金币显示为 %） */
export function fmtMod(mod) {
  if (mod.stat === 'critChance') return `${mod.label} +${(mod.value * 100).toFixed(1)}%`
  if (mod.stat === 'goldPct') return `${mod.label} +${mod.value}%`
  return `${mod.label} +${mod.value}`
}

