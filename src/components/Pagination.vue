<template>
  <div class="pager-row">
    <button class="btn btn-sm" :disabled="current <= 1" @click="$emit('update:current', current - 1)">‹ 上一页</button>
    <span class="dim mono">第 {{ current }}/{{ pages }} 页</span>
    <button class="btn btn-sm" :disabled="current >= pages" @click="$emit('update:current', current + 1)">下一页 ›</button>
  </div>
</template>

<script setup>
defineProps({ current: Number, pages: Number })
defineEmits(['update:current'])
</script>

<style scoped>
.pager-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}
</style>
