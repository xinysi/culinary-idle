<script setup>
// 公会系统 — 需求文档 §13（可选扩展）
// 20 家公会（3 初始无要求 + 17 按类型等级 + 金币加入，增强逐级递增）
// 加入公会 → 被动词条 + 公会任务（每日重置、可重复）+ 公会商店（公会点数）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { GUILDS, GUILD_SHOP, getGuild, guildRequirementText, guildPassiveText } from '../game/data/guilds.js'
import { getItem } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const detail = ref(null) // 弹窗右侧选中的公会（列表弹窗内左右分栏）
const showList = ref(false) // 公会列表是否以弹窗展示
const guild = computed(() => getGuild(player.guild.id)) // 响应式：加入/退出公会立即更新任务区
// 列表弹窗右侧默认显示当前公会（未加入则第一家）
if (!detail.value) detail.value = guild.value ?? GUILDS[0] ?? null
function join(id) {
  if (player.joinGuild(id)) {
    ui.pushLog(`已加入公会：${getGuild(id)?.name}`, 'info')
    detail.value = null
  } else {
    ui.pushLog(`加入${getGuild(id)?.name}失败：未满足等级/金币需求`, 'warn')
  }
}
function buy(itemId) {
  if (player.guildShopBuy(itemId)) ui.pushLog(`购买 ${getItem(itemId)?.name}`, 'info')
  else ui.pushLog('公会点数不足', 'warn')
}
function taskProgress(task) {
  return player.guild.taskProgress[task.id] ?? 0
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🤝 美食公会</h2>
        <p class="dim">20 家公会：初始 3 家无要求，其余按类型等级 + 金币加入；增强逐级递增</p>
      </div>
      <div class="skill-head-right guild-head-right">
        <div class="xp-num">公会点数 <span class="mono">{{ player.guild.points }}</span></div>
        <p v-if="guild" class="dim guild-head-info">当前公会：<strong>{{ guild.name }}</strong> · {{ guildPassiveText(guild) }}</p>
        <button v-if="player.guild.id" class="btn btn-sm" @click="player.leaveGuild(); ui.pushLog('已退出公会', 'info')">退出公会</button>
      </div>
    </header>

    <!-- 公会列表：改为按钮，点击弹窗查看 -->
    <div class="card status-line">
      <span class="dim">共 {{ GUILDS.length }} 家公会（初始 3 家无要求，其余按类型等级 + 金币加入，增强逐级递增）</span>
      <button class="btn btn-sm btn-primary" style="margin-left: auto" @click="showList = true">公会列表</button>
    </div>

    <!-- 公会任务 -->
    <div class="card" v-if="guild">
      <h3>公会任务（每日重置）</h3>
      <div class="season-task-grid">
        <div v-for="(t, ti) in guild.tasks" :key="t.id" v-tilt class="season-task-card" :style="{ animationDelay: (ti * 0.06) + 's' }" :class="{ done: taskProgress(t) >= t.qty }">
          <div class="season-task-top">
            <strong class="season-task-name">{{ t.name }}</strong>
            <span class="badge season-task-pts" :class="{ 'badge-on': taskProgress(t) >= t.qty }">{{ taskProgress(t) >= t.qty ? '完成' : `+${t.reward.points} 点` }}</span>
          </div>
          <div class="season-task-bar">
            <ProgressBar :progress="Math.min(1, taskProgress(t) / t.qty)" />
            <span class="dim mono season-task-num">{{ taskProgress(t) }}/{{ t.qty }}</span>
          </div>
          <div class="dim season-task-note" style="font-size:11px">奖励 {{ t.reward.points }} 公会点{{ t.reward.gold ? ` + ${t.reward.gold} 金币` : '' }} · 可重复</div>
        </div>
      </div>
    </div>
    <div v-else class="card placeholder"><p class="dim">加入公会后解锁公会任务与商店</p></div>

    <!-- 公会商店 -->
    <div class="card" v-if="player.guild.id">
      <h3>公会商店（{{ GUILD_SHOP.length }} 件）· 公会点数兑换</h3>
      <div class="guild-shop-grid">
        <div v-for="(s, si) in GUILD_SHOP" :key="s.itemId" v-tilt class="season-tier-card guild-shop-card" :style="{ animationDelay: (si * 0.06) + 's' }" :class="player.guild.points >= s.price ? 'buyable' : 'poor'">
          <div class="season-tier-head">
            <div class="item-label">
              <img v-if="itemImage(s.itemId)" :src="itemImage(s.itemId)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
              <div class="guild-shop-name" style="margin:0">{{ getItem(s.itemId)?.name ?? s.itemId }}</div>
            </div>
          </div>
          <div class="dim mono guild-shop-price">公会点 {{ s.price }}</div>
          <button class="btn btn-sm season-tier-claim" :class="{ 'btn-primary': player.guild.points >= s.price }" :disabled="player.guild.points < s.price" @click="buy(s.itemId)">兑换</button>
        </div>
      </div>
    </div>

<!-- 公会列表弹窗 -->
    <div v-if="showList" class="modal-backdrop" @click.self="showList = false">
      <div class="modal guild-list-modal">
        <header class="modal-head">
          <h3>公会列表（{{ GUILDS.length }} 家）· 点击查看详情加入</h3>
          <button class="btn btn-sm" @click="showList = false">✕</button>
        </header>
        <div class="guild-list-body">
          <!-- 左：公会列表 -->
          <div class="guild-list-left">
            <div class="guild-grid">
              <button
                v-for="g in GUILDS"
                :key="g.id"
                class="btn guild-btn"
                :class="{ 'btn-primary': player.guild.id === g.id, 'guild-locked': g.requirements && player.guild.id !== g.id }"
                @click="detail = g"
              >
                {{ g.name }}
                <span class="dim guild-type">{{ g.type }} · {{ g.requirements ? '需' + guildRequirementText(g).split(' + ')[0] : '无要求' }}</span>
              </button>
            </div>
          </div>
          <!-- 右：公会详情 -->
          <div class="guild-list-right" v-if="detail">
            <h3>{{ detail.name }} <span class="badge" style="background: var(--sidebar-bg); color: var(--text)">{{ detail.type }}</span></h3>
            <table class="target-table item-detail-table">
              <tbody>
                <tr><td class="dim" style="width: 90px">公会描述</td><td>{{ detail.desc }}</td></tr>
                <tr><td class="dim">被动加成</td><td>{{ guildPassiveText(detail) }}</td></tr>
                <tr><td class="dim">加入要求</td><td>{{ guildRequirementText(detail) }}</td></tr>
                <tr><td class="dim">每日任务</td><td>{{ detail.tasks.length }} 个（采集/制作/对决等，可重复完成）</td></tr>
                <tr><td class="dim">当前状态</td><td>{{ player.guild.id === detail.id ? '已加入' : player.guild.id ? '换入（100 金币，点数减半）' : '未加入' }}</td></tr>
              </tbody>
            </table>
            <div style="margin-top: 10px; text-align: right">
              <button class="btn btn-sm btn-primary" :disabled="player.guild.id === detail.id" @click="join(detail.id)">
                {{ player.guild.id === detail.id ? '已加入' : player.guild.id ? '换入' : '加入' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══ 公会任务 / 公会商店：复制赛季动态样式（与 SeasonView 一致） ═══ */
/* 公会任务：5 个任务卡刚好占满一行（5 列） */
.season-task-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}
/* 公会商店：自动换行多列 */
.guild-shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  align-items: stretch;
}
/* 卡片 3D 倾斜 + 毛玻璃 + 流光动效（配合 v-tilt 的 --tilt-x/--tilt-y） */
.season-task-card,
.season-tier-card {
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(150, 110, 70, 0.32);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 6px 18px rgba(150, 110, 70, 0.16);
  transform: perspective(700px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  will-change: transform;
  min-height: 104px;
  position: relative;
}
/* 悬浮流光描边 */
.season-task-card::after,
.season-tier-card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 12px;
  padding: 1.5px;
  background: conic-gradient(from var(--spin, 0deg), transparent 0%, rgba(217, 90, 56, 0.55) 18%, transparent 36%, rgba(217, 90, 56, 0.3) 60%, transparent 80%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.season-task-card:hover::after,
.season-tier-card:hover::after {
  opacity: 1;
  animation: seasonFlow 2.6s linear infinite;
}
@keyframes seasonFlow { to { --spin: 360deg; } }
@property --spin { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
.season-task-card:hover,
.season-tier-card:hover {
  box-shadow: 0 8px 24px rgba(217, 90, 56, 0.18);
}
/* ── 任务卡 ── */
.season-task-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.season-task-name {
  flex: 1; font-size: 13px; line-height: 1.35; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.season-task-pts { flex-shrink: 0; white-space: nowrap; font-size: 12px; }
.season-task-bar { display: flex; align-items: center; gap: 8px; margin-top: auto; }
.season-task-bar :deep(.progress-bar) { flex: 1; }
.season-task-num { flex-shrink: 0; font-size: 12px; }
.season-task-note { margin-top: 2px; }
/* 进度条流光 */
.season-task-bar :deep(.progress-bar-fill) {
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%),
    linear-gradient(90deg, var(--primary), var(--primary-strong));
  background-size: 200% 100%, 100% 100%;
  background-position: 200% 0, 0 0;
  background-repeat: repeat, no-repeat;
  animation: seasonBarFlow 5s linear infinite;
}
@keyframes seasonBarFlow { from { background-position: 200% 0, 0 0; } to { background-position: 0 0, 0 0; } }
.season-task-card.done :deep(.progress-bar-fill) {
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%),
    linear-gradient(90deg, var(--good), var(--good-strong));
  animation: seasonBarFlow 4s linear infinite, seasonDoneGlow 0.6s ease;
}
@keyframes seasonDoneGlow {
  0% { box-shadow: 0 0 0 0 rgba(92, 184, 92, 0.7); }
  100% { box-shadow: 0 0 0 8px rgba(92, 184, 92, 0); }
}
.season-task-card.done { border-color: var(--good-soft); }
/* ── 商店卡 ── */
.guild-shop-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.guild-shop-card { align-items: center; text-align: center; }
.guild-shop-card .item-label { flex-direction: column; align-items: center; gap: 2px; justify-content: center; }
.guild-shop-name { font-weight: 600; font-size: 13px; text-align: center; min-height: 34px; display: flex; align-items: center; }
.guild-shop-price { font-size: 12px; }
.guild-shop-card .season-tier-claim { margin-top: auto; width: 100%; }
/* 买得起 / 买不起 动态状态 */
.guild-shop-card.buyable { border-color: var(--primary-soft); }
.guild-shop-card.poor { opacity: 0.55; filter: grayscale(0.4); cursor: not-allowed; }

/* ═══ 头部右区排版（公会点数 / 当前公会 / 退出按钮）═══ */
.guild-head-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  text-align: right;
}
.guild-head-right .xp-num { text-align: right; }
.guild-head-info {
  margin: 0;
  text-align: right;
  line-height: 1.35;
  color: var(--muted);
}
.guild-head-right .btn { margin-top: 2px; }
</style>
