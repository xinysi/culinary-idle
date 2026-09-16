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
    if (Math.random() < FOSSIL_CHANCE) {
      this.player.gainItem(FOSSIL_ITEM_ID, 1)
      extraItem = FOSSIL_ITEM_ID
      extras.push(FOSSIL_ITEM_ID)
    }
    if (Math.random() < COPPER_CHANCE) {
      this.player.gainItem('copperOre', 1)
      extras.push('copperOre')
    }
    if (Math.random() < IRON_CHANCE) {
      this.player.gainItem('ironOre', 1)
      extras.push('ironOre')
    }
    // 10% 掉落本作物种子（仅对可种作物；矿物目标无种子自动跳过）
    const seedId = SEED_MAP[target.itemId]
    if (seedId && Math.random() < SEED_CHANCE + (this.player.daoEffects?.()?.seedChancePct ?? 0) / 100) {
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

  /** 离线结算：产出含期望化石/矿石数量 */
  computeOffline(durationMs, efficiency) {
    const result = super.computeOffline(durationMs, efficiency)
    if (!result) return null
    const fossils = Math.round(result.actions * FOSSIL_CHANCE)
    if (fossils > 0) result.items[FOSSIL_ITEM_ID] = fossils
    const coppers = Math.round(result.actions * COPPER_CHANCE)
    if (coppers > 0) result.items.copperOre = coppers
    const irons = Math.round(result.actions * IRON_CHANCE)
    if (irons > 0) result.items.ironOre = irons
    const seedId = SEED_MAP[this.currentTarget?.itemId]
    if (seedId) {
      const seeds = Math.round(result.actions * (SEED_CHANCE + (this.player.daoEffects?.()?.seedChancePct ?? 0) / 100))
      if (seeds > 0) result.items[seedId] = seeds
    }
    return result
  }
}
