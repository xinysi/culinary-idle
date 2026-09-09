<script setup>
// 技能详情视图 — 需求文档 §9.1.2
// 按技能类型分派到对应视图组件；100 级时可转生突破至 120（§3）
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getSkillInstance } from '../game/skills/registry.js'
import { getSkillDef } from '../game/data/skills.js'
import { getItem } from '../game/data/items.js'
import { CROPS } from '../game/skills/FarmingSkill.js'
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

// ── 挂机计划（2026-09-09）：按顺序挂机 → 条件满足自动换目标 → 全部完成自动暂停 ──
const PLAN_SKILLS = ['foraging', 'fishing', 'hunting', 'excavation', 'exploration', 'farming']
const planOpen = ref(false)
const planSkill = ref('foraging')
const planTarget = ref(null)
const planUntil = ref('mastery')
const planValue = ref(100)
const planTargets = computed(() => {
  if (planSkill.value === 'farming') return CROPS.map((c) => ({ id: c.itemId, name: getItem(c.itemId)?.name ?? c.itemId, reqLevel: c.reqLevel }))
  const inst = getSkillInstance(planSkill.value)
  return (inst?.targets ?? []).map((t) => ({ id: t.itemId ?? t.id, name: getItem(t.itemId ?? t.id)?.name ?? t.itemId, reqLevel: t.reqLevel }))
})
function planLabel(step) {
  const name = getItem(step.target)?.name ?? step.target
  return `${getSkillDef(step.skill)?.name ?? step.skill} · ${name}（${step.until === 'level' ? `技能 Lv${step.value}` : `精通 ${step.value} 级`}后）`
}
function planAdd() {
  const r = player.planAddStep(planSkill.value, planTarget.value, planUntil.value, planValue.value)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
  else planTarget.value = null
}
function planToggle() {
  const on = player.planToggle()
  ui.pushLog(on ? '🗓 挂机计划已启用（从第 1 步开始）' : '挂机计划已停用', 'info')
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

    <div class="card plan-card">
      <div class="plan-head">
        <h3>🗓 挂机计划</h3>
        <span class="dim">按顺序挂机：条件满足自动换目标，全部完成自动暂停</span>
        <div class="plan-head-btns">
          <button class="btn btn-sm" @click="planOpen = !planOpen">{{ planOpen ? '收起' : '编辑' }}</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': player.planState().active }" @click="planToggle()">
            {{ player.planState().active ? '⏸ 停用' : '▶ 启用' }}
          </button>
          <button class="btn btn-sm" @click="player.planClear()">清空</button>
        </div>
      </div>
      <div v-if="player.planState().steps.length" class="plan-steps">
        <div
          v-for="(s, i) in player.planState().steps"
          :key="i"
          class="gather-card-row plan-step"
          :class="{ 'plan-cur': player.planState().active && player.planState().index === i }"
        >
          <span>{{ i + 1 }}. {{ planLabel(s) }}</span>
          <button class="btn btn-sm" @click="player.planRemoveStep(i)">✕</button>
        </div>
      </div>
      <p v-else class="dim" style="font-size: 12px">还没有步骤——点「编辑」添加（支持采集/探索/农耕目标）。</p>
      <div v-if="planOpen" class="plan-add">
        <select v-model="planSkill" @change="planTarget = null">
          <option v-for="id in PLAN_SKILLS" :key="id" :value="id">{{ getSkillDef(id)?.name }}</option>
        </select>
        <select v-model="planTarget" style="flex: 1">
          <option :value="null">选择目标</option>
          <option v-for="t in planTargets" :key="t.id" :value="t.id">{{ t.name }}（Lv{{ t.reqLevel }}）</option>
        </select>
        <select v-model="planUntil">
          <option value="mastery">精通满</option>
          <option value="level">技能等级</option>
        </select>
        <input type="number" min="1" max="100" v-model.number="planValue" style="width: 80px" />
        <button class="btn btn-sm btn-primary" @click="planAdd()">＋ 添加</button>
      </div>
    </div>

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
/* 挂机计划（2026-09-09） */
.plan-card { margin-bottom: 12px; }
.plan-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.plan-head h3 { margin: 0; }
.plan-head-btns { margin-left: auto; display: flex; gap: 6px; }
.plan-steps { display: flex; flex-direction: column; gap: 4px; }
.plan-step.plan-cur { border: 1px dashed var(--primary); border-radius: 8px; padding: 2px 8px; background: var(--primary-soft); }
.plan-add { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
.plan-add select,
.plan-add input {
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  min-width: 0;
}
.plan-add select { appearance: none; -webkit-appearance: none; padding-right: 26px; background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%); background-position: calc(100% - 14px) 14px, calc(100% - 9px) 14px; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
.plan-add input[type='number'] { width: 84px; text-align: center; cursor: text; }
.plan-add select:focus-visible,
.plan-add input:focus-visible { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-soft); }
.plan-add .btn { height: 34px; display: inline-flex; align-items: center; }
</style>
