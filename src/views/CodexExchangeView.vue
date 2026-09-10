<script setup>
// 图鉴兑换所（2026-09-10 新增）— 给「图鉴收集」补一个兑现出口：
// 按完成度档位一次性发「图鉴点数」，兑换限定称号 / 头像框 / 限量收藏道具。
// 纯读取层：只读 player.collected，不改任何物品数据。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { CODEX_TIERS, CODEX_TIER_TOTAL, CODEX_REWARDS, getCodexReward } from '../game/data/codexShop.js'
import { collectionTotal } from '../game/data/achievements.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const pts = computed(() => player.codexPoints())
const owned = computed(() => new Set(player.codexOwnedIds()))

const totalItems = collectionTotal()
const gotItems = computed(() => Object.keys(player.collected ?? {}).length)
const unclaimedTiers = computed(() => CODEX_TIERS.filter((t) => pts.value.pct >= t.pct).length)

function row(r) {
  const isOwned = owned.value.has(r.id)
  return {
    def: r,
    owned: isOwned,
    afford: pts.value.points >= r.cost,
    detail: r.items
      ? Object.entries(r.items).map(([id, q]) => `${getItem(id)?.name ?? id} ×${q}`).join('、')
      : r.tastePoints ? `品鉴点 ×${r.tastePoints}` : r.desc,
  }
}
const rows = computed(() => CODEX_REWARDS.map(row))

function redeem(r) {
  const res = player.codexRedeem(r.id)
  if (!res.ok) { ui.pushLog(res.msg, 'warn'); return }
  ui.pushLog(`📖 图鉴兑换：${r.name}（-${r.cost} 图鉴点数）`, 'levelup')
}
function gotoCodex() {
  ui.openLogTab('log')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'honor', label: '🎖 荣誉殿堂' }, { view: 'log', label: '📖 图鉴' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📖 图鉴兑换所</h2>
        <p class="dim">
          图鉴每收集一件物品都记在册，但过去只给完成度；现在按<b>完成度档位</b>另发「图鉴点数」，
          可在本页兑换<b>限定称号</b>、<b>专属头像框</b>与限量收藏道具。共 {{ CODEX_TIERS.length }} 档，满档累计
          <b class="mono">{{ CODEX_TIER_TOTAL }}</b> 点。点数只按档位发一次，与「美食见闻」互不影响。
        </p>
      </div>
    </header>

    <div class="card cx-hero">
      <div class="cx-hero-left">
        <div class="cx-pts">
          <span class="cx-pts-num">{{ pts.points }}</span>
          <span class="dim">点可用</span>
        </div>
        <div class="dim cx-sub">已发放 {{ pts.total }} · 已花费 {{ pts.spent }}</div>
      </div>
      <div class="cx-hero-right">
        <div class="rev-bar-label">
          <span class="dim">图鉴完成度 <b class="mono">{{ pts.pct }}%</b>（{{ gotItems }} / {{ totalItems }} 件）</span>
          <span class="mono">{{ pts.next ? `下一档 ${pts.next.pct}% → +${pts.next.points} 点` : '已满档' }}</span>
        </div>
        <ProgressBar :progress="pts.pct / 100" />
        <div class="dim cx-sub">已达标档位 {{ unclaimedTiers }} / {{ CODEX_TIERS.length }}</div>
      </div>
    </div>

    <div class="cx-grid">
      <div v-for="r in rows" :key="r.def.id" class="card cx-card" :class="{ owned: r.owned }">
        <div class="cx-head">
          <span class="cx-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim cx-sub">{{ r.def.desc }}</div>
          </div>
          <span v-if="r.owned" class="badge badge-on">已兑换</span>
        </div>

        <div class="cx-row">
          <span class="dim">内容</span>
          <span>{{ r.detail }}</span>
        </div>
        <div class="cx-row">
          <span class="dim">花费</span>
          <span class="mono cx-cost" :class="{ afford: r.afford }">{{ r.def.cost }} 图鉴点数</span>
        </div>

        <template v-if="r.owned">
          <div class="dim cx-sub">✅ 已在本档拿到手</div>
        </template>
        <template v-else>
          <button class="btn btn-sm btn-primary" :disabled="!r.afford" @click="redeem(r.def)">
            {{ r.afford ? '兑换' : `还差 ${r.def.cost - pts.points} 点` }}
          </button>
          <div v-if="!r.afford" class="dim cx-sub">继续收集图鉴提升完成度即可获得更多点数</div>
        </template>
      </div>
    </div>

    <div class="card cx-tiers">
      <div class="cx-tiers-h">🎯 点数档位表</div>
      <div class="cx-tier-list">
        <span
          v-for="t in CODEX_TIERS"
          :key="t.pct"
          class="cx-tier"
          :class="{ hit: pts.pct >= t.pct }"
        >{{ t.pct }}% <b class="mono">+{{ t.points }}</b></span>
      </div>
      <p class="dim cx-sub" style="margin-top: 8px">
        点数在达标时自动计入（无需手动领取）；完成度不会下降，所以已得点数永久有效。
      </p>
    </div>

    <div class="card status-line">
      <span class="dim">想核对还缺哪些物品？去</span>
      <button class="btn btn-sm" @click="gotoCodex">📖 打开图鉴</button>
      <span class="dim">；称号被动效果见</span>
      <button class="btn btn-sm" @click="ui.setView('honor')">🎖 荣誉殿堂</button>
      <span class="dim">。</span>
    </div>
      <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.cx-hero {
  margin-top: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.cx-hero-left {
  min-width: 130px;
  text-align: center;
}
.cx-pts {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}
.cx-pts-num {
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
  color: var(--accent, #d95a38);
}
.cx-hero-right {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rev-bar-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.cx-sub {
  font-size: 12px;
  line-height: 1.5;
}
.cx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.cx-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cx-card.owned {
  opacity: 0.9;
}
.cx-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cx-icon {
  font-size: 22px;
}
.cx-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.cx-cost {
  color: var(--bad, #d94b3f);
}
.cx-cost.afford {
  color: var(--good, #57a861);
}
.cx-tiers {
  margin-top: 12px;
}
.cx-tiers-h {
  font-weight: 600;
  margin-bottom: 8px;
}
.cx-tier-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cx-tier {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  opacity: 0.6;
}
.cx-tier.hit {
  opacity: 1;
  border-style: solid;
  border-color: var(--accent, #d95a38);
  color: var(--accent, #d95a38);
}
</style>
