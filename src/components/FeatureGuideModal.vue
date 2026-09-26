<script setup>
// 功能页「指南」弹窗（2026-09-21）——用户报「技能都有指南按钮，怎么功能没有？」
//
// 说明文字**不另写一份**：直接取「攻略总览」里对应该页的那一条（`guide.js` 的 GUIDE_OVERVIEW，
// 由 `featureGroups.js` 的视图→关键词映射定位）。于是攻略与页内指南永远同一份内容，
// 内容同步审计既有的「左栏每个功能页都要有攻略关键词」派生检查顺带守住了这里的覆盖率。
//
// ⚠️ `desc` 是富文本（带 `<b>`），必须 `v-html` 渲染（AGENTS「富文本字段必须用 v-html」）。
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { guideEntryForView } from '../game/data/guide.js'

const ui = useUiStore()
const player = usePlayerStore()

const entry = computed(() => guideEntryForView(ui.activeView, player))

function close() {
  ui.toggleFeatureGuide(false)
}
/** 去攻略总览看完整版（并定位到该条目所在的分类） */
function openFull() {
  ui.setView('guide')
  close()
}
</script>

<template>
  <div v-if="entry" class="modal-backdrop" @click.self="close">
    <div class="modal feature-guide-modal">
      <header class="modal-head">
        <h3>{{ entry.icon }} {{ entry.name }} · 指南</h3>
        <button class="btn btn-sm" @click="close">✕</button>
      </header>
      <div class="fg-body">
        <p class="fg-meta">
          <span class="dim">{{ entry.categoryIcon }} {{ entry.category }}</span>
          <span class="fg-pill">阶段：{{ entry.stage }}</span>
          <span class="fg-pill">解锁：{{ entry.unlock }}</span>
        </p>
        <!-- eslint-disable-next-line vue/no-v-html -- 攻略文案是本地静态数据，且带 <b> 标记 -->
        <div class="fg-desc" v-html="entry.desc" />
        <p class="dim fg-foot">
          本页只讲机制；具体数值以页面上的卡片为准。全部功能的说明见
          <button class="btn btn-sm fg-link" @click="openFull">🗺️ 攻略总览</button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feature-guide-modal {
  width: min(660px, 92vw);
}
.fg-body {
  padding: 4px 2px;
}
.fg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 10px;
  font-size: 12px;
}
.fg-pill {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(var(--primary-tint-rgb), 0.12);
  /* 浅色：12% 主色淡彩底上的字（实测 2.29~4.42）⇒ 最深档；深色有自己的覆盖（--on-primary-tint-4）*/
  color: var(--primary-deep);
  font-size: 11px;
}
/* 深色下 `--primary` 当小字对比度不足（与 .sg-bold 同一原因）→ 用淡彩底文字 token */
html[data-theme='dark'] .fg-pill {
  color: var(--on-primary-tint-4);
}
.fg-desc {
  font-size: 13px;
  line-height: 1.7;
}
.fg-desc :deep(b) {
  color: var(--primary);
}
html[data-theme='dark'] .fg-desc :deep(b) {
  color: var(--on-primary-tint);
}
.fg-foot {
  margin: 14px 0 0;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.fg-link {
  font-size: 11px;
  padding: 1px 8px;
}
</style>
