<script setup>
// 火候挑战弹窗（2026-09-06）：制作时弹出——定火完美/良好/失误，结果回调给制作流程加成
import { ref, onUnmounted } from 'vue'

const props = defineProps({
  title: { type: String, default: '🔥 火候挑战' },
})
const emit = defineEmits(['result', 'close'])

const PERFECT_W = 0.2
const ph = ref(0)
const running = ref(true)
let rafId = null
let lastT = 0
const verdict = ref(null)

function loop(t) {
  if (lastT) ph.value = (ph.value + ((t - lastT) / 1000) * 0.5) % 1
  lastT = t
  if (running.value) rafId = requestAnimationFrame(loop)
}
rafId = requestAnimationFrame(loop)

function strike() {
  if (verdict.value) return
  const d = Math.abs(ph.value - 0.5)
  let type = 'miss'
  if (d <= PERFECT_W / 2) type = 'perfect'
  else if (d <= PERFECT_W) type = 'good'
  verdict.value = type
  running.value = false
  if (rafId) cancelAnimationFrame(rafId)
}
function confirm() {
  emit('result', verdict.value || 'miss')
  emit('close')
}
function skip() {
  emit('result', 'skip')
  emit('close')
}
onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId) })

const zoneStyle = { left: (0.5 - PERFECT_W / 2) * 100 + '%', width: PERFECT_W * 100 + '%' }
const needleStyle = () => ({ left: ph.value * 100 + '%' })
</script>

<template>
  <div class="modal-backdrop" @click.self="skip">
    <div class="modal heat-challenge-modal">
      <header class="modal-head">
        <h3>{{ title }}</h3>
        <button class="btn btn-sm" @click="skip">✕</button>
      </header>
      <p class="dim">锅已烧热——点击「定火」让指针停在金黄区：<b>完美 +30% 经验</b> / 良好 +15% / 失误无加成（制作照常）。</p>
      <div class="heat-track">
        <div class="heat-perfect" :style="zoneStyle"></div>
        <div class="heat-needle" :style="needleStyle()"></div>
      </div>
      <div class="heat-actions">
        <button v-if="!verdict" class="btn btn-primary" @click="strike">🔥 定火！</button>
        <template v-else>
          <div class="heat-verdict" :class="verdict">
            {{ verdict === 'perfect' ? '🔥 完美定火！经验 +30%' : verdict === 'good' ? '✅ 还好，经验 +15%' : '❌ 火候过了，普通完成' }}
          </div>
          <button class="btn btn-sm btn-primary" @click="confirm">继续制作</button>
        </template>
      </div>
    </div>
  </div>
</template>
