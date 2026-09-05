<script setup>
// 全局搜索弹窗：按名称搜索 物品 / 对手 / 首领，物品可查看详情
import { ref, computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { ITEMS, getItem } from '../game/data/items.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { COMBAT_REGIONS, COMBAT_BOSSES } from '../game/data/combat.js'
import ItemDetailModal from './ItemDetailModal.vue'

const ui = useUiStore()
const q = ref('')
const detailItem = ref(null)

const itemHits = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return []
  return Object.entries(ITEMS)
    .filter(([, it]) => it?.name?.toLowerCase().includes(s))
    .slice(0, 20)
})
const oppHits = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return []
  const all = [...COMBAT_REGIONS.flatMap((r) => r.opponents), ...COMBAT_BOSSES]
  return all.filter((o) => o.name.toLowerCase().includes(s)).slice(0, 10)
})
</script>

<template>
  <div class="modal-backdrop" @click.self="ui.toggleSearch(false)">
    <div class="modal search-modal">
      <header class="modal-head">
        <h3>🔍 搜索</h3>
        <button class="btn btn-sm" @click="ui.toggleSearch(false)">✕</button>
      </header>
      <div class="item-detail-body">
        <input
          v-model="q"
          class="plot-select"
          style="width: 100%; margin-bottom: 8px"
          placeholder="输入物品 / 对手 / 首领名称…"
          autofocus
        />
        <template v-if="q.trim()">
          <div v-if="itemHits.length">
            <div class="dim" style="margin: 6px 0 4px">物品（{{ itemHits.length }}）</div>
            <div v-for="[id, it] in itemHits" :key="'i' + id" class="search-row" @click="detailItem = id">
              <span>{{ it.name }}</span>
              <span class="dim" style="font-size: 12px">T{{ it.tier }} · {{ CATEGORY_LABEL[it.category] ?? it.category }}</span>
            </div>
          </div>
          <div v-if="oppHits.length">
            <div class="dim" style="margin: 6px 0 4px">对手 / 首领（{{ oppHits.length }}）</div>
            <div v-for="o in oppHits" :key="'o' + o.name" class="search-row">
              <span>{{ o.isBoss ? '👑' : '' }} {{ o.name }}</span>
              <span class="dim" style="font-size: 12px">等级 {{ o.level }} · {{ o.styleName }}</span>
            </div>
          </div>
          <p v-if="!itemHits.length && !oppHits.length" class="dim">没有匹配结果</p>
        </template>
        <p v-else class="dim">输入名称开始搜索</p>
      </div>
    </div>
    <ItemDetailModal v-if="detailItem" :item-id="detailItem" @close="detailItem = null" />
  </div>
</template>
