<script setup>
// 统计面板 — 里程碑总览（分栏式 + 赛季点数流光数字）
// 数据全部来自 player store（已确认字段存在且口径正确）。
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import { ITEMS } from '../game/data/items.js'
import { COMBAT_BOSSES } from '../game/data/combat.js'
import { COLLECTABLE_SETS } from '../game/data/setBonuses.js'
import { masteryLevelFromCount } from '../game/core/mastery.js'
import { REGIONS } from '../game/data/regions.js'
import { ALL_ACHIEVEMENTS } from '../game/data/achievements.js'

const player = usePlayerStore()
const ui = useUiStore()

const skills = computed(() => getAllSkillInstances())
const totalActions = computed(() => skills.value.reduce((a, s) => a + (s.actionsDone ?? 0), 0))
const totalCrafts = computed(() => skills.value.filter((s) => s.type === 'production').reduce((a, s) => a + (s.actionsDone ?? 0), 0))
const totalGathers = computed(() => skills.value.filter((s) => s.type === 'gathering').reduce((a, s) => a + (s.actionsDone ?? 0), 0))
const winRate = computed(() => {
  const w = player.stats.combatWins ?? 0
  const total = w + (player.stats.combatLosses ?? 0)
  return total ? Math.round((w / total) * 100) : 0
})
const seasonClaimed = computed(() =>
  Object.values(player.seasons ?? {}).reduce((a, s) => a + (s.claimed?.length ?? 0), 0)
)
// 厨房笔记（2026-09-10）：配方精通分布（只读 player.skills[*].mastery）
const recipeMastery = computed(() => {
  const lv = []
  for (const s of skills.value) {
    if (s.type !== 'production') continue
    for (const v of Object.values(s.mastery ?? {})) lv.push(masteryLevelFromCount(v ?? 0))
  }
  return { total: lv.length, half: lv.filter((l) => l >= 50).length, maxed: lv.filter((l) => l >= 100).length }
})

// 招牌纪录（2026-09-10 由名人堂并入）：6 张大字卡
const highlights = computed(() => [
  { icon: '⚔️', label: '对决等级', value: player.combatLevel },
  { icon: '📖', label: '图鉴完成度', value: `${player.collectionPct}%` },
  { icon: '🗼', label: '挑战塔最高层', value: player.tower?.best ?? 0 },
  { icon: '🏯', label: '秘境最高层', value: player.realm?.best ?? 0 },
  { icon: '🏆', label: '竞技场最佳连胜', value: player.stats?.arena?.bestStreak ?? 0 },
  { icon: '🎪', label: '大赛最高月分', value: player.fest?.score ?? 0 },
])
// 已获称号（称号墙）
const ownedTitles = computed(() => ALL_ACHIEVEMENTS.filter((a) => a.title && (player.achievements ?? []).includes(a.id)).map((a) => a.title))
const totalTitles = computed(() => ALL_ACHIEVEMENTS.filter((a) => a.title).length)

// 分栏式：六大类，每栏若干统计项；value 为流光大数字，sub 为辅助文字
const sections = computed(() => [
  {
    icon: '🌱',
    title: '成长',
    rows: [
      { label: '总等级', value: player.totalLevels },
      { label: '转生次数', value: player.stats.prestiges ?? 0 },
      { label: '每日任务连续', value: (player.daily?.streak ?? 0) > 0 ? `${player.daily.streak} 天` : '—', sub: ' 全清+连续' },
    ],
  },
  {
    icon: '⚔️',
    title: '对战',
    rows: [
      { label: '对决胜利', value: player.stats.combatWins ?? 0, sub: ` 场 · 胜率 ${winRate.value}%` },
      { label: '对决等级', value: player.combatLevel },
      { label: '首领击杀', value: player.stats.bosses?.length ?? 0, sub: ` / ${COMBAT_BOSSES.length}` },
      { label: '竞技场最佳连胜', value: player.stats.arena?.bestStreak ?? 0 },
      { label: '竞技场胜场', value: player.stats?.arena?.wins ?? 0, sub: ' 场' },
      { label: '困难首杀', value: player.stats?.hardBosses?.length ?? 0, sub: ` / ${COMBAT_BOSSES.length}` },
      { label: '卡牌对战', value: player.stats.cardBattle?.wins ?? 0, sub: ` 胜 / ${player.stats.cardBattle?.losses ?? 0} 负` },
      { label: '试炼塔最高层', value: player.tower?.best ?? 0, sub: player.tower?.best ? ' 层' : '（对决99解锁）' },
      { label: '食神秘境最高层', value: player.realm?.best ?? 0, sub: player.realm?.best ? ' 层' : '（对决页进入）' },
      { label: '每周挑战达成', value: player.stats?.challengesDone ?? 0, sub: ' 次' },
      { label: '硬核生存', value: player.hardcore ? `${player.hardcoreStats?.days ?? 0} 天` : '非硬核', sub: player.hardcore ? ` 最佳 ${player.hardcoreStats?.best ?? 0} 天` : '' },
    ],
  },
  {
    icon: '⛏️',
    title: '生产',
    rows: [
      { label: '采集动作', value: totalGathers.value },
      { label: '制作次数', value: totalCrafts.value },
      { label: '总动作', value: totalActions.value },
      { label: '配方精通 ≥50 级', value: recipeMastery.value.half, sub: ` / ${recipeMastery.value.total} 张` },
      { label: '满级配方', value: recipeMastery.value.maxed, sub: ' 张（精通 100）' },
      { label: '地窖出窖', value: player.stats?.cellarRounds ?? 0, sub: ` 次 · 累计 ${(player.stats?.cellarGold ?? 0).toLocaleString()} 金币` },
      { label: '常客招待', value: player.stats?.regularServes ?? 0, sub: ` 次 · 小费 +${player.regularTipPct()}%` },
      { label: '食灵物语', value: player.stats?.spiritStoryClaims ?? 0, sub: ` 段 · 待领取 ${player.spiritStoryPending()}` },
      { label: '自动出售', value: player.stats?.autoSold ?? 0, sub: ` 件 · 回收 ${(player.stats?.autoSoldGold ?? 0).toLocaleString()} 金币` },
      { label: '牧场产出周期', value: player.stats?.ranchCycles ?? 0, sub: ` 次 · ${player.ranchPens()} 个栏位` },
      { label: '分店入账', value: (player.stats?.branchGold ?? 0).toLocaleString(), sub: ` 金币 · ${Object.keys(player.branches ?? {}).length} 家分店` },
      { label: '米其林星级', value: '★'.repeat(player.michelin?.stars ?? 0) || '—', sub: ` 当前 ${player.michelin?.score ?? 0} 分 · 最高 ${player.michelin?.best ?? 0} 星` },
      { label: '风味搭配', value: player.flavorProgress().found, sub: ` / ${player.flavorProgress().total} 条` },
      { label: '厨具大赛', value: player.gearScore().score, sub: ` 分 · 历史最高 ${player.gearContest?.best ?? 0}` },
      { label: '今日节庆', value: player.festivalBoost().active.map((f) => f.name).join('、') || '无', sub: player.festivalBoost().active.length ? '（加成已生效）' : '（见节庆日历）' },
      { label: '菜系研究', value: player.schoolTotalLevels(), sub: ' / 30 级（六派 ×5）' },
      { label: '雇工班底', value: player.staffWagePerHour().toLocaleString(), sub: ` 金币/时 · 收入 +${player.staffIncomePct()}%` },
      { label: '产地考察', value: Object.keys(player.regions ?? {}).length, sub: ` / ${REGIONS.length} 个 · 派驻 ${Object.keys(player.regionPosting ?? {}).length} 条线路` },
      { label: '徒弟', value: `Lv${player.apprenticeState().level}`, sub: ` ${player.apprenticeRankName()} · 离线效率 ${Math.round((0.8 + player.apprenticeOfflineBonus()) * 100)}%` },
      { label: '守护神信仰', value: player.patronActiveId() ? `Lv${player.patronLevel(player.patronActiveId())}` : '无', sub: ' 信仰等级（供奉永久保留）' },
      { label: '交易所成交', value: player.stats?.exchangeTrades ?? 0, sub: ` 件 · 流水 ${(player.stats?.exchangeGold ?? 0).toLocaleString()} 金币` },
      { label: '厨神试炼通关', value: player.stats?.trialClears ?? 0, sub: ' 次' },
    ],
  },
  {
    icon: '📖',
    title: '收集',
    rows: [
      { label: '图鉴完成度', value: `${player.collectionPct}%`, sub: `（${Object.keys(player.collected).length}/${Object.keys(ITEMS).length}）` },
      { label: '锻造套装集齐', value: player.setBonuses?.length ?? 0, sub: ` / ${COLLECTABLE_SETS.length} 套` },
      { label: '称号', value: player.title ? `「${player.title}」` : '无' },
      { label: '称号收集', value: ownedTitles.value.length, sub: ` / ${totalTitles.value}` },
      { label: '赛季套装收集', value: seasonClaimed.value, sub: ' 档' },
      { label: '厨艺大赛月分', value: player.fest?.score ?? 0, sub: player.fest?.month ? `（${player.festTheme()?.name ?? ''}）` : '（未开赛）' },
      { label: '食灵羁绊', value: (player.spirits?.active ?? []).map((id) => `Lv${player.bondLevelFor(id)}`).join('+') || '—', sub: ' 出战食灵最高羁绊' },
      { label: '菜系图谱', value: (player.insights?.length ?? 0), sub: ` / 12 节点 · 见闻 ${player.insightPoints()}` },
      { label: '宝石镶嵌', value: player.stats?.gemsSocketed ?? 0, sub: ' 颗' },
      { label: '远行采集队', value: Object.values(player.expeditions ?? {}).reduce((a, e) => a + (e?.completions ?? 0), 0), sub: ' 轮' },
      { label: '评论家好评', value: player.stats?.criticServed ?? 0, sub: ' 次' },
      { label: '挂机计划完成', value: player.stats?.plansDone ?? 0, sub: ' 次' },
    ],
  },
  {
    icon: '💰',
    title: '经济',
    rows: [
      { label: '餐厅总收入', value: (player.stats.restaurantTotal ?? 0).toLocaleString(), sub: ' 金币' },
      { label: '餐厅好感', value: `Lv${player.favorLevel()}`, sub: ' 小费 +3%/级' },
      { label: '累计获得金币', value: (player.stats.totalGoldEarned ?? 0).toLocaleString(), sub: ' 金币' },
      { label: '探索次数', value: player.stats.explorations ?? 0 },
    ],
  },
  {
    icon: '🤝',
    title: '社交',
    rows: [
      { label: '公会点数', value: player.guild?.points ?? 0 },
    ],
  },
])
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📊 统计</h2>
        <p class="dim">你的美食之旅里程碑总览</p>
      </div>
      <button class="btn btn-sm btn-primary" style="margin-left: auto" @click="ui.toggleShareCard(true)">📸 生成战报</button>
    </header>
    <div class="hall-highlights">
      <div v-for="h in highlights" :key="h.label" class="card hall-card">
        <div class="hall-icon">{{ h.icon }}</div>
        <div class="stats-num mono">{{ h.value }}</div>
        <div class="stats-label dim">{{ h.label }}</div>
      </div>
    </div>
    <div class="stats-columns">
      <div v-for="sec in sections" :key="sec.title" class="stats-col card">
        <h4 class="stats-col-head">{{ sec.icon }} {{ sec.title }}</h4>
        <div v-for="row in sec.rows" :key="row.label" class="stats-row">
          <span class="stats-label dim">{{ row.label }}</span>
          <span class="stats-value">
            <span class="stats-num mono">{{ row.value }}</span>
            <span v-if="row.sub" class="stats-sub dim">{{ row.sub }}</span>
          </span>
        </div>
      </div>
    </div>
    <div v-if="ownedTitles.length" class="card hall-titles-card">
      <h4 class="stats-col-head">🎖 已获称号（{{ ownedTitles.length }} / {{ totalTitles }}）</h4>
      <div class="hall-titles">
        <span v-for="t in ownedTitles" :key="t" class="badge" :class="{ 'badge-on': player.title === t }">{{ t }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hall-highlights {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin: 12px 0;
}
.hall-card {
  padding: 12px 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hall-icon {
  font-size: 20px;
}
.hall-titles-card {
  margin-top: 12px;
  padding: 12px 14px;
}
.hall-titles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
/* 分栏式：自动填充多列 */
.stats-columns {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.stats-col {
  padding: 14px 16px;
}
.stats-col-head {
  font-size: 15px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--border);
}
.stats-row:last-child { border-bottom: none; }
.stats-label { font-size: 13px; white-space: nowrap; }
.stats-value { display: flex; align-items: baseline; gap: 4px; }

/* 赛季点数数字那种流光：底层主色渐变 + 上层彩虹高光滑过（background-clip:text） */
.stats-num {
  font-size: 20px;
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
  animation: statsNumFlow 4s linear infinite;
}
@keyframes statsNumFlow { from { background-position: 200% 0, 0 0; } to { background-position: 0 0, 0 0; } }
.stats-sub { font-size: 12px; }
</style>
