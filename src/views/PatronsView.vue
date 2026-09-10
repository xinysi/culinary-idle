<script setup>
// 食神信仰（2026-09-10 新增）— 八位守护神：同时只信一位，供奉升级永久，切换需金币 + 24h 冷却。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { PATRONS, PATRON_MAX_LEVEL, PATRON_SWITCH_GOLD, patronCost, patronEffectAt } from '../game/data/patrons.js'
import { getItem } from '../game/data/items.js'

const player = usePlayerStore()
const ui = useUiStore()

const activeId = computed(() => player.patronActiveId())
const cdMs = computed(() => player.patronSwitchCdMs())
const fx = computed(() => player.patronEffects())

const rows = computed(() =>
  PATRONS.map((def) => {
    const level = player.patronLevel(def.id)
    const nextLevel = Math.min(PATRON_MAX_LEVEL, level + 1)
    const cost = patronCost(def, nextLevel)
    const isActive = activeId.value === def.id
    const fxNow = patronEffectAt(def, level)
    return {
      def,
      level,
      isActive,
      maxed: level >= PATRON_MAX_LEVEL,
      nextLevel,
      cost,
      canPay: player.gold >= cost.gold && Object.entries(cost.mats).every(([id, q]) => (player.inventory[id] ?? 0) >= q),
      matsText: Object.entries(cost.mats).map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、'),
      nowText: describeFx(fxNow),
    }
  })
)

function describeFx(f) {
  const parts = []
  if (f.healPct) parts.push(`料理回血 +${f.healPct}%`)
  if (f.cellarPct) parts.push(`地窖出窖 +${f.cellarPct}%`)
  if (f.yieldPct) parts.push(`采集产量 +${f.yieldPct}%`)
  if (f.incomePct) parts.push(`餐厅收入 +${f.incomePct}%`)
  if (f.xpPct) parts.push(`全技能经验 +${f.xpPct}%`)
  for (const [k, v] of Object.entries(f.xpSkills ?? {})) parts.push(`${k} 经验 +${v}%`)
  return parts.join(' · ') || '无加成'
}
function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分 ${s % 60} 秒`
}
function worship(r) {
  const res = player.patronWorship(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function pick(r) {
  const res = player.patronSwitch(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏛 食神信仰</h2>
        <p class="dim">
          八位守护神各 {{ PATRON_MAX_LEVEL }} 级：<b>同时只能信仰一位</b>，供奉升级永久保留；切换信仰需
          {{ PATRON_SWITCH_GOLD.toLocaleString() }} 金币 + 24 小时冷却。当前信仰加成：{{ describeFx(fx) }}。
        </p>
      </div>
      <span v-if="cdMs > 0" class="dim mono">切换冷却 {{ fmtMs(cdMs) }}</span>
    </header>

    <div class="card status-line">
      <span class="badge" :class="{ 'badge-on': !!activeId }">
        当前信仰：{{ activeId ? PATRONS.find((p) => p.id === activeId)?.icon + ' ' + PATRONS.find((p) => p.id === activeId)?.name : '无' }}
      </span>
      <span class="dim">切到未信仰的守护神不会重置已有的供奉等级</span>
    </div>

    <div class="patron-grid">
      <div v-for="r in rows" :key="r.def.id" class="card patron-card" :class="{ active: r.isActive, maxed: r.maxed }">
        <div class="patron-head">
          <span class="patron-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim patron-sub">{{ r.def.desc }}</div>
          </div>
          <span class="badge" :class="{ 'badge-on': r.isActive }" style="margin-left: auto">
            {{ r.isActive ? `信仰中 Lv${r.level}` : r.level > 0 ? `曾供奉 Lv${r.level}` : '未供奉' }}
          </span>
        </div>

        <div class="dim patron-sub">当前：{{ r.nowText }}</div>

        <div class="patron-actions">
          <button v-if="!r.isActive" class="btn btn-sm" :disabled="cdMs > 0 && !!activeId" @click="pick(r)">信仰（{{ PATRON_SWITCH_GOLD.toLocaleString() }} 金币）</button>
          <template v-else>
            <button v-if="!r.maxed" class="btn btn-sm" :class="r.canPay ? 'btn-primary' : ''" :disabled="!r.canPay" @click="worship(r)">
              供奉至 Lv{{ r.nextLevel }}（{{ r.matsText }} + {{ r.cost.gold.toLocaleString() }} 金币）
            </button>
            <span v-else class="dim patron-sub">✅ 已满级</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.patron-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.patron-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.patron-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.patron-card.maxed {
  background: var(--primary-soft);
}
.patron-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.patron-icon {
  font-size: 22px;
}
.patron-sub {
  font-size: 12px;
  line-height: 1.6;
}
.patron-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
