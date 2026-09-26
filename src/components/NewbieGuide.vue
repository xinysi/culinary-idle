<script setup>
// 新手目标链横幅（2026-09-06 立，2026-09-18 扩成 20 步带奖励的链条）
// 数据与判定在 `game/data/newbieChain.js`；推进与发奖在 `player.syncNewbieChain()`（幂等）。
// ⚠️ 本组件**不写状态**（旧版在 computed 里推进度、还带发奖，是副作用写在 getter 里 —— 已修）：
//    这里只负责「按引擎 tick 调一次 store 动作」+ 渲染当前步与奖励预览。
import { computed, watch } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { NEWBIE_STEPS, NEWBIE_TOTAL, rewardText } from '../game/data/newbieChain.js'

const ui = useUiStore()
const player = usePlayerStore()

// 每引擎 tick 推进一次（动作本身幂等，没完成任何步骤时开销就是 20 次只读判定）
watch(() => ui.loopTick, () => { player.syncNewbieChain() })
// 进游戏/读档后立刻推一次（此时还没走过 tick，空档会先显示第 1 步）
player.syncNewbieChain()

const current = computed(() => {
  if (player.guide?.done) return null
  return NEWBIE_STEPS[player.guide?.step ?? 0] ?? null
})
const stepNo = computed(() => Math.min((player.guide?.step ?? 0) + 1, NEWBIE_TOTAL))
/** 当前步的目标页面是否就是正在看的页面（不是则淡化横幅） */
const onTarget = computed(() => !!current.value && ui.activeView === current.value.view)
const rewardHint = computed(() => (current.value ? rewardText(current.value.reward) : ''))

function skipGuide() {
  player.guide = { ...(player.guide ?? {}), step: NEWBIE_TOTAL, done: true }
}
</script>

<template>
  <div
    v-if="current"
    class="newbie-guide"
    :class="{ 'newbie-dim': !onTarget }"
    :title="`${current.label}${current.where ? ` · ${current.where}` : ''}`"
  >
    <span class="newbie-count mono">{{ stepNo }}/{{ NEWBIE_TOTAL }}</span>
    <span class="newbie-step">{{ current.label }}</span>
    <span class="dim newbie-where">{{ current.where }}</span>
    <span v-if="rewardHint" class="newbie-reward">🎁 {{ rewardHint }}</span>
    <button class="btn btn-sm newbie-close" @click="skipGuide" title="不再显示引导">✕</button>
  </div>
</template>

<style scoped>
.newbie-guide {
  display: flex;
  align-items: center;
  gap: 8px;
  /* 2026-09-18：与 GoalStrip 同处一行（.head-strips），竖向 margin 收进容器、自身不撑满整行 */
  margin: 0;
  flex: 0 1 auto;
  min-width: 0;
  padding: 3px 8px;
  border-radius: 8px;
  /* 2026-09-19 用户反馈「底色太丑」：原来的粉红渐变压在壁纸上发脏、虚线框也显随意。
     改成与其它卡片同材质的**面板底 + 左侧主色竖条**（身份感靠那一条竖线，而不是整块染色）。 */
  background-color: rgba(var(--panel-rgb), 0.92);
  border: 1px solid var(--border);
  border-left: 3px solid var(--primary-tint);
  font-size: 13px;
}
.newbie-count {
  font-size: 12px;
  font-weight: 700;
  /* 浅色：25%~14% 主色淡彩底上的字用最深档（实测 4.27~4.44，差一点点）*/
  color: var(--primary-deep);
  background: rgba(var(--primary-tint-rgb), 0.14);
  border-radius: 6px;
  padding: 1px 6px;
  flex: 0 0 auto;
}
/* 单行不折（2026-09-19）：它现在住在**底栏**里，一旦折成两行整条底栏就高 52px、
   用户反馈「上下高度还是太高了」。文案超出时截断并靠 title 兜底，而不是把底栏撑高。 */
.newbie-guide {
  flex-wrap: nowrap;
}
.newbie-step,
.newbie-where {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.newbie-step { font-weight: 600; color: var(--primary-strong); flex: 0 1 auto; }
.newbie-where { font-size: 12px; flex: 0 1 auto; }
/* 奖励预览：常驻显示「完成能拿什么」——放置类留人的第一根胡萝卜 */
.newbie-reward {
  font-size: 12px;
  /* 浅色：`--gold` 压 12% 金光底实测只有 3.78 ⇒ 用金色深档（本篇最多的一类，165 处）*/
  color: var(--gold-strong);
  background: var(--gold-glow);
  border: 1px solid var(--gold);
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}
.newbie-close { margin-left: auto; padding: 1px 8px; }

/* 当前页 ≠ 该步的目标页 → 淡化（去掉主色强调，退成一条普通提示；✕ 保持正常可见）
   2026-09-11：此前它在每个页面都高亮显示，且定位文案含「技能页 · 采摘」，
   在「今日待办」等页面上会被误读成「页面内容/跳到了采摘页」。 */
.newbie-guide.newbie-dim {
  background: var(--bg-soft, rgba(var(--panel-rgb), 0.6));
  border-color: var(--border);
}
.newbie-guide.newbie-dim .newbie-step {
  color: var(--muted);
  font-weight: 500;
}
.newbie-guide.newbie-dim .newbie-where { opacity: 0.85; }
.newbie-guide.newbie-dim .newbie-reward { opacity: 0.75; }
</style>
