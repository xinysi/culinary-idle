<script setup>
// 大反馈演出浮层（2026-09-18，留存改进 ⑥）
// 触发点见 `game/core/celebrations.js`（首次转生 / 首次赛季满档，各只演一次）。
// 设计：**不打断操作**——不锁滚动、点任意处或「继续」即可关闭，8 秒后自动淡出；
// 视觉只用既有 token（主色/金色 + 玻璃面板），不做全屏动画（避免与 60fps 的挂机循环抢帧）。
import { computed, onBeforeUnmount, watch } from 'vue'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
const data = computed(() => ui.celebration)

let timer = 0
function clear() {
  if (timer) { clearTimeout(timer); timer = 0 }
}
watch(data, (v) => {
  clear()
  if (v) timer = setTimeout(() => ui.closeCelebration(), 8000) // 8 秒自动收起，不挡着玩家
})
onBeforeUnmount(clear)
</script>

<template>
  <Teleport to="body">
    <div v-if="data" class="celebrate-mask" @click.self="ui.closeCelebration()">
      <div class="celebrate-card" :class="`celebrate-${data.tone ?? 'primary'}`">
        <div class="celebrate-icon">{{ data.icon }}</div>
        <div class="celebrate-title">{{ data.title }}</div>
        <p class="celebrate-sub" v-html="data.sub"></p>
        <button class="btn btn-sm btn-primary" @click="ui.closeCelebration()">继续</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.celebrate-mask {
  position: fixed;
  inset: 0;
  z-index: 60; /* 高于弹窗(50)、低于开发者面板(70) */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--scrim-rgb), 0.34);
  animation: celebrate-fade 0.35s ease-out;
}
.celebrate-card {
  width: min(460px, 92vw);
  padding: 22px 24px 18px;
  border-radius: 16px;
  text-align: center;
  background: rgba(var(--panel-rgb), 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  box-shadow: 0 16px 48px rgba(40, 20, 10, 0.4);
  animation: celebrate-pop 0.4s cubic-bezier(0.2, 1.1, 0.4, 1);
}
.celebrate-gold { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold-glow-strong), 0 16px 48px rgba(40, 20, 10, 0.4); }
.celebrate-icon { font-size: 44px; line-height: 1; }
.celebrate-title {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--primary-strong);
}
.celebrate-gold .celebrate-title { color: var(--gold); }
.celebrate-sub { margin: 10px 0 16px; font-size: 13px; color: var(--text); line-height: 1.7; }
.celebrate-sub :deep(b) { color: var(--primary-strong); }

@keyframes celebrate-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes celebrate-pop { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: none; } }
</style>
