<script setup>
// 风味搭配册（2026-09-10 新增）— 收集食材组合：首次在一张配方里同时用到某组食材即点亮。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { FLAVOR_PAIRS } from '../game/data/flavorPairs.js'
import { getItem } from '../game/data/items.js'

const player = usePlayerStore()
const onlyUndiscovered = ref(false)

const rows = computed(() =>
  FLAVOR_PAIRS.map((p) => ({
    ...p,
    found: !!player.flavors?.[p.id],
    itemsText: p.items.map((id) => getItem(id)?.name ?? id).join(' + '),
  })).filter((r) => (onlyUndiscovered.value ? !r.found : true))
)
const prog = computed(() => player.flavorProgress())
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📔 风味搭配册</h2>
        <p class="dim">
          记录你发现的<b>食材组合</b>：只要在一张配方里同时用到该组合的全部食材（制作成功即算），就会点亮并给一次性奖励。
          共 {{ prog.total }} 条，已点亮 <b class="mono">{{ prog.found }}</b> 条。
        </p>
      </div>
      <button class="btn btn-sm" :class="{ 'btn-primary': onlyUndiscovered }" @click="onlyUndiscovered = !onlyUndiscovered">
        {{ onlyUndiscovered ? '✓ 只看未点亮' : '只看未点亮' }}
      </button>
    </header>

    <div class="flavor-grid">
      <div v-for="r in rows" :key="r.id" class="card flavor-card" :class="{ found: r.found }">
        <div class="flavor-head">
          <span class="flavor-icon">{{ r.found ? '📖' : '❔' }}</span>
          <div>
            <strong>{{ r.found ? r.name : '未点亮的搭配' }}</strong>
            <div class="dim flavor-sub">{{ r.itemsText }}</div>
          </div>
        </div>
        <p class="dim flavor-desc">{{ r.found ? r.desc : '在任意一张配方里同时用上以上食材即可点亮。' }}</p>
        <div v-if="r.found" class="dim flavor-sub">
          奖励已领取：{{ (r.reward.gold ?? 0).toLocaleString() }} 金币<template v-for="(q, id) in r.reward.items ?? {}" :key="id"> + {{ getItem(id)?.name ?? id }} ×{{ q }}</template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flavor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.flavor-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.75;
}
.flavor-card.found {
  opacity: 1;
  border-color: var(--primary);
}
.flavor-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.flavor-icon {
  font-size: 20px;
}
.flavor-sub {
  font-size: 12px;
  line-height: 1.6;
}
.flavor-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}
</style>
