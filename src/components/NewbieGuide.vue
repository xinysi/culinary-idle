<script setup>
// 新手引导横幅 — 首日 5 步自动检测推进（2026-09-06）
// 达标即自动进下一步（由 ui.loopTick 每帧检测）；全部完成/点跳过则不再显示
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const STEPS = [
  { label: '① 选择挂机目标开始采集', where: '技能页 · 采摘', check: () => Object.keys(player.skillTargets ?? {}).length > 0 },
  { label: '② 做一道菜（烹饪/烘焙）', where: '技能页 · 制作', check: () => Object.keys(player.storyProgress ?? {}).some((k) => k.startsWith('craft:')) },
  { label: '③ 赢得第一场料理对决', where: '技能页 · 对决（刀工/摆盘/调味）', check: () => (player.stats?.combatWins ?? 0) > 0 },
  { label: '④ 领取每日任务的奖励', where: '图鉴 → 任务页', check: () => (player.daily?.tasks ?? []).some((t) => t.claimed) },
  { label: '⑤ 同时开第二条挂机线（多技能并行）', where: '技能页 · 再选一个挂机目标', check: () => Object.keys(player.skillTargets ?? {}).length >= 2 },
]

const current = computed(() => {
  ui.loopTick // 每引擎 tick 检测推进
  if (player.guide?.done) return null
  let i = player.guide?.step ?? 0
  while (i < STEPS.length && STEPS[i].check()) i++
  if (i >= STEPS.length) {
    player.guide = { step: STEPS.length, done: true }
    return null
  }
  if (player.guide.step !== i) player.guide = { step: i, done: false }
  return i
})

function skipGuide() {
  player.guide = { step: STEPS.length, done: true }
}
</script>

<template>
  <div v-if="current !== null" class="newbie-guide">
    <span class="newbie-step">{{ STEPS[current].label }}</span>
    <span class="dim newbie-where">{{ STEPS[current].where }}</span>
    <button class="btn btn-sm newbie-close" @click="skipGuide" title="不再显示引导">✕</button>
  </div>
</template>

<style scoped>
.newbie-guide {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
  padding: 7px 12px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(217, 90, 56, 0.12), rgba(217, 90, 56, 0.05));
  border: 1px dashed rgba(217, 90, 56, 0.4);
  font-size: 13px;
}
.newbie-step { font-weight: 600; color: var(--primary-strong); }
.newbie-where { font-size: 12px; }
.newbie-close { margin-left: auto; padding: 1px 8px; }
</style>
