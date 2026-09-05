// 制作类技能基类 — 需求文档 §3.2
// 核心机制：选择食谱 → 消耗对应食材 → 制作 → 获得经验
// 制作有成功率，失败时消耗食材但获得一半经验（§3.2.1）

import { Skill } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryDoubleChance, masteryXpMultiplier } from '../core/mastery.js'
import { getSkillDef } from '../data/skills.js'
import { applyCraftXp } from './xpBalance.js'

const BASE_SUCCESS_LEVEL_BONUS = 0.02 // 每高于食谱等级 1 级 +2% 成功率
const MAX_SUCCESS = 0.98

export class ProductionSkill extends Skill {
  /**
   * @param {string} id
   * @param {object} player
   * @param {Array<{id:string, name:string, category:string, reqLevel:number, xp:number,
   *                 successChance:number, ingredients:Record<string,number>, output:{itemId:string, qty:number}}>} recipes
   */
  constructor(id, player, recipes) {
    super(id, player)
    this.recipes = [...recipes].sort((a, b) => a.reqLevel - b.reqLevel)
    applyCraftXp(this.recipes) // 制作经验随等级递增（消除高等级配方给低经验的倒挂）
    this.actionsDone = 0
  }

  get type() {
    return 'production'
  }

  /** 实际成功率：基础 + 等级差加成 + 公会制作成功率 增益，封顶 98% */
  successChance(recipe) {
    const guild = this.player.guildEffects?.() ?? {}
    const craftBonus = (guild.craftPct ?? 0) / 100
    return Math.min(recipe.successChance + (this.level - recipe.reqLevel) * BASE_SUCCESS_LEVEL_BONUS + craftBonus, MAX_SUCCESS)
  }

  /** 材料是否足够 + 等级是否满足 */
  canCraft(recipe) {
    if (this.level < recipe.reqLevel) return false
    for (const [itemId, qty] of Object.entries(recipe.ingredients)) {
      if ((this.player.inventory[itemId] ?? 0) < qty) return false
    }
    return true
  }

  /** 制作配方卡片的精通等级（0~100），按配方 id 累计获得次数反推 */
  masteryLevel(recipe) {
    return masteryLevelFromCount(this.mastery[recipe.id] ?? 0)
  }

  /**
   * 制作：成功 → 产出 + 全额经验；失败 → 无产出 + 半额经验（材料均消耗）
   * 每次制作累加该配方卡片的精通次数；成功产出按精通档位有概率双倍。
   * @returns {'ok'|'fail'|'denied'}
   */
  craft(recipe) {
    if (!this.canCraft(recipe)) return 'denied'
    for (const [itemId, qty] of Object.entries(recipe.ingredients)) {
      this.player.spendItem(itemId, qty)
    }
    this.actionsDone++
    this.player.addMastery(this.id, recipe.id, 1)

    if (Math.random() < this.successChance(recipe)) {
      const out = recipe.output
      const doubled = Math.random() < masteryDoubleChance(this.masteryLevel(recipe))
      const qty = doubled ? out.qty * 2 : out.qty
      this.player.gainItem(out.itemId, qty)
      this.player.bumpStory('craft', this.id + ':' + out.itemId)
      // 食材保鲜：按保鲜产物 id 单独计次
      if (this.id === 'preservation') this.player.bumpStory('support', 'preservation:' + out.itemId)
      // 对决·食灵召唤：按食灵 id 单独计次
      if (this.id === 'spiritSummoning') this.player.bumpStory('spirit', 'spirit:' + out.itemId)
      const expGained = this.addCardXp(recipe.xp, masteryXpMultiplier(this.masteryLevel(recipe)))
      EventBus.emit('skill:action', {
        skillId: this.id,
        itemId: out.itemId,
        qty,
        expGained,
        outcome: 'craft',
        recipeId: recipe.id,
        doubled,
        timestamp: Date.now(),
      })
      return 'ok'
    }

    const expGained = this.addCardXp(recipe.xp * 0.5, masteryXpMultiplier(this.masteryLevel(recipe)))
    EventBus.emit('skill:action', {
      skillId: this.id,
      itemId: recipe.output.itemId,
      qty: 0,
      expGained,
      outcome: 'craftfail',
      recipeId: recipe.id,
      timestamp: Date.now(),
    })
    return 'fail'
  }
}
