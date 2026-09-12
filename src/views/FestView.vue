<script setup>
// 月度厨艺大赛 — 与赛季错峰的月度主题比赛（2026-09-06）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { getItem, ITEMS } from '../game/data/items.js'
import { festScore, festAccepts, FEST_MILESTONES, FEST_DAILY_ENTRIES, FEST_THEMES, festThemeFor } from '../game/data/cookingFest.js'
import { CATEGORY_LABEL } from '../game/data/itemDetail.js'
import { itemImage } from '../game/data/itemImage.js'
import FoldCard from '../components/FoldCard.vue'

const player = usePlayerStore()

const theme = computed(() => player.festTheme())

// ── 主题日历（2026-09-12 补）──
// 主题只取决于「年月」，所以往期与下月都能算出来（festThemeFor(YYYYMM) 按主题数取模循环）。
// cats 里混着中文大类（汤品/主菜）与物品类别 id（baking/seafood…），展示时过一遍标签表，避免露出英文 id。
const monthCalendar = computed(() => {
  const cur = player.festState().month // YYYYMM
  const y0 = Math.floor(cur / 100)
  const m0 = cur % 100
  const out = []
  for (let k = -3; k <= 3; k++) {
    const d = new Date(y0, m0 - 1 + k, 1)
    const key = d.getFullYear() * 100 + (d.getMonth() + 1)
    out.push({
      key,
      label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`,
      theme: festThemeFor(key),
      offset: k,
      isCur: k === 0,
    })
  }
  return out
})
function catText(cats) {
  if (!cats?.length || cats[0] === 'any') return '任何料理'
  return cats.map((c) => CATEGORY_LABEL[c] ?? c).join(' / ')
}
const state = computed(() => player.festState())

// 背包中可参赛料理（type=food 且符合当月主题），按得分预估排序
const candidates = computed(() =>
  Object.entries(player.inventory)
    .filter(([id, qty]) => qty > 0 && getItem(id)?.type === 'food' && festAccepts(theme.value, getItem(id)))
    .map(([id, qty]) => ({ id, qty, item: getItem(id), score: festScore(getItem(id)) }))
    .sort((a, b) => b.score - a.score)
)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🏆 月度厨艺大赛</h2>
        <p class="dim">每月一个主题 · 每日 {{ FEST_DAILY_ENTRIES }} 次参赛机会（消耗 1 件料理）· 月分里程碑领奖</p>
      </div>
      <div class="skill-head-right">
        <div class="fest-score">
          <span class="dim">本月总分</span>
          <strong class="mono">{{ state.score }}</strong>
        </div>
      </div>
    </header>


    <FoldCard
      title="🗓 主题日历（本期与前后三个月）"
      hint="主题＝年月取模 12，下个月是什么现在就知道、可提前备菜"
    >
      <div class="table-scroll">
        <table class="target-table">
          <thead>
            <tr><th>月份</th><th>主题</th><th>可提交</th><th>说明</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in monthCalendar" :key="m.key" :class="{ selected: m.isCur }">
              <td class="mono">{{ m.label }}<span v-if="m.isCur" class="badge badge-on" style="margin-left: 4px">本月</span><span v-else-if="m.offset < 0" class="dim" style="margin-left: 4px">已过</span></td>
              <td>{{ m.theme.name }}</td>
              <td class="dim">{{ catText(m.theme.cats) }}</td>
              <td class="dim">{{ m.theme.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="dim" style="margin: 8px 0 0; font-size: 12px; line-height: 1.6">
        主题 = <b>年月对 {{ FEST_THEMES.length }} 取模</b>，所以顺序固定、可以预知：下个月是什么主题，现在就能按它的「可提交」范围先把菜备好。
        每月 1 号自动切换并重置月分与里程碑（已领的不会退回）。
      </p>
    </FoldCard>
    <div class="card">
      <h3>🎪 本月主题：{{ theme.name }}</h3>
      <p class="dim">{{ theme.desc }}</p>
      <div class="fest-meta">
        <span class="dim">今日已参赛 {{ state.todayEntries }}/{{ FEST_DAILY_ENTRIES }}</span>
        <span class="dim">已提交 {{ state.entries.length }} 次</span>
      </div>
    </div>

    <!-- 主题日历（2026-09-12 补）：主题按月确定性轮换，所以下个月是什么现在就知道 -->

    <div class="card">
      <h3>📅 月度里程碑</h3>
      <div class="fest-milestones">
        <div v-for="(m, i) in FEST_MILESTONES" :key="i" class="fest-ms" :class="{ got: state.rewarded.includes(i) }">
          <strong class="mono">{{ m.score }} 分</strong>
          <span class="dim">+{{ m.gold }} 金 · 神秘调料 ×{{ m.items?.mysterySpice ?? 0 }}<template v-if="m.items?.energyBiscuit"> · 能量饼干 ×1</template></span>
          <span v-if="state.rewarded.includes(i)" class="badge badge-on">已领</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>🥗 可参赛料理（符合主题，点击提交）</h3>
      <p v-if="!candidates.length" class="dim">背包中没有符合本月主题的料理——去烹饪或制作一些吧！</p>
      <div class="fest-grid">
        <div v-for="c in candidates" :key="c.id" class="fest-item" :class="{ none: player.inventory[c.id] <= 0 }">
          <img v-if="itemImage(c.id)" :src="itemImage(c.id)" class="item-img item-img-sm" @error="$event.target.style.display = 'none'" alt="" />
          <span class="fest-name">{{ c.item.name }}</span>
          <span class="dim mono">×{{ c.qty }}</span>
          <span class="dim mono">预估 {{ c.score }} 分</span>
          <button class="btn btn-sm btn-primary" :disabled="state.todayEntries >= FEST_DAILY_ENTRIES || player.inventory[c.id] <= 0" @click="player.festSubmit(c.id)">
            参赛
          </button>
        </div>
      </div>
      <p v-if="state.entries.length" class="dim fest-history">最近得分：{{ state.entries.slice(-5).reverse().map((e) => `${getItem(e.itemId)?.name ?? ''} +${e.score}`).filter(Boolean).join('、') }}</p>
    </div>
  </div>
</template>

<style scoped>
.fest-score { display: flex; flex-direction: column; align-items: flex-end; }
.fest-score .mono { font-size: 24px; color: var(--primary); }
.fest-meta { display: flex; gap: 16px; margin-top: 6px; }
.fest-milestones { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.fest-ms { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.6); border: 1px dashed rgba(217, 90, 56, 0.25); font-size: 13px; }
.fest-ms.got { border-color: var(--good); background: rgba(92, 184, 92, 0.08); }
.fest-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; margin-top: 8px; }
.fest-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(217, 90, 56, 0.18); font-size: 12px; }
.fest-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fest-history { margin-top: 8px; font-size: 12px; }
</style>
