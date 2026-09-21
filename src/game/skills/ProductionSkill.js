// 制作类技能基类 — 需求文档 §3.2
// 核心机制：选择食谱 → 消耗对应食材 → 制作 → 获得经验
// 制作有成功率，失败时消耗食材但获得一半经验（§3.2.1）

import { Skill, CARD_XP_SCALE } from './Skill.js'
import { EventBus } from '../core/EventBus.js'
import { masteryLevelFromCount, masteryLevelProgress, masteryDoubleChance, masteryXpMultiplier, masteryYieldBonus } from '../core/mastery.js'
import { getSkillDef } from '../data/skills.js'
import { applyCraftXp } from './xpBalance.js'
import { craftSuccessChance } from '../data/difficulty.js' // 全局难度系数：成功率唯一缩放出口
import { effIngredients } from '../data/materialCost.js' // 全局材料系数：材料用量唯一出口

const BASE_SUCCESS_LEVEL_BONUS = 0.02 // 每高于食谱等级 1 级 +2% 成功率
const MAX_SUCCESS = 0.98
// 制作队列节奏：每 3 秒自动制作 1 次。**与配方等级无关**（采集的间隔则随目标等级变长）——
// 这条差异正是「制作侧梯级比采集更陡」的结构原因（实测同精通天花板 ×19~×48 vs 采集 ×8.5~×27）。
// `xpPerHour()` 与守卫都读这个导出常量，别再写第二份 3000。
export const CRAFT_QUEUE_INTERVAL_MS = 3000
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

  /**
   * 实际成功率：基础 + 等级差加成 + 公会制作成功率 增益，封顶 98%，再乘全局难度系数。
   *
   * 🔴 这是**全部制作类技能**的唯一成功率出口（制作/烘焙/腌制/调酒/调料/锻造/保鲜/木工/15 支副业/食灵召唤
   *    都继承本类且无人覆写）：`craft()` 的掷骰、`ProductionView` 的「成功率」列、卡片「效率」换算
   *    读的都是它 ⇒ 显示与结算天然同源。
   * ⚠️ 难度系数作用在**最终值**上（含各种加成之后），所以它是「有效成功率」的真实倍率；
   *    若作用在 `recipe.successChance` 上，会被等级差/公会等加成稀释掉。
   *    下限 8%（`CHANCE_FLOOR.craft`）保证再难也刷得出来。
   */
  successChance(recipe) {
    const guild = this.player.guildEffects?.() ?? {}
    const craftBonus = (guild.craftPct ?? 0) / 100
    const insightBonus = (this.player.insightEffects?.()?.craftPct ?? 0) / 100 // 菜系图谱（2026-09-09）
    const honorBonus = (this.player.honorState?.()?.perks?.craftPct ?? 0) / 100 // 荣誉殿堂（2026-09-10）
    const poolPP = (this.player.masteryPoolBonus?.(this.id)?.successPP ?? 0) / 100 // 精通池里程碑（2026-09-19）
    const raw = Math.min(recipe.successChance + (this.level - recipe.reqLevel) * BASE_SUCCESS_LEVEL_BONUS + craftBonus + insightBonus + honorBonus + poolPP, MAX_SUCCESS)
    return craftSuccessChance(raw)
  }

  /** 该配方成功时的「双倍产出」几率（精通档位 + 精通池里程碑）。
   *  单一出口：`craft()` 只读它，别再在 craft 里各拼一次。 */
  doubleChanceOf(recipe) {
    const poolPP = (this.player.masteryPoolBonus?.(this.id)?.doublePP ?? 0) / 100
    return Math.min(1, masteryDoubleChance(this.masteryLevel(recipe)) + poolPP)
  }

  /** 材料是否足够 + 等级是否满足（材料用量走 `effIngredients` 唯一出口，别直接读 `recipe.ingredients`） */
  canCraft(recipe) {
    if (this.level < recipe.reqLevel) return false
    for (const [itemId, qty] of Object.entries(effIngredients(recipe))) {
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

  /** 单次制作的**期望经验**（成功全额、失败半额 —— 与 `craft()` 里的两条分支同源） */
  xpPerCraft(recipe) {
    const p = this.successChance(recipe)
    return recipe.xp * (p + (1 - p) * 0.5)
  }

  /**
   * 该配方的**实际效率**（技能经验/小时）＝ 期望经验 × 精通经验倍率 × CARD_XP_SCALE × 3600 ÷ 队列节奏。
   *
   * 🔴 这是玩家横向比较配方时**唯一需要的数字**，也是「换更高级配方」这条设计意图的可见化：
   *   配方卡片上原本只有「经验」（`r.xp`）一列 —— 玩家要自己乘**精通倍率**、还要乘**成功率**
   *   （失败只得半额经验），而成功率**随等级差每级 +2%**、还随配方不同而不同（0.6~0.9）⇒ 心算必错。
   *   实测（`scripts/sim/recipe_choice.mjs`，材料给足、同起点同时长）：「择优换配方」比
   *   「蹲最低级配方」多拿 **×14.6~×20.7** 经验；而**「跟着解锁无脑换」只能拿到择优的一半到四分之三**
   *   （锻造差 4 倍）—— 因为刚解锁的配方成功率最低，玩家却看不出来。
   * ⚠️ 乘 `CARD_XP_SCALE` 是为了与技能经验条同口径（`Skill.addCardXp` 也乘它）。
   * ⚠️ 含「菜系研究」的该学派经验加成（`craft()` 里对成功分支乘了同样的系数），所以显示值 ≈ 实际到账值。
   */
  xpPerHour(recipe) {
    if (!recipe) return 0
    const schoolMult = 1 + (this.player.schoolCraftXpPct?.(recipe.category) ?? 0) / 100
    return (this.xpPerCraft(recipe) * schoolMult * CARD_XP_SCALE * masteryXpMultiplier(this.masteryLevel(recipe))) / (CRAFT_QUEUE_INTERVAL_MS / 1000) * 3600
  }

  /** 当前**已解锁**配方里效率最高的那个（未解锁的不参与，避免给玩家「换过去更快」的错误引导） */
  bestUnlockedRecipe() {
    let best = null
    let bestRate = -1
    for (const r of this.recipes) {
      if (this.level < r.reqLevel) continue
      const v = this.xpPerHour(r)
      if (v > bestRate) {
        bestRate = v
        best = r
      }
    }
    return best
  }

  /**
   * 制作：成功 → 产出 + 全额经验；失败 → 无产出 + 半额经验（材料均消耗）
   * 每次制作累加该配方卡片的精通次数；成功产出按精通档位有概率双倍。
   * @returns {'ok'|'fail'|'denied'}
   */
  craft(recipe) {
    if (!this.canCraft(recipe)) return 'denied'
    // 材料用量唯一出口（含全局材料系数）：扣料与 canCraft/各处展示同源
    const mats = effIngredients(recipe)
    for (const [itemId, qty] of Object.entries(mats)) {
      this.player.spendItem(itemId, qty)
    }
    this.actionsDone++
    this.player.addMastery(this.id, recipe.id, 1)

    if (Math.random() < this.successChance(recipe)) {
      const out = recipe.output
      const doubled = Math.random() < this.doubleChanceOf(recipe)
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
      // 风味搭配册（2026-09-10）：成功制作时检测食材组合（用生效材料表，与扣料同一口径）
      this.player.discoverFlavors?.(Object.keys(mats))
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
