<script setup>
// 副业作品面板（v2.10.0）——挂在**副业技能页**（ProductionView）下方：
// 做完一件陶器/织物/绣品/蜡烛，就在同一页把它「做成作品」，换取一条经营侧永久加成。
// 与木工的区别：木工的产物是**手工装潢**（在餐厅装潢页操作），本组件只服务陶艺/编织/刺绣/蜡烛。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SIDELINE_AXES, SIDELINE_SKILL_LIST } from '../game/data/sidelineWorks.js'
import { getSkillDef } from '../game/data/skills.js'
import { getItem } from '../game/data/items.js'
import ItemImg from './ItemImg.vue'

const props = defineProps({
  instance: { type: Object, required: true },
})

const player = usePlayerStore()
const ui = useUiStore()

/** 本技能对应的副业定义（木工等非本表技能返回 null → 不渲染） */
const def = computed(() => SIDELINE_SKILL_LIST.find((s) => s.id === props.instance.id) ?? null)
const axis = computed(() => (def.value ? SIDELINE_AXES[def.value.axis] : null))

const rows = computed(() => {
  if (!def.value) return []
  const owned = new Set(player.sidelineWorks ?? [])
  return (props.instance.recipes ?? []).map((r) => {
    const itemId = r.output.itemId
    const it = getItem(itemId)
    return {
      itemId,
      name: it?.name ?? r.name,
      level: r.reqLevel,
      amount: axis.value.perItem,
      owned: owned.has(itemId),
      have: player.inventory[itemId] ?? 0,
    }
  }).sort((a, b) => a.level - b.level)
})

const ownedCount = computed(() => rows.value.filter((r) => r.owned).length)
const total = computed(() => player.sidelineEffectTotal(def.value.axis))

function craft(row) {
  const res = player.craftWork(row.itemId)
  if (res === 'denied') ui.pushLog(`背包里没有「${row.name}」——先去上面做一件`, 'warn')
  else if (res === 'bad') ui.pushLog('这个产物不是副业作品', 'warn')
  else if (res === 'owned') ui.pushLog(`「${row.name}」已经做成过了`, 'warn')
}
</script>

<template>
  <div v-if="def" class="card sw-card">
    <div class="sw-head">
      <span class="sw-h">{{ def.icon }} {{ def.name }}作品</span>
      <span class="dim">做成后给 <b>{{ axis.label }}</b> 永久加成（每件 {{ axis.amountLabel(axis.perItem) }}）</span>
    </div>
    <p class="dim sw-note">
      {{ def.materialNote }} · 已完成 <b>{{ ownedCount }}/{{ rows.length }}</b> 件，
      当前合计 <b>{{ axis.amountLabel(total) }}</b>（满级 {{ axis.amountLabel(axis.perItem * rows.length) }}）。
    </p>
    <div class="sw-grid">
      <div
        v-for="r in rows"
        :key="r.itemId"
        class="sw-item"
        :class="{ 'sw-done': r.owned, 'sw-can': !r.owned && r.have > 0 }"
      >
        <ItemImg :item-id="r.itemId" />
        <div class="sw-body">
          <div class="sw-name">{{ r.name }} <span class="dim mono">Lv{{ r.level }}</span></div>
          <div class="dim sw-eff">{{ axis.label }} {{ axis.amountLabel(r.amount) }}</div>
          <button
            v-if="!r.owned"
            class="btn btn-sm"
            :class="r.have > 0 ? 'btn-primary' : ''"
            @click="craft(r)"
          >
            {{ r.have > 0 ? '做成作品' : '背包没有' }}
          </button>
          <span v-else class="badge badge-on">已完成</span>
        </div>
      </div>
    </div>
    <p class="dim sw-foot">
      产物是<b>副业独占品</b>：采集拿不到，商店、抽卡、交易所、商队都不出，也不会被自动出售。
      <b>多做出来的不会浪费</b>——它的价值等于配方材料合计，去杂货铺「出售」页半价卖掉，等于把那份材料整包卖回。
    </p>
  </div>
</template>

<style scoped>
.sw-card {
  margin-top: 12px;
  padding: 12px 16px;
}
.sw-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.sw-h {
  font-weight: 600;
  font-size: 15px;
}
.sw-note {
  margin: 6px 0 10px;
  font-size: 12px;
}
.sw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 8px;
}
.sw-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
}
.sw-item.sw-can {
  border-style: solid;
  border-color: rgba(var(--primary-tint-rgb), 0.45);
}
.sw-item.sw-done {
  opacity: 0.75;
}
.sw-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.sw-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sw-eff {
  font-size: 11px;
}
.sw-foot {
  margin: 10px 0 0;
  font-size: 11px;
}
</style>
