<script setup>
// 美食知识视图 — 需求文档 §3.4.1：品鉴点数 + 奥义激活/关闭（卡片式，参考食灵召唤页）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { AOJIS } from '../game/data/aojis.js'
import { INSIGHT_NODES, INSIGHT_BRANCHES, getInsightNode } from '../game/data/insightTree.js'
import { BISCUIT_TASTE_RATE } from '../game/data/biscuitUse.js'

const player = usePlayerStore()
const ui = useUiStore()

// 分类 tab（全部/攻击/防御/采集）
const catFilter = ref('')
const CATS = [
  { id: '', name: '全部' },
  { id: '攻击', name: '攻击' },
  { id: '防御', name: '防御' },
  { id: '采集', name: '采集' },
]

function isOn(id) {
  return player.gastronomy.active.includes(id)
}
function toggle(id) {
  const on = player.toggleAoji(id)
  ui.pushLog(on ? `激活奥义：${AOJIS.find((a) => a.id === id)?.name}` : `关闭奥义：${AOJIS.find((a) => a.id === id)?.name}`, 'info')
}
function totalDrain() {
  return player.gastronomy.active.reduce((s, id) => s + (AOJIS.find((a) => a.id === id)?.costPerSec ?? 0), 0)
}
function filteredAojis() {
  return AOJIS.filter((a) => !catFilter.value || a.category === catFilter.value)
}
function catCount(c) {
  if (!c) return AOJIS.length
  return AOJIS.filter((a) => a.category === c).length
}

// ── 能量补给：常驻回收（2026-09-10）──
// 能量饼干的离线上限封顶 +12h（用满 3 块即饱和），多余的在此不限量换成品鉴点——
// 品鉴点是奥义的持续消耗燃料，本身就是不封顶系统，形成稳定出口。
const redeemCount = ref(null) // null = 全部
const biscuitPv = computed(() => player.biscuitExchangePreview(redeemCount.value))
function redeemBiscuits() {
  const r = player.exchangeBiscuitForTaste(redeemCount.value)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  redeemCount.value = null
  ui.pushLog(`🍪 回收能量饼干 ×${r.count} → 品鉴点 +${r.taste}`, 'gain')
}

// ── 菜系图谱（2026-09-09 永久天赋树）──
function nodesOf(branch) {
  return INSIGHT_NODES.filter((n) => n.branch === branch)
}
function isUnlocked(id) {
  return (player.insights ?? []).includes(id)
}
function nodeState(n) {
  if (isUnlocked(n.id)) return 'done'
  for (const r of n.requires) if (!isUnlocked(r)) return 'locked'
  return player.insightPoints() >= n.cost ? 'ready' : 'poor'
}
function unlockNode(id) {
  const r = player.unlockInsight(id)
  if (!r.ok) ui.pushLog(r.msg ?? '解锁失败', 'warn')
}
</script>

<template>
  <div>
    <div class="card status-line">
      <span class="badge badge-on">品鉴点数 <span class="mono">{{ Math.floor(player.tastePoints) }}</span></span>
      <span v-if="player.gastronomy.active.length" class="dim">奥义消耗 {{ totalDrain().toFixed(1) }} 点/秒（耗尽自动关闭）</span>
      <span v-else class="dim">品鉴点数通过对决胜利获得；激活奥义持续消耗（前 10 秒宽限免费）</span>
    </div>

    <div class="card">
      <h3>美食奥义（{{ AOJIS.length }} 种）</h3>
      <div class="region-tabs" style="flex-wrap: wrap">
        <button v-for="c in CATS" :key="c.id" class="btn btn-sm" :class="{ 'btn-primary': catFilter === c.id }" @click="catFilter = c.id">
          {{ c.name }}（{{ catCount(c.id) }}）
        </button>
      </div>
      <div class="spirit-card-grid">
        <div
          v-for="a in filteredAojis()"
          :key="a.id"
          v-tilt
          class="item-card"
          :class="{ active: isOn(a.id) }"
        >
          <div class="spirit-card-top">
            <div class="spirit-card-head">
              <div class="spirit-card-name-row">
                <span class="item-card-name">{{ a.name }}</span>
                <span class="badge badge-tier">{{ a.category }}</span>
              </div>
              <div class="mono dim">消耗 {{ a.costPerSec.toFixed(1) }} 点/秒</div>
            </div>
          </div>
          <div class="spirit-card-badges">
            <span v-if="isOn(a.id)" class="badge badge-on">激活中</span>
          </div>
          <div class="spirit-card-effect dim">
            <span class="ing">{{ a.desc }}</span>
          </div>
          <button class="btn btn-sm" :class="{ 'btn-primary': isOn(a.id) }" @click="toggle(a.id)">
            {{ isOn(a.id) ? '关闭' : '激活' }}
          </button>
        </div>
      </div>
    </div>
    <!-- 菜系图谱（2026-09-09 永久天赋树）：用「美食见闻」解锁永久加成 -->
    <div class="card">
      <div class="insight-head">
        <h3>🗺️ 菜系图谱</h3>
        <span class="badge badge-on">美食见闻 <span class="mono">{{ player.insightPoints() }}</span></span>
        <span class="dim">见闻来源：图鉴首次收集 +1 · 成就 +5 · 赛季领档 +3 · 首次击败首领 +2</span>
      </div>
      <div v-for="br in INSIGHT_BRANCHES" :key="br.id" class="insight-branch">
        <div class="insight-branch-title">{{ br.icon }} {{ br.name }}</div>
        <div class="insight-row">
          <button
            v-for="n in nodesOf(br.id)"
            :key="n.id"
            class="btn btn-sm insight-node"
            :class="{ 'btn-primary': nodeState(n) === 'done', 'insight-ready': nodeState(n) === 'ready', 'insight-locked': nodeState(n) === 'locked' }"
            :disabled="nodeState(n) !== 'ready'"
            :title="`${n.desc}（需 ${n.cost} 见闻）`"
            @click="unlockNode(n.id)"
          >
            {{ n.name }}<span class="dim"> · {{ n.cost }}</span>
          </button>
        </div>
      </div>
      <p class="dim" style="font-size: 12px; margin: 8px 0 0">
        已解锁 {{ (player.insights ?? []).length }}/{{ INSIGHT_NODES.length }} 个节点；加成永久生效（经验/产量/制作成功率/对决攻防）。
      </p>
    </div>

    <!-- 能量补给：能量饼干的常驻回收（2026-09-10）-->
    <div class="card biscuit-box">
      <div class="biscuit-head">
        <span class="biscuit-title">🍪 能量补给（能量饼干回收）</span>
        <span class="dim biscuit-sub">
          持有 <b class="mono">{{ player.inventory.energyBiscuit ?? 0 }}</b> 块 ·
          离线上限 {{ player.offlineBonusH ?? 0 }}h<template v-if="player.biscuitOfflineMaxed()">（已满 +12h）</template>
        </span>
      </div>
      <p class="dim biscuit-sub">
        能量饼干的作用是「离线时长上限 +4h」，而该上限封顶 +12h（{{ 3 }} 块即饱和）；战斗中也能吃（能量补给：回血 + 命中/攻速增益）。
        多余的饼干可在这里<b>不限量</b>回收成<b>品鉴点</b>——品鉴点是奥义的持续消耗燃料，不封顶。
      </p>
      <div class="biscuit-actions">
        <span class="dim biscuit-sub">回收数量</span>
        <input v-model.number="redeemCount" type="number" min="1" :max="biscuitPv.max" class="plot-select biscuit-input" :placeholder="String(biscuitPv.max)" />
        <span class="dim biscuit-sub">块（留空 = 全部）</span>
        <span class="biscuit-preview mono">
          → 品鉴点 +{{ (redeemCount ? Math.min(redeemCount, biscuitPv.max) : biscuitPv.max) * BISCUIT_TASTE_RATE }}
        </span>
        <button class="btn btn-sm btn-primary" :disabled="player.inventory.energyBiscuit < 1" @click="redeemBiscuits">
          回收{{ redeemCount ? '' : '全部' }}
        </button>
      </div>
      <p class="dim biscuit-sub">
        汇率固定 {{ BISCUIT_TASTE_RATE }} 品鉴点/块（约等于同级战斗一场的一小部分，不会取代打怪成为主要来源）；
        已回收 <b class="mono">{{ (player.stats?.biscuitsRecycled ?? 0).toLocaleString() }}</b> 块。
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 菜系图谱（2026-09-09） */
.insight-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.insight-head h3 { margin: 0; }
.insight-branch { margin-top: 8px; }
.insight-branch-title { font-weight: 700; margin-bottom: 6px; }
.insight-row { display: flex; flex-wrap: wrap; gap: 6px; }
.insight-node.insight-ready { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-soft) inset; }
.insight-node.insight-locked { opacity: 0.55; }
/* 能量补给（2026-09-10） */
.biscuit-box {
  margin-top: 12px;
}
.biscuit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.biscuit-title {
  font-weight: 600;
}
.biscuit-sub {
  font-size: 12px;
  line-height: 1.6;
}
.biscuit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.biscuit-input {
  width: 110px;
}
.biscuit-preview {
  font-size: 13px;
  color: var(--good, #57a861);
}
</style>
