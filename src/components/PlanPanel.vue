<script setup>
// 挂机计划面板（2026-09-27 用户⑩：原先它是技能页头部的一整张卡「有点占空间」⇒ 整块搬进
// 底栏胶囊 `BottomDock` 的 🗓 计划分区，点胶囊弹出面板）。
// 逻辑**逐行照搬**自 `SkillView.vue`（没有重写），只把容器从 `.card` 换成底栏面板里的分区。
// ⚠️ 唯一的行为变化：原先把「对决类技能页不显示计划卡」写成模板条件（`activeDef?.category !== 'combat'`），
//    搬到底栏后这条**天然成立**（底栏与技能页无关），守卫也改成了「SkillView 里不再有 plan-card」。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getSkillInstance } from '../game/skills/registry.js'
import { getSkillDef } from '../game/data/skills.js'
import { getItem } from '../game/data/items.js'
import { CROPS } from '../game/skills/FarmingSkill.js'

const player = usePlayerStore()
const ui = useUiStore()

// 可计划的技能：采集 6 支 + 探索 + 农耕（有「目标」概念的才有意义；制作类是队列语义）
const PLAN_SKILLS = ['foraging', 'fishing', 'hunting', 'excavation', 'mining', 'woodcutting', 'exploration', 'farming']
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
/** 给底栏胶囊用的角标：计划在跑时显示「当前步/总步数」 */
const planBadge = computed(() => {
  const st = player.planState()
  if (!st.steps.length) return ''
  return st.active ? `${Math.min(st.index + 1, st.steps.length)}/${st.steps.length}` : `${st.steps.length} 步`
})
defineExpose({ planBadge })
</script>

<template>
  <div class="plan-panel">
    <div class="plan-head">
      <span class="dim">
        <template v-if="player.planState().steps.length">按顺序挂机：条件满足自动换目标，全部完成自动暂停</template>
        <template v-else>还没有步骤——点「编辑」添加（支持采集 / 探索 / 农耕目标）</template>
      </span>
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
        class="plan-step"
        :class="{ 'plan-cur': player.planState().active && player.planState().index === i }"
      >
        <span>{{ i + 1 }}. {{ planLabel(s) }}</span>
        <button class="btn btn-sm" @click="player.planRemoveStep(i)">✕</button>
      </div>
    </div>
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
</template>

<style scoped>
/* 面板内的排版：与底栏其它分区一致（不透明底由 `.dock-panel` 提供，这里只管行内布局） */
.plan-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}
.plan-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.plan-head-btns {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.plan-steps {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 128px;
  overflow-y: auto;
}
.plan-step {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border-radius: 6px;
}
.plan-step.plan-cur {
  background: rgba(var(--primary-tint-rgb), 0.16);
  border: 1px solid var(--primary);
}
.plan-add {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
</style>
