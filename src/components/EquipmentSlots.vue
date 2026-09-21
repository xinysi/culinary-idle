<script setup>
// 装备槽概览（2026-09-19 从 CombatLoadout 拆出；2026-09-21 随布局调整回到左栏：
// 用户要求「装备」与「战斗日志」互换位置 —— 日志去右栏，装备与战备同屏、**八个槽位排成一排**）。
// 槽位与顺序直接取 `player.equipment`（= `EQUIPMENT_SLOTS`，恒 8 个），**不另抄一份槽位清单**。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { SLOT_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const equipped = computed(() => {
  const eq = player.equipment ?? {}
  return Object.keys(eq).map((slot) => {
    const id = eq[slot]
    return { slot, label: SLOT_LABEL[slot] ?? slot, id, name: id ? (getItem(id)?.name ?? id) : '—', img: id ? itemImage(id) : null }
  })
})
const equippedCount = computed(() => equipped.value.filter((e) => e.id).length)

function openEquip() {
  ui.setView('equipment')
}
</script>

<template>
  <div class="card equipment-slots">
    <h3>
      装备
      <span class="dim" style="font-size: 12px">{{ equippedCount }} / {{ equipped.length }}</span>
      <button class="btn btn-sm" style="margin-left: 8px" @click="openEquip()">更换 ↗</button>
    </h3>
    <div class="eq-slots">
      <div v-for="e in equipped" :key="e.slot" class="eq-slot" :class="{ empty: !e.id }" :title="`${e.label}：${e.name}`" @click="openEquip()">
        <img v-if="e.img" class="eq-icon" :src="e.img" alt="" @error="$event.target.style.display = 'none'" />
        <span v-else class="eq-icon eq-icon--empty">空</span>
        <span class="eq-slot-label">{{ e.label }}</span>
        <span class="eq-slot-name">{{ e.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 🔒 一排 8 格（2026-09-21 用户要求「一排刚好显示八个装备位」）：
   `player.equipment` 恒有 8 个槽位（EQUIPMENT_SLOTS），所以列数写死 8 —— 用 auto-fill
   会在窄一点的容器里悄悄折成 2 行（旧写法 minmax(88px,1fr) 在左栏 ~660px 下正好是 7 列，第 8 格掉到第二行）。
   `minmax(0,1fr)` 允许压缩，不给 min-width 就不会横向溢出。 */
.eq-slots {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
}
.eq-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border: 1px dashed rgba(var(--ink-rgb), 0.2);
  border-radius: 8px;
  cursor: pointer;
  min-width: 0;
}
.eq-slot.empty {
  opacity: 0.6;
}
.eq-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.eq-icon--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted);
}
.eq-slot-label {
  font-size: 12px;
  color: var(--muted);
}
.eq-slot-name {
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 窄屏：8 格挤在一行会把名字压成「每个字一行」→ 4 + 4 两排（布局守卫的竖排判据） */
@media (max-width: 720px) {
  .eq-slots {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
