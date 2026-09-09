// 农耕（Farming）— 需求文档 §3.1.5
// 对应 Melvor 农业：购买种子 → 种植到农田格 → 等待生长 → 收获 + 经验。
// - 初始 4 块农田，每 5 级 +1，上限 20 块
// - 作物有 3% 枯萎概率（堆肥可降低，后续迭代）
// - 可种普通作物与香料作物（15 种）
// 农田状态存于 player.farming.plots（随存档持久化），地块按时间戳生长（天然支持离线）。

import { Skill } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryDoubleChance, masteryXpMultiplier, masteryYieldBonus } from '../core/mastery.js'
import { FARM_CROPS } from '../data/farmSeeds.js'

const CROPS_15 = [
  { itemId: 'wheat', seedId: 'wheatSeed', reqLevel: 1, growSec: 90, xp: 25 },
  { itemId: 'rice', seedId: 'riceSeed', reqLevel: 5, growSec: 120, xp: 35 },
  { itemId: 'corn', seedId: 'cornSeed', reqLevel: 10, growSec: 150, xp: 50 },
  { itemId: 'cabbage', seedId: 'cabbageSeed', reqLevel: 15, growSec: 180, xp: 70 },
  { itemId: 'chili', seedId: 'chiliSeed', reqLevel: 20, growSec: 240, xp: 90 },
  { itemId: 'peppercorn', seedId: 'peppercornSeed', reqLevel: 25, growSec: 420, xp: 110 },
  { itemId: 'eggplant', seedId: 'eggplantSeed', reqLevel: 30, growSec: 300, xp: 130 },
  { itemId: 'starAnise', seedId: 'starAniseSeed', reqLevel: 35, growSec: 480, xp: 160 },
  { itemId: 'pumpkin', seedId: 'pumpkinSeed', reqLevel: 40, growSec: 360, xp: 180 },
  { itemId: 'cassia', seedId: 'cassiaSeed', reqLevel: 45, growSec: 540, xp: 220 },
  { itemId: 'vanilla', seedId: 'vanillaSeed', reqLevel: 50, growSec: 600, xp: 260 },
  { itemId: 'basil', seedId: 'basilSeed', reqLevel: 55, growSec: 660, xp: 300 },
  { itemId: 'rosemary', seedId: 'rosemarySeed', reqLevel: 65, growSec: 720, xp: 380 },
  { itemId: 'saffron', seedId: 'saffronSeed', reqLevel: 75, growSec: 840, xp: 500 },
  { itemId: 'dragonPepper', seedId: 'dragonPepperSeed', reqLevel: 85, growSec: 960, xp: 650 },
]

// 合并生成器补充的所有可采集/可挖掘非矿物食材作物（含现有 15 种），按等级升序展示
export const CROPS = [...CROPS_15, ...FARM_CROPS].sort((a, b) => a.reqLevel - b.reqLevel || a.itemId.localeCompare(b.itemId))

const WITHER_CHANCE = 0.03 // 成熟瞬间 3% 枯萎（堆肥 1% / 肥沃堆肥 0%）
export const FERTILIZER = {
  compost: { name: '堆肥', wither: 0.01, bonusQty: 0 },
  richCompost: { name: '肥沃堆肥', wither: 0, bonusQty: 1 },
}

export class FarmingSkill extends Skill {
  constructor(player) {
    super('farming', player)
  }

  get type() {
    return 'farming'
  }

  get maxPlots() {
    return Math.min(4 + Math.floor(this.level / 5), 20)
  }

  get plots() {
    return this.player.farming.plots
  }

  getCrop(seedId) {
    return CROPS.find((c) => c.seedId === seedId) ?? null
  }

  plotAt(i) {
    return this.plots[i] ?? null
  }

  /** 地块 i 上种植中的作物 */
  plotCrop(i) {
    const p = this.plotAt(i)
    return p ? this.getCrop(p.seedId) : null
  }

  /** 地块肥料配置 */
  plotFertilizer(i) {
    const p = this.plotAt(i)
    return p?.fertilizer ? (FERTILIZER[p.fertilizer] ?? null) : null
  }

  /** 地块枯萎概率（受肥料影响） */
  witherChance(i) {
    const f = this.plotFertilizer(i)
    return f ? f.wither : WITHER_CHANCE
  }

  /** 施肥：消耗 1 个肥料，降低枯萎概率（肥沃堆肥额外收获 +1） */
  fertilize(i, fertilizerId) {
    const p = this.plotAt(i)
    if (!p || p.withered) return false
    if (!FERTILIZER[fertilizerId]) return false
    if (this.isMature(i)) return false // 成熟后无需施肥
    if ((this.player.inventory[fertilizerId] ?? 0) < 1) return false
    this.player.spendItem(fertilizerId, 1)
    this.player.setPlot(i, { ...p, fertilizer: fertilizerId })
    EventBus.emit('skill:action', { skillId: this.id, itemId: fertilizerId, qty: 1, outcome: 'fertilize', timestamp: Date.now() })
    return true
  }

  /** 生长进度 0~1 */
  plotProgress(i) {
    const p = this.plotAt(i)
    const crop = this.plotCrop(i)
    if (!p || !crop) return 0
    return Math.min(1, (Date.now() - p.plantedAt) / (crop.growSec * 1000))
  }

  isMature(i) {
    const p = this.plotAt(i)
    const crop = this.plotCrop(i)
    if (!p || !crop) return false
    return Date.now() - p.plantedAt >= crop.growSec * 1000
  }

  /** 该种子可种植（等级足够 + 已拥有 + 地块空） */
  canPlant(i, seedId) {
    if (i >= this.maxPlots) return false
    if (this.plotAt(i)) return false
    const crop = this.getCrop(seedId)
    if (!crop) return false
    if (this.level < crop.reqLevel) return false
    return (this.player.inventory[seedId] ?? 0) >= 1
  }

  /** 可选的种子列表（只显示**已拥有且等级已解锁**的种子，可立即种植；未拥有的不显示） */
  get plantableSeeds() {
    return CROPS.filter((c) => this.level >= c.reqLevel && (this.player.inventory[c.seedId] ?? 0) >= 1)
  }

  /** 该种子等级是否已解锁（可种） */
  isSeedUnlocked(seedId) {
    const crop = this.getCrop(seedId)
    return crop ? this.level >= crop.reqLevel : false
  }

  /** 是否拥有该种子（供下拉禁用未拥有项） */
  hasSeed(seedId) {
    return (this.player.inventory[seedId] ?? 0) >= 1
  }

  plant(i, seedId) {
    if (!this.canPlant(i, seedId)) return false
    this.player.spendItem(seedId, 1)
    this.player.setPlot(i, { seedId, plantedAt: Date.now() })
    EventBus.emit('skill:action', { skillId: this.id, itemId: seedId, qty: 1, outcome: 'plant', timestamp: Date.now() })
    return true
  }

  /** 每帧：成熟瞬间判定枯萎（每块地只判定一次，防止成熟后每帧重复掷 3%）；
   *  另按设置自动收种（2026-09-09 放置化）：成熟即收获，并用同种种子自动补种（无种子则留空） */
  tick(deltaMs) {
    const autoFarm = this.player.settings?.autoFarm !== false
    for (let i = 0; i < this.plots.length; i++) {
      const p = this.plots[i]
      if (!p) continue
      if (!p.withered && !p.witherRolled && this.isMature(i)) {
        p.witherRolled = true // 成熟后首次判定即锁死，后续帧不再掷
        if (Math.random() < this.witherChance(i)) {
          this.player.setPlot(i, { ...p, withered: true })
          EventBus.emit('skill:action', {
            skillId: this.id,
            itemId: this.plotCrop(i)?.itemId ?? p.seedId,
            qty: 0,
            outcome: 'wither',
            timestamp: Date.now(),
          })
        }
      }
      if (autoFarm && this.isMature(i)) {
        const seedId = this.plotAt(i)?.seedId
        this.harvest(i) // 成熟地块收获（枯萎地块清理）
        if (seedId && this.canPlant(i, seedId)) this.plant(i, seedId)
      }
    }
  }

  /** 一键收获全部成熟地块（含枯萎清理），返回收获数 */
  harvestAll() {
    let n = 0
    for (let i = 0; i < this.plots.length; i++) {
      if (this.plotAt(i) && this.isMature(i) && this.harvest(i)) n++
    }
    return n
  }

  /** 一键种植：用同一种子种满所有空地块，返回种植数 */
  plantAll(seedId) {
    let n = 0
    for (let i = 0; i < this.maxPlots; i++) {
      if (this.canPlant(i, seedId) && this.plant(i, seedId)) n++
    }
    return n
  }

  /** 当前成熟（可收获）地块数 */
  get harvestableCount() {
    let n = 0
    for (let i = 0; i < this.plots.length; i++) {
      if (this.plotAt(i) && this.isMature(i)) n++
    }
    return n
  }

  /** 当前空地块数 */
  get emptyPlotCount() {
    let n = 0
    for (let i = 0; i < this.maxPlots; i++) {
      if (!this.plotAt(i)) n++
    }
    return n
  }

  /** 收获（枯萎地块 → 清理无产出） */
  harvest(i) {    const p = this.plotAt(i)
    if (!p) return false
    if (!this.isMature(i)) return false

    const crop = this.getCrop(p.seedId)
    if (p.withered) {
      this.player.clearPlot(i)
      EventBus.emit('skill:action', {
        skillId: this.id,
        itemId: crop?.itemId ?? p.seedId,
        qty: 0,
        outcome: 'cleared',
        timestamp: Date.now(),
      })
      return true
    }

    const spirit = this.player.spiritEffects?.() ?? {}
    const farmBonus = spirit.farmYieldBonus ?? 0
    const aoji = this.player.gastronomyEffects?.() ?? {}
    const extraChance = (aoji.yieldPct ?? 0) / 100 + ((this.player.getYieldMultiplier?.() ?? 1) - 1)
    const fertBonus = this.plotFertilizer(i)?.bonusQty ?? 0 // 肥沃堆肥收获 +1
    const batch = masteryYieldBonus(masteryLevelFromCount(this.mastery[crop.itemId] ?? 0)) // 精通保底批量（2026-09-09）
    let qty = 1 + farmBonus + fertBonus + batch + (extraChance > 0 && Math.random() < extraChance ? 1 : 0)
    // 精通档位双倍（新表：5→1%…100→80%）
    if (Math.random() < masteryDoubleChance(masteryLevelFromCount(this.mastery[crop.itemId] ?? 0))) qty *= 2
    this.player.gainItem(crop.itemId, qty)
    this.player.addMastery(this.id, crop.itemId, 1)
    const expGained = this.addCardXp(crop.xp, masteryXpMultiplier(masteryLevelFromCount(this.mastery[crop.itemId] ?? 0)))
    this.player.clearPlot(i)
    EventBus.emit('skill:action', {
      skillId: this.id,
      itemId: crop.itemId,
      qty: 1,
      expGained,
      outcome: 'harvest',
      timestamp: Date.now(),
    })
    return true
  }
}
