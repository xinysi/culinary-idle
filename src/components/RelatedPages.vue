<script setup>
// 相关页面跳转条（2026-09-10 补）— 各功能页底部一行「相关页面」按钮，减少在左栏里翻找。
// 用法：<RelatedPages :links="[{ view: 'branches', label: '🏬 分店' }]" />
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
defineProps({
  links: { type: Array, default: () => [] },
  title: { type: String, default: '相关页面：' },
})
</script>

<template>
  <div v-if="links.length" class="card rel-pages">
    <span class="dim rel-pages-title">{{ title }}</span>
    <button v-for="l in links" :key="l.view + (l.skill ?? '')" class="btn btn-sm" @click="ui.setView(l.view)">
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
