// 装备词条（2026-09-06）— 玩家侧随机乘区/附加，不改动装备固定数值（数据铁律）
// 词条绑定到「穿戴槽位 + 装备 id」：换装重掷、脱下再穿同件保留，未穿戴不生效。

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

/** 词条展示文案（暴击/金币显示为 %） */
export function fmtMod(mod) {
  if (mod.stat === 'critChance') return `${mod.label} +${(mod.value * 100).toFixed(1)}%`
  if (mod.stat === 'goldPct') return `${mod.label} +${mod.value}%`
  return `${mod.label} +${mod.value}`
}

