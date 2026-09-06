<script setup>
// 离线结算详情弹窗 — 回到游戏时的收获清单（2026-09-06）
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { getItem, itemName } from '../game/data/items.js'
import { formatDuration } from '../game/core/OfflineProgress.js'

const ui = useUiStore()
const player = usePlayerStore()

const report = computed(() => ui.offlineReport)
// 每技能行的展示数据：物品/消耗/金币的文案
function reportLines() {
  const r = report.value
  if (!r) return []
  return r.reports.map(({ inst, r: sub }) => {
    const itemText = Object.entries(sub.items)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => `${itemName(id)} ×${q}`)
      .join('、')
    const consumeText = sub.consumed
      ? Object.entries(sub.consumed).map(([id, q]) => `消耗 ${itemName(id)} ×${q}`).join('')
      : ''
    const goldText = sub.gold > 0 ? `金币 +${sub.gold}` : ''
    return {
      name: inst.def.name,
      duration: formatDuration(sub.durationMs),
      exp: sub.exp,
      itemText: itemText || '无产出',
      consumeText,
      goldText,
      actions: sub.actions,
    }
  })
}

function fmtGolds(n) {
  return (n ?? 0).toLocaleString()
}
</script>

<template>
  <div v-if="report" class="modal-backdrop">
    <div class="modal offline-modal">
      <header class="modal-head">
        <h3>🚀 离线结算</h3>
        <button class="btn btn-sm" @click="ui.closeOfflineReport()">✕</button>
      </header>

      <p class="dim">离开游戏 <strong class="mono">{{ formatDuration(report.elapsedMs ?? 0) }}</strong>（离线收益 80% 效率）</p>

      <div class="offline-list">
        <div v-for="(l, i) in reportLines()" :key="i" class="offline-row">
          <div class="offline-row-head">
            <strong>{{ l.name }}</strong>
            <span class="dim mono">{{ l.duration }}</span>
            <span class="mono">+{{ l.exp }} 经验</span>
            <span v-if="l.actions" class="dim mono">{{ l.actions }} 次</span>
          </div>
          <div class="offline-row-body">
            <span>{{ l.itemText }}</span>
            <span v-if="l.consumeText" class="dim">{{ l.consumeText }}</span>
            <span v-if="l.goldText" class="mono">{{ l.goldText }}</span>
          </div>
        </div>
      </div>

      <div v-if="report.restGold > 0" class="offline-row restaurant">
        <strong>🏮 餐厅收入</strong>
        <span class="mono gold-inline">+{{ fmtGolds(report.restGold) }} 金币（80% 效率）</span>
      </div>

      <div class="offline-footer">
        <button class="btn btn-sm btn-primary" @click="ui.closeOfflineReport()">收下</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.offline-modal { max-width: 460px; }
.offline-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; max-height: 40vh; overflow-y: auto; }
.offline-row { padding: 8px 10px; border-radius: 8px; background: rgba(255, 251, 244, 0.8); border: 1px dashed rgba(217, 90, 56, 0.3); font-size: 13px; }
.offline-row-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.offline-row-body { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; font-size: 12px; color: var(--muted); }
.offline-row.restaurant { border-color: rgba(92, 184, 92, 0.5); background: rgba(92, 184, 92, 0.07); }
.offline-row.restaurant .mono { margin-left: auto; }
.offline-footer { margin-top: 12px; text-align: right; }
</style>
