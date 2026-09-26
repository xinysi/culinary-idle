<script setup>
// 通用数量选择弹窗：滑块 + 步进/快捷档 + 输入框 + 总价预览，确认后回调数量。
// 2026-09-25 重排：此前是裸浏览器控件（默认蓝滑块/白底数字框），与全站主题脱节（用户报「样式没有适配」）
//   ⇒ 全部改走项目 token（--primary/--border/--panel-rgb），深浅色自动跟随；并加 −10/+10/+100/最大 快捷档。
import { ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, default: '选择数量' },
  show: { type: Boolean, default: false },
  max: { type: Number, default: 1 },
  priceEach: { type: Number, default: 0 }, // 0 = 无价格显示
  unit: { type: String, default: '个' },
})
const emit = defineEmits(['confirm', 'close'])
const qty = ref(1)

watch(
  () => props.show,
  (v) => {
    if (v) qty.value = Math.max(1, Math.min(props.max, 1))
  },
)
function setQty(v) {
  const n = Math.max(1, Math.min(props.max, Math.floor(Number(v) || 1)))
  qty.value = Number.isFinite(n) ? n : 1
}
function confirm() {
  const n = Math.max(1, Math.min(props.max, Math.floor(qty.value) || 1))
  emit('confirm', n)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal qty-modal">
      <header class="modal-head">
        <h3>{{ title }}</h3>
        <button class="btn btn-sm" @click="emit('close')">✕</button>
      </header>
      <div class="qty-body">
        <div class="qty-slider-row">
          <input type="range" min="1" :max="Math.max(1, max)" step="1" v-model.number="qty" />
          <span class="mono qty-cap">/ {{ max.toLocaleString() }} {{ unit }}</span>
        </div>
        <div class="qty-input-row">
          <button class="btn btn-sm" :disabled="qty <= 1" @click="setQty(qty - 1)">−</button>
          <input
            type="number"
            :value="qty"
            @input="setQty($event.target.value)"
            min="1"
            :max="Math.max(1, max)"
            class="mono qty-input"
          />
          <button class="btn btn-sm" :disabled="qty >= max" @click="setQty(qty + 1)">＋</button>
        </div>
        <div class="qty-quick">
          <button class="btn btn-sm" :disabled="qty <= 1" @click="setQty(qty - 10)">−10</button>
          <button class="btn btn-sm" :disabled="qty >= max" @click="setQty(qty + 10)">+10</button>
          <button class="btn btn-sm" :disabled="qty >= max" @click="setQty(qty + 100)">+100</button>
          <button class="btn btn-sm" :disabled="qty >= max" @click="setQty(max)">最大</button>
        </div>
        <div v-if="priceEach > 0" class="mono qty-price">
          总价：<strong>{{ (qty * priceEach).toLocaleString() }}</strong> 金币
        </div>
        <div class="qty-actions">
          <button class="btn btn-sm" @click="emit('close')">取消</button>
          <button class="btn btn-sm btn-primary" @click="confirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qty-modal { width: min(400px, 94vw); }
.qty-body { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 16px; }
.qty-slider-row { display: flex; align-items: center; gap: 10px; }
.qty-slider-row input[type='range'] { flex: 1; min-width: 0; accent-color: var(--primary); }
.qty-cap { font-size: 12px; color: var(--muted); white-space: nowrap; }
.qty-input-row { display: flex; align-items: stretch; gap: 6px; }
.qty-input { flex: 1; min-width: 0; text-align: center; font-size: 15px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 9px; background: rgba(var(--panel-rgb), 0.9); color: inherit; }
.qty-quick { display: flex; gap: 6px; flex-wrap: wrap; }
.qty-price { font-size: 13px; }
.qty-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
</style>
