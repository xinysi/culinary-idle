<script setup>
// 通用数量选择弹窗：滑块 + 输入框 + 总价预览，确认后回调数量
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
        <input type="range" min="1" :max="Math.max(1, max)" step="1" v-model.number="qty" style="width: 100%" />
        <div style="display: flex; align-items: center; gap: 8px">
          <input
            type="number"
            :value="qty"
            @input="setQty($event.target.value)"
            min="1"
            :max="Math.max(1, max)"
            class="mono"
            style="width: 90px"
          />
          <span class="dim">/ {{ max }} {{ unit }}</span>
        </div>
        <div v-if="priceEach > 0" class="mono" style="margin-top: 4px">
          总价：<strong>{{ qty * priceEach }}</strong> 金币
        </div>
        <div style="margin-top: 12px; text-align: right">
          <button class="btn btn-sm" @click="emit('close')">取消</button>
          <button class="btn btn-sm btn-primary" @click="confirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>
