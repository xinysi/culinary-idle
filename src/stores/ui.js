// UI 运行时状态（非游戏数据，不入存档）

import { defineStore } from 'pinia'

const LOG_MAX = 100

export const useUiStore = defineStore('ui', {
  state: () => ({
    log: [], // { id, ts, message, kind: info|gain|levelup|offline|warn }
    phase: 'splash', // splash(启动界面) | game(游戏主界面)
    showStartSlotModal: false, // 启动界面选存档弹窗
    rightPanelOpen: true,
    activeView: 'skill', // skill | shop | log | restaurant | guild | season | arena
    showSavePanel: false, // 存档面板（§8.2）
    showSettingsPanel: false, // 设置面板
    showMobileSkills: false, // 移动端技能抽屉
    showBagModal: false, // 背包/仓库弹窗
    bagModalTab: 'bag', // 弹窗初始页：bag | bank
    showEquipModal: false, // 装备（穿戴）弹窗（独立于背包/仓库）
    showSignIn: false, // 每日签到弹窗
    showSearch: false, // 全局搜索弹窗
    showShareCard: false, // 战报分享卡弹窗（2026-09-06）
    logInitialTab: null, // 日志页直达子页（图鉴/卡牌/成就…）
    encounter: null, // 随机奇遇弹窗（非存档：{ encounter, startedAt }）
    offlineReport: null, // 离线结算弹窗（非存档：{ reports, restGold, elapsedMs }）
    topNavPage: 0, // 顶部导航分页（纯 UI，不入存档；每页一组按钮）
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
    setTopNavPage(p) {
      this.topNavPage = p
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
