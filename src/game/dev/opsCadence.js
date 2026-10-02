// 内容节奏 —— **只读**聚合：每 10 级段「新增了多少可玩内容」（2026-10-02 新角色 ops 的方案 5）
//
// 用途：回答「哪一段是空档 / 内容密度在哪掉下去」——把「玩家进度」与「内容供给」叠在一张图上。
// 🔒 只读契约：只读数据表，不碰 player、不写任何状态。
// ⚠️ 副作用导入 `lateExplore.js`：把 Lv102-120 的探索目标并进 `EXPLORATION_TARGETS_ALL`
//    （否则末段恒为空 —— 而那正是我们最想看的一段）。
import { FORAGING_TARGETS } from '../skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../skills/HuntingSkill.js'
import { EXCAVATION_GROUND_TARGETS, MINING_TARGETS } from '../skills/ExcavationSkill.js'
import { WOODCUTTING_TARGETS } from '../data/timbers.js'
import { COOKING_RECIPES } from '../skills/CookingSkill.js'
import { BAKING_RECIPES } from '../skills/BakingSkill.js'
import { BREWING_RECIPES } from '../skills/BrewingSkill.js'
import { SPICE_RECIPES } from '../skills/SpiceMixingSkill.js'
import { PRESERVING_RECIPES } from '../skills/PreservingSkill.js'
import { SMITHING_RECIPES } from '../skills/CraftsmithingSkill.js'
import { CROPS } from '../skills/FarmingSkill.js'
import { EXPLORATION_TARGETS_ALL } from '../data/explorationTargets.js'
import { ITEM_LEVEL } from '../data/combatLoot.js'
import '../data/lateExplore.js' // 副作用：末段（102-120）探索目标并入上面的基础表

/** 10 级段的起点（1–10 … 111–120） */
const BAND_STARTS = []
for (let s = 1; s <= 111; s += 10) BAND_STARTS.push(s)

const idxOf = (lv) => {
  const n = Number(lv)
  if (!Number.isFinite(n) || n < 1) return -1
  return Math.min(BAND_STARTS.length - 1, Math.floor((n - 1) / 10))
}

/**
 * 按 10 级段聚合「新增内容条目」。
 * 口径（都是 reqLevel 落在该段即计入）：采集目标 / 制作配方 / 农作物 / 探索目标 / 物品库。
 * @returns {Array<{start,end,label,gather,craft,farm,explore,items,total}>}
 */
export function contentByBand() {
  const rows = BAND_STARTS.map((s) => ({ start: s, end: s + 9, label: `${s}–${s + 9}`, gather: 0, craft: 0, farm: 0, explore: 0, items: 0, total: 0 }))
  const add = (key, list, lvOf = (x) => x?.reqLevel) => {
    for (const t of list ?? []) {
      const i = idxOf(lvOf(t))
      if (i >= 0) rows[i][key]++
    }
  }
  // 采集（6 条线）
  add('gather', FORAGING_TARGETS)
  add('gather', FISHING_TARGETS)
  add('gather', HUNTING_TARGETS)
  add('gather', EXCAVATION_GROUND_TARGETS)
  add('gather', MINING_TARGETS)
  add('gather', WOODCUTTING_TARGETS)
  // 制作
  add('craft', COOKING_RECIPES)
  add('craft', BAKING_RECIPES)
  add('craft', BREWING_RECIPES)
  add('craft', SPICE_RECIPES)
  add('craft', PRESERVING_RECIPES)
  add('craft', SMITHING_RECIPES)
  // 农耕 / 探索
  add('farm', CROPS)
  add('explore', EXPLORATION_TARGETS_ALL)
  // 物品库（每件物品的等级）
  add('items', Object.values(ITEM_LEVEL ?? {}).map((level) => ({ reqLevel: level })))
  for (const r of rows) r.total = r.gather + r.craft + r.farm + r.explore
  return rows
}

/** 空档诊断：最薄的三段 + 完全为空的段 */
export function contentGaps(rows = contentByBand()) {
  const totals = rows.map((r) => r.total)
  const max = Math.max(0, ...totals)
  const sum = totals.reduce((a, b) => a + b, 0)
  const sorted = [...rows].sort((a, b) => a.total - b.total || a.start - b.start)
  const empty = rows.filter((r) => r.total === 0)
  return { max, sum, mean: rows.length ? sum / rows.length : 0, thinnest: sorted.slice(0, 3), empty }
}

/** 段 → 是否「相对稀薄」（低于均值一半，且不高于空段） */
export function isThin(row, gaps) {
  return gaps.mean > 0 && row.total < gaps.mean * 0.5
}
