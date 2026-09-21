<script setup>
// 三栏布局 — 需求文档 §9.1：顶部功能导航 + 左侧技能导航 + 中央主区域 + 右侧面板
// 视图懒加载（defineAsyncComponent）：代码分割，减小主包体积
import { onMounted, onUnmounted, computed, ref, defineAsyncComponent, watch, nextTick } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import Sidebar from './components/Sidebar.vue'
import BgmPlayer from './components/BgmPlayer.vue'
import SkillGuideModal from './components/SkillGuideModal.vue'
import FeatureGuideModal from './components/FeatureGuideModal.vue'
import SavePanel from './components/SavePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import SignInModal from './components/SignInModal.vue'
import SearchModal from './components/SearchModal.vue'
import EncounterModal from './components/EncounterModal.vue'
import NewbieGuide from './components/NewbieGuide.vue'
import BottomDock from './components/BottomDock.vue'
import CelebrationOverlay from './components/CelebrationOverlay.vue'
import { initCelebrations } from './game/core/celebrations.js'
import OfflineReportModal from './components/OfflineReportModal.vue'
import ShareCardModal from './components/ShareCardModal.vue'
import MarketEventsModal from './components/MarketEventsModal.vue'
import { useUiStore } from './stores/ui.js'
import { usePlayerStore } from './stores/player.js'
import { getItem } from './game/data/items.js'
import { EventBus } from './game/core/EventBus.js'
import { sfx, bgm, primeAudio, setSfxVolume, setBgmVolume } from './game/core/sound.js'
import { getBgmTrack, bgmTrackOfScene, nextTrackId, getBgmMode } from './game/data/bgmTracks.js'
import { getCombat } from './game/combat/Combat.js'
import { applySkinToDom } from './game/data/skins.js'
import { getSeason, activeSeasonId } from './game/data/seasons.js'
import { guideEntryForView } from './game/data/guide.js'
import { DEV_PANEL_ENABLED, requestDevEntry } from './game/dev/devFlag.js'
import { initTelemetry } from './game/dev/telemetry.js'

// 🔒 开发者面板 = **构建期隔离**：生产构建里 `DEV_PANEL_ENABLED` 会被静态替换成 `false`，
// 于是下面这个动态 import 会被打包器整块丢弃 —— **面板代码连同口令哈希都不进产物**。
// （守卫 `scripts/ci/dev_panel_audit.mjs` 会真的构建一次并在产物里断言这件事。）
// 要临时给打包版留入口：`VITE_DEV_PANEL=1 npm run build`。
const DevEntry = DEV_PANEL_ENABLED ? defineAsyncComponent(() => import('./components/DevEntry.vue')) : null

// 2026-09-19：厨藏/装备由弹窗升级为独立页面（厨藏的「厨藏」与「仓库」同屏合一）
const InventoryView = defineAsyncComponent(() => import('./views/InventoryView.vue'))
const EquipmentView = defineAsyncComponent(() => import('./views/EquipmentView.vue'))
const SkillView = defineAsyncComponent(() => import('./views/SkillView.vue'))
const DaoView = defineAsyncComponent(() => import('./views/DaoView.vue'))
const ShanhaiView = defineAsyncComponent(() => import('./views/ShanhaiView.vue'))
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
const MijianView = defineAsyncComponent(() => import('./views/MijianView.vue'))
const MinigamesView = defineAsyncComponent(() => import('./views/MinigamesView.vue'))
const ExpeditionView = defineAsyncComponent(() => import('./views/ExpeditionView.vue'))
const KitchenNotesView = defineAsyncComponent(() => import('./views/KitchenNotesView.vue'))
const CellarView = defineAsyncComponent(() => import('./views/CellarView.vue'))
const RegularsView = defineAsyncComponent(() => import('./views/RegularsView.vue'))
const SpiritStoriesView = defineAsyncComponent(() => import('./views/SpiritStoriesView.vue'))
const AutomationView = defineAsyncComponent(() => import('./views/AutomationView.vue'))
const RanchView = defineAsyncComponent(() => import('./views/RanchView.vue'))
const BranchesView = defineAsyncComponent(() => import('./views/BranchesView.vue'))
const ExchangeView = defineAsyncComponent(() => import('./views/ExchangeView.vue'))
const TrialsView = defineAsyncComponent(() => import('./views/TrialsView.vue'))
const MichelinView = defineAsyncComponent(() => import('./views/MichelinView.vue'))
const FlavorBookView = defineAsyncComponent(() => import('./views/FlavorBookView.vue'))
const GearContestView = defineAsyncComponent(() => import('./views/GearContestView.vue'))
const FestivalView = defineAsyncComponent(() => import('./views/FestivalView.vue'))
const SchoolsView = defineAsyncComponent(() => import('./views/SchoolsView.vue'))
const StaffView = defineAsyncComponent(() => import('./views/StaffView.vue'))
const RegionsView = defineAsyncComponent(() => import('./views/RegionsView.vue'))
const LegacyView = defineAsyncComponent(() => import('./views/LegacyView.vue'))
const PatronsView = defineAsyncComponent(() => import('./views/PatronsView.vue'))
const MilestonesView = defineAsyncComponent(() => import('./views/MilestonesView.vue'))
const ChronicleView = defineAsyncComponent(() => import('./views/ChronicleView.vue'))
const WeatherView = defineAsyncComponent(() => import('./views/WeatherView.vue'))
const MascotView = defineAsyncComponent(() => import('./views/MascotView.vue'))
const BanquetView = defineAsyncComponent(() => import('./views/BanquetView.vue'))
const TakeoutView = defineAsyncComponent(() => import('./views/TakeoutView.vue'))
const SuppliersView = defineAsyncComponent(() => import('./views/SuppliersView.vue'))
const ChefChallengeView = defineAsyncComponent(() => import('./views/ChefChallengeView.vue'))
const SeasonReviewView = defineAsyncComponent(() => import('./views/SeasonReviewView.vue'))
const HonorView = defineAsyncComponent(() => import('./views/HonorView.vue'))
const CodexExchangeView = defineAsyncComponent(() => import('./views/CodexExchangeView.vue'))
const SetMealView = defineAsyncComponent(() => import('./views/SetMealView.vue'))
const RivalsView = defineAsyncComponent(() => import('./views/RivalsView.vue'))
const GearView = defineAsyncComponent(() => import('./views/GearView.vue'))
const QuestsView = defineAsyncComponent(() => import('./views/QuestsView.vue'))
const AchievementsView = defineAsyncComponent(() => import('./views/AchievementsView.vue'))
const MysticRealmView = defineAsyncComponent(() => import('./views/MysticRealmView.vue'))
const DecorView = defineAsyncComponent(() => import('./views/DecorView.vue'))
const MailView = defineAsyncComponent(() => import('./views/MailView.vue'))
const LogsView = defineAsyncComponent(() => import('./views/LogsView.vue'))
const MarketView = defineAsyncComponent(() => import('./views/MarketView.vue'))
const FriendsView = defineAsyncComponent(() => import('./views/FriendsView.vue'))
const TodayView = defineAsyncComponent(() => import('./views/TodayView.vue'))
const StoryView = defineAsyncComponent(() => import('./views/StoryView.vue'))
const CardBattleView = defineAsyncComponent(() => import('./views/CardBattleView.vue'))
const EncountersView = defineAsyncComponent(() => import('./views/EncountersView.vue'))
// 挂机产线四套（2026-09-14）
const CaravanView = defineAsyncComponent(() => import('./views/CaravanView.vue'))
const MycoFieldView = defineAsyncComponent(() => import('./views/MycoFieldView.vue'))
const GreenhouseView = defineAsyncComponent(() => import('./views/GreenhouseView.vue'))
const EffectsView = defineAsyncComponent(() => import('./views/EffectsView.vue'))

const ui = useUiStore()
const player = usePlayerStore()

// 功能页「指南」（2026-09-21）：只在「当前页在攻略总览里有条目」时显示按钮 ——
// 技能页有自己的指南按钮（SkillView），顶栏主页（商店/厨藏/装备…）不在攻略条目里，自然都是 null。
const featureGuideEntry = computed(() => guideEntryForView(ui.activeView, player))

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

// ── 顶部导航（2026-09-10）：只保留 7 个高频功能页；其余功能页移入左侧栏「功能」折叠分组 ──
// 每项：{ label, view, onClick, dot? }；view 用于激活高亮
const TOP_NAV = [
  { label: '🏮餐厅', view: 'restaurant', onClick: () => ui.setView('restaurant') },
  { label: '🤝公会', view: 'guild', onClick: () => ui.setView('guild') },
  { label: '🎪赛季', view: 'season', onClick: () => ui.setView('season'), dot: () => seasonDot.value },
  { label: '⚔️竞技场', view: 'arena', onClick: () => ui.setView('arena') },
  { label: '🗼试炼塔', view: 'tower', onClick: () => ui.setView('tower'), dot: () => player.combatLevel >= 99 && (player.tower?.best ?? 0) === 0 },
  { label: '🏆大赛', view: 'fest', onClick: () => ui.setView('fest'), dot: () => (player.fest?.todayEntries ?? 0) === 0 && (player.fest?.score ?? 0) < 1000 },
  { label: '🎴觅珍', view: 'mijian', onClick: () => ui.setView('mijian') },
]
// 界面缩放（§10.2.3 uiScale）：启动/读档后应用（整页等比缩放；放大后的导航观感由 CSS 紧凑设计保障）
function applyUiScale() {
  const v = player.settings?.uiScale ?? 1
  document.documentElement.style.zoom = v === 1 ? '' : String(v)
  // 缩放档位标记（2026-09-06）：110% 时网格减一列防止卡牌信息被裁
  if (v === 1) delete document.documentElement.dataset.scale
  else document.documentElement.dataset.scale = String(Math.round(v * 100))
}
// 高清晰模式（2026-09-10）：<html data-crisp="1"> 关闭全部 backdrop-filter、抬高遮罩、加深文字
function applyCrisp() {
  if (player.settings?.crispMode) document.documentElement.dataset.crisp = '1'
  else delete document.documentElement.dataset.crisp
}
// 深色主题（2026-09-06）：<html data-theme="dark"> 驱动 CSS 覆写
// 2026-09-10：主题偏好另存一份全局键，供「启动界面」使用——启动页阶段还没读档，
// player.settings 是默认值（theme:'light'），深色玩家否则会在启动页看到亮色壁纸。
const THEME_KEY = 'culinary-idle.theme'
function applyTheme() {
  const saved = player.settings?.theme
  // 进游戏前（phase = splash，尚未读档）优先用全局偏好；进游戏后以存档内的设置为准
  const pref = ui.phase === 'game' ? saved : (localStorage.getItem(THEME_KEY) || saved)
  if (pref === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
}
// 皮肤（v2.1）：同样另存一份全局键供启动界面使用；皮肤只写主色系变量（浅/深色都成立）
const SKIN_KEY = 'culinary-idle.skin'
function applySkin() {
  const saved = player.settings?.skin
  const pref = ui.phase === 'game' ? saved : (localStorage.getItem(SKIN_KEY) || saved)
  // 皮肤分浅/深两版主色：按当前主题取（applyTheme 已先跑，此处读到的就是生效值）
  applySkinToDom(pref ?? 'classic', document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
}
function syncAudioSettings() {
  setSfxVolume(player.settings?.sfxVolume ?? 0.6)
  setBgmVolume(player.settings?.bgmVolume ?? 0.35)
  if (player.settings?.soundEnabled || player.settings?.bgmEnabled) primeAudio()
}

/**
 * 场景判定（2026-09-17 起 10 个场景各有一首真实 BGM，曲库见 `game/data/bgmTracks.js`）：
 *   boss（首领战） > duel（普通对决） > 按当前功能页分类 > 主题昼夜兜底
 * 手动选曲（settings.bgmTrack）优先于场景：玩家在右下角播放器里点过就听那首，点「自动」才跟随场景。
 */
const DINER_VIEWS = ['restaurant', 'staff', 'branches', 'michelin', 'regulars', 'setMeals', 'takeout', 'suppliers', 'banquet', 'decor', 'rivals', 'friends']
const MARKET_VIEWS = ['fest', 'festival', 'season', 'seasonReview', 'minigames', 'today', 'weather', 'mascot', 'milestones', 'chronicle']
const MEDITATE_VIEWS = ['shanhai', 'dao', 'legacy', 'honor']
const MEMORY_VIEWS = ['log', 'story', 'cards', 'encounters', 'achievements', 'stats', 'logs', 'guide', 'mail', 'codexExchange']
const KITCHEN_SKILLS = ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'woodworking', 'pottery', 'weaving', 'embroidery', 'candles',
  'fletching', 'netmaking', 'incense', 'festivalGoods', 'jadecraft', 'goodsTag', 'miningGear', 'papermaking', 'instrument', 'soapmaking', 'exchequer']

function bgmScene() {
  const combat = getCombat()
  if (combat?.inFight) return combat.opponent?.isBoss ? 'boss' : 'duel' // 首领（含塔/秘境）用「山海盛宴」，普通对决用「厨艺切磋」
  const dark = document.documentElement.dataset.theme === 'dark'
  const ambient = dark ? 'night' : 'day' // 「昼/夜」是唯一一对主题相关的曲，其余场景各有专属曲
  const v = ui.activeView
  if (v === 'skill') return KITCHEN_SKILLS.includes(player.activeSkill) ? 'kitchen' : ambient
  if (DINER_VIEWS.includes(v)) return 'diner'
  if (MARKET_VIEWS.includes(v)) return 'market'
  if (MEDITATE_VIEWS.includes(v)) return 'meditate'
  if (MEMORY_VIEWS.includes(v)) return 'memory'
  return ambient
}

/** BGM 曲目：手动选曲优先，否则跟随场景；用户按了暂停就只更新「该放哪首」不出声（未开启 BGM 直接停） */
function syncBgm() {
  if (ui.phase !== 'game' || !player.settings?.bgmEnabled) {
    bgm.stop()
    return
  }
  if (player.settings?.bgmPaused) {
    bgm.pause() // 暂停保留进度；播放器里点「继续」会把 bgmPaused 置回 false
    return
  }
  const manual = player.settings?.bgmTrack
  bgm.play(getBgmTrack(manual) ? manual : bgmTrackOfScene(bgmScene()))
}

/**
 * 「这首放完了」→ 按播放模式决定下一首（顺序/随机；单曲循环走 el.loop，不会触发这里）。
 * 引擎不写存档：这里改的是 settings，仍由 `syncBgm()`（唯一调用点）去真正播放。
 */
function onBgmEnded(finishedId) {
  const mode = bgm.mode()
  if (mode === 'repeat') return
  const nextId = nextTrackId(finishedId ?? bgm.current(), mode)
  player.settings.bgmTrack = nextId // 顺着列表播 ⇒ 视为玩家选了这首（播放器上会显示它）
  player.settings.bgmPaused = false
}

onMounted(() => {
  applyUiScale()
  applyTheme()
  applySkin()
  applyCrisp()
  syncAudioSettings()
  bgm.setMode(getBgmMode(player.settings?.bgmMode).id) // 播放模式（单曲循环/顺序/随机）
  bgm.onEnded(onBgmEnded) // 顺序/随机模式下「放完了接下一首」
  // 跨午夜刷新「当天日期」，让签到能签到/红点自动点亮（每分钟核对一次，日期变化才触发重算）
  const t = setInterval(() => { player.refreshToday() }, 60_000)
  refreshTodayTimer = t

  // ── 开发者面板入口（仅含开发者模式的构建）──────────────────────────────
  if (DEV_PANEL_ENABLED) {
    initTelemetry(player) // 本地埋点：只写本机、不进存档、不联网
    // Ctrl + Shift + D：任意阶段都能唤出开发者入口（按下去只开「登录挡板」，不直接开面板）
    devHotkey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        requestDevEntry(ui) // 已登录直接开面板，否则弹口令；面板开着再按一次收起
      }
    }
    window.addEventListener('keydown', devHotkey)
    // ?dev=1：在线版/演示时最方便的入口（exe 用热键或启动页连点）
    try {
      if (new URLSearchParams(window.location.search).get('dev') === '1') requestDevEntry(ui)
    } catch { /* 忽略非法 URL */ }
  }

  // 大反馈演出（2026-09-18 留存改进 ⑥）：首次转生 / 首次赛季满档。**与开发者面板无关**，正式构建里也生效
  disposeCelebrations = initCelebrations(player, ui)
})
onUnmounted(() => {
  disposeCelebrations?.()
  clearInterval(refreshTodayTimer)
  bgm.onEnded(null)
  if (devHotkey) window.removeEventListener('keydown', devHotkey)
})
// 主题切换实时生效（设置面板修改 settings.theme），并写入全局键供启动页复用
watch(() => player.settings?.theme, (v) => {
  try { if (v) localStorage.setItem(THEME_KEY, v) } catch { /* 隐私模式下忽略 */ }
  applyTheme()
  applySkin() // 皮肤分浅/深两版主色 → 主题变了要重算
})

// v2.1：皮肤偏好同样另存全局键（供启动界面），并在设置/阶段变化时重写行内样式
watch(() => [player.settings?.skin, ui.phase], () => {
  try { if (player.settings?.skin) localStorage.setItem(SKIN_KEY, player.settings.skin) } catch { /* 隐私模式下忽略 */ }
  applySkin()
})
// v2.1：音量与开关变化时即时生效（BGM 关掉就停、开了就按当前场景起）
// v2.15：加入「手动选曲 / 当前功能页 / 当前技能」三个依赖——否则在播放器里点一首、或切到制作页，
//        曲目不会跟着换（漏掉依赖是 v2.1 踩过的同类坑：开关点了没反应）
watch(
  () => [
    player.settings?.soundEnabled,
    player.settings?.bgmEnabled,
    player.settings?.sfxVolume,
    player.settings?.bgmVolume,
    player.settings?.bgmTrack,
    player.settings?.bgmPaused,
    player.settings?.bgmMode,
    ui.phase,
    ui.activeView,
    player.activeSkill,
  ],
  () => { syncAudioSettings(); syncBgm(); bgm.setMode(getBgmMode(player.settings?.bgmMode).id) },
  { immediate: true }
)

// 跨午夜刷新定时器句柄
let refreshTodayTimer = null
// 开发者热键（Ctrl+Shift+D）的监听句柄：只在含开发者模式的构建里被赋值
let devHotkey = null
let disposeCelebrations = null

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
  navMoreOpen.value = false // 滚动内容时收起「⋯」浮层，避免它悬在半空
}
// 窄屏顶栏的「⋯」浮层（宽屏隐藏该按钮、右侧功能直接铺开）
const navMoreOpen = ref(false)
watch(() => ui.activeView, () => { navMoreOpen.value = false })
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
  // v2.1：更多事件的音效（缺事件时静默，不影响逻辑）
  EventBus.on('player:prestige', () => on() && sfx.prestige())
  EventBus.on('dao:unlock', () => on() && sfx.unlock())
  EventBus.on('trial:pass', () => on() && sfx.reward())
  EventBus.on('season:claim', () => on() && sfx.open())
  EventBus.on('exchange:trade', () => on() && sfx.coin())
  EventBus.on('branch:open', () => on() && sfx.buy())
  EventBus.on('supplier:sign', () => on() && sfx.buy())
  EventBus.on('supplier:deliver', () => on() && sfx.mail())
  EventBus.on('guild:join', () => on() && sfx.friend())
  EventBus.on('chef:win', () => on() && sfx.serve())
  EventBus.on('arena:end', () => on() && sfx.tower())
  EventBus.on('tower:advance', () => on() && sfx.tower())
  EventBus.on('boss:appear', () => on() && sfx.boss())
  EventBus.on('quest:complete', () => on() && sfx.win())
  EventBus.on('combat:start', () => { if (on()) sfx.collect(); syncBgm() })
  EventBus.on('combat:end', ({ result }) => { if (on()) (result === 'win' ? sfx.win() : sfx.lose()); syncBgm() })
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
  EventBus.on('mail:overflow', () => on() && sfx.warn()) // 信箱：溢出转存同样给一声提醒（2026-09-11）
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
          <!-- 主按钮区：自己横向滚动，不与右侧组抢宽度（2026-09-11 拆开——此前共用一个滚动容器，
               窄屏下右侧组会被一起推出可视区，连签到/设置都点不到） -->
          <div class="top-nav-main">
            <template v-for="item in TOP_NAV" :key="item.view">
              <button class="top-nav-btn" :class="{ active: ui.activeView === item.view, 'has-dot': !!item.dot, 'dot-on': item.dot?.() }" @click="item.onClick()">
                {{ item.label }}
              </button>
            </template>
          </div>
          <!-- 右侧功能区：宽屏铺开；≤940px 收进「⋯」浮层（点任一项自动收起） -->
          <div class="top-nav-right" :class="{ open: navMoreOpen }" @click="navMoreOpen = false">
            <button
              v-if="marketSummary"
              class="top-nav-market"
              :title="marketSummary.title"
              @click="ui.showMarketModal = true"
            >{{ marketSummary.label }}</button>
            <button class="top-nav-btn top-nav-market-all" title="查看限时活动轮换时间表" @click="ui.showMarketModal = true">⏰<span class="nav-btn-text">活动</span></button>
            <button class="top-nav-btn top-nav-icon" title="统计" :class="{ active: ui.activeView === 'stats' }" @click="ui.setView('stats')">📊<span class="nav-btn-text">统计</span></button>
            <button class="top-nav-btn top-nav-icon" title="图鉴" :class="{ active: ui.activeView === 'log' }" @click="ui.openLogTab('log')">📖<span class="nav-btn-text">图鉴</span></button>
            <button class="top-nav-btn top-nav-icon" title="攻略" :class="{ active: ui.activeView === 'guide' }" @click="ui.setView('guide')">🗺️<span class="nav-btn-text">攻略</span></button>
            <!-- 功能页「指南」（2026-09-21）：只在当前页有攻略条目时出现，说明与攻略总览同一份数据 -->
            <button
              v-if="featureGuideEntry"
              class="top-nav-btn top-nav-icon top-nav-guide"
              :title="`本页指南：${featureGuideEntry.name}`"
              @click="ui.toggleFeatureGuide(true)"
            >📘<span class="nav-btn-text">指南</span></button>
            <span class="top-nav-sep"></span>
            <!-- 顶栏 ⚡（状态抽屉入口）已于 2026-09-20 删除：那六块整体移到底部胶囊弹出的面板里 -->
            <button class="top-nav-btn has-dot" :class="{ 'dot-on': signInDot }" @click="ui.toggleSignIn(true)">🎁签到</button>
            <button class="top-nav-btn" @click="ui.toggleSearch(true)">🔍搜索</button>
            <button class="top-nav-btn" @click="ui.setView('inventory')">🧺厨藏</button>
            <button class="top-nav-btn" @click="ui.setView('equipment')">⚔️装备</button>
            <span class="top-nav-sep"></span>
            <button class="top-nav-btn" title="设置" @click="ui.toggleSettingsPanel(true)">⚙️<span class="nav-btn-text">设置</span></button>
            <button class="top-nav-btn" title="存档" @click="ui.toggleSavePanel(true)">💾<span class="nav-btn-text">存档</span></button>
          </div>
          <!-- 窄屏专用：呼出上面的右侧功能区（宽屏隐藏） -->
          <button
            class="top-nav-btn top-nav-more"
            :class="{ active: navMoreOpen }"
            title="更多功能（统计/图鉴/攻略/签到/搜索/厨藏/装备/设置/存档）"
            @click="navMoreOpen = !navMoreOpen"
          >⋯</button>
          <div v-if="navMoreOpen" class="top-nav-more-backdrop" @click="navMoreOpen = false"></div>
        </nav>

        <!-- 内容滚动区（独立滚动，导航不跟随）；新手引导横幅位于滚动区顶部 -->
        <div ref="mainScroll" @scroll="onMainScroll" class="main-scroll" :class="{ 'main-scroll--bleed': ui.activeView === 'shanhai' }">
          <ShopView v-if="ui.activeView === 'shop'" />
          <ZhenXiuView v-else-if="ui.activeView === 'deluxe'" />
          <AlchemyView v-else-if="ui.activeView === 'alchemy'" />
          <ExpeditionView v-else-if="ui.activeView === 'expedition'" />
          <CellarView v-else-if="ui.activeView === 'cellar'" />
          <KitchenNotesView v-else-if="ui.activeView === 'kitchenNotes'" />
          <RegularsView v-else-if="ui.activeView === 'regulars'" />
          <SpiritStoriesView v-else-if="ui.activeView === 'spiritStories'" />
          <AutomationView v-else-if="ui.activeView === 'automation'" />
          <RanchView v-else-if="ui.activeView === 'ranch'" />
          <BranchesView v-else-if="ui.activeView === 'branches'" />
          <ExchangeView v-else-if="ui.activeView === 'exchange'" />
          <TrialsView v-else-if="ui.activeView === 'trials'" />
          <MichelinView v-else-if="ui.activeView === 'michelin'" />
          <FlavorBookView v-else-if="ui.activeView === 'flavorBook'" />
          <GearContestView v-else-if="ui.activeView === 'gearContest'" />
          <FestivalView v-else-if="ui.activeView === 'festival'" />
          <SchoolsView v-else-if="ui.activeView === 'schools'" />
          <StaffView v-else-if="ui.activeView === 'staff'" />
          <RegionsView v-else-if="ui.activeView === 'regions'" />
          <LegacyView v-else-if="ui.activeView === 'legacy'" />
          <PatronsView v-else-if="ui.activeView === 'patrons'" />
          <MilestonesView v-else-if="ui.activeView === 'milestones'" />
          <ChronicleView v-else-if="ui.activeView === 'chronicle'" />
          <WeatherView v-else-if="ui.activeView === 'weather'" />
          <MascotView v-else-if="ui.activeView === 'mascot'" />
          <BanquetView v-else-if="ui.activeView === 'banquet'" />
          <TakeoutView v-else-if="ui.activeView === 'takeout'" />
          <SuppliersView v-else-if="ui.activeView === 'suppliers'" />
          <ChefChallengeView v-else-if="ui.activeView === 'chefChallenge'" />
          <SeasonReviewView v-else-if="ui.activeView === 'seasonReview'" />
          <HonorView v-else-if="ui.activeView === 'honor'" />
          <CodexExchangeView v-else-if="ui.activeView === 'codexExchange'" />
          <SetMealView v-else-if="ui.activeView === 'setMeals'" />
          <RivalsView v-else-if="ui.activeView === 'rivals'" />
          <GearView v-else-if="ui.activeView === 'gear'" />
          <QuestsView v-else-if="ui.activeView === 'quests'" />
          <AchievementsView v-else-if="ui.activeView === 'achievements'" />
          <MysticRealmView v-else-if="ui.activeView === 'realm'" />
          <DecorView v-else-if="ui.activeView === 'decor'" />
          <MailView v-else-if="ui.activeView === 'mail'" />
          <LogsView v-else-if="ui.activeView === 'logs'" />
          <MarketView v-else-if="ui.activeView === 'market'" />
          <FriendsView v-else-if="ui.activeView === 'friends'" />
          <TodayView v-else-if="ui.activeView === 'today'" />
          <StoryView v-else-if="ui.activeView === 'story'" />
          <CardBattleView v-else-if="ui.activeView === 'cards'" />
          <EncountersView v-else-if="ui.activeView === 'encounters'" />
          <DaoView v-else-if="ui.activeView === 'dao'" />
          <ShanhaiView v-else-if="ui.activeView === 'shanhai'" />
          <CaravanView v-else-if="ui.activeView === 'caravan'" />
          <MycoFieldView v-else-if="ui.activeView === 'mycoField'" />
          <GreenhouseView v-else-if="ui.activeView === 'greenhouse'" />
          <EffectsView v-else-if="ui.activeView === 'effects'" />
          <!-- 27 款小游戏统一由 MinigamesView 内部注册与切换（它自带 activeComp 与 GAMES 表）；
               这里不再逐个注册——2026-09-10 清理了 6 个永远命中不到的旧分支 -->
          <MinigamesView v-else-if="ui.activeView === 'minigames'" />
          <StatsView v-else-if="ui.activeView === 'stats'" />
          <LogView v-else-if="ui.activeView === 'log'" />
          <RestaurantView v-else-if="ui.activeView === 'restaurant'" />
          <GuildView v-else-if="ui.activeView === 'guild'" />
          <SeasonView v-else-if="ui.activeView === 'season'" />
          <ArenaView v-else-if="ui.activeView === 'arena'" />
          <TowerView v-else-if="ui.activeView === 'tower'" />
          <FestView v-else-if="ui.activeView === 'fest'" />
          <MijianView v-else-if="ui.activeView === 'mijian'" />
          <GuideView v-else-if="ui.activeView === 'guide'" />
          <InventoryView v-else-if="ui.activeView === 'inventory'" />
          <EquipmentView v-else-if="ui.activeView === 'equipment'" />
          <SkillView v-else />
        </div>

        <!-- 两条常驻提示（新手横幅 + 下一个目标）：2026-09-19 用户要求「移位置，太碍眼了」——
             从内容滚动区**顶部**挪到中间列的**底栏**（原底部状态条的位置，同轮那条被用户去掉）。
             每页正文因此从最顶端开始，提示仍在最外层常驻可见（新手任务不该被藏进抽屉）。
             ⚠️ 右下角 BGM 胶囊是 fixed 浮层、压在中间列右侧 ⇒ 这里必须留 padding-right。 -->
        <div class="head-strips">
          <NewbieGuide />
        </div>
      </main>
    </div>

    <!-- 原「顶栏 ⚡ 抽屉」已于 2026-09-20 撤掉：那六块（食灵出战/美食奥义/生效中/快捷状态/事件日志）
         与「挂机动向」一起搬到底部胶囊向上弹出的面板里（`components/BottomDock.vue`）。
         组件本体 `StatusPanel.vue` 仍**一行未改**地复用 ⇒ 零功能丢失（暂停/继续/关闭、各页入口都在）。 -->
    <!-- 一键回到顶部（中间页面右下角） -->
    <button v-if="showTopBtn" class="btn btn-primary back-top-btn" @click="scrollTop" title="回到顶部">⬆ 顶部</button>

    <!-- 底部状态胶囊组（右下角，紧贴 BGM 胶囊左边；2026-09-20 用户要求）。
         ⚠️ 必须放在这里而不是底栏 `.head-strips` 里：那个容器有 `z-index: 20` 的**层叠上下文**，
         会把内部的 fixed 子元素一起按 20 参与层叠 ⇒ 手机上被底部导航（z-index 40）盖住、点不动。 -->
    <BottomDock v-if="ui.phase === 'game'" />

    <!-- 背景音乐播放器（右下角玻璃胶囊，点击向上展开选曲；2026-09-17） -->
    <BgmPlayer v-if="ui.phase === 'game'" />

    <!-- 弹层：背包/仓库（§5.4）/ 存档（§8.2）/ 设置 / 签到 / 搜索 / 奇遇 -->
    <SkillGuideModal v-if="ui.skillGuide" />
    <FeatureGuideModal v-if="ui.featureGuide" />
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
      <button class="mobile-nav-btn" @click="ui.setView('inventory')">🎒<span>厨藏</span></button>
      <button class="mobile-nav-btn" @click="ui.toggleSettingsPanel(true)">⚙️<span>设置</span></button>
    </nav>
  </div>

  <!-- 开发者入口与面板（2026-09-18）：**必须挂在根级**，不能放进上面那个 `v-else` 的 .app-layout ——
       面板要在「启动页」和「游戏内」两个阶段都能用（启动页阶段要在那里管存档/看数据）。
       `DevEntry` 在不含开发者模式的构建里是 null，其动态 import 会被打包器整块丢弃。 -->
  <DevEntry v-if="DevEntry" />
  <!-- 大反馈演出（首次转生 / 首次赛季满档）：根级挂载，任何阶段都能盖在最上层 -->
  <CelebrationOverlay />
</template>
