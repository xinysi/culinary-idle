<script setup>
// 进度条组件。
// 两种模式：
//  - 数值模式：传 progress(0~1)，由 Vue :style 响应式驱动（用于任务/精通/故事等离散更新）。
//  - 绝对时间戳模式：传 startAt、durationMs、active，用 requestAnimationFrame 每帧直接写 DOM
//    （复用 Rocky Idle 的做法：保存“周期起点时间戳”，每帧按 (now-startAt)/duration 单调推进，
//      不依赖引擎采样值 → 不动时不抖、动起来逐帧丝滑、无回拉）。
// 渲染性能：fill 用 transform: scaleX(pct) + transform-origin:left 表现进度，而非改 width。
//   width 会触发 layout/重排并在带 backdrop-filter(blur) 的容器上强制每帧模糊重绘 → 实测掉到 18fps；
//   transform 只走合成器（compositor），不重排不重绘，能保持 ~60fps，进度条才真正丝滑。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  progress: { type: Number, default: 0 }, // 数值模式 0~1
  startAt: { type: Number, default: null }, // 绝对时间戳模式：周期起点（performance.now()）
  durationMs: { type: Number, default: 0 }, // 周期时长（ms）
  active: { type: Boolean, default: true }, // 是否推进；false 时冻结为 0（已暂停/未挂机）
})

const fill = ref(null)
const timed = computed(() => props.startAt != null)
const scaleStr = computed(() => `translateZ(0) scaleX(${Math.min(1, Math.max(0, props.progress)).toFixed(4)})`)
// timed 模式：返回空对象（不含 transform 键），避免 Vue 的 :style 响应式 patch 把 rAF 手动写入的 transform 覆盖为空
// 数值模式：由 :style 绑定 transform 表现进度
const fillStyle = computed(() => (timed.value ? {} : { transform: scaleStr.value }))

let raf = 0
let running = false
function loop() {
  if (!running) return
  const el = fill.value
  if (el) {
    let pct = 0
    if (props.active && props.durationMs > 0) {
      pct = Math.min((performance.now() - props.startAt) / props.durationMs, 1)
    }
    el.style.transform = `translateZ(0) scaleX(${Math.max(0, Math.min(1, pct)).toFixed(4)})`
  }
  raf = requestAnimationFrame(loop)
}
function start() {
  if (running || !timed.value) return
  running = true
  raf = requestAnimationFrame(loop)
}
function stop() {
  running = false
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}
watch(timed, (t) => (t ? start() : stop()))
onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <div class="progress-bar">
    <div ref="fill" class="progress-bar-fill" :style="fillStyle"></div>
  </div>
</template>
