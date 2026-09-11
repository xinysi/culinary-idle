<script setup>
// 今日待办（2026-09-11 新增）— 把散落在十几个页面里的「每日/每周该做的事」聚成一页。
//
// 为什么需要它：全项目有 15 处「每日闸门」（每日任务/签到/天气/吉祥物/厨友/宴会/外卖/供应商/
// 常客/交易所/地窖/采集队/评论家/大赛/赛季…），它们分别住在 12 个页面里，而右栏「快捷状态」
// 只覆盖 4 项——「入口在顶栏、提示在左栏」的错位让玩家每上线都要挨个翻页面。
//
// 本页**零新增存档字段**：全部是对既有 player 状态/接口的只读汇总，点了只是把你送到那一页。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { FEST_DAILY_ENTRIES } from '../game/data/cookingFest.js'
import { EXCHANGE_DAILY_LIMIT } from '../game/data/exchange.js'
import { activeMarketEvents } from '../game/data/marketEvents.js'
import { getItem } from '../game/data/items.js'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'quests', label: '📋 任务中心' },
  { view: 'mail', label: '📬 信箱' },
  { view: 'market', label: '💹 行情' },
  { view: 'logs', label: '🗂 系统日志' },
]

const go = (view) => () => ui.setView(view)
const minutesText = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分`
}

/** 到货/到期类：地窖、采集队 —— 返回就绪个数与最近一个的剩余时间 */
const cellar = computed(() => {
  if (!player.cellarUnlocked()) return null
  const now = Date.now()
  const slots = player.cellarState().slots ?? []
  const used = slots.filter(Boolean)
  const ready = used.filter((s) => now >= s.readyAt).length
  const soonest = used.filter((s) => now < s.readyAt).reduce((a, s) => Math.min(a, s.readyAt - now), Infinity)
  return { total: slots.length, used: used.length, ready, soonest: Number.isFinite(soonest) ? soonest : null }
})
const expedition = computed(() => {
  if (!player.expeditionUnlocked()) return null
  const now = Date.now()
  let used = 0
  let ready = 0
  let soonest = Infinity
  for (const line of Object.values(player.expeditions ?? {})) {
    for (const s of line?.slots ?? []) {
      if (!s) continue
      used++
      if (now >= s.readyAt) ready++
      else soonest = Math.min(soonest, s.readyAt - now)
    }
  }
  return { used, ready, soonest: Number.isFinite(soonest) ? soonest : null }
})

const rows = computed(() => {
  const out = []
  const push = (r) => out.push(r)
  const d = player.daily ?? { tasks: [] }
  const w = player.weekly ?? {}

  // ── A. 现在就能领（做完没领的）──
  const dailyReady = (d.tasks ?? []).filter((t) => !t.claimed && (t.progress ?? 0) >= t.qty).length
  if (dailyReady) push({ tone: 'claim', icon: '📅', name: '每日任务', desc: `${dailyReady} 项已完成待领取（全清还有每日礼包）`, cta: '去领取', go: go('quests') })
  if (w.task && !w.claimed && w.progress >= w.task.qty) push({ tone: 'claim', icon: '🏆', name: '周常任务', desc: '已达标，可领取', cta: '去领取', go: go('quests') })
  const cd = player.challengeDef()
  if (cd && !player.challenge.done && player.challenge.progress >= cd.target) push({ tone: 'claim', icon: '⚔️', name: '每周挑战', desc: '已达标，可领取', cta: '去领取', go: go('quests') })
  const mailN = player.mailUnclaimedCount()
  if (mailN) push({ tone: 'claim', icon: '📬', name: '信箱待领', desc: `${mailN} 封带着附件（溢出转存 / 奖励到账）`, cta: '去领取', go: go('mail') })
  const storyN = player.spiritStoryPending()
  if (storyN) push({ tone: 'claim', icon: '✨', name: '食灵物语', desc: `${storyN} 段可领取`, cta: '去领取', go: go('spiritStories') })
  const banquetN = player.banquetReady()
  if (banquetN) push({ tone: 'claim', icon: '🍽', name: '宴会承办', desc: `备齐了 ${banquetN} 道，可交付`, cta: '去交付', go: go('banquet') })
  const schoolReady = (player.schoolReadyList()).length
  if (schoolReady) push({ tone: 'claim', icon: '📜', name: '菜系研究', desc: `${schoolReady} 个学派研究完成待收`, cta: '去收取', go: go('schools') })
  const giftReady = player.regularGiftReadyCount()
  if (giftReady) push({ tone: 'claim', icon: '📖', name: '常客满级礼', desc: `${giftReady} 位常客的满级礼物未领`, cta: '去领取', go: go('regulars') })
  const seasonReady = player.seasonClaimableCount()
  if (seasonReady) push({ tone: 'claim', icon: '🎪', name: '赛季档位', desc: `${seasonReady} 档点数已够，可领`, cta: '去领取', go: go('season') })
  if (player.rivalBoard && !player.rivals?.claimed) push({ tone: 'claim', icon: '🏪', name: '同业榜月奖', desc: `本月名次 #${player.rivalBoard().rank}，奖励未领`, cta: '去领取', go: go('rivals') })

  // ── B. 今日还没做 ──
  if (player.canSignInToday()) push({ tone: 'todo', icon: '🎁', name: '每日签到', desc: '今天的签到还没做', cta: '去签到', go: () => ui.toggleSignIn(true) })
  if (player.mascotState().active && !player.mascotPettedToday()) push({ tone: 'todo', icon: '🍀', name: '吉祥物', desc: '今天还没蹭过（每天一次）', cta: '去蹭一蹭', go: go('mascot') })
  const visitable = player.friendsVisitableCount()
  if (visitable) push({ tone: 'todo', icon: '🤝', name: '厨友拜访', desc: `${visitable} 位今天还没拜访（可一键串门）`, cta: '去拜访', go: go('friends') })
  const fest = player.festState()
  if (fest.todayEntries < FEST_DAILY_ENTRIES) push({ tone: 'todo', icon: '🏆', name: '厨艺大赛', desc: `今日还可参赛 ${FEST_DAILY_ENTRIES - fest.todayEntries}/${FEST_DAILY_ENTRIES} 次`, cta: '去参赛', go: go('fest') })
  if (player.exchangeUnlocked()) {
    const traded = Object.values(player.exchange?.traded ?? {}).reduce((a, n) => a + (n ?? 0), 0)
    const left = Math.max(0, EXCHANGE_DAILY_LIMIT - traded)
    if (left > 0) push({ tone: 'todo', icon: '💹', name: '交易所额度', desc: `今日还剩 ${left} 件成交额度（市价每 4 小时轮换）`, cta: '去看行情', go: go('exchange') })
  }

  // ── C. 到货与到期（有计时的）──
  if (cellar.value?.ready) push({ tone: 'ready', icon: '🍶', name: '地窖出窖', desc: `${cellar.value.ready} 个槽位已到年份`, cta: '去出窖', go: go('cellar') })
  else if (cellar.value?.used && cellar.value.soonest) push({ tone: 'wait', icon: '🍶', name: '地窖陈酿中', desc: `最近一槽还要 ${minutesText(cellar.value.soonest)}`, cta: '去看看', go: go('cellar') })
  if (expedition.value?.ready) push({ tone: 'ready', icon: '🚢', name: '采集队归来', desc: `${expedition.value.ready} 个槽位已到点`, cta: '去收取', go: go('expedition') })
  else if (expedition.value?.used && expedition.value.soonest) push({ tone: 'wait', icon: '🚢', name: '采集队在外', desc: `最近一队还要 ${minutesText(expedition.value.soonest)}`, cta: '去看看', go: go('expedition') })
  const critic = player.criticState().order
  if (critic) {
    const remain = Math.max(0, critic.expireAt - Date.now())
    push({ tone: remain < 10 * 60_000 ? 'claim' : 'ready', icon: '📝', name: '美食评论家到访', desc: `要一份 tier ≥ ${critic.minTier} 的${critic.category} · 还剩 ${minutesText(remain)}`, cta: '去提交', go: go('restaurant') })
  }

  // ── D. 本周（周度重置）──
  if (!player.chefClearedThisWeek()) push({ tone: 'week', icon: '🃏', name: '名厨挑战', desc: `本周还没战胜 ${player.chefOfWeek().name}`, cta: '去挑战', go: go('chefChallenge') })
  if (player.gearContestUnlocked() && !player.gearContestDoneThisWeek()) push({ tone: 'week', icon: '⚒️', name: '厨具大赛', desc: '本周还没用装备参赛', cta: '去参赛', go: go('gearContest') })
  if (player.guild?.id) {
    const tasks = player.guildTasks()
    const undone = tasks.filter((t) => (player.guild.taskProgress?.[t.id] ?? 0) < t.qty).length
    if (undone) push({ tone: 'week', icon: '🤝', name: '公会任务', desc: `${undone} 项今日未完成（完成即自动到账）`, cta: '去做任务', go: go('guild') })
  }

  // ── E. 今日信息（纯提示，不算待办）──
  const evs = activeMarketEvents()
  if (evs.length) push({ tone: 'info', icon: '💹', name: '限时窗口进行中', desc: evs.map((e) => `${e.icon}${e.name}（${e.desc}）`).join('、'), cta: '看排班', go: go('market') })
  const lucky = getItem(player.todayFortune().luckyItem)
  push({ tone: 'info', icon: '🌤', name: `今日天气：${player.todayWeather().name}`, desc: lucky ? `幸运食材「${lucky.name}」采集产量 +20%` : '查看今日加成与宜做建议', cta: '看运势', go: go('weather') })

  return out
})

const claimCount = computed(() => rows.value.filter((r) => r.tone === 'claim').length)
const todoCount = computed(() => rows.value.filter((r) => r.tone === 'todo' || r.tone === 'ready').length)
const TONE_LABEL = { claim: '可领取', todo: '今日待做', ready: '已就绪', wait: '等待中', week: '本周', info: '今日信息' }
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📌 今日待办</h2>
        <p class="dim">
          把散在各个页面里的<b>每日 / 每周该做的事</b>汇成一页：能领的先领、今天还没做的排前面、
          有计时的给出剩余时间。点每条的按钮直达对应页面，<b>不会替你执行任何操作</b>。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ rows.length }} 条</div>
        <p class="dim mono">可领 {{ claimCount }} · 待做 {{ todoCount }}</p>
      </div>
    </header>

    <!-- 汇总 -->
    <div class="card td-hero">
      <div class="td-stat"><span class="dim">可领取</span><b class="mono" :class="{ 'td-hot': claimCount > 0 }">{{ claimCount }}</b></div>
      <div class="td-stat"><span class="dim">今日待做</span><b class="mono">{{ todoCount }}</b></div>
      <div class="td-stat"><span class="dim">本周待办</span><b class="mono">{{ rows.filter((r) => r.tone === 'week').length }}</b></div>
      <div class="td-stat"><span class="dim">今日信息</span><b class="mono">{{ rows.filter((r) => r.tone === 'info').length }}</b></div>
      <button class="btn btn-sm btn-primary td-hero-btn" :disabled="!claimCount" @click="ui.setView('quests')">
        {{ claimCount ? '先去处理可领取' : '暂无待领' }}
      </button>
    </div>

    <!-- 清单 -->
    <div class="card td-card">
      <div v-if="rows.length" class="td-list">
        <div v-for="(r, i) in rows" :key="r.name + i" class="td-row" :class="'td-' + r.tone">
          <span class="td-icon">{{ r.icon }}</span>
          <span class="td-body">
            <span class="td-name">
              {{ r.name }}
              <span v-if="r.tone === 'claim'" class="badge badge-on">可领取</span>
            </span>
            <span class="dim td-desc">{{ r.desc }}</span>
          </span>
          <span class="dim td-tone">{{ TONE_LABEL[r.tone] }}</span>
          <button class="btn btn-sm" :class="{ 'btn-primary': r.tone === 'claim' || r.tone === 'todo' }" @click="r.go()">{{ r.cta }} ↗</button>
        </div>
      </div>
      <p v-else class="dim td-empty">今天没有待办事项——挂机去吧，产出会替你攒着。</p>
      <p class="dim td-note">
        「等待中」的条目只显示最近一个的剩余时间；跨天或跨周后这里的清单会自动刷新。
        本页只是<b>汇总与跳转</b>，领取/交付等操作仍在各自页面完成。
      </p>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.td-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}
.td-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.td-stat b {
  font-size: 16px;
}
.td-hot {
  color: var(--accent, #d95a38);
}
.td-hero-btn {
  margin-left: auto;
}
.td-card {
  margin-top: 12px;
}
.td-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.td-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 64px 116px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.td-row.td-claim {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.td-row.td-info {
  opacity: 0.82;
}
.td-icon {
  font-size: 16px;
  text-align: center;
}
.td-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.td-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.td-desc {
  font-size: 12px;
  line-height: 1.5;
}
.td-tone {
  font-size: 11px;
  text-align: center;
}
.td-empty {
  font-size: 13px;
  padding: 6px 0;
}
.td-note {
  font-size: 12px;
  line-height: 1.7;
  margin-top: 10px;
}
@media (max-width: 720px) {
  .td-row {
    grid-template-columns: 22px minmax(0, 1fr) 108px;
  }
  .td-tone {
    display: none;
  }
}
</style>
