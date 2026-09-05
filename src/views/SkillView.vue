<script setup>
// 技能详情视图 — 需求文档 §9.1.2
// 按技能类型分派到对应视图组件；100 级时可转生突破至 120（§3）
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getSkillInstance } from '../game/skills/registry.js'
import { getSkillDef } from '../game/data/skills.js'
import { xpProgress } from '../game/core/Experience.js'
import { MAX_LEVEL } from '../game/skills/Skill.js'
import { SPIRIT_SLOTS } from '../game/data/spirits.js'
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
  if (!confirm(`转生「${activeDef.value?.name}」？\n等级重置为 1，永久 +20% 该技能经验，等级上限突破至 120。`)) return
  if (player.prestigeSkill(player.activeSkill)) {
    ui.pushLog(`已转生「${activeDef.value?.name}」`, 'levelup')
  }
}
</script>

<template>
  <section class="skill-view">
    <header class="skill-head">
      <div>
        <h2>
          {{ activeDef?.name }}
          <span v-if="prestiges > 0" class="badge badge-on">{{ prestiges }} 转</span>
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
