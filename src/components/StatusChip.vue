<script setup>
// 状态分类块（2026-09-15 立，v2.5.4）——StatusChips 里的一「类」。
// label = 类别名（灰字），默认插槽 = 该类的值（正文色）；tone 决定语义底色。
// 色值一律用主题变量（--panel-soft-rgb / --border / --muted / --text / --good-soft / --bad-soft / --primary-soft），
// 其中前三类被 skins.js 覆盖 ⇒ 15 套皮肤无需额外分支（对比度实测见 AGENTS）。
defineProps({
  label: { type: String, default: '' },
  tone: { type: String, default: '' }, // '' | 'on' | 'good' | 'bad' | 'warn'
})
</script>

<template>
  <span class="status-chip" :class="tone ? `status-chip-${tone}` : ''">
    <span v-if="label" class="status-chip-label">{{ label }}</span>
    <span class="status-chip-value"><slot /></span>
  </span>
</template>
