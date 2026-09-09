// 美食探索（Culinary Exploration）— 需求文档 §3.4.3
// 对应 Melvor 偷窃：选择目标探索/偷师，有成功率；
// 成功获得稀有食材/道具/金币，失败被「抓住」损失金币（金币不足则损失 生命值）。

import { Skill } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryXpMultiplier } from '../core/mastery.js'
import { itemName } from '../data/items.js'
import { EXPLORATION_TARGETS_ALL } from '../data/explorationTargets.js'

// 注：此数组为遗留“基础 10 目标”，仅保留向后兼容导出；实际运行数据使用下面的 EXPLORATION_TARGETS_ALL（200 目标）。
// 运行数据：src/game/data/explorationTargets.js 的 EXPLORATION_TARGETS_ALL。
export const EXPLORATION_TARGETS = [
  { id: 'streetVendor', name: '街头小贩', reqLevel: 1, intervalSec: 3.0, xp: 10, baseSuccess: 0.85, failGold: 5, loot: [{ type: 'gold', min: 2, max: 10, chance: 0.7 }, { type: 'item', itemId: 'apple', min: 1, max: 3, chance: 0.35 }, { type: 'item', itemId: 'copperOre', min: 1, max: 2, chance: 0.2 }] },
  { id: 'streetPerformer', name: '街头艺人', reqLevel: 8, intervalSec: 3.4, xp: 18, baseSuccess: 0.82, failGold: 8, loot: [{ type: 'gold', min: 4, max: 15, chance: 0.7 }, { type: 'item', itemId: 'apple', min: 1, max: 3, chance: 0.3 }, { type: 'item', itemId: 'wood', min: 1, max: 3, chance: 0.25 }] },
  { id: 'snackBoss', name: '小吃摊老板娘', reqLevel: 15, intervalSec: 3.8, xp: 30, baseSuccess: 0.8, failGold: 12, loot: [{ type: 'gold', min: 6, max: 20, chance: 0.65 }, { type: 'item', itemId: 'wheat', min: 2, max: 4, chance: 0.3 }, { type: 'item', itemId: 'flour', min: 1, max: 3, chance: 0.25 }] },
  { id: 'nightMarket', name: '夜市摊主', reqLevel: 25, intervalSec: 4.2, xp: 50, baseSuccess: 0.78, failGold: 18, loot: [{ type: 'gold', min: 10, max: 30, chance: 0.65 }, { type: 'item', itemId: 'peppercorn', min: 1, max: 2, chance: 0.3 }, { type: 'item', itemId: 'chili', min: 1, max: 3, chance: 0.3 }] },
  { id: 'privateKitchen', name: '私房菜馆', reqLevel: 35, intervalSec: 4.6, xp: 75, baseSuccess: 0.75, failGold: 25, loot: [{ type: 'gold', min: 15, max: 40, chance: 0.6 }, { type: 'item', itemId: 'garlic', min: 1, max: 3, chance: 0.3 }, { type: 'item', itemId: 'ginger', min: 1, max: 2, chance: 0.3 }] },
  { id: 'michelin', name: '米其林后厨', reqLevel: 45, intervalSec: 5.0, xp: 105, baseSuccess: 0.72, failGold: 35, loot: [{ type: 'gold', min: 20, max: 55, chance: 0.6 }, { type: 'item', itemId: 'truffle', min: 1, max: 1, chance: 0.15 }, { type: 'item', itemId: 'matsutake', min: 1, max: 1, chance: 0.2 }] },
  { id: 'foodBlogger', name: '美食博主', reqLevel: 55, intervalSec: 5.4, xp: 145, baseSuccess: 0.7, failGold: 45, loot: [{ type: 'gold', min: 30, max: 70, chance: 0.6 }, { type: 'item', itemId: 'vanilla', min: 1, max: 2, chance: 0.25 }, { type: 'item', itemId: 'energyBiscuit', min: 1, max: 1, chance: 0.1 }] },
  { id: 'royalChef', name: '宫廷御厨', reqLevel: 65, intervalSec: 5.8, xp: 195, baseSuccess: 0.68, failGold: 60, loot: [{ type: 'gold', min: 40, max: 90, chance: 0.55 }, { type: 'item', itemId: 'ginseng', min: 1, max: 2, chance: 0.25 }, { type: 'item', itemId: 'fossilIngredient', min: 1, max: 1, chance: 0.1 }] },
  { id: 'godDisciple', name: '食神弟子', reqLevel: 80, intervalSec: 6.4, xp: 280, baseSuccess: 0.65, failGold: 90, loot: [{ type: 'gold', min: 60, max: 130, chance: 0.55 }, { type: 'item', itemId: 'spiritFruit', min: 1, max: 1, chance: 0.2 }, { type: 'item', itemId: 'mysterySpice', min: 1, max: 1, chance: 0.12 }] },
  { id: 'legendRestaurant', name: '传说餐厅', reqLevel: 90, intervalSec: 7.0, xp: 380, baseSuccess: 0.6, failGold: 130, loot: [{ type: 'gold', min: 100, max: 200, chance: 0.5 }, { type: 'item', itemId: 'goldenDragonFish', min: 1, max: 1, chance: 0.06 }, { type: 'item', itemId: 'dragonRoot', min: 1, max: 2, chance: 0.2 }] },
]

const SUCCESS_PER_LEVEL = 0.015
const MAX_SUCCESS = 0.95
const MIN_SUCCESS = 0.25
const FAIL_HP_PCT = 0.1

export class ExplorationSkill extends Skill {
  constructor(player) {
    super('exploration', player)
    this.targets = [...EXPLORATION_TARGETS_ALL].sort((a, b) => a.reqLevel - b.reqLevel)
    this.timerMs = 0
    this.cycleStartAt = performance.now() // 本产出周期起点（绝对时间戳，进度条 rAF 用）
    this.actionsDone = 0
  }

  get type() {
    return 'exploration'
  }

  get currentTarget() {
    const targetId = this.player.getSkillTarget?.(this.id) ?? this.player.activeTarget
    return this.targets.find((t) => t.id === targetId) ?? null
  }

  /** 成功率：基础 + 等级差（§3.4.3） */
  successChance(target = this.currentTarget) {
    if (!target) return 0
    return Math.min(Math.max(target.baseSuccess + (this.level - target.reqLevel) * SUCCESS_PER_LEVEL, MIN_SUCCESS), MAX_SUCCESS)
  }

  intervalMs(target = this.currentTarget) {
    return target ? target.intervalSec * 1000 : 0
  }

  /** 手动暂停（§3.1 停止/继续） */
  get paused() {
    return this.player.isSkillPaused?.(this.id) ?? false
  }

  /** 距下一次探索的进度 0~1（进度条用） */
  get progressPct() {
    const t = this.currentTarget
    if (!t || this.level < t.reqLevel) return 0
    const iv = this.intervalMs(t)
    return iv > 0 ? Math.min(1, this.timerMs / iv) : 0
  }

  tick(deltaMs) {
    const target = this.currentTarget
    if (!target) return
    if (this.level < target.reqLevel) return
    if (this.paused) return // 手动停止
    this.timerMs += deltaMs
    const interval = this.intervalMs(target)
    let guard = 0
    while (this.timerMs >= interval && guard++ < 100) {
      this.timerMs -= interval
      this.performAction(target)
    }
    if (guard >= 100) this.timerMs = 0
    this.cycleStartAt = performance.now() - this.timerMs
  }

  performAction(target) {
    this.actionsDone++
    if (Math.random() < this.successChance(target)) {
      // 成功：结算掉落
      const gained = []
      for (const entry of target.loot) {
        if (Math.random() >= entry.chance) continue
        const qty = entry.min === undefined ? 1 : entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1))
        if (entry.type === 'gold') {
          this.player.gainGold(qty)
          gained.push(`金币×${qty}`)
        } else {
          this.player.gainItem(entry.itemId, qty)
          gained.push(`${itemName(entry.itemId)}×${qty}`) // 掉落物品用中文名（此前误用英文 id）
        }
      }
      this.player.addMastery(this.id, target.id, 1)
      // 卡片经验（2026-09-09 修复）：此前误用 addXp，少了 ×60 卡片系数与精通倍率 → 满级时长
      // 比同类采集慢约 12 倍（基准 64 天 vs 5 天）。改用 addCardXp，与采集/制作同口径。
      this.addCardXp(target.xp, masteryXpMultiplier(masteryLevelFromCount(this.mastery[target.id] ?? 0)))
      this.player.onExplorationSuccess()
      // 掉落清单用中文描述的字符串（extraGain）；itemId 仍是目标 id，仅用于计数，不再当物品名拼接日志
      EventBus.emit('skill:action', { skillId: this.id, itemId: target.id, qty: 1, outcome: 'explore', timestamp: Date.now(), extraGain: gained.length ? gained.join('、') : null })
    } else {
      // 失败：被抓住 → 损失金币（不足则损失 生命值）
      let penalty = ''
      if (this.player.spendGold(target.failGold)) {
        penalty = `损失 ${target.failGold} 金币`
      } else {
        const dmg = Math.max(1, Math.floor(this.player.maxHp * FAIL_HP_PCT))
        this.player.setCombat({ hp: Math.max(0, this.player.combat.hp - dmg) })
        penalty = `损失 ${dmg} 品鉴值`
      }
      EventBus.emit('skill:action', { skillId: this.id, itemId: target.id, qty: 0, outcome: 'explorefail', penalty, timestamp: Date.now() })
    }
  }

  /** 离线：按期望成功率折算（§10.2.2） */
  computeOffline(durationMs, efficiency) {
    const target = this.currentTarget
    if (!target || this.level < target.reqLevel) return null
    const interval = this.intervalMs(target)
    const actions = Math.floor((durationMs / interval) * efficiency)
    if (actions <= 0) return null
    const rate = this.successChance(target)
    const ok = Math.round(actions * rate)
    // 经验按期望成功次数；物品给期望掉落（简化为只报经验与金币估算）
    const exp = ok * target.xp
    const gold = ok * (target.loot.find((l) => l.type === 'gold')?.chance ?? 0) * ((target.loot.find((l) => l.type === 'gold')?.min ?? 0) + (target.loot.find((l) => l.type === 'gold')?.max ?? 0)) / 2
    return { actions, exp, items: {}, gold: Math.round(gold) }
  }
}
