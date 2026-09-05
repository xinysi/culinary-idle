<script setup>
// 赛季系统 — 需求文档 §13（可选扩展）
// 按时间轮换主题赛季：赛季任务 → 赛季点数 → 分档奖励（含限定装备）
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getSeason, seasonRemainingMs, SEASONS } from '../game/data/seasons.js'
import { itemName, getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const season = computed(() => player.activeSeasonDef)
const state = computed(() => player.seasonState())

function remainingText() {
  const ms = seasonRemainingMs(season.value?.id)
  const h = Math.floor(ms / 3600_000)
  const m = Math.floor((ms % 3600_000) / 60_000)
  return `${h} 小时 ${m} 分`
}

// 赛季任务 → 跳转对应界面（采集/制作/对决/首领/餐厅）
function gatherSkillFor(it) {
  if (!it) return 'foraging'
  const c = it.category
  if (c === 'seafood') return 'fishing'
  if (c === 'meat') return 'hunting'
  if (['root', 'fungus', 'mineral', 'fossil'].includes(c)) return 'excavation'
  if (c === 'crop') return 'farming'
  return 'foraging'
}
function craftSkillFor(it) {
  if (!it) return 'cooking'
  const c = it.category, ty = it.type
  if (ty === 'spice') return 'spiceMixing'
  if (ty === 'drink') return 'brewing'
  if (c === 'pickled' || c === 'sauce') return 'preserving'
  if (c === '甜点' || c === 'baking') return 'baking'
  if (ty === 'equipment') return 'craftsmithing'
  return 'cooking'
}
function jumpTask(m) {
  const kind = m.kind
  if (kind === 'restaurant') { ui.setView('restaurant'); return }
  if (kind === 'combatWin' || kind === 'boss') { player.activeSkill = 'knife'; ui.setView('skill'); return }
  if (kind === 'explore') { player.activeSkill = 'exploration'; ui.setView('skill'); return }
  if (kind === 'harvest') { player.activeSkill = 'farming'; ui.setView('skill'); return }
  if (kind === 'gather') { const it = getItem(m.param); player.activeSkill = gatherSkillFor(it); ui.setView('skill'); return }
  if (kind === 'craft') { const it = getItem(m.param); player.activeSkill = craftSkillFor(it); ui.setView('skill'); return }
  ui.setView('skill')
}
function jumpLabel(m) {
  const map = { gather: '去采集', craft: '去制作', combatWin: '去对决', boss: '去打首领', restaurant: '去餐厅', explore: '去探索', harvest: '去收获' }
  return map[m.kind] || '前往'
}
function canJump(m) {
  return ['gather', 'craft', 'combatWin', 'boss', 'restaurant', 'explore', 'harvest'].includes(m.kind)
}
function missionProgress(m) {
  return state.value.missionProgress[m.id] ?? 0
}
function claim(i) {
  if (player.seasonClaimTier(i)) ui.pushLog('赛季奖励已领取', 'info')
  else ui.pushLog('点数不足或已领取', 'warn')
}
function rewardText(reward) {
  const parts = []
  if (reward?.gold) parts.push(`${reward.gold} 金币`)
  if (reward?.items) for (const [id, q] of Object.entries(reward.items)) parts.push(`${itemName(id)} ×${q}`)
  return parts.join('、')
}
// 赛季主题色（背景渐变 / 礼花用），每季一个代表色
const SEASON_COLORS = {
  summer: '#f2691c', winter: '#4f8fd0', spring: '#5cb85c', autumn: '#d98a2b', ocean: '#2aa5c8',
  forest: '#3f8f5a', desert: '#c98f4a', berry: '#c0392b', summit: '#6fa8dc', tea: '#7a9a5a',
  spice: '#b5651d', pickle: '#8a6d3b', lotus: '#3aa8a8', ember: '#d35400', snow: '#8fc1e3',
  moon: '#d9b3c9', chili: '#c0392b', pirate: '#1f6f8b', coral: '#e07a5f', galaxy: '#5a4fcf',
  blossom: '#e79fb4', mooncake2: '#d9a441', grape: '#6a3f9c', honey2: '#d9a441', citrus: '#f0a500',
  chestnut: '#8a5a2b', snow2: '#a8c8e8', bamboo: '#6a994e', ocean2: '#3a9ba8', pine: '#3f7d5a',
  plum: '#c58f9c', eggplant: '#5a4f8f', goat: '#c3a06a', ginkgo: '#d9b344', taro: '#7a5a8f',
  sesame: '#c9973f', chili2: '#d64545', wine: '#7a3b6f', phoenix: '#d2583a', dragon2: '#3e6d9c',
}
const seasonColor = computed(() => SEASON_COLORS[season.value?.id] ?? '#d95a38')
// 领取礼花：点击领取在按钮位置迸发小粒子
function doClaim(i, ev) {
  claim(i)
  const el = ev?.currentTarget
  if (!el) return
  const rect = el.getBoundingClientRect()
  const color = seasonColor.value
  for (let k = 0; k < 12; k++) {
    const p = document.createElement('span')
    p.className = 'season-burst'
    const ang = (k / 12) * Math.PI * 2
    const r = 42 + Math.random() * 18
    p.style.cssText = `left:${rect.width / 2}px;top:${rect.height / 2}px;--dx:${Math.cos(ang) * r}px;--dy:${Math.sin(ang) * r}px;background:${color};`
    el.appendChild(p)
    setTimeout(() => p.remove(), 650)
  }
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🎪 {{ season?.name }}</h2>
        <p class="dim">主题：{{ season?.theme }} · 剩余 {{ remainingText() }} · 限定套装 {{ (season?.limitedItems ?? []).length }} 件（已得 {{ (season?.limitedItems ?? []).filter((id) => player.collected[id]).length }}）</p>
      </div>
      <div class="skill-head-right">
        <div class="season-pts-card">
          <img src="/images/icon-season-pts.png" alt="" class="season-pts-icon" />
          <div class="season-pts-text">
            <span class="season-pts-label">赛季点数</span>
            <span class="season-pts-num mono">{{ state.points }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 赛季任务（动态卡片式） -->
    <div class="card">
      <h3>赛季任务（按主题动态）</h3>
      <div class="season-task-grid">
        <div v-for="(m, mi) in season?.missions ?? []" :key="m.id" v-tilt class="season-task-card" :style="{ animationDelay: (mi * 0.06) + 's' }" :class="{ done: missionProgress(m) >= m.qty }">
          <div class="season-task-top">
            <strong class="season-task-name">{{ m.name }}</strong>
            <span class="badge season-task-pts" :class="{ 'badge-on': missionProgress(m) >= m.qty }">{{ missionProgress(m) >= m.qty ? '完成' : `+${m.points} 点` }}</span>
          </div>
          <div class="season-task-bar">
            <ProgressBar :progress="Math.min(1, missionProgress(m) / m.qty)" />
            <span class="dim mono season-task-num">{{ missionProgress(m) }}/{{ m.qty }}</span>
          </div>
          <button v-if="canJump(m)" class="btn btn-sm season-task-jump" @click="jumpTask(m)">{{ jumpLabel(m) }}</button>
        </div>
      </div>
      <p class="dim special-note">任务进度自动累计（采集/制作/对决/首领/餐厅收入），赛季结束后轮换新主题。</p>
    </div>

    <!-- 奖励档位（动态卡片式） -->
    <div class="card">
      <h3>奖励档位（赛季结束前领取）</h3>
      <div class="season-tier-grid">
        <div v-for="(tier, i) in season?.tiers ?? []" :key="i" v-tilt class="season-tier-card" :style="{ animationDelay: (i * 0.06) + 's' }" :class="{ claimed: state.claimed.includes(i), claimable: state.points >= tier.points && !state.claimed.includes(i) }">
          <div class="season-tier-head">
            <strong>{{ tier.name ?? `第 ${i + 1} 档` }}</strong>
            <span class="dim season-tier-pts">需 {{ tier.points }} 点</span>
          </div>
          <div class="season-tier-reward">{{ rewardText(tier.reward) }}</div>
          <button class="btn btn-sm season-tier-claim" :class="{ 'btn-primary': state.points >= tier.points && !state.claimed.includes(i) }" :disabled="state.points < tier.points || state.claimed.includes(i)" @click="doClaim(i, $event)">
            {{ state.claimed.includes(i) ? '已领取' : '领取' }}
          </button>
        </div>
      </div>
      <p class="dim special-note">历史赛季：{{ SEASONS.map((s) => s.name).join('、') }}（限定装备永久保留）</p>
    </div>
  </div>
</template>

<style scoped>
.season-task-grid,
.season-tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
  align-items: stretch;
}
/* 卡片 3D 倾斜动效（配合 v-tilt 的 --tilt-x/--tilt-y） */
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
/* 悬浮流光描边（卡片边缘流动光晕） */
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
/* 特性：--spin 是自定义属性，需在 @property 注册才能动画（兼容 fallback） */
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
.season-task-pts { flex-shrink: 0; white-space: nowrap; font-size: 11px; }
.season-task-bar { display: flex; align-items: center; gap: 8px; margin-top: auto; }
.season-task-bar :deep(.progress-bar) { flex: 1; }
.season-task-num { flex-shrink: 0; font-size: 12px; }
.season-task-jump { align-self: flex-end; margin-top: 2px; }
/* 进度条流动高光：白高光滑过 + 底层保持主色渐变（不可覆盖底色，否则进度条变白） */
.season-task-bar :deep(.progress-bar-fill) {
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%),
    linear-gradient(90deg, var(--primary), var(--primary-strong));
  background-size: 200% 100%, 100% 100%;
  background-position: 200% 0, 0 0;
  background-repeat: repeat, no-repeat;
  animation: seasonBarFlow 5s linear infinite;
}
/* 无缝循环：位置 200%→0（正好一整张 200% 宽的渐变），两端透明图案重合，loop 无跳变 */
@keyframes seasonBarFlow { from { background-position: 200% 0, 0 0; } to { background-position: 0 0, 0 0; } }
/* 完成：底层变绿 + 闪光 */
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
/* ── 奖励卡 ── */
.season-tier-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.season-tier-head strong { font-size: 13px; }
.season-tier-pts { font-size: 11px; white-space: nowrap; }
.season-tier-reward {
  font-size: 12px; color: var(--muted); line-height: 1.5; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; min-height: 36px;
}
.season-tier-claim { margin-top: auto; width: 100%; position: relative; }
.season-tier-card.claimed { opacity: 0.6; }
.season-tier-card.claimable { border-color: var(--primary-soft); }
/* 领取礼花粒子 */
.season-burst {
  position: absolute;
  width: 5px; height: 5px; border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: seasonBurst 0.6s ease-out forwards;
  pointer-events: none;
}
@keyframes seasonBurst {
  from { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
  to { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.4); }
}
/* 赛季点数徽章（毛玻璃卡片式） */
.skill-head-right { display: flex; align-items: center; justify-content: flex-end; margin-left: auto; min-width: 0; align-self: center; }
.season-pts-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(150, 110, 70, 0.42);
  border-radius: 12px;
  padding: 8px 14px;
  box-shadow: 0 4px 14px rgba(150, 110, 70, 0.18);
}
.season-pts-icon { width: 26px; height: 26px; image-rendering: pixelated; flex-shrink: 0; }
.season-pts-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
.season-pts-label { font-size: 11px; color: var(--muted); }
/* 数字复用进度条流光：底层主色渐变 + 上层彩色高光(彩虹)滑过(background-clip:text)；200%宽、200%→0 无缝循环 */
.season-pts-num {
  font-size: 22px;
  font-weight: 700;
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,80,80,0.85) 20%, rgba(255,190,60,0.85) 40%, rgba(80,220,120,0.85) 60%, rgba(70,170,255,0.85) 80%, rgba(255,255,255,0) 100%),
    linear-gradient(90deg, var(--primary), var(--primary-strong));
  background-size: 200% 100%, 100% 100%;
  background-position: 200% 0, 0 0;
  background-repeat: repeat, no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: seasonNumFlow 4s linear infinite;
}
@keyframes seasonNumFlow { from { background-position: 200% 0, 0 0; } to { background-position: 0 0, 0 0; } }
</style>
