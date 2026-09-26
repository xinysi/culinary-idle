// UI 运行时状态（非游戏数据，不入存档）

import { defineStore } from 'pinia'

// 日志保留条数（2026-09-11：100 → 500，配合新增的「系统日志」页可回溯；仍为**会话内**，
// 不入存档——挂机游戏每 tick 都可能 pushLog，写档会显著放大存档体积与写入频率）
const LOG_MAX = 500

/**
 * 合法的功能页 view key（与 App.vue 的 v-if/v-else-if 分派链一一对应）。
 * App.vue 末尾是 `v-else` 兜底到 SkillView，因此拼错的 key 不会报错、会静默显示技能页——
 * 新增页面时若忘了在这里登记，开发期会看到告警而不是"页面没反应"。
 */
export const VIEW_KEYS = [
  'skill', 'shop', 'deluxe', 'alchemy', 'expedition', 'cellar', 'kitchenNotes', 'regulars',
  'spiritStories', 'automation', 'ranch', 'branches', 'exchange', 'trials', 'michelin',
  'flavorBook', 'gearContest', 'festival', 'schools', 'staff', 'regions', 'legacy', 'patrons',
  'milestones', 'chronicle', 'weather', 'mascot', 'banquet', 'takeout', 'suppliers',
  'chefChallenge', 'seasonReview', 'honor', 'codexExchange', 'setMeals', 'rivals',
  'minigames', 'stats', 'log', 'restaurant', 'guild', 'season', 'arena', 'tower', 'fest',
  'mijian', 'guide', 'gear', 'quests', 'achievements', 'realm', 'decor', 'mail', 'logs', 'market', 'friends', 'today', 'story', 'cards', 'encounters', 'dao', 'shanhai',
  // 挂机产线四套（2026-09-14）：商队线 / 菌房 / 灵田 / 温室蜂场（蜂场与温室合并；网箱并入牧场不另开页）
  'caravan', 'mycoField', 'greenhouse', // 「灵圃菌房」由原「菌房」+「灵田」合并（v2.3.0）；网箱并入牧场不另开页
  'effects', // 效果总览（v2.6.0）：今日组，汇总此刻生效的全部增益 / 效果 / 减益
  // 2026-09-19：厨藏/装备由弹窗升级为独立页面（用户要求；厨藏的「厨藏」与「仓库」同屏合一）
  'inventory', 'equipment',
]

export const useUiStore = defineStore('ui', {
  state: () => ({
    log: [], // { id, ts, message, kind: info|gain|levelup|offline|warn }
    phase: 'splash', // splash(启动界面) | game(游戏主界面)
    guest: false, // 游客 / 试玩会话（2026-09-24）：不写档、不占存档位；仅内存，刷新即回普通会话
    showStartSlotModal: false, // 启动界面选存档弹窗
    rightPanelOpen: true,
    activeView: 'skill', // 取值见 VIEW_KEYS（与 App.vue 的分派链对应）
    showSavePanel: false, // 存档面板（§8.2）
    showSettingsPanel: false, // 设置面板
    showMobileSkills: false, // 移动端技能抽屉
    skillGuide: null, // 技能页「指南」弹窗：null = 关闭，否则为技能 id（2026-09-19）
    featureGuide: false, // 功能页「指南」弹窗（2026-09-21）：说明取自攻略总览里对应该页的条目
    mijianOdds: false, // 觅珍「概率说明」弹窗（2026-09-22）：放 store 是为了让深色体检（e2e-dark）能打开它逐皮肤扫
    showSignIn: false, // 每日签到弹窗
    showSearch: false, // 全局搜索弹窗
    showShareCard: false, // 战报分享卡弹窗（2026-09-06）
    showMarketModal: false, // 限时活动轮换表弹窗（2026-09-06）
    // 底部状态面板（2026-09-19 由右栏改为浮层；2026-09-20 再改成**五个独立胶囊各自向上弹出**）：
    // `dockSection` = 当前展开的那一块（'idle'|'spirit'|'aoji'|'status'|'log'，null = 全收起）。
    // 同时只开一个（点另一个自动换）。非存档（与其它浮层一致，刷新后收起）。
    dockSection: null,
    logInitialTab: null, // 日志页直达子页（图鉴/卡牌/成就…）
    encounter: null, // 随机奇遇弹窗（非存档：{ encounter, startedAt }）
    offlineReport: null, // 离线结算弹窗（非存档：{ reports, restGold, elapsedMs }）
    celebration: null, // 大反馈演出（非存档：{ icon, title, sub, tone }）——首次转生 / 首次赛季满档
    loopTick: 0, // 全局循环计数：每引擎 tick +1，驱动进度条等 UI 刷新
    // 开发者面板（2026-09-18）：两个**非存档**标志。组件本体只在含开发者模式的构建里存在——
    // 生产构建下 DevPanel 的 import 会被静态替换掉（见 App.vue 的 DEV_PANEL_ENABLED 分支）。
    devGate: false, // 登录挡板（启动页连点标题 / Ctrl+Shift+D / ?dev=1 都打开它）
    showDevPanel: false, // 面板本体
    showTunerPanel: false, // 运营调参页（2026-09-25 第四角色「运营调参员」的页面）
  }),

  actions: {
    setPhase(p) {
      this.phase = p
    },
    toggleStartSlotModal(open) {
      this.showStartSlotModal = open ?? !this.showStartSlotModal
    },
    /** 打开开发者登录挡板（启动页连点标题 / Ctrl+Shift+D / ?dev=1 都走它） */
    openDevGate() {
      this.devGate = true
    },
    toggleDevPanel(open) {
      this.showDevPanel = open ?? !this.showDevPanel
    },
    setView(v) {
      // 未知 key：开发期告警并按 App.vue 的兜底行为落到技能页；线上保持原样，行为与旧版完全一致。
      // 2026-09-11：告警同时写进**游戏内日志**——此前只 console.warn，页面上毫无提示，
      // 表现成「点某个入口莫名其妙跳到技能页（采摘）」，排查时看不出是被兜底了。
      if (!VIEW_KEYS.includes(v) && import.meta.env?.DEV) {
        console.warn(`[ui] 未知的 view key「${v}」——已回退到 skill。若是新页面，请在 ui.js 的 VIEW_KEYS 与 App.vue 分派链中登记；若只是页面没刷新，硬刷新（Ctrl+Shift+R）即可。`)
        this.pushLog(`⚠️ 未知页面「${v}」，已回退到技能页（多半是开发服务器模块未刷新，硬刷新即可）`, 'warn')
        this.activeView = 'skill'
        return
      }
      this.activeView = v
    },
    toggleSavePanel(open) {
      this.showSavePanel = open ?? !this.showSavePanel
    },
    toggleSettingsPanel(open) {
      this.showSettingsPanel = open ?? !this.showSettingsPanel
    },
    /** 底部状态胶囊（2026-09-20）：传入区块 id 打开；传 null 收起；传当前 id 则切换（点第二下收起） */
    toggleDockSection(sec) {
      if (sec == null) this.dockSection = null
      else this.dockSection = this.dockSection === sec ? null : sec
    },
    toggleSignIn(open) {
      this.showSignIn = open ?? !this.showSignIn
    },
    toggleSearch(open) {
      this.showSearch = open ?? !this.showSearch
    },
    toggleShareCard(open) {
      this.showShareCard = open ?? !this.showShareCard
    },
    closeShareCard() {
      this.showShareCard = false
    },
    // 日志页直达子页（图鉴/卡牌等）
    openLogTab(tab) {
      this.logInitialTab = tab
      this.activeView = 'log'
    },
    toggleMobileSkills(open) {
      this.showMobileSkills = open ?? !this.showMobileSkills
    },
    /** 技能页指南弹窗（2026-09-19）：传 null 关闭，传技能 id 打开 */
    toggleSkillGuide(id) {
      this.skillGuide = id ?? null
    },
    /** 功能页指南弹窗（2026-09-21）：只对「攻略总览里有条目」的页显示按钮 */
    toggleFeatureGuide(open) {
      this.featureGuide = open ?? !this.featureGuide
    },
    /** 觅珍概率说明弹窗（2026-09-22） */
    toggleMijianOdds(open) {
      this.mijianOdds = open ?? !this.mijianOdds
    },

    openEncounter(encounter) {
      if (this.encounter) return false // 一次只弹一个
      this.encounter = { encounter, startedAt: Date.now() }
      return true
    },
    closeEncounter() {
      this.encounter = null
    },
    openOfflineReport(report) {
      this.offlineReport = report
    },
    closeOfflineReport() {
      this.offlineReport = null
    },
    /** 大反馈演出（2026-09-18，留存改进 ⑥）：同一时刻只演一个，后到的覆盖先到的 */
    celebrate(payload) {
      this.celebration = payload ?? null
    },
    closeCelebration() {
      this.celebration = null
    },
    bumpLoop() {
      this.loopTick++
    },
    pushLog(message, kind = 'info') {
      this.log.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), message, kind })
      if (this.log.length > LOG_MAX) this.log.splice(0, this.log.length - LOG_MAX)
    },
    clearLog() {
      this.log = []
    },
  },
})
