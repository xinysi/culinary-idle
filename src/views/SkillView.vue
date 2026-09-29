<script setup>
// 技能详情视图 — 需求文档 §9.1.2
// 按技能类型分派到对应视图组件；100 级时可转生突破至 120（§3）
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getSkillInstance } from '../game/skills/registry.js'
import { getSkillDef } from '../game/data/skills.js'
import { xpProgress } from '../game/core/Experience.js'
import { nextLevelPerk } from '../game/data/levelPerks.js'
import { MAX_LEVEL } from '../game/skills/Skill.js'
import { carryFromLevel } from '../game/data/legacy.js'

import ProgressBar from '../components/ProgressBar.vue'
import GatheringView from './GatheringView.vue'
import FarmingView from './FarmingView.vue'
import ProductionView from './ProductionView.vue'
import CombatView from './CombatView.vue'
import SpiritView from './SpiritView.vue'
import GastronomyView from './GastronomyView.vue'
import ExplorationView from './ExplorationView.vue'

const player = usePlayerStore()
const ui = useUiStore()

const activeDef = computed(() => getSkillDef(player.activeSkill))
const instance = computed(() => getSkillInstance(player.activeSkill))
const maxLevel = computed(() => player.getMaxLevel(player.activeSkill))
const progress = computed(() => xpProgress(player.skillState(player.activeSkill).exp, maxLevel.value, player.skillState(player.activeSkill).level))
// 等级台阶：本技能等级对应的「下一档」（见 game/data/levelPerks.js；Lv82 起每 2 级一个，直到 120）
const nextPerk = computed(() => nextLevelPerk(player.skillState(player.activeSkill)?.level ?? 1))
const prestiges = computed(() => player.skillState(player.activeSkill).prestiges ?? 0)

// 当前出站食灵对本技能的加成（§3.3.6）：让作用直观可见
const spiritEff = computed(() => player.spiritEffects?.() ?? {})
const spiritXpPct = computed(() => spiritEff.value.xpPct?.[player.activeSkill] ?? 0)
const spiritNonXp = computed(() => {
  const e = spiritEff.value
  const parts = []
  if (e.dmgPct) parts.push(`对决伤害 +${e.dmgPct}%`)
  if (e.healPerTurnPct) parts.push(`每回合回血 +${e.healPerTurnPct}%`)
  if (e.loseHpPerTurnPct) parts.push(`每回合损血 -${e.loseHpPerTurnPct}%`)
  if (e.fishingAccPct) parts.push(`垂钓成功率 +${e.fishingAccPct}%`)
  if (e.farmYieldBonus) parts.push(`农耕收获 +${e.farmYieldBonus}`)
  for (const [k, v] of Object.entries(e.styleDmgPct ?? {})) parts.push(`${k}伤害 +${v}%`)
  return parts
})
const spiritActiveCount = computed(() => player.spirits?.active?.length ?? 0)

function doPrestige() {
  // 文案必须与实现同口径：师徒传承把等级置为「1 + 传承级」（满 100 级转生保留 5 级），
  // 原先写「等级重置为 1」是错的（2026-09-18 用户报「文案与实现不符」）。
  const lv = player.skillState(player.activeSkill)?.level ?? MAX_LEVEL
  const carry = carryFromLevel(lv)
  const where = carry > 0 ? `Lv${1 + carry}（1 级 + 师徒传承保留的 ${carry} 级）` : `Lv1`
  // 「经验清零」已改成「经验回到该等级起点」：传承保留的等级**连累计经验基线一起给**（2026-09-18 用户确认）
  if (!confirm(`转生「${activeDef.value?.name}」？\n等级回到 ${where}，经验回到该等级起点（进度从 0 开始），永久 +20% 该技能经验，等级上限突破至 120。`)) return
  if (player.prestigeSkill(player.activeSkill)) {
    ui.pushLog(`已转生「${activeDef.value?.name}」`, 'levelup')
  }
}

// ── 挂机计划（2026-09-09；2026-09-27 用户⑩ 整块搬到 `PlanPanel.vue`，由底栏 🗓 胶囊弹出）──
// 原先它是本页头部的一整张卡（用户反馈「有点占空间」）⇒ 现在技能页不再渲染它，
// 连「对决类技能页不显示」那条模板条件也一并消失（底栏与技能页无关，天然成立）。
</script>

<template>
  <section class="skill-view">
    <header class="skill-head">
      <div>
        <h2>
          {{ activeDef?.name }}
          <span v-if="prestiges > 0" class="badge badge-on">{{ prestiges }} 转</span>
          <!-- 2026-09-26 用户⑪：原先这里有个内嵌的 📖 指南 按钮，而功能页的指南在**顶栏** ——
               同一个东西两个位置。现统一到顶栏那一枚（`App.vue` 的 `.top-nav-guide`，
               技能页也走它、渲染 skillGuides 的内容），这里不再重复。 -->
        </h2>
        <p class="dim">{{ activeDef?.desc }}</p>
      </div>
      <div class="skill-head-right">
        <div class="skill-head-xp-row">
          <span class="xp-level">等级 {{ progress.level }}<template v-if="maxLevel > MAX_LEVEL"> / {{ maxLevel }}</template></span>
          <div class="xp-num">
            <span class="dim mono">{{ progress.current.toLocaleString() }} / {{ progress.needed.toLocaleString() }}</span>
          </div>
        </div>
        <ProgressBar :progress="progress.progress" />
        <!-- 等级台阶（2026-09-29）：大后期 82~120 段每 2 级一个称号，这里把它变成**看得见的下一档目标**。
             荒漠段（Lv101-120 没有任何新目标）原本只剩数值，这一行就是那段里唯一的「还有东西可拿」。 -->
        <div v-if="nextPerk" class="dim skill-perk-hint">
          🎖 下一档台阶：<b>Lv{{ nextPerk.level }}</b>「{{ nextPerk.title }}」
          （还差 {{ nextPerk.level - progress.level }} 级 · 任一技能达到即可，称号见「成就与称号」）
        </div>
        <button
          v-if="progress.level >= MAX_LEVEL && maxLevel === MAX_LEVEL"
          class="btn btn-primary btn-sm"
          style="margin-top: 8px"
          @click="doPrestige"
        >
          ✨ 转生（突破 120 级）
        </button>
        <p v-else-if="prestiges > 0" class="dim" style="margin-top: 4px">转生加成：+{{ prestiges * 20 }}% 经验</p>
      </div>
    </header>

    <GatheringView v-if="instance?.type === 'gathering'" :instance="instance" />
    <FarmingView v-else-if="instance?.type === 'farming'" :instance="instance" />
    <ProductionView v-else-if="instance?.type === 'production'" :instance="instance" />
    <SpiritView v-else-if="instance?.type === 'spirit'" :instance="instance" />
    <GastronomyView v-else-if="instance?.type === 'gastronomy'" :instance="instance" />
    <ExplorationView v-else-if="instance?.type === 'exploration'" :instance="instance" />
    <!-- 对决类技能（§3.3） -->
    <CombatView v-else-if="activeDef?.category === 'combat'" />

    <div v-else class="card placeholder">
      <h2>{{ activeDef?.name }}</h2>
      <p>{{ activeDef?.desc }}</p>
      <p class="dim">该技能尚未实现（开发中）。</p>
    </div>
  </section>
</template>

<style scoped>
</style>
