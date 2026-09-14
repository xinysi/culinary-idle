// 温室蜂场（2026-09-14 新增）— 「挂机产线」第 9 个系统：**温室 + 蜂场合并为一页**（用户指定）。
//
// 两块内容：
//   ① 温室（种植）：用**任意既有种子**种在温室格（独立于农田，2 → 6 格），生长时间 = 作物 growSec × 0.75
//      （温室提速 25%）；收获照常给作物，并且**每次收获有 10% 概率伴生一瓶蜂蜜**，
//      品级由「该作物的 reqLevel」决定（见 honey.js 的 honeyTierForLevel）。
//   ② 蜂箱（原蜂场）：用**花类**做蜜源，短周期稳定产蜜，品级由花的 reqLevel 决定（菊花/玫瑰/茉莉/桂花 → 2~4 品）。
//
// 为什么这样切分（而不是让蜂箱随便产任意品级）：
//   · 蜂箱 = 「稳定、低阶」的日常蜜源（花类最高 34 级 → 4 品）；
//   · 温室伴生 = 「侥幸、高阶」的稀罕蜜（种 90 级的灵果 → 8 品百花臻蜜，但只有 10%）；
//   两条路径合起来才覆盖 8 个品级，也让「种什么」这件事对蜂蜜有意义。
//
// 设计约束：不新增物品（种子/作物/花类都是既有物品）；温室只读 CROPS（农耕表），不改农耕任何数值。
import { CROPS } from '../skills/FarmingSkill.js'
import { getItem } from './items.js'

export const GREENHOUSE_UNLOCK_SKILL = 'farming'
export const GREENHOUSE_UNLOCK_LEVEL = 20

/** 温室格：2 → 6（扩建费用按顺序取） */
export const GREENHOUSE_BASE_BEDS = 2
export const GREENHOUSE_MAX_BEDS = 6
export const GREENHOUSE_EXPAND_COSTS = [25000, 70000, 150000, 300000]

/** 温室生长加速（0.75 = 时间 ×0.75，即提速 25%） */
export const GREENHOUSE_GROW_FACTOR = 0.75
/** 作物伴生蜂蜜的概率（用户指定 10%） */
export const GREENHOUSE_HONEY_CHANCE = 0.1

/** 蜂箱：1 → 3 */
export const HIVE_BASE_COUNT = 1
export const HIVE_MAX_COUNT = 3
export const HIVE_EXPAND_COSTS = [35000, 100000]

/**
 * 蜜源：花类作物（都是既有物品），逐周期消耗花朵、产出对应品级的蜂蜜。
 * 品级由「花的 reqLevel」决定 → 菊花(Lv12)=2 品 / 玫瑰(Lv15)=2 品 / 洛神花(Lv18)=2 品 /
 * 茉莉花(Lv32)=3 品 / 桂花(Lv34)=4 品。
 */
export const HIVE_MEDIA = [
  { id: 'chrysanthemum', name: '菊花蜜箱', icon: '🌼', hours: 4, feed: { chrysanthemum: 2 }, honeyQty: 1 },
  { id: 'rose', name: '玫瑰蜜箱', icon: '🌹', hours: 4, feed: { rose: 2 }, honeyQty: 1 },
  { id: 'rosella', name: '洛神蜜箱', icon: '🌺', hours: 5, feed: { rosella: 2 }, honeyQty: 1 },
  { id: 'jasmine', name: '茉莉蜜箱', icon: '🌷', hours: 6, feed: { jasmine: 2 }, honeyQty: 2 },
  { id: 'osmanthus', name: '桂花蜜箱', icon: '🌾', hours: 8, feed: { osmanthus: 2 }, honeyQty: 2 },
]

const MEDIA_INDEX = new Map(HIVE_MEDIA.map((m) => [m.id, m]))

export function getHiveMedia(id) {
  return MEDIA_INDEX.get(id) ?? null
}

/** 作物（种子）查询：温室种植用（沿用农耕表，只读不写） */
export function greenhouseCrop(seedId) {
  return CROPS.find((c) => c.seedId === seedId) ?? null
}

/** 温室内该作物的生长时长（毫秒） */
export function greenhouseGrowMs(seedId) {
  const crop = greenhouseCrop(seedId)
  if (!crop) return 0
  return Math.round(crop.growSec * GREENHOUSE_GROW_FACTOR * 1000)
}

/** 蜜源花的等级（决定蜂蜜品级）——取该花在农耕表里的 reqLevel */
export function hiveMediaLevel(mediaId) {
  const media = getHiveMedia(mediaId)
  if (!media) return 1
  const flowerId = Object.keys(media.feed ?? {})[0]
  const crop = CROPS.find((c) => c.itemId === flowerId)
  return crop?.reqLevel ?? 1
}

/** 蜂箱产物文案（UI 复用） */
export function hiveProductText(media) {
  return `${honeyQtyText(media)} 蜂蜜`
}

function honeyQtyText(media) {
  return `×${media?.honeyQty ?? 1}`
}

/** 扩建费用：温室（beds 为当前格数；已满返回 null） */
export function nextGreenhouseExpandCost(beds) {
  return GREENHOUSE_EXPAND_COSTS[beds - GREENHOUSE_BASE_BEDS] ?? null
}

/** 扩建费用：蜂箱（hives 为当前箱数；已满返回 null） */
export function nextHiveExpandCost(hives) {
  return HIVE_EXPAND_COSTS[hives - HIVE_BASE_COUNT] ?? null
}

/** 种子名（UI 复用） */
export function seedName(seedId) {
  return getItem(seedId)?.name ?? seedId
}
