<script setup>
// 掉落列表（2026-09-19）：原先是「点敌人卡片 → 弹窗看掉落」，现改为页内**常驻**。
// 对决页与竞技场共用这一份（此前同款弹窗在两个视图里各抄了一遍）。
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'
// 掉落概率的缩放放在**本组件内**：调用方只传原始 drops，避免「忘了包 scaleDrops」导致显示 30% 实际 6%
import { dropChance } from '../game/data/difficulty.js'

defineProps({
  name: { type: String, default: '' },
  drops: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="drop-list">
    <p v-if="!drops.length" class="dim drop-empty">点选对手后，这里常驻显示它的掉落与概率。</p>
    <template v-else>
      <p class="dim drop-head">{{ name }} · {{ drops.length }} 项掉落</p>
      <div v-for="(d, di) in drops" :key="di" class="drop-line">
        <img
          v-if="itemImage(d.itemId)"
          class="drop-icon"
          :src="itemImage(d.itemId)"
          alt=""
          @error="$event.target.style.display = 'none'"
        />
        <span class="drop-name">{{ getItem(d.itemId)?.name ?? d.itemId }}</span>
        <span v-if="d.qty > 1" class="dim mono drop-qty">×{{ d.qty }}</span>
        <span class="dim mono drop-pct">{{ (dropChance(d.chance) * 100).toFixed(1) }}%</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.drop-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.drop-empty {
  margin: 0;
  font-size: 13px;
}
.drop-head {
  margin: 0 0 2px;
  font-size: 13px;
}
.drop-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  border-bottom: 1px dashed rgba(var(--ink-rgb), 0.12);
  font-size: 13px;
}
.drop-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  object-fit: contain;
}
.drop-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drop-qty,
.drop-pct {
  flex: 0 0 auto;
}
.drop-pct {
  min-width: 46px;
  text-align: right;
}
</style>
