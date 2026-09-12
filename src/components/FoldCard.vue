<script setup>
// 折叠对照卡（2026-09-12 立）— 放在页头正下方，默认收起，点开显示详细对照表。
//
// 为什么不是"表格放在原处 + 一个按钮"：实测手机上对照表多在 1.5~3.0 屏之下（要滚 2~3.5 次），
// 按钮放原处仍然要滚过去；而把「入口」提到页头下方后，无论页面多长，第一屏就能看到并展开。
// 为什么摘要必须写结论：收起状态下玩家只看到这一行——结论留在折叠体内等于没有（同「折叠线以下等于白给」）。
defineProps({
  title: { type: String, required: true },
  hint: { type: String, default: '' }, // 一行结论（收起时唯一可见的信息）
  open: { type: Boolean, default: false }, // 默认收起
})
</script>

<template>
  <details class="card fold-card" :open="open">
    <summary>
      <span class="fold-title">{{ title }}</span>
      <span v-if="hint" class="dim fold-hint">{{ hint }}</span>
      <span class="fold-toggle mono" aria-hidden="true"></span>
    </summary>
    <div class="fold-body">
      <slot />
    </div>
  </details>
</template>
