<script setup>
// 餐厅米其林评级（2026-09-10 新增）— 把餐厅六个子系统汇成一个总评分，每日评审、可升可掉星。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MICHELIN_UNLOCK_LEVEL, MICHELIN_STARS, starFromScore, nextStar } from '../game/data/michelin.js'

const player = usePlayerStore()
const ui = useUiStore()

const unlocked = computed(() => player.michelinUnlocked())
const review = computed(() => player.michelinScore())
const state = computed(() => player.michelin ?? { score: 0, stars: 0, best: 0 })
const current = computed(() => starFromScore(review.value.score))
const next = computed(() => nextStar(current.value.star))
const progress = computed(() => {
  if (!next.value) return 1
  const lo = current.value.min
  const hi = next.value.min
  return Math.min(1, Math.max(0, (review.value.score - lo) / Math.max(1, hi - lo)))
})

const stars = computed(() => MICHELIN_STARS.map((s) => ({
  ...s,
  reached: current.value.star >= s.star,
  active: current.value.star === s.star,
})))

function fmt(n) {
  return Math.round(n).toLocaleString()
}
function refresh() {
  const { score } = player.michelinScore()
  player.michelin.score = score
  player.michelin.stars = starFromScore(score).star
  player.michelin.lastReviewDay = player.todayKey
  ui.pushLog(`⭐ 米其林评审：${fmt(score)} 分 → ${starFromScore(score).name}`, 'info')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>⭐ 米其林评级</h2>
        <p class="dim">
          评审综合菜单成色 / 店面装潢 / 出餐口碑 / 评论家好评 / 常客好感 / 连锁规模六项；
          <b>每个自然日自动评审一次</b>，分数达标升星、滑落掉星。
        </p>
      </div>
      <button v-if="unlocked" class="btn btn-sm" @click="refresh">🔄 立即评审</button>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需餐厅 Lv{{ MICHELIN_UNLOCK_LEVEL }} 解锁评级</span>
    </div>

    <template v-else>
      <div class="card michelin-hero">
        <div class="michelin-left">
          <div class="michelin-stars">
            <span v-for="n in 3" :key="n" :class="{ on: current.star >= n }">★</span>
          </div>
          <div class="michelin-name">{{ current.name }}<span class="dim"> · 当前 {{ fmt(review.score) }} 分</span></div>
          <div class="dim michelin-hint">
            <template v-if="next">距离「{{ next.name }}」还需 <b class="mono">{{ fmt(next.min - review.score) }}</b> 分（{{ next.desc }}）</template>
            <template v-else>已是最高星级：{{ current.desc }}</template>
          </div>
          <div class="dim michelin-hint">历史最高 {{ state.best }} 星 · 上次评审 {{ state.lastReviewDay ?? '尚未' }}</div>
        </div>
        <div class="michelin-right">
          <div class="dim">本期评级收益</div>
          <div class="mono michelin-bonus">餐厅收入 +{{ current.incomePct }}%</div>
          <div class="mono michelin-bonus">全技能经验 +{{ current.xpPct }}%</div>
        </div>
      </div>

      <div class="michelin-bar">
        <div class="michelin-bar-fill" :style="{ width: (progress * 100) + '%' }"></div>
      </div>

      <h3 style="margin-top: 14px">评分构成</h3>
      <div class="card">
        <table class="target-table">
          <tbody>
            <tr v-for="p in review.parts" :key="p.id">
              <td class="dim" style="width: 120px">{{ p.label }}</td>
              <td class="dim" style="width: 220px">{{ p.hint }}</td>
              <td class="mono" style="width: 90px">{{ fmt(p.raw) }}</td>
              <td class="mono" style="width: 60px">×{{ p.weight }}</td>
              <td class="mono"><b>{{ fmt(p.points) }}</b> 分</td>
            </tr>
            <tr>
              <td colspan="4" class="dim">合计</td>
              <td class="mono"><b>{{ fmt(review.score) }}</b> 分</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style="margin-top: 14px">星级与收益</h3>
      <div class="michelin-tiers">
        <div v-for="s in stars" :key="s.star" class="card michelin-tier" :class="{ on: s.active, reached: s.reached }">
          <div class="michelin-tier-head">{{ s.name }}<span class="dim mono"> ≥{{ s.min }} 分</span></div>
          <div class="dim michelin-hint">{{ s.desc }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.michelin-hero {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 14px 16px;
  flex-wrap: wrap;
}
.michelin-left {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.michelin-stars {
  font-size: 30px;
  letter-spacing: 6px;
  color: var(--border);
}
.michelin-stars .on {
  color: var(--warn-strong);
  text-shadow: 0 0 10px rgba(217, 90, 56, 0.35);
}
.michelin-name {
  font-size: 18px;
  font-weight: 700;
}
.michelin-hint {
  font-size: 12px;
  line-height: 1.7;
}
.michelin-right {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.michelin-bonus {
  font-size: 15px;
  font-weight: 700;
}
.michelin-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--bg-soft);
  overflow: hidden;
  margin-top: 10px;
}
.michelin-bar-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  transition: width 0.3s;
}
.michelin-tiers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.michelin-tier {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0.7;
}
.michelin-tier.reached {
  opacity: 1;
}
.michelin-tier.on {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.michelin-tier-head {
  font-size: 14px;
  font-weight: 700;
}
</style>
