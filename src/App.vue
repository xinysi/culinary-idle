<script setup>
// 三栏布局 — 需求文档 §9.1：顶部功能导航 + 左侧技能导航 + 中央主区域 + 右侧面板
// 视图懒加载（defineAsyncComponent）：代码分割，减小主包体积
import { onMounted, onUnmounted, computed, ref, defineAsyncComponent, watch, nextTick } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import Sidebar from './components/Sidebar.vue'
import StatusPanel from './components/StatusPanel.vue'
import SavePanel from './components/SavePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import InventoryModal from './components/InventoryModal.vue'
import EquipmentModal from './components/EquipmentModal.vue'
import SignInModal from './components/SignInModal.vue'
import SearchModal from './components/SearchModal.vue'
import EncounterModal from './components/EncounterModal.vue'
import NewbieGuide from './components/NewbieGuide.vue'
import OfflineReportModal from './components/OfflineReportModal.vue'
import ShareCardModal from './components/ShareCardModal.vue'
import MarketEventsModal from './components/MarketEventsModal.vue'
import { useUiStore } from './stores/ui.js'
import { usePlayerStore } from './stores/player.js'
import { getItem } from './game/data/items.js'
import { EventBus } from './game/core/EventBus.js'
import { sfx } from './game/core/sound.js'
import { getSeason, activeSeasonId } from './game/data/seasons.js'

const SkillView = defineAsyncComponent(() => import('./views/SkillView.vue'))
const ShopView = defineAsyncComponent(() => import('./views/ShopView.vue'))
const ZhenXiuView = defineAsyncComponent(() => import('./views/ZhenXiuView.vue'))
const StatsView = defineAsyncComponent(() => import('./views/StatsView.vue'))
const AlchemyView = defineAsyncComponent(() => import('./views/AlchemyView.vue'))
const LogView = defineAsyncComponent(() => import('./views/LogView.vue'))
const RestaurantView = defineAsyncComponent(() => import('./views/RestaurantView.vue'))
const GuildView = defineAsyncComponent(() => import('./views/GuildView.vue'))
const SeasonView = defineAsyncComponent(() => import('./views/SeasonView.vue'))
const ArenaView = defineAsyncComponent(() => import('./views/ArenaView.vue'))
const GuideView = defineAsyncComponent(() => import('./views/GuideView.vue'))
const TowerView = defineAsyncComponent(() => import('./views/TowerView.vue'))
const FestView = defineAsyncComponent(() => import('./views/FestView.vue'))

const ui = useUiStore()
const player = usePlayerStore()

// 底部状态条：装备槽位名称（与右侧状态栏一致）
const SLOT_NAMES = {
  weapon: '武器', helmet: '头盔', body: '身体', legs: '腿部',
  boots: '脚部', offhand: '副手', amulet: '饰品1', ring: '饰品2',
}

// 红点提醒（§13）：签到可签 / 赛季有可领奖励
const signInDot = computed(() => player.canSignInToday())
const seasonDot = computed(() => {
  const se = getSeason(activeSeasonId())
  const st = player.seasonState()
  if (!se || !st) return false
  return (se.tiers ?? []).some((t, i) => !st.claimed.includes(i) && st.points >= t.points)
})
// 限时窗口活动（2026-09-06）：单活动显示徽章；多个同时命中聚合为「⏰ 活动 ×N」（点击查看时间表）
const marketSummary = computed(() => {
  const evs = player.activeMarketEvents?.() ?? []
  if (!evs.length) return null
  if (evs.length === 1) {
    const e = evs[0]
    return { label: `${e.icon} ${e.name} ×${Object.values(e.effect)[0]}`, title: `${e.desc}（点击查看全活动轮换时间表）` }
  }
  return {
    label: `⏰ 活动 ×${evs.length}`,
    title: `进行中：${evs.map((e) => `${e.icon}${e.name}（${e.desc}）`).join('、')}（点击查看时间表）`,
  }
})

// ── 顶部导航分页（2026-09-06）：主功能按钮分 3 页，翻页浏览；右侧功能组固定 ──
// 每页按钮：{ label, view, onClick, dot? }；view 用于激活高亮与自动跳页
const TOP_PAGES = [
  [
    { label: '🏮餐厅', view: 'restaurant', onClick: () => ui.setView('restaurant') },
    { label: '🤝公会', view: 'guild', onClick: () => ui.setView('guild') },
    { label: '🎪赛季', view: 'season', onClick: () => ui.setView('season'), dot: () => seasonDot.value },
    { label: '⚔️竞技场', view: 'arena', onClick: () => ui.setView('arena') },
    { label: '🗼试炼塔', view: 'tower', onClick: () => ui.setView('tower'), dot: () => player.combatLevel >= 99 && (player.tower?.best ?? 0) === 0 },
    { label: '🏆大赛', view: 'fest', onClick: () => ui.setView('fest'), dot: () => (player.fest?.todayEntries ?? 0) === 0 && (player.fest?.score ?? 0) < 1000 },
  ],
  [
    { label: '🛒商店', view: 'shop', onClick: () => ui.setView('shop') },
    { label: '🍽️珍馐阁', view: 'deluxe', onClick: () => ui.setView('deluxe') },
    { label: '🧪炼金', view: 'alchemy', onClick: () => ui.setView('alchemy') },
  ],
  [
    { label: '📊统计', view: 'stats', onClick: () => ui.setView('stats') },
    { label: '📖图鉴', view: 'log', onClick: () => ui.openLogTab('log') },
    { label: '🗺️攻略', view: 'guide', onClick: () => ui.setView('guide') },
  ],
]
function navPage(dir) {
  const n = TOP_PAGES.length
  ui.setTopNavPage((ui.topNavPage + dir + n) % n)
}
// 切视图自动跳到所在页（用户从右栏/弹窗跳转时也能看到对应按钮）
watch(
  () => ui.activeView,
  (v) => {
    const idx = TOP_PAGES.findIndex((p) => p.some((i) => i.view === v))
    if (idx >= 0 && ui.topNavPage !== idx) ui.setTopNavPage(idx)
  },
)

// 界面缩放（§10.2.3 uiScale）：启动/读档后应用
function applyUiScale() {
  const v = player.settings?.uiScale ?? 1
  document.documentElement.style.zoom = v === 1 ? '' : String(v)
}
// 深色主题（2026-09-06）：<html data-theme="dark"> 驱动 CSS 覆写
function applyTheme() {
  const t = player.settings?.theme === 'dark' ? 'dark' : ''
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
}
onMounted(() => {
  applyUiScale()
  applyTheme()
  // 跨午夜刷新「当天日期」，让签到能签到/红点自动点亮（每分钟核对一次，日期变化才触发重算）
  const t = setInterval(() => { player.refreshToday() }, 60_000)
  refreshTodayTimer = t
})
onUnmounted(() => { clearInterval(refreshTodayTimer) })
// 主题切换实时生效（设置面板修改 settings.theme）
watch(() => player.settings?.theme, () => applyTheme())

// 跨午夜刷新定时器句柄
let refreshTodayTimer = null

// 进入游戏主界面后初始化"回到顶部"按钮显示状态（main-scroll 此时才渲染）
watch(
  () => ui.phase,
  () => nextTick(onMainScroll),
  { immediate: true }
)

// ── 一键回到顶部（主区域右下角）──
const mainScroll = ref(null)
const showTopBtn = ref(false)
function onMainScroll() {
  showTopBtn.value = (mainScroll.value?.scrollTop ?? 0) > 300
}
function scrollTop() {
  mainScroll.value?.scrollTo({ top: 0, behavior: 'smooth' })
}
// 音效桥接（模块级去重）：事件 → 声音，受 settings.soundEnabled 控制
let soundBridgeRegistered = false
onMounted(() => {
  if (soundBridgeRegistered) return
  soundBridgeRegistered = true
  const on = () => player.settings.soundEnabled
  // 全局按钮点击轻音（事件委托；音量低，不压过动作音效）
  document.addEventListener('click', (e) => {
    if (on() && e.target?.closest?.('button')) sfx.click()
  }, true)
  EventBus.on('skill:action', (e) => {
    if (!on()) return
    if (e.outcome === 'craft') sfx.craft()
    else if (e.outcome === 'craftfail') sfx.craftFail()
    else if (e.outcome === 'harvest' || e.outcome === 'rare') sfx.collect()
    else if (e.outcome === 'explore') sfx.collect()
    else if (e.outcome === 'explorefail') sfx.warn()
    else if (e.outcome === 'plant' || e.outcome === 'fertilize') sfx.click()
  })
  EventBus.on('player:levelup', () => on() && sfx.levelup())
  EventBus.on('quest:complete', () => on() && sfx.win())
  EventBus.on('combat:start', () => on() && sfx.collect())
  EventBus.on('combat:end', ({ result }) => { if (on()) (result === 'win' ? sfx.win() : sfx.lose()) })
  EventBus.on('arena:reward', () => on() && sfx.reward())
  EventBus.on('achievement:unlock', () => on() && sfx.reward())
  EventBus.on('guild:task', () => on() && sfx.reward())
  EventBus.on('season:claim', () => on() && sfx.reward())
  EventBus.on('restaurant:upgrade', () => on() && sfx.levelup())
  // 日活/长线系统奖励音效（2026-09-06）
  EventBus.on('daily:claim', () => on() && sfx.reward())
  EventBus.on('daily:bonus', () => on() && sfx.reward())
  EventBus.on('weekly:claim', () => on() && sfx.reward())
  EventBus.on('tower:milestone', () => on() && sfx.reward())
  EventBus.on('fest:submit', () => on() && sfx.collect())
  EventBus.on('fest:milestone', () => on() && sfx.reward())
  EventBus.on('set:bonus', () => on() && sfx.reward())
  EventBus.on('skill:outofammo', () => on() && sfx.warn())
  EventBus.on('inventory:full', () => on() && sfx.warn())
  EventBus.on('bank:full', () => on() && sfx.warn())
  EventBus.on('spoilage:spoil', () => on() && sfx.warn())
})
</script>

<template>
  <!-- 启动界面：显示背景图 + 开始游戏（选存档后进入游戏主界面） -->
  <SplashScreen v-if="ui.phase === 'splash'" />

  <!-- 游戏主界面（三栏） -->
  <div v-else class="app-layout">
    <!-- 三栏主体 -->
    <div class="app-body">
      <Sidebar class="app-sidebar" />
      <main class="app-main">
        <!-- 顶部功能导航：主功能按页翻页（左对齐弹性区），翻页控件+功能组固定贴右不动 -->
        <nav class="top-nav">
          <template v-for="item in TOP_PAGES[ui.topNavPage]" :key="item.view">
            <button class="top-nav-btn" :class="{ active: ui.activeView === item.view, 'has-dot': !!item.dot, 'dot-on': item.dot?.() }" @click="item.onClick()">
              {{ item.label }}
            </button>
          </template>
          <span class="top-nav-spacer"></span>
          <div class="top-nav-right">
            <button
              v-if="marketSummary"
              class="top-nav-market"
              :title="marketSummary.title"
              @click="ui.showMarketModal = true"
            >{{ marketSummary.label }}</button>
            <button class="top-nav-market top-nav-market-all" title="查看限时活动轮换时间表" @click="ui.showMarketModal = true">⏰</button>
            <button class="top-nav-btn top-nav-pager" title="上一页" @click="navPage(-1)">‹</button>
            <span class="top-nav-pagenum mono">{{ ui.topNavPage + 1 }}/{{ TOP_PAGES.length }}</span>
            <button class="top-nav-btn top-nav-pager" title="下一页" @click="navPage(1)">›</button>
            <span class="top-nav-sep"></span>
            <button class="top-nav-btn has-dot" :class="{ 'dot-on': signInDot }" @click="ui.toggleSignIn(true)">🎁签到</button>
            <button class="top-nav-btn" @click="ui.toggleSearch(true)">🔍搜索</button>
            <button class="top-nav-btn" @click="ui.toggleBagModal(true, 'bag')">🧺厨藏</button>
            <button class="top-nav-btn" @click="ui.toggleEquipModal(true)">⚔️装备</button>
            <span class="top-nav-sep"></span>
            <button class="top-nav-btn" @click="ui.toggleSettingsPanel(true)">⚙️设置</button>
            <button class="top-nav-btn" @click="ui.toggleSavePanel(true)">💾存档</button>
          </div>
        </nav>

        <!-- 内容滚动区（独立滚动，导航不跟随）；新手引导横幅位于滚动区顶部 -->
        <div ref="mainScroll" @scroll="onMainScroll" class="main-scroll">
          <NewbieGuide />
          <ShopView v-if="ui.activeView === 'shop'" />
          <ZhenXiuView v-else-if="ui.activeView === 'deluxe'" />
          <AlchemyView v-else-if="ui.activeView === 'alchemy'" />
          <StatsView v-else-if="ui.activeView === 'stats'" />
          <LogView v-else-if="ui.activeView === 'log'" />
          <RestaurantView v-else-if="ui.activeView === 'restaurant'" />
          <GuildView v-else-if="ui.activeView === 'guild'" />
          <SeasonView v-else-if="ui.activeView === 'season'" />
          <ArenaView v-else-if="ui.activeView === 'arena'" />
          <TowerView v-else-if="ui.activeView === 'tower'" />
          <FestView v-else-if="ui.activeView === 'fest'" />
          <GuideView v-else-if="ui.activeView === 'guide'" />
          <SkillView v-else />
        </div>

        <!-- 中间底部状态条：左「角色状态」| 虚线 | 右「装备」 -->
        <nav class="bottom-nav">
          <div class="bottom-nav-col">
            <div class="bottom-nav-stats">
              <div class="bottom-nav-stat"><span class="dim">品鉴力 / 生命</span><span class="mono">{{ player.maxHp }}</span></div>
              <div class="bottom-nav-stat"><span class="dim">品鉴点数</span><span class="mono">{{ Math.floor(player.tastePoints) }}</span></div>
              <div class="bottom-nav-stat"><span class="dim">调味能量</span><span class="mono">{{ player.combat.flavorEnergy }}</span></div>
              <div class="bottom-nav-stat"><span class="dim">金币</span><span class="mono gold">{{ player.gold.toLocaleString() }}</span></div>
            </div>
          </div>
          <div class="bottom-nav-sep"></div>
          <div class="bottom-nav-col">
            <div class="bottom-nav-grid">
              <div v-for="(itemId, slot) in player.equipment" :key="slot" class="bottom-nav-slot">
                <span class="dim">{{ SLOT_NAMES[slot] }}</span>
                <span :class="{ dim: !itemId }">{{ itemId ? getItem(itemId)?.name : '—' }}</span>
              </div>
            </div>
          </div>
        </nav>
      </main>
      <StatusPanel class="app-status" />
    </div>

    <!-- 一键回到顶部（中间页面右下角） -->
    <button v-if="showTopBtn" class="btn btn-primary back-top-btn" @click="scrollTop" title="回到顶部">⬆ 顶部</button>

    <!-- 弹层：背包/仓库（§5.4）/ 存档（§8.2）/ 设置 / 签到 / 搜索 / 奇遇 -->
    <InventoryModal v-if="ui.showBagModal" />
    <EquipmentModal v-if="ui.showEquipModal" />
    <SavePanel v-if="ui.showSavePanel" />
    <SettingsPanel v-if="ui.showSettingsPanel" />
    <SignInModal v-if="ui.showSignIn" />
    <SearchModal v-if="ui.showSearch" />
    <EncounterModal />
    <ShareCardModal />
    <MarketEventsModal />
    <OfflineReportModal />

    <!-- 移动端：技能抽屉 + 底部导航（§9.3 单栏布局） -->
    <template v-if="ui.showMobileSkills">
      <div class="mobile-backdrop" @click="ui.toggleMobileSkills(false)"></div>
      <aside class="mobile-skills"><Sidebar /></aside>
    </template>
    <nav class="mobile-nav">
      <button class="mobile-nav-btn" :class="{ active: ui.activeView === 'skill' }" @click="ui.toggleMobileSkills(true)">🏠<span>技能</span></button>
      <button class="mobile-nav-btn" :class="{ active: ui.activeView === 'restaurant' }" @click="ui.setView('restaurant')">🏮<span>餐厅</span></button>
      <button class="mobile-nav-btn" :class="{ active: ui.activeView === 'shop' }" @click="ui.setView('shop')">🛒<span>商店</span></button>
      <button class="mobile-nav-btn" @click="ui.toggleBagModal(true, 'bag')">🎒<span>背包</span></button>
      <button class="mobile-nav-btn" @click="ui.toggleSettingsPanel(true)">⚙️<span>设置</span></button>
    </nav>
  </div>
</template>
