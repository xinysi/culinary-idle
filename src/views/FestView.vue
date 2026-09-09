<script setup>
// 月度厨艺大赛 — 与赛季错峰的月度主题比赛（2026-09-06）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { getItem, ITEMS } from '../game/data/items.js'
import { festScore, festAccepts, FEST_MILESTONES, FEST_DAILY_ENTRIES } from '../game/data/cookingFest.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()

const theme = computed(() => player.festTheme())
const state = computed(() => player.festState())

// 背包中可参赛料理（type=food 且符合当月主题），按得分预估排序
const candidates = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, qty]) => qty > 0 && getItem(id)?.type === 'food' && festAccepts(theme.value, getItem(id)))
    .map(([id, qty]) => ({ id, qty, item: getItem(id), score: festScore(getItem(id)) }))
    .sort((a, b) => b.score - a.score)
)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏆 月度厨艺大赛</h2>
        <p class="dim">每月一个主题 · 每日 {{ FEST_DAILY_ENTRIES }} 次参赛机会（消耗 1 件料理）· 月分里程碑领奖</p>
      </div>
      <div class="skill-head-right">
        <div class="fest-score">
          <span class="dim">本月总分</span>
          <strong class="mono">{{ state.score }}</strong>
        </div>
      </div>
    </header>

    <div class="card">
      <h3>🎪 本月主题：{{ theme.name }}</h3>
      <p class="dim">{{ theme.desc }}</p>
      <div class="fest-meta">
        <span class="dim">今日已参赛 {{ state.todayEntries }}/{{ FEST_DAILY_ENTRIES }}</span>
        <span class="dim">已提交 {{ state.entries.length }} 次</span>
      </div>
    </div>

    <div class="card">
      <h3>📅 月度里程碑</h3>
      <div class="fest-milestones">
        <div v-for="(m, i) in FEST_MILESTONES" :key="i" class="fest-ms" :class="{ got: state.rewarded.includes(i) }">
          <strong class="mono">{{ m.score }} 分</strong>
          <span class="dim">+{{ m.gold }} 金 · 神秘调料 ×{{ m.items?.mysterySpice ?? 0 }}<template v-if="m.items?.energyBiscuit"> · 能量饼干 ×1</template></span>
          <span v-if="state.rewarded.includes(i)" class="badge badge-on">已领</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>🥗 可参赛料理（符合主题，点击提交）</h3>
      <p v-if="!candidates.length" class="dim">背包中没有符合本月主题的料理——去烹饪或制作一些吧！</p>
      <div class="fest-grid">
        <div v-for="c in candidates" :key="c.id" class="fest-item" :class="{ none: player.inventory[c.id] <= 0 }">
          <img v-if="itemImage(c.id)" :src="itemImage(c.id)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
          <span class="fest-name">{{ c.item.name }}</span>
          <span class="dim mono">×{{ c.qty }}</span>
          <span class="dim mono">预估 {{ c.score }} 分</span>
          <button class="btn btn-sm btn-primary" :disabled="state.todayEntries >= FEST_DAILY_ENTRIES || player.inventory[c.id] <= 0" @click="player.festSubmit(c.id)">
            参赛
          </button>
        </div>
      </div>
      <p v-if="state.entries.length" class="dim fest-history">最近得分：{{ state.entries.slice(-5).reverse().map((e) => `${getItem(e.itemId)?.name ?? ''} +${e.score}`).filter(Boolean).join('、') }}</p>
    </div>
  </div>
</template>

<style scoped>
.fest-score { display: flex; flex-direction: column; align-items: flex-end; }
.fest-score .mono { font-size: 24px; color: var(--primary); }
.fest-meta { display: flex; gap: 16px; margin-top: 6px; }
.fest-milestones { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.fest-ms { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.6); border: 1px dashed rgba(217, 90, 56, 0.25); font-size: 13px; }
.fest-ms.got { border-color: var(--good); background: rgba(92, 184, 92, 0.08); }
.fest-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; margin-top: 8px; }
.fest-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(217, 90, 56, 0.18); font-size: 12px; }
.fest-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fest-history { margin-top: 8px; font-size: 12px; }
</style>
