<script setup>
// 随机奇遇弹窗 — 挂机途中的 3 选 1 小事件（2026-09-06）
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { getItem } from '../game/data/items.js'

const ui = useUiStore()
const player = usePlayerStore()

const enc = computed(() => ui.encounter?.encounter ?? null)

/** 该分支要付出的材料是否够（costItem 此前**没有任何消费方** → 带代价的分支等于白拿，2026-09-14 修） */
function affordable(choice) {
  const cost = choice.costItem ?? {}
  return Object.entries(cost).every(([id, qty]) => (player.inventory[id] ?? 0) >= qty)
}
function costText(choice) {
  const cost = choice.costItem ?? {}
  return Object.entries(cost).map(([id, qty]) => `${getItem(id)?.name ?? id}×${qty}（有 ${player.inventory[id] ?? 0}）`).join('、')
}

function pick(choice, index) {
  if (!enc.value) return
  if (!affordable(choice)) {
    ui.pushLog(`✨ 奇遇「${enc.value.title}」：材料不足，需要 ${costText(choice)}`, 'warn')
    return
  }
  player.recordEncounterPick(enc.value.id, index) // 奇遇图鉴：记录选了哪一支（2026-09-11）
  // 先付代价，再发奖励（代价不足时上面已拦）
  for (const [id, qty] of Object.entries(choice.costItem ?? {})) player.spendItem(id, qty)
  const e = choice.effect ?? {}
  if (e.gold) {
    const gold = Math.floor(e.gold * (1 + player.combatLevel * 0.2))
    player.gainGold(gold)
    ui.pushLog(`✨ 奇遇：「${enc.value.title}」获得 ${gold} 金币`, 'gain')
  }
  if (e.items) {
    for (const [id, qty] of Object.entries(e.items)) {
      player.gainItem(id, qty)
      ui.pushLog(`✨ 奇遇：「${enc.value.title}」获得 ${getItem(id)?.name ?? id} ×${qty}`, 'gain')
    }
  }
  ui.pushLog(`🥳 奇遇结局：${choice.label}`, 'info')
  ui.closeEncounter()
}
</script>

<template>
  <div v-if="enc" class="modal-backdrop" @click.self="ui.closeEncounter()">
    <div class="modal encounter-modal">
      <header class="modal-head">
        <h3>{{ enc.title }}</h3>
        <button class="btn btn-sm" @click="ui.closeEncounter()">✕</button>
      </header>
      <p class="dim encounter-body">{{ enc.body }}</p>
      <div class="encounter-choices">
        <button
          v-for="(c, i) in enc.choices"
          :key="i"
          class="btn encounter-choice"
          :class="{ 'is-locked': !affordable(c) }"
          :disabled="!affordable(c)"
          :title="c.costItem ? `需要 ${costText(c)}` : ''"
          @click="pick(c, i)"
        >{{ c.label }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.encounter-modal { max-width: 420px; }
.encounter-body { line-height: 1.7; white-space: pre-wrap; margin: 6px 0 12px; }
.encounter-choices { display: flex; flex-direction: column; gap: 8px; }
.encounter-choice { text-align: left; padding: 10px 14px; }
</style>
