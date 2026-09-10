<script setup>
// 风味搭配册（2026-09-10 新增）— 收集食材组合：首次在一张配方里同时用到某组食材即点亮。
// 2026-09-10 补：总览进度 + 未点亮也显示奖励预览 + 「在哪做」反查（最低等级配方优先）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { FLAVOR_PAIRS } from '../game/data/flavorPairs.js'
import { recipesForPair } from '../game/data/flavorRecipes.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const onlyUndiscovered = ref(false)
const expanded = ref(null) // 展开「在哪做」的搭配 id

const rows = computed(() =>
  FLAVOR_PAIRS.map((p) => {
    const recipes = recipesForPair(p.items)
    return {
      ...p,
      found: !!player.flavors?.[p.id],
      itemsText: p.items.map((id) => getItem(id)?.name ?? id).join(' + '),
      rewardText: rewardTextOf(p.reward),
      recipes,
      easiest: recipes[0] ?? null,
      moreCount: Math.max(0, recipes.length - 1),
    }
  }).filter((r) => (onlyUndiscovered.value ? !r.found : true))
)
const prog = computed(() => player.flavorProgress())

function rewardTextOf(reward) {
  const parts = []
  if (reward?.gold) parts.push(`${reward.gold.toLocaleString()} 金币`)
  for (const [id, q] of Object.entries(reward?.items ?? {})) parts.push(`${getItem(id)?.name ?? id} ×${q}`)
  return parts.join(' + ') || '—'
}

// 总览：奖励总量 + 分类统计（按所需食材数）
const summary = computed(() => {
  const all = FLAVOR_PAIRS.map((p) => ({ ...p, found: !!player.flavors?.[p.id] }))
  const gold = all.reduce((a, p) => a + (p.reward?.gold ?? 0), 0)
  const goldGot = all.filter((p) => p.found).reduce((a, p) => a + (p.reward?.gold ?? 0), 0)
  const two = all.filter((p) => p.items.length === 2)
  const three = all.filter((p) => p.items.length >= 3)
  return {
    gold,
    goldGot,
    goldLeft: Math.max(0, gold - goldGot),
    two: { found: two.filter((p) => p.found).length, total: two.length },
    three: { found: three.filter((p) => p.found).length, total: three.length },
    pct: all.length ? all.filter((p) => p.found).length / all.length : 0,
  }
})
function toggle(id) {
  expanded.value = expanded.value === id ? null : id
}
function goCraft(skillId, recipeName) {
  if (skillId && skillId !== 'alchemy') player.setActiveSkill?.(skillId)
  ui.setView(skillId === 'alchemy' ? 'alchemy' : 'skill')
  ui.pushLog(`📔 去制作「${recipeName}」`, 'info')
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'kitchenNotes', label: '📓 厨房笔记' }, { view: 'schools', label: '📜 菜系研究' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📔 风味搭配册</h2>
        <p class="dim">
          记录你发现的<b>食材组合</b>：只要在一张配方里同时用到该组合的全部食材（制作成功即算），就会点亮并给一次性奖励。
          共 {{ prog.total }} 条，已点亮 <b class="mono">{{ prog.found }}</b> 条。
        </p>
      </div>
      <button class="btn btn-sm" :class="{ 'btn-primary': onlyUndiscovered }" @click="onlyUndiscovered = !onlyUndiscovered">
        {{ onlyUndiscovered ? '✓ 只看未点亮' : '只看未点亮' }}
      </button>
    </header>

    <!-- 总览（2026-09-10 补） -->
    <div class="card flavor-hero">
      <div class="flavor-hero-left">
        <div class="flavor-hero-num">{{ prog.found }}<span class="dim flavor-hero-max">/{{ prog.total }}</span></div>
        <div class="dim flavor-hero-label">已点亮搭配</div>
      </div>
      <div class="flavor-hero-right">
        <div class="rev-bar-label">
          <span class="dim">收集进度</span>
          <span class="dim mono">{{ Math.round(summary.pct * 100) }}%</span>
        </div>
        <ProgressBar :progress="summary.pct" />
        <div class="flavor-hero-chips">
          <span class="flavor-chip">二味 {{ summary.two.found }}/{{ summary.two.total }}</span>
          <span class="flavor-chip">三味 {{ summary.three.found }}/{{ summary.three.total }}</span>
          <span class="flavor-chip">奖励已得 <b class="mono">{{ summary.goldGot.toLocaleString() }}</b> 金币</span>
          <span class="flavor-chip">剩余待拿 <b class="mono">{{ summary.goldLeft.toLocaleString() }}</b> 金币</span>
        </div>
      </div>
    </div>

    <div class="flavor-grid">
      <div v-for="r in rows" :key="r.id" class="card flavor-card" :class="{ found: r.found }">
        <div class="flavor-head">
          <span class="flavor-icon">{{ r.found ? '📖' : '❔' }}</span>
          <div>
            <strong>{{ r.found ? r.name : '未点亮的搭配' }}</strong>
            <div class="dim flavor-sub">{{ r.itemsText }}</div>
          </div>
        </div>
        <p class="dim flavor-desc">{{ r.found ? r.desc : '在任意一张配方里同时用上以上食材即可点亮。' }}</p>

        <!-- 奖励：未点亮也展示，让玩家知道值不值得去做 -->
        <div class="flavor-reward" :class="{ got: r.found }">
          <span>{{ r.found ? '✅ 奖励已领取：' : '🎁 点亮可得：' }}</span>
          <span class="mono">{{ r.rewardText }}</span>
        </div>

        <!-- 在哪做（2026-09-10 补）：最低等级配方 + 展开全部 -->
        <div v-if="r.recipes.length" class="flavor-where">
          <div class="flavor-where-row">
            <span class="dim">建议配方</span>
            <button class="flavor-recipe" @click="goCraft(r.easiest.skillId, r.easiest.name)">
              {{ r.easiest.skillName }} · {{ r.easiest.name }}
              <span class="dim mono">Lv{{ r.easiest.reqLevel }}</span>
            </button>
          </div>
          <button v-if="r.moreCount" class="btn btn-sm flavor-more" @click="toggle(r.id)">
            {{ expanded === r.id ? '收起' : `还有 ${r.moreCount} 张配方可做` }}
          </button>
          <div v-if="expanded === r.id" class="flavor-recipe-list">
            <button
              v-for="(rc, i) in r.recipes.slice(1)"
              :key="rc.skillId + rc.name + i"
              class="flavor-recipe"
              @click="goCraft(rc.skillId, rc.name)"
            >
              {{ rc.skillName }} · {{ rc.name }}
              <span class="dim mono">Lv{{ rc.reqLevel }}</span>
              <span class="dim mono">×{{ rc.qty }}</span>
            </button>
          </div>
        </div>
        <div v-else class="dim flavor-sub flavor-norecipe">⚠️ 现有配方中<b>没有同时使用这几味食材</b>的做法——该搭配目前无法点亮。</div>
      </div>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.flavor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.flavor-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.75;
}
.flavor-card.found {
  opacity: 1;
  border-color: var(--primary);
}
.flavor-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.flavor-icon {
  font-size: 20px;
}
.flavor-sub {
  font-size: 12px;
  line-height: 1.6;
}
.flavor-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}
/* 总览（2026-09-10 补） */
.flavor-hero {
  margin-top: 12px;
  padding: 12px 14px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.flavor-hero-left {
  text-align: center;
  min-width: 104px;
}
.flavor-hero-num {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--accent, #d95a38);
}
.flavor-hero-max {
  font-size: 14px;
  font-weight: 400;
}
.flavor-hero-label {
  font-size: 12px;
}
.flavor-hero-right {
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
.flavor-hero-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.flavor-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
/* 奖励预览 + 在哪做（2026-09-10 补） */
.flavor-reward {
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.flavor-reward.got {
  opacity: 0.85;
}
.flavor-norecipe {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px dashed var(--border);
}
.flavor-where {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.flavor-where-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.flavor-recipe {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  text-align: left;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px dashed var(--border);
  background: var(--bg-soft);
  color: inherit;
  cursor: pointer;
}
.flavor-recipe:hover {
  border-style: solid;
  border-color: var(--accent, #d95a38);
  color: var(--accent, #d95a38);
}
.flavor-more {
  align-self: flex-start;
}
.flavor-recipe-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}
</style>
