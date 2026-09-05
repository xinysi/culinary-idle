<script setup>
// 物品图片/文字占位：有图片显示图片，无图片显示物品名首字（用于新增未配图的物品）
import { computed } from 'vue'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const props = defineProps({
  itemId: { type: String, required: true },
  size: { type: String, default: '' }, // '' | sm | lg
})
const it = computed(() => getItem(props.itemId))
const src = computed(() => itemImage(props.itemId))
const char = computed(() => (it.value?.name ?? '?').slice(0, 1).toUpperCase())
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :class="['item-img', size ? 'item-img-' + size : '']"
    alt=""
    @error="$event.target.style.display = 'none'"
  />
  <span v-else :class="['item-img', 'item-img-placeholder', size ? 'item-img-' + size : '']">{{ char }}</span>
</template>
