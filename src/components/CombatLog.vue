<script setup>
// 战斗日志（2026-09-19 从 CombatArena 拆出；2026-09-21 用户要求移到右栏「装备」原来的位置）。
// 拆出来的原因：用户要求日志只占半行 —— 它跟战斗屏的进度条/对峙不是一回事，
// 留着在战斗屏里就只能整行通铺。
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { getCombat } from '../game/combat/Combat.js'

const ui = useUiStore()
const combat = getCombat()

// ⚠️ 必须**返回副本**：`combat.log` 是就地 push 的同一个数组，computed 重算后若返回同一引用，
//    Vue 判定「值没变」⇒ 依赖它的渲染不会更新（玩家看到的就是「战斗日志不实时更新」）。
const log = computed(() => {
  ui.loopTick
  return [...(combat?.log ?? [])]
})
</script>

<template>
  <div class="card combat-log-card">
    <h3>战斗日志</h3>
    <div class="battle-log combat-log">
      <div v-if="!log.length" class="dim">选择对手开始料理对决（自动回合制）；战斗过程会记在这里。</div>
      <div v-for="(l, i) in [...log].reverse()" :key="i" :class="`log-${l.kind}`">{{ l.text }}</div>
    </div>
  </div>
</template>

<style scoped>
.combat-log-card {
  min-width: 0;
}
/* 右栏宽 288px ⇒ 加高一点（原先跟战备并排时只有 150px，读起来一直要滚） */
.combat-log {
  max-height: 220px;
  overflow-y: auto;
}
</style>
