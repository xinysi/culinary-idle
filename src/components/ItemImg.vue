<script setup>
// 物品图片/文字占位：有图片显示图片，无图片显示物品名首字（用于新增未配图的物品）
// 种子专属图（2026-09-25）：seed/{中文名}.png 缺失时 @error 回落到通用 🌱 占位图
// _seed.png（而不是直接隐藏）—— 渐进配图期间其余未配图的种子保持有图标。
// 🔴 2026-09-26 加 `loading="lazy" decoding="async"`：全项目 60 个 <img> 里原先只有 3 个懒加载，
//    而**本组件是列表图的主力**（厨藏 2267 格、制作/温室/菌田/交易所/炼金各整列表）——不加懒加载时
//    一进页就把整列表几十~几百张图全发出去；加了之后浏览器只拉视口附近的（视口内的照常立刻加载）。
//    `decoding="async"` 让解码不阻塞主线程（2267 张 64×64 解码后的位图内存也不小）。
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

/** 图片加载失败：种子专属图回落到 _seed.png（只回落一次防循环）；其它类型维持「隐藏」原行为 */
function onImgError(e) {
  const el = e.target
  const cur = el.getAttribute('src') || ''
  if (cur.includes('items/seed/') && !cur.includes('_seed.png') && !el.dataset.fb) {
    el.dataset.fb = '1'
    el.src = 'images/items/seed/_seed.png'
    return
  }
  el.style.display = 'none'
}
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :class="['item-img', size ? 'item-img-' + size : '']"
    alt=""
    loading="lazy"
    decoding="async"
    @error="onImgError"
  />
  <span v-else :class="['item-img', 'item-img-placeholder', size ? 'item-img-' + size : '']">{{ char }}</span>
</template>
