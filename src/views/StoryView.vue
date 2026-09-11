<script setup>
// 故事与传闻（2026-09-12 从「图鉴」页抽出为独立页）— 主线章节 / 传闻 / 轶事 三块。
// 抽出原因：这三块在原页签里占了 122 行模板 + 123 行脚本，且与「图鉴」的物品浏览是两种完全不同的任务。
// 纯读取层（STORY / TALES / tales_ext + player 进度），不改动任何剧情数据；样式全部复用全局类。
import { computed, ref, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { STORY } from '../game/data/story.js'
import { TALES, QUIRK_CAT_DEFS, quirkCategoryStats } from '../game/data/tales.js'
import { SPIRITS } from '../game/data/spiritTiers.js'
import { AOJIS } from '../game/data/aojis.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'
import Pagination from '../components/Pagination.vue'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()

const RELATED = [
  { view: 'log', label: '📖 图鉴' },
  { view: 'quests', label: '📋 任务中心' },
  { view: 'achievements', label: '🏅 成就与称号' },
  { view: 'spiritStories', label: '✨ 食灵物语' },
]

/** 轶事每页条数（原为 LogView 的 QUIRK_PAGE） */
const QUIRK_PAGE = 24

// ── 以下逻辑自 LogView 原样搬来（2026-09-12）──
const talesExt = ref(null) // TALES_EXT（500 篇传闻）
const quirks = ref(null) // QUIRKS（3588 条轶事）
const quirkList = computed(() => quirks.value ?? [])
const quirkPage = ref(1)
// ── 故事（§13：线性七章，每章覆盖全部功能，需求全达标解锁下一章）──
function storyCur(kind) {
  const p = player
  switch (kind) {
    case 'totalLevel': return p.totalLevels
    case 'gather': return p.gatherLevels
    case 'craft': return p.craftLevels
    case 'support': return p.supportLevels
    case 'combatWins': return p.stats.combatWins
    case 'regions': return p.regionsUnlocked
    case 'bosses': return p.stats.bosses?.length ?? 0
    case 'gear': return Object.keys(p.collected).filter((id) => getItem(id)?.type === 'equipment').length
    case 'upgrades': return Object.values(p.upgrades ?? {}).filter((v) => v > 0).length
    case 'spirits': return SPIRITS.filter((s) => p.collected[s.id]).length
    case 'aojis': return AOJIS.filter((a) => p.collected[a.id]).length
    case 'restaurant': return p.restaurant?.level ?? 1
    case 'decor': return (p.restaurant?.decor ?? []).length
    case 'guild': return p.guild?.id ? 1 : 0
    case 'seasons': return Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length
    case 'arena': return p.stats.arena?.bestStreak ?? 0
    case 'card': return p.stats.cardBattle?.wins ?? 0
    case 'explore': return p.stats.explorations ?? 0
    case 'prestiges': return p.stats.prestiges ?? 0
    case 'signin': return p.signIn?.day ?? 0
    case 'gold': return p.stats.totalGoldEarned ?? 0
    case 'alchemy': return p.stats.alchemyCrafts ?? 0
    case 'hardcore': return p.hardcore ? 1 : 0
    case 'collection': return p.collectionPct
    default: return 0
  }
}
const storyChapters = computed(() => {
  let prevDone = true
  return STORY.map((ch) => {
    const reqs = (ch.requirements ?? []).map((r) => ({ ...r, cur: Math.min(storyCur(r.kind), r.need) }))
    const done = reqs.length > 0 && reqs.every((r) => r.cur >= r.need)
    const unlocked = prevDone
    prevDone = prevDone && done
    return { ...ch, reqs, done, unlocked }
  })
})

// 传闻轶事：按玩家进度解锁。unlock 含 param 时按具体物品/对手/动作计数（storyProgress），否则用聚合 kind（storyCur）
function storyProg(t) {
  const u = t.unlock
  // 键 = kind[:sub][:param]；含 param 时读具体进度，否则用聚合 kind
  if (u.param) {
    const key = [u.kind, u.sub, u.param].filter(Boolean).join(':')
    return player.storyProgress?.[key] ?? 0
  }
  return storyCur(u.kind)
}
function taleProgress(t) {
  return Math.min(storyProg(t), t.unlock.need)
}
function taleUnlocked(t) {
  return storyProg(t) >= t.unlock.need
}
// 故事大类切换：主线 / 传闻 / 轶事；轶事再按「大类 → 子子类（技能）」两级切换
const storyCat = ref('main')
const quirkCat = ref('gather')
const quirkSub = ref('foraging')
const allTales = computed(() => [...TALES, ...(talesExt.value ?? [])])
// 传闻解锁计数（500 条过滤一次缓存；模板按钮/标题不再内联全量 filter）
const talesUnlocked = computed(() => allTales.value.filter(taleUnlocked).length)
// 传闻按「系列」分组展示（同系列在一起），组头带解锁计数
const talesBySeries = computed(() => {
  const m = new Map()
  for (const t of allTales.value) {
    const s = t.series ?? '其他'
    if (!m.has(s)) m.set(s, [])
    m.get(s).push(t)
  }
  return [...m.entries()].map(([series, tales]) => ({ series, tales, total: tales.length, unlocked: tales.filter(taleUnlocked).length }))
})
// 子子类（技能）中文名映射；缺失时回退为 sub 本身
const QUIRK_SUB_NAMES = {
  foraging: '采摘', fishing: '垂钓', hunting: '狩猎', excavation: '挖掘', farming: '农耕',
  cooking: '烹饪', baking: '烘焙', preserving: '腌制', brewing: '调酒',
  spiceMixing: '调料调配', craftsmithing: '厨具锻造',
  battle: '战斗', spirit: '食灵召唤',
  gastronomy: '美食知识', preservation: '食材保鲜', exploration: '美食探索',
}
function quirkSubName(sub) { return QUIRK_SUB_NAMES[sub] ?? sub }
// 轶事计数（QUIRKS 3588 条：按大类/子类一次性统计；模板不再内联反复 filter 全表）
const quirkCats = computed(() => quirkCategoryStats(quirkList.value, taleUnlocked))
// 当前大类下的子子类列表（按首次出现顺序，带解锁计数）
const activeQuirkSubs = computed(() => {
  const list = []
  for (const [key, s] of quirkCats.value.subMap) {
    if (key.startsWith(quirkCat.value + '|')) list.push(s)
  }
  return list
})
const quirkSubStats = computed(() => quirkCats.value.subMap.get(quirkCat.value + '|' + quirkSub.value) ?? { sub: quirkSub.value, total: 0, unlocked: 0 })
const currentQuirks = computed(() => quirkList.value.filter((q) => q.cat === quirkCat.value && q.sub === quirkSub.value))
// 切换大类时，若当前子子类不在该大类下，则回退到该大类第一个子子类
function switchQuirkCat(cat) {
  quirkCat.value = cat
  const subs = activeQuirkSubs.value
  if (!subs.some((s) => s.sub === quirkSub.value)) quirkSub.value = subs[0]?.sub ?? ''
  quirkPage.value = 1
}
function selectQuirkSub(sub) {
  quirkSub.value = sub
  quirkPage.value = 1
}
const quirkPages = computed(() => Math.max(1, Math.ceil(currentQuirks.value.length / QUIRK_PAGE)))
const quirkPaged = computed(() => {
  const p = Math.min(quirkPage.value, quirkPages.value)
  const arr = currentQuirks.value.slice((p - 1) * QUIRK_PAGE, p * QUIRK_PAGE)
  while (arr.length < QUIRK_PAGE) arr.push({ _pad: true })
  return arr
})
// 传闻：系列快速跳转
function scrollToTalesSeries(series) {
  const el = document.getElementById('tales-series-' + series)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  // 传闻/轶事文案 chunk 按需加载（2026-09-06 拆包）：只有进这个页面才拉 tales_ext
  import('../game/data/tales_ext.js').then((m) => {
    talesExt.value = m.TALES_EXT
    quirks.value = m.QUIRKS
  }).catch(() => {})
})
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📜 故事与传闻</h2>
        <p class="dim">
          三个层次：<b>主线章节</b>（八章，每章需求全达标才解锁下一章）、<b>传闻</b>（按系列分组，随进度解锁）、
          <b>轶事</b>（3588 条，按大类 → 子类两级浏览）。全部按你的专属进度解锁，只读展示，不影响任何数值。
        </p>
      </div>
    </header>

    <div class="card">
    <p class="dim" style="margin: 8px 0">太古厨神封印饕餮之影，二十八星坠散落大陆——主线章节覆盖全部功能，传闻与轶事按你的专属进度逐步解锁</p>
    <div class="region-tabs" style="margin-bottom: 10px">
      <button class="btn btn-sm" :class="{ 'btn-primary': storyCat === 'main' }" @click="storyCat = 'main'">主线</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': storyCat === 'tales' }" @click="storyCat = 'tales'">传闻（{{ talesUnlocked }}/{{ allTales.length }}）</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': storyCat === 'quirks' }" @click="storyCat = 'quirks'">轶事（{{ quirkCats.defs.reduce((s, c) => s + c.unlocked, 0) }}/{{ quirkList.length }}）</button>
    </div>

    <!-- 主线章节 -->
    <template v-if="storyCat === 'main'">
      <div
      v-for="(ch, ci) in storyChapters"
      :key="ci"
      v-tilt:small
      class="gather-card story-chapter"
      :class="{ locked: !ch.unlocked }"
      style="margin-bottom: 10px"
    >
        <h3>
          {{ ch.icon }} {{ ch.chapter }}
          <span v-if="ch.done" class="badge" style="background: var(--good-soft); color: var(--good-strong)">✔ 已通过</span>
          <span v-else-if="ch.unlocked" class="badge badge-on">进行中</span>
          <span v-else class="badge" style="background: var(--lock-bg); color: var(--muted)">未解锁</span>
        </h3>
        <div v-if="ch.unlocked" class="story-reqs">
          <div v-for="r in ch.reqs" :key="r.kind" class="story-req-row">
            <span class="dim story-req-label">{{ r.label }}</span>
            <ProgressBar :progress="r.cur / r.need" />
            <span class="mono dim story-req-num">{{ r.cur }}/{{ r.need }}</span>
            <span v-if="r.cur >= r.need" class="badge" style="background: var(--good-soft); color: var(--good-strong); font-size: 12px">✔</span>
          </div>
          <p class="dim story-lock-note" style="margin-top: 4px">全部达标后通过本章 → 解锁下一章</p>
        </div>
        <template v-if="ch.unlocked">
          <div v-for="(part, pi) in ch.parts" :key="pi" class="story-part">
            <h4>{{ part.title }}</h4>
            <p class="story-body">{{ part.body }}</p>
          </div>
        </template>
        <p v-else class="dim story-lock-note">🔒 完成上一章全部需求后解锁此章。</p>
      </div>
      <div class="card placeholder"><p class="dim">传说终成现实：你，就是新一代厨神。</p></div>
    </template>

    <!-- 传闻 → 按「系列」分组 -->
    <template v-else-if="storyCat === 'tales'">
      <h3 style="margin-top: 14px">传闻：{{ talesUnlocked }}/{{ allTales.length }}</h3>
      <!-- 分类快速跳转：按系列定位 -->
      <div class="quick-nav" style="margin: 8px 0 4px">
        <span class="dim" style="font-size: 12px">系列跳转：</span>
        <button v-for="group in talesBySeries" :key="group.series" class="btn btn-sm" @click="scrollToTalesSeries(group.series)">{{ group.series }}</button>
      </div>
      <template v-for="group in talesBySeries" :key="group.series">
        <h4 :id="'tales-series-' + group.series" style="margin-top: 14px; margin-bottom: 6px; color: var(--accent, #d95a38)">{{ group.series }} · {{ group.unlocked }}/{{ group.total }}</h4>
        <div class="gather-grid">
          <div
            v-for="t in group.tales"
            :key="t.id"
            v-tilt
            class="gather-card"
            style="opacity: 1"
          >
            <div class="gather-card-head"><strong>{{ t.title }}</strong></div>
            <div class="gather-card-row"><span>进度</span><span class="dim mono">{{ taleProgress(t) }}/{{ t.unlock.need }}</span></div>
            <div v-if="!taleUnlocked(t)" class="gather-card-need">{{ t.unlock.needText }}</div>
            <ProgressBar :progress="taleProgress(t) / t.unlock.need" />
            <div v-if="taleUnlocked(t)" class="dim" style="font-size: 12px">{{ t.body }}</div>
            <div v-else-if="t.unlock.flavor" class="dim" style="font-size: 12px">{{ t.unlock.flavor }}</div>
          </div>
        </div>
      </template>
    </template>

    <!-- 轶事 → 大类（采集/制作/对决/辅助）→ 子子类（技能/战斗/食灵…）两级 -->
    <template v-else>
      <p v-if="!quirks" class="dim" style="margin: 10px 0">轶事文案加载中……</p>
      <div class="region-tabs" style="margin-bottom: 10px">
        <button
          v-for="c in quirkCats.defs"
          :key="c.id"
          class="btn btn-sm"
          :class="{ 'btn-primary': quirkCat === c.id }"
          @click="switchQuirkCat(c.id)"
        >
          {{ c.icon }} {{ c.name }}（{{ c.unlocked }}/{{ c.total }}）
        </button>
      </div>
      <!-- 当前大类的子子类（技能）切换条 -->
      <div v-if="activeQuirkSubs.length" class="region-tabs" style="margin-bottom: 10px">
        <button
          v-for="s in activeQuirkSubs"
          :key="s.sub"
          class="btn btn-sm"
          :class="{ 'btn-primary': quirkSub === s.sub }"
          @click="selectQuirkSub(s.sub)"
        >
          {{ quirkSubName(s.sub) }}（{{ s.unlocked }}/{{ s.total }}）
        </button>
      </div>
      <h3 style="margin-top: 8px">{{ QUIRK_CAT_DEFS.find((c) => c.id === quirkCat)?.name }}·{{ quirkSubName(quirkSub) }}轶事：{{ quirkSubStats.unlocked }}/{{ quirkSubStats.total }}</h3>
      <div v-if="currentQuirks.length" class="gather-grid grid-n-6">
        <template v-for="(q, qi) in quirkPaged" :key="q.id ?? 'pad-' + qi">
        <div
          v-if="!q._pad"
          v-tilt
          class="gather-card"
          style="opacity: 1"
        >
          <div class="gather-card-head"><strong>{{ q.subtitle }}</strong></div>
          <div class="gather-card-row"><span>进度</span><span class="dim mono">{{ taleProgress(q) }}/{{ q.unlock.need }}</span></div>
          <div v-if="!taleUnlocked(q)" class="gather-card-need">{{ q.unlock.needText }}</div>
          <ProgressBar :progress="taleProgress(q) / q.unlock.need" />
          <div v-if="taleUnlocked(q)" class="dim" style="font-size: 12px">{{ q.body }}</div>
          <div v-else-if="q.unlock.flavor" class="dim" style="font-size: 12px">{{ q.unlock.flavor }}</div>
        </div>
        <div v-else class="pager-spacer"></div>
        </template>
      </div>
      <Pagination v-if="currentQuirks.length > QUIRK_PAGE" :current="Math.min(quirkPage, quirkPages)" :pages="quirkPages" @update:current="(p) => quirkPage = p" />
      <div v-else class="card placeholder"><p class="dim">该大类轶事制作中，敬请期待。</p></div>
    </template>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>
