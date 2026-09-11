<script setup>
// 新手引导横幅 — 首日 5 步自动检测推进（2026-09-06）
// 达标即自动进下一步（由 ui.loopTick 每帧检测）；全部完成/点跳过则不再显示
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

// 每步标注**目标页面**（view）：当前不在该页时横幅会淡化，避免它抢走当前页的视觉重心
// （2026-09-11 用户反馈「点今日待办像跳到了采摘页」——根源就是这条横幅在每个页面都高亮显示，
//  而它的定位文案写着「技能页 · 采摘」；淡化后它只在真正该去的页面才醒目）
const STEPS = [
  { label: '① 选择挂机目标开始采集', where: '技能页 · 采摘', view: 'skill', check: () => Object.keys(player.skillTargets ?? {}).length > 0 },
  { label: '② 做一道菜（烹饪/烘焙）', where: '技能页 · 制作', view: 'skill', check: () => Object.keys(player.storyProgress ?? {}).some((k) => k.startsWith('craft:')) },
  { label: '③ 赢得第一场料理对决', where: '技能页 · 对决（刀工/摆盘/调味）', view: 'skill', check: () => (player.stats?.combatWins ?? 0) > 0 },
  // ④ 的定位文案原为「图鉴 → 任务页」：每日任务已在 v1.8.0 搬到独立的「任务中心」页，此处同步更正
  { label: '④ 领取每日任务的奖励', where: '左侧栏 · 任务中心', view: 'quests', check: () => (player.daily?.tasks ?? []).some((t) => t.claimed) },
  { label: '⑤ 同时开第二条挂机线（多技能并行）', where: '技能页 · 再选一个挂机目标', view: 'skill', check: () => Object.keys(player.skillTargets ?? {}).length >= 2 },
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

/** 当前步的目标页面是否就是正在看的页面（不是则淡化横幅） */
const onTarget = computed(() => current.value !== null && ui.activeView === STEPS[current.value].view)

function skipGuide() {
  player.guide = { step: STEPS.length, done: true }
}
</script>

<template>
  <div
    v-if="current !== null"
    class="newbie-guide"
    :class="{ 'newbie-dim': !onTarget }"
    :title="onTarget ? '' : `这一步要去：${STEPS[current].where}`"
  >
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

/* 当前页 ≠ 该步的目标页 → 淡化（去掉主色强调，退成一条普通提示；✕ 保持正常可见）
   2026-09-11：此前它在每个页面都高亮显示，且定位文案含「技能页 · 采摘」，
   在「今日待办」等页面上会被误读成「页面内容/跳到了采摘页」。 */
.newbie-guide.newbie-dim {
  background: var(--bg-soft, rgba(255, 252, 246, 0.6));
  border-color: var(--border);
}
.newbie-guide.newbie-dim .newbie-step {
  color: var(--muted);
  font-weight: 500;
}
.newbie-guide.newbie-dim .newbie-where { opacity: 0.85; }
</style>
