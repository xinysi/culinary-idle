<script setup>
// 统计面板 — 里程碑总览（分栏式 + 赛季点数流光数字）
// 数据全部来自 player store（已确认字段存在且口径正确）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { getAllSkillInstances } from '../game/skills/registry.js'
import { ITEMS } from '../game/data/items.js'
import { COMBAT_BOSSES } from '../game/data/combat.js'

const player = usePlayerStore()

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
      { label: '卡牌对战', value: player.stats.cardBattle?.wins ?? 0, sub: ` 胜 / ${player.stats.cardBattle?.losses ?? 0} 负` },
      { label: '试炼塔最高层', value: player.tower?.best ?? 0, sub: player.tower?.best ? ' 层' : '（对决99解锁）' },
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
    ],
  },
  {
    icon: '📖',
    title: '收集',
    rows: [
      { label: '图鉴完成度', value: `${player.collectionPct}%`, sub: `（${Object.keys(player.collected).length}/${Object.keys(ITEMS).length}）` },
      { label: '称号', value: player.title ? `「${player.title}」` : '无' },
      { label: '赛季套装收集', value: seasonClaimed.value, sub: ' 档' },
      { label: '厨艺大赛月分', value: player.fest?.score ?? 0, sub: player.fest?.month ? `（${player.festTheme()?.name ?? ''}）` : '（未开赛）' },
      { label: '食灵羁绊', value: (player.spirits?.active ?? []).map((id) => `Lv${player.bondLevelFor(id)}`).join('+') || '—', sub: ' 出战食灵最高羁绊' },
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
    </header>
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
  </div>
</template>

<style scoped>
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
