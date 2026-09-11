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
  'mijian', 'guide', 'gear', 'quests', 'achievements', 'realm', 'decor', 'mail', 'logs', 'market', 'friends', 'today',
]

export const useUiStore = defineStore('ui', {
  state: () => ({
    log: [], // { id, ts, message, kind: info|gain|levelup|offline|warn }
    phase: 'splash', // splash(启动界面) | game(游戏主界面)
    showStartSlotModal: false, // 启动界面选存档弹窗
    rightPanelOpen: true,
    activeView: 'skill', // 取值见 VIEW_KEYS（与 App.vue 的分派链对应）
    showSavePanel: false, // 存档面板（§8.2）
    showSettingsPanel: false, // 设置面板
    showMobileSkills: false, // 移动端技能抽屉
    showBagModal: false, // 背包/仓库弹窗
    bagModalTab: 'bag', // 弹窗初始页：bag | bank
    showEquipModal: false, // 装备（穿戴）弹窗（独立于背包/仓库）
    showSignIn: false, // 每日签到弹窗
    showSearch: false, // 全局搜索弹窗
    showShareCard: false, // 战报分享卡弹窗（2026-09-06）
    showMarketModal: false, // 限时活动轮换表弹窗（2026-09-06）
    logInitialTab: null, // 日志页直达子页（图鉴/卡牌/成就…）
    encounter: null, // 随机奇遇弹窗（非存档：{ encounter, startedAt }）
    offlineReport: null, // 离线结算弹窗（非存档：{ reports, restGold, elapsedMs }）
    loopTick: 0, // 全局循环计数：每引擎 tick +1，驱动进度条等 UI 刷新
  }),

  actions: {
    setPhase(p) {
      this.phase = p
    },
    toggleStartSlotModal(open) {
      this.showStartSlotModal = open ?? !this.showStartSlotModal
    },
    setView(v) {
      // 未知 key：开发期告警并按 App.vue 的兜底行为落到技能页；线上保持原样，行为与旧版完全一致
      if (!VIEW_KEYS.includes(v)) {
        if (import.meta.env?.DEV) {
          console.warn(`[ui] 未知的 view key「${v}」——已回退到 skill。若是新页面，请在 ui.js 的 VIEW_KEYS 与 App.vue 分派链中登记。`)
          this.activeView = 'skill'
          return
        }
      }
      this.activeView = v
    },
    toggleSavePanel(open) {
      this.showSavePanel = open ?? !this.showSavePanel
    },
    toggleSettingsPanel(open) {
      this.showSettingsPanel = open ?? !this.showSettingsPanel
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
    toggleBagModal(open, tab = 'bag') {
      this.showBagModal = open ?? !this.showBagModal
      if (this.showBagModal) this.bagModalTab = tab
    },
    toggleEquipModal(open) {
      this.showEquipModal = open ?? !this.showEquipModal
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
