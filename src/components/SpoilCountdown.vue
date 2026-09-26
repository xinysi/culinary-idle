<script setup>
// 腐坏倒计时（只有一行文字的一个小组件，2026-09-26 独立出来）——
// 🔴 **为什么要单独做成组件**：倒计时需要「秒级实时跳」，而它所在的 `InventoryView` 里有 2267 个格子。
//    只要**组件内**读取了 1 秒一跳的值，整页（含全部格子）就会跟着每秒重渲染 —— 实测单次 35.3ms，
//    等于每秒白烧 35ms 主线程。把这一行拆出来之后：**秒级节拍只重渲染这一个组件**，
//    `InventoryView` 那边只用 30 秒的慢节拍（它的文案粒度只有分钟）。
// ⚠️ 别再把它内联回 `InventoryView` 的模板里，也别把这里的 tick 挪到父组件。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { spoilCountdown } from '../game/data/itemDetail.js'

const props = defineProps({
  itemId: { type: String, required: true },
})
const player = usePlayerStore()
const tick = ref(0)
let timer = null
onMounted(() => { timer = setInterval(() => { tick.value++ }, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

/** 「59 分 30 秒后腐坏」；不腐坏时为 null */
const left = computed(() => {
  tick.value // 依赖 1 秒节拍
  const until = player.spoilage[props.itemId]
  if (!until) return null
  const cd = spoilCountdown(until, Date.now())
  return cd ? `${cd}后腐坏` : null
})
</script>

<template>
  <span v-if="left">{{ left }}</span>
</template>
