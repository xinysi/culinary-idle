// 腐坏（spoilage）平衡：让荤食（meat/seafood/egg）的腐坏时长随其获取等级递增。
// 规则（用户确认）：仅 lv≥25 的中高级荤食腐坏；spoilMs = (12 + 等级×0.6) 小时，等级越高越耐放。
// 启动时调用（bootstrap.js）。
// 注意：此模块会改写 ITEMS[id].spoilMs；保鲜剂刷新时按各食材自身 spoilMs 计算（见 stores/player.js useItem）。
import { ITEMS } from './items.js'
import { FORAGING_TARGETS } from '../skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../skills/HuntingSkill.js'
import { EXCAVATION_TARGETS } from '../skills/ExcavationSkill.js'
import { CROPS } from '../skills/FarmingSkill.js'
import { EXPLORATION_TARGETS_ALL } from './explorationTargets.js'
import { GATHERING_EXT } from './expansion1.js'
import { GATHERING_EXT2 } from './expansion2.js'

// 物品 -> 最低获取等级（采集/农耕/探索掉落）
const level = {}
const addLv = (id, lv) => { if (id != null && (level[id] == null || lv < level[id])) level[id] = lv }
for (const [arr] of [[FORAGING_TARGETS], [FISHING_TARGETS], [HUNTING_TARGETS], [EXCAVATION_TARGETS]]) for (const t of arr) addLv(t.itemId, t.reqLevel)
for (const s of ['foraging', 'fishing', 'hunting', 'excavation']) {
  for (const t of GATHERING_EXT[s] ?? []) addLv(t.itemId, t.reqLevel)
  for (const t of GATHERING_EXT2[s] ?? []) addLv(t.itemId, t.reqLevel)
}
for (const c of CROPS) addLv(c.itemId, c.reqLevel)
for (const t of EXPLORATION_TARGETS_ALL) for (const l of t.loot ?? []) if (l.itemId) addLv(l.itemId, t.reqLevel)
// 少数腐坏食材无采集/掉落等级锚（仅作配方材料），手动给等级，确保高级蛋/海鲜仍腐坏
addLv('pheasantEgg', 45) // 野鸡蛋（高级猎物蛋）

const MEAT_CATS = new Set(['meat', 'seafood', 'egg'])
const MIN_SPOIL_LV = 25 // 仅 lv≥25 的中高级荤食腐坏
const HOUR_MS = 3600 * 1000

export function applySpoilBalance() {
  for (const [id, item] of Object.entries(ITEMS)) {
    if (!MEAT_CATS.has(item.category)) continue
    const lv = level[id]
    if (lv == null || lv < MIN_SPOIL_LV) {
      // 低于阈值或未知等级：不做腐坏（低级荤食更耐放/不腐坏）
      if (item.spoilMs != null) delete item.spoilMs
      continue
    }
    // 越高级腐坏越长（单位小时）
    item.spoilMs = Math.round((12 + lv * 0.6) * HOUR_MS)
  }
}
