// 挖掘（Excavation）— 需求文档 §3.1.4
// 对应 Melvor 采矿；挖掘物与解锁等级对齐文档，经验/间隔为按同难度档位设计的数值。
// 核心机制：根茎与菌类是烹饪/调料的基础资源；有 2% 几率额外挖到「化石食材」（远古食谱原料）。
//
// ⚠️ v2.7.0（2026-09-16）**矿物已独立为「采矿」技能**（`MiningSkill.js`）：
//   挖掘现在只管**根茎 / 菌类**（42 条），矿物（41 条）归采矿。
//   分流在本文件完成（`isMineralTarget` + `EXCAVATION_GROUND_TARGETS` / `MINING_TARGETS`），
//   因为 `expansion1.js` / `expansion2.js` / `smithOres.js` 是**冻结的生成器产物、一个字都不改**
//   （AGENTS.md 的生成器门禁）；两个技能各自 import 同一批源数组，再按物品类别分流。
//   `EXCAVATION_TARGETS`（历史手写 10 条）与四处附产（化石/铜矿/铁矿/种子）**保持原样**：
//   前者仍是四个生成器与三份平衡锚的输入（改它会引发未登记漂移），后者是既有掉落设计。

import { GatheringSkill } from './GatheringSkill.js'
import { EventBus } from '../core/EventBus.js'
import { GATHERING_EXT } from '../data/expansion1.js'
import { GATHERING_EXT2 } from '../data/expansion2.js'
import { SEED_MAP } from '../data/farmSeeds.js'
import { SMITH_ORE_TARGETS } from '../data/smithOres.js'
import { masteryXpMultiplier } from '../core/mastery.js'
import { getItem } from '../data/items.js'
import { gatherExtraChance } from '../data/difficulty.js' // 全局难度系数（附产概率；只压常量基准值）

/** ⚠️ 历史手写清单（10 条，含 1 个矿物 `saltOre`）——**内容保持原样**（见文件头注释）。 */
export const EXCAVATION_TARGETS = [
  { itemId: 'potato', reqLevel: 1, xpPerAction: 10, intervalSec: 3.0 },
  { itemId: 'sweetPotato', reqLevel: 5, xpPerAction: 16, intervalSec: 3.3 },
  { itemId: 'saltOre', reqLevel: 10, xpPerAction: 25, intervalSec: 3.6 },
  { itemId: 'onion', reqLevel: 20, xpPerAction: 40, intervalSec: 4.0 },
  { itemId: 'garlic', reqLevel: 30, xpPerAction: 60, intervalSec: 4.4 },
  { itemId: 'ginger', reqLevel: 40, xpPerAction: 85, intervalSec: 4.8 },
  { itemId: 'yam', reqLevel: 50, xpPerAction: 115, intervalSec: 5.2 },
  { itemId: 'lingzhi', reqLevel: 60, xpPerAction: 150, intervalSec: 5.6 },
  { itemId: 'ginseng', reqLevel: 75, xpPerAction: 215, intervalSec: 6.2 },
  { itemId: 'dragonRoot', reqLevel: 90, xpPerAction: 320, intervalSec: 7.0 },
  // ── 后期补档（2026-09-19）：修「75→90 有 15 级空档、91-99 一件都没有」 ──
  // 效果：61-99 段平均间距 7.3 → 3.5、最大空档 15 → 7、最深等级 90 → 99（对齐参照作 Melvor 的收官密度）。
  // 等级按间距 ~3 级铺；intervalSec 沿用本技能 75→90 的实测趋势（约 +0.053 秒/级）；
  // xpPerAction 取 `10 + 5×reqLevel` 下限（与所有后期目标一致，也是 `applyGatherXp` 的口径）。
  { itemId: 'rockCoreRoot', reqLevel: 78, xpPerAction: 400, intervalSec: 6.4 },
  { itemId: 'jadePithRoot', reqLevel: 81, xpPerAction: 415, intervalSec: 6.5 },
  { itemId: 'cloudFungus', reqLevel: 84, xpPerAction: 430, intervalSec: 6.7 },
  { itemId: 'bloodFungus', reqLevel: 87, xpPerAction: 445, intervalSec: 6.8 },
  { itemId: 'taiSui', reqLevel: 93, xpPerAction: 475, intervalSec: 7.2 },
  { itemId: 'vermilionGrass', reqLevel: 96, xpPerAction: 490, intervalSec: 7.3 },
  { itemId: 'mysticRoot', reqLevel: 99, xpPerAction: 505, intervalSec: 7.5 },
]

/** 是否矿物（分流依据**只看物品类别**，不看名字——石膏/硝石/明矾这类名字里没有「矿」） */
export function isMineralTarget(t) {
  return getItem(t?.itemId)?.category === 'mineral'
}

/** 拆分前的全部挖掘目标（83 条 = 手写 10 + ext 30 + ext2 30 + 同名矿 13），供分流与审计使用 */
export const EXCAVATION_ALL_TARGETS = [
  ...EXCAVATION_TARGETS,
  ...GATHERING_EXT.excavation,
  ...GATHERING_EXT2.excavation,
  ...SMITH_ORE_TARGETS,
]

/** 挖掘的实际目标：根茎 + 菌类（42 条） */
export const EXCAVATION_GROUND_TARGETS = EXCAVATION_ALL_TARGETS.filter((t) => !isMineralTarget(t))

/** 采矿的 Lv1 / Lv5 入口：铜矿与铁矿此前**只作为挖掘附产**出现、玩家无法定向采集；
 *  独立成采矿后把它们补为正式目标（也让采集有 Lv1 入口，与其它采集技能一致）。 */
export const MINING_BASE_TARGETS = [
  { itemId: 'copperOre', reqLevel: 1, xpPerAction: 10, intervalSec: 3.0 },
  { itemId: 'ironOre', reqLevel: 5, xpPerAction: 16, intervalSec: 3.3 },
]

/** 采矿的实际目标：铜矿/铁矿 + 41 个矿物 = 43 条（Lv1~99 全覆盖） */
export const MINING_TARGETS = [
  ...MINING_BASE_TARGETS,
  ...EXCAVATION_ALL_TARGETS.filter(isMineralTarget),
].sort((a, b) => a.reqLevel - b.reqLevel)

export const FOSSIL_ITEM_ID = 'fossilIngredient'
const FOSSIL_CHANCE = 0.02 // 2%
const COPPER_CHANCE = 0.5 // 50% 附带铜矿（厨具锻造 §3.2.6）
const IRON_CHANCE = 0.3 // 30% 附带铁矿
const SEED_CHANCE = 0.1 // 10% 附带产出本作物种子（农耕种子掉落 §3.1.5）

export class ExcavationSkill extends GatheringSkill {
  constructor(player) {
    super('excavation', player, EXCAVATION_GROUND_TARGETS)
  }

  performAction(target) {
    this.actionsDone++
    const doubled = Math.random() < this.doubleChance(target)
    const qty = this.yieldQuantity(doubled ? 2 : 1)
    this.player.gainItem(target.itemId, qty)
    this.player.addMastery(this.id, target.itemId, 1)
    const expGained = this.addCardXp(target.xpPerAction, masteryXpMultiplier(this.masteryLevel(target)))

    let extraItem = null
    const extras = []
    if (Math.random() < gatherExtraChance(FOSSIL_CHANCE)) {
      this.player.gainItem(FOSSIL_ITEM_ID, 1)
      extraItem = FOSSIL_ITEM_ID
      extras.push(FOSSIL_ITEM_ID)
    }
    if (Math.random() < gatherExtraChance(COPPER_CHANCE)) {
      this.player.gainItem('copperOre', 1)
      extras.push('copperOre')
    }
    if (Math.random() < gatherExtraChance(IRON_CHANCE)) {
      this.player.gainItem('ironOre', 1)
      extras.push('ironOre')
    }
    // 10% 掉落本作物种子（仅对可种作物；矿物目标无种子自动跳过）
    const seedId = SEED_MAP[target.itemId]
    // 只压常量基准值；daoEffects.seedChancePct 是轮回天赋练出来的加成，加回去
    if (seedId && Math.random() < gatherExtraChance(SEED_CHANCE) + (this.player.daoEffects?.()?.seedChancePct ?? 0) / 100) {
      this.player.gainItem(seedId, 1)
      extras.push(seedId)
    }
    if (extras.length > 1) extraItem = extras.join(',')

    EventBus.emit('skill:action', {
      skillId: this.id,
      itemId: target.itemId,
      qty,
      doubled,
      expGained,
      outcome: 'dig',
      extraItem,
      timestamp: Date.now(),
    })
  }

  /** 离线结算：产出含期望化石/矿石数量。⚠️ 概率一律走 gatherExtraChance，否则在线/离线不同口径 */
  computeOffline(durationMs, efficiency) {
    const result = super.computeOffline(durationMs, efficiency)
    if (!result) return null
    const fossils = Math.round(result.actions * gatherExtraChance(FOSSIL_CHANCE))
    if (fossils > 0) result.items[FOSSIL_ITEM_ID] = fossils
    const coppers = Math.round(result.actions * gatherExtraChance(COPPER_CHANCE))
    if (coppers > 0) result.items.copperOre = coppers
    const irons = Math.round(result.actions * gatherExtraChance(IRON_CHANCE))
    if (irons > 0) result.items.ironOre = irons
    const seedId = SEED_MAP[this.currentTarget?.itemId]
    if (seedId) {
      const seeds = Math.round(result.actions * (gatherExtraChance(SEED_CHANCE) + (this.player.daoEffects?.()?.seedChancePct ?? 0) / 100))
      if (seeds > 0) result.items[seedId] = seeds
    }
    return result
  }
}
