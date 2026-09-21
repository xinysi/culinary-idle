<script setup>
// 技能页「指南」弹窗（2026-09-19）：原先页面顶部有一整框说明文字（「共 N 个采集目标 · 1% 双倍产出…」），
// 用户要求「去掉那一框，在标题旁边加个指南按钮」。说明文字搬到 `game/data/skillGuides.js`，
// 这里只负责渲染。文案里的 `**加粗**` 只做粗体，不引入完整 markdown 解析。
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { getSkillDef } from '../game/data/skills.js'
import { getSkillInstance } from '../game/skills/registry.js'
import { guideFor } from '../game/data/skillGuides.js'

const ui = useUiStore()

const def = computed(() => getSkillDef(ui.skillGuide))
// 页内数量：采集类给目标数、制作类给配方数（没有实例时就不显示这一句）
const count = computed(() => {
  const inst = getSkillInstance(ui.skillGuide)
  return inst?.targets?.length ?? inst?.recipes?.length ?? null
})
const isProduction = computed(() => def.value?.category === 'production')
const guide = computed(() => guideFor(def.value, { count: count.value, isProduction: isProduction.value }))

/** 把 `**粗体**` 切成片段渲染（只支持这一种标记，避免引第三方 markdown） */
function segs(text) {
  return String(text ?? '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((s) => ({
    bold: s.startsWith('**') && s.endsWith('**'),
    text: s.startsWith('**') ? s.slice(2, -2) : s,
  }))
}
function close() {
  ui.toggleSkillGuide(null)
}
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal skill-guide-modal">
      <header class="modal-head">
        <h3>📖 {{ guide.title }} · 指南</h3>
        <button class="btn btn-sm" @click="close">✕</button>
      </header>
      <div class="skill-guide-body">
        <p class="skill-guide-intro">{{ guide.intro }}</p>
        <ul class="skill-guide-points">
          <li v-for="(p, i) in guide.points" :key="i">
            <span v-for="(s, j) in segs(p)" :key="j" :class="{ 'sg-bold': s.bold }">{{ s.text }}</span>
          </li>
        </ul>
        <p class="dim sg-foot">不知道选哪个目标就跟卡片上的「⚡ 最优」走；具体数值以页面卡片为准，本页只解释机制。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skill-guide-modal {
  width: min(620px, 92vw);
}
.skill-guide-body {
  padding: 4px 2px;
}
.skill-guide-intro {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.6;
}
.skill-guide-points {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.skill-guide-points li {
  font-size: 13px;
  line-height: 1.65;
}
.sg-bold {
  font-weight: 700;
  color: var(--primary);
}
/* 深色皮肤下 `--primary` 当小字只有 3.3~4.0 对比度（与 .era-name / .best-flag 同一原因），
   换成「淡彩底上的文字」token（皮肤按 shade(pd, 0.45) 提亮推导）。 */
html[data-theme='dark'] .sg-bold {
  color: var(--on-primary-tint);
}
.sg-foot {
  margin: 12px 0 0;
  font-size: 12px;
}
</style>
