<script setup>
// 相关页面跳转条（2026-09-10 补）— 各功能页底部一行「相关页面」按钮，减少在左栏里翻找。
// 用法：<RelatedPages :links="[{ view: 'branches', label: '🏬 分店' }]" />
//   跳到某个技能页要写成 { view: 'skill', skill: 'farming' }（skill 是**子目标**）。
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'

const ui = useUiStore()
const player = usePlayerStore()
defineProps({
  links: { type: Array, default: () => [] },
  title: { type: String, default: '相关页面：' },
})

/**
 * ⚠️ 只调 setView(l.view) 会**丢掉 skill 子目标**：`skill` 视图只渲染「当时激活的那一个技能」，
 * 于是「温室蜂场 → 🌾 农耕」「灵圃菌房 → 🌾 采摘」这两条会跳到玩家当前正在练的技能页（2026-09-21 修）。
 * 照 ShopView 的写法：先 setActiveSkill、再 setView。
 */
function go(l) {
  if (l.view === 'skill' && l.skill) player.setActiveSkill(l.skill)
  ui.setView(l.view)
}
</script>

<template>
  <div v-if="links.length" class="card rel-pages">
    <span class="dim rel-pages-title">{{ title }}</span>
    <button v-for="l in links" :key="l.view + (l.skill ?? '')" class="btn btn-sm" @click="go(l)">
      {{ l.label }}
    </button>
  </div>
</template>

<style scoped>
.rel-pages {
  margin-top: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rel-pages-title {
  font-size: 12px;
}
</style>
