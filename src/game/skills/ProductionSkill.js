// 制作类技能基类 — 需求文档 §3.2
// 核心机制：选择食谱 → 消耗对应食材 → 制作 → 获得经验
// 制作有成功率，失败时消耗食材但获得一半经验（§3.2.1）

import { Skill } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryLevelProgress, masteryDoubleChance, masteryXpMultiplier, masteryYieldBonus } from '../core/mastery.js'
import { getSkillDef } from '../data/skills.js'
import { applyCraftXp } from './xpBalance.js'

const BASE_SUCCESS_LEVEL_BONUS = 0.02 // 每高于食谱等级 1 级 +2% 成功率
const MAX_SUCCESS = 0.98
const CRAFT_QUEUE_INTERVAL_MS = 3000 // 制作队列：每 3 秒自动制作 1 次
const MAX_QUEUE_ENTRIES = 8 // 每技能最多排队条目（相同配方自动合并）

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
    const insightBonus = (this.player.insightEffects?.()?.craftPct ?? 0) / 100 // 菜系图谱（2026-09-09）
    return Math.min(recipe.successChance + (this.level - recipe.reqLevel) * BASE_SUCCESS_LEVEL_BONUS + craftBonus + insightBonus, MAX_SUCCESS)
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

  /** 该配方的精通累计次数（厨房笔记 / 图鉴展示用） */
  masteryCount(recipe) {
    return this.mastery[recipe.id] ?? 0
  }

  /** 该配方的精通进度：{ level, current(本级内次数), needed(升下 1 级需次数), progress(0~1) } */
  masteryProgress(recipe) {
    return masteryLevelProgress(this.mastery[recipe.id] ?? 0)
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
      const batch = masteryYieldBonus(this.masteryLevel(recipe)) // 精通保底批量（2026-09-09）
      const qty = (doubled ? out.qty * 2 : out.qty) + batch
      // 食灵召唤：产物直接入「食灵阁」（不占背包格，2026-09-06）
      if (this.id === 'spiritSummoning') this.player.gainSpirit(out.itemId, qty)
      else this.player.gainItem(out.itemId, qty)
      this.player.bumpStory('craft', this.id + ':' + out.itemId)
      // 食材保鲜：按保鲜产物 id 单独计次
      if (this.id === 'preservation') this.player.bumpStory('support', 'preservation:' + out.itemId)
      // 对决·食灵召唤：按食灵 id 单独计次
      if (this.id === 'spiritSummoning') this.player.bumpStory('spirit', 'spirit:' + out.itemId)
      // 风味搭配册（2026-09-10）：成功制作时检测食材组合
      this.player.discoverFlavors?.(Object.keys(recipe.ingredients ?? {}))
      // 菜系研究（2026-09-10）：该学派配方经验加成
      const schoolMult = 1 + (this.player.schoolCraftXpPct?.(recipe.category) ?? 0) / 100
      const expGained = this.addCardXp(recipe.xp * schoolMult, masteryXpMultiplier(this.masteryLevel(recipe)))
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

  /* ── 制作队列（自动连续制作，放置核心） ── */

  /** 当前队列（持久化于 player.craftQueues[this.id]，条目 { recipeId, qty, paused }） */
  get craftQueue() {
    if (!this.player.craftQueues) this.player.craftQueues = {}
    const q = this.player.craftQueues[this.id]
    if (!Array.isArray(q)) {
      this.player.craftQueues[this.id] = [] // 旧档/异常：重置空队列
    }
    return this.player.craftQueues[this.id]
  }

  /**
   * 入队：校验等级；相同配方合并到队尾条目；满 8 条目拒绝。
   * @returns {{ok:boolean, reason?:string}}
   */
  enqueue(recipe, qty = 1) {
    if (this.level < recipe.reqLevel) return { ok: false, reason: 'level' }
    const q = this.craftQueue
    const last = q[q.length - 1]
    if (last && last.recipeId === recipe.id) {
      last.qty += qty
    } else if (q.length >= MAX_QUEUE_ENTRIES) {
      return { ok: false, reason: 'full' }
    } else {
      q.push({ recipeId: recipe.id, qty, paused: false })
    }
    return { ok: true }
  }

  /** 引擎 tick：推进队列（3 秒 1 次；队头材料不足则暂停等待，补料后手动恢复） */
  tick(deltaMs) {
    if (!(deltaMs > 0)) return
    const q = this.player.craftQueues?.[this.id]
    if (!Array.isArray(q) || q.length === 0 || q[0]?.paused) return
    this._queueAccum = (this._queueAccum ?? 0) + deltaMs
    if (this._queueAccum < CRAFT_QUEUE_INTERVAL_MS) return
    this._queueAccum = 0
    const head = q[0]
    const recipe = this.recipes.find((r) => r.id === head.recipeId)
    if (!recipe) {
      q.shift()
      return
    }
    const res = this.craft(recipe)
    if (res === 'denied') {
      head.paused = true // 材料不足：暂停等补料
      return
    }
    head.qty--
    if (head.qty <= 0) q.shift()
  }

  /** 恢复被暂停的队头（补料后） */
  resumeQueue() {
    const q = this.craftQueue
    if (q[0]) q[0].paused = false
  }

  removeQueueEntry(index) {
    this.craftQueue.splice(index, 1)
  }

  clearQueue() {
    this.craftQueue.splice(0)
  }
}
