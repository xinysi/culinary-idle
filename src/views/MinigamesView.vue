<script setup>
// 小游戏大厅（2026-09-06）：顶部第三页单一入口——六款小游戏卡片 + 记录预览
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'

const ui = useUiStore()
const player = usePlayerStore()

const GAMES = [
  {
    id: 'heat', emoji: '🔥', name: '火候炉', view: 'heat',
    desc: '定火挑战：指针停黄金区，每 5 连完美 +50 金。',
    record: () => `最佳 ${player.minigames?.heat?.bestStreak ?? 0} 连击`,
  },
  {
    id: 'trivia', emoji: '📚', name: '美食讲堂', view: 'trivia',
    desc: '每周 10 题竞答（答案实时取游戏数据），≥8 题得徽章+100 金。',
    record: () => `徽章 ${player.minigames?.trivia?.badges ?? 0} 枚`,
  },
  {
    id: 'kitchen2048', emoji: '🧩', name: '厨心 2048', view: 'kitchen2048',
    desc: '4×4 / 3×3 滑动合并，跨档即时 +20 金。',
    record: () => `最佳 4×4：${player.minigames?.kitchen2048?.best ?? 0} · 3×3：${player.minigames?.kitchen2048?.best3 ?? 0}`,
  },
  {
    id: 'foodrush', emoji: '🍖', name: '大胃王', view: 'foodrush',
    desc: '60 秒连点干饭，10 连击触发暴食×2，档位奖励 40-100 金。',
    record: () => `最佳 ${player.minigames?.foodrush?.best ?? 0} 碗`,
  },
  {
    id: 'puzzle', emoji: '🧩', name: '每日美食拼图', view: 'puzzle',
    desc: '4×4 华容道复原美食图，完成得能量饼干（每日 1 次）。',
    record: () => `累计完成 ${player.minigames?.puzzle?.done ?? 0} 天`,
  },
  {
    id: 'matchfood', emoji: '🀄', name: '食材连连看', view: 'matchfood',
    desc: '6×6 配对消除，全清得「满汉全席」buff（经验+20% 1 小时）。',
    record: () => `buff 天数 ${player.minigames?.matchfood?.buffed ?? 0}`,
  },
]
function go(view) { ui.setView(view) }
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🎮 小游戏</h2>
        <p class="dim">六款美食主题小游戏——练手、涨知识、赚金币/饼干/buff，记录永久保留。</p>
      </div>
    </header>
    <div class="minigame-grid">
      <div
        v-for="g in GAMES"
        :key="g.id"
        class="minigame-card"
        @click="go(g.view)"
      >
        <div class="minigame-emoji">{{ g.emoji }}</div>
        <div class="minigame-name">{{ g.name }}</div>
        <div class="minigame-desc">{{ g.desc }}</div>
        <div class="minigame-record dim mono">🏆 {{ g.record() }}</div>
      </div>
    </div>
  </div>
</template>
