<script setup>
// 厨具大赛（2026-09-10 新增）— 每周一届，用全身装备评分参赛取名次。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { GEAR_CONTEST_UNLOCK_LEVEL, GEAR_RANKS, GEAR_SCORE_WEIGHTS, rankFromScore, contestWeek, themeOfWeek } from '../game/data/gearContest.js'
import { getItem } from '../game/data/items.js'
import { SLOT_LABEL } from '../game/data/itemDetail.js'

const player = usePlayerStore()
const ui = useUiStore()

const unlocked = computed(() => player.gearContestUnlocked())
const live = computed(() => player.gearScore())
const st = computed(() => player.gearContest ?? {})
const done = computed(() => player.gearContestDoneThisWeek())
const liveRank = computed(() => rankFromScore(live.value.score))
const week = computed(() => contestWeek())
const theme = computed(() => themeOfWeek(week.value))
const nextWeek = computed(() => 7 * 24 * 3600_000 - (Date.now() % (7 * 24 * 3600_000)))

function fmt(n) {
  return Math.round(n).toLocaleString()
}
function fmtMs(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return d > 0 ? `${d} 天 ${h} 小时` : `${h} 小时`
}
function run() {
  const r = player.gearContestRun()
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🃏 厨具大赛</h2>
        <p class="dim">
          每周一届，用<b>当前全身装备</b>的厨具评分参赛（价值 + 属性 + 词条 + 宝石 + 强化）取名次档位；
          每周只能参赛一次，评分越高档位越好。
        </p>
      </div>
      <span v-if="unlocked" class="dim mono">距换届 {{ fmtMs(nextWeek) }}</span>
    </header>

    <div v-if="!unlocked" class="card status-line">
      <span class="badge">🔒 未解锁</span>
      <span class="dim">需对决 Lv{{ GEAR_CONTEST_UNLOCK_LEVEL }} 解锁厨具大赛</span>
    </div>

    <template v-else>
      <div class="card status-line">
        <span class="badge badge-on">第 {{ week }} 届 · {{ theme }}</span>
        <span class="dim">当前评分 <b class="mono">{{ fmt(live.score) }}</b> → 预计档位 <b>{{ liveRank.name }}</b></span>
        <span v-if="st.best" class="dim">历史最高 {{ fmt(st.best) }} 分 · 已参赛 {{ st.runs ?? 0 }} 届</span>
      </div>

      <div class="contest-actions">
        <button class="btn btn-primary" :disabled="done" @click="run">
          {{ done ? '本届已参赛' : `提交作品参赛（预计 ${liveRank.name}）` }}
        </button>
        <span v-if="done" class="dim">本届成绩：{{ fmt(st.score) }} 分 · {{ GEAR_RANKS.find((r) => r.id === st.rank)?.name ?? st.rank }}</span>
      </div>

      <h3 style="margin-top: 14px">本期评分构成</h3>
      <div class="card">
        <table class="target-table">
          <tbody>
            <tr v-for="p in live.parts" :key="p.slot">
              <td class="dim" style="width: 80px">{{ SLOT_LABEL[p.slot] ?? p.slot }}</td>
              <td>{{ p.name }}</td>
              <td class="mono" style="width: 90px"><b>{{ fmt(p.points) }}</b> 分</td>
            </tr>
            <tr v-if="!live.parts.length">
              <td colspan="3" class="dim">尚未穿戴任何装备——先去锻造并穿上装备再来参赛。</td>
            </tr>
            <tr>
              <td colspan="2" class="dim">合计（权重：价值 ×{{ GEAR_SCORE_WEIGHTS.value }} / 属性 ×{{ GEAR_SCORE_WEIGHTS.stats }} / 词条 ×{{ GEAR_SCORE_WEIGHTS.mods }} / 宝石 ×{{ GEAR_SCORE_WEIGHTS.gems }} / 强化 ×{{ GEAR_SCORE_WEIGHTS.upgrade }}）</td>
              <td class="mono"><b>{{ fmt(live.score) }}</b> 分</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style="margin-top: 14px">名次档位与奖励</h3>
      <div class="contest-ranks">
        <div v-for="r in GEAR_RANKS" :key="r.id" class="card contest-rank" :class="{ on: liveRank.id === r.id }">
          <div class="contest-rank-head"><b>{{ r.id }}</b> {{ r.name }}<span class="dim mono"> ≥{{ fmt(r.min) }}</span></div>
          <div class="dim contest-sub">
            {{ (r.gold ?? 0).toLocaleString() }} 金币<template v-for="(q, id) in r.items ?? {}" :key="id"> + {{ getItem(id)?.name ?? id }} ×{{ q }}</template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.contest-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.contest-ranks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.contest-rank {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.contest-rank.on {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.contest-rank-head {
  font-size: 13px;
}
.contest-sub {
  font-size: 12px;
  line-height: 1.6;
}
</style>
