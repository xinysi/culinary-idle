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

/**
 * **不能**挂大类导航栏的视图（2026-09-27）：整屏画布页 —— `.main-scroll--bleed` 会把滚动区变成
 * 无内边距的 flex 列、内容撑满中区，再分掉 168px 会把画布挤变形。
 * 唯一来源：App.vue 的显隐判断与 Sidebar 的「落地页要挑一个挂得住导航的页」都读它。
 */
export const RAIL_HIDDEN_VIEWS = ['shanhai']

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
    // 底部状态面板（2026-09-19 由右栏改为浮层；2026-09-20 再改成**独立胶囊各自向上弹出**）：
    // `dockSection` = 当前展开的那一块（'idle'|'plan'|'spirit'|'aoji'|'status'|'log'，null = 全收起）。
    // `plan` = 2026-09-27 用户⑩ 加的（挂机计划从技能页搬进底栏，不再是页面里的一整张卡）。
    // 同时只开一个（点另一个自动换）。非存档（与其它浮层一致，刷新后收起）。
    dockSection: null,
    // 左栏「功能」大类的**工作区**（2026-09-27 用户⑳ 第二轮：「点击大类后，右边面板的左边显示导航、
    // 右边显示详细内容」，形态照开发者面板）：非空时主内容区变成「左导航栏 + 右内容」两栏。
    // 只记「打开了哪个大类」；**离开该类就自动收起**（判定在 App.vue 的 watch —— 需要 player 的解锁过滤）。
    featureCat: null,
    /** 导航栏此刻**是否真的显示着**（App.vue 是唯一写入者：只有它知道宽窄屏与「整屏画布页」两种例外）。
     *  左栏按钮的开关语义读它：状态还在、界面没显示时（如山海食经那页），点一下应该是**打开**而不是关掉 ——
     *  否则玩家看到的是「点了没反应」（探针实测到过）。 */
    railShown: false,
    logInitialTab: null, // 日志页直达子页（图鉴/卡牌/成就…）
    encounter: null, // 随机奇遇弹窗（非存档：{ encounter, startedAt }）
    offlineReport: null, // 离线结算弹窗（非存档：{ reports, restGold, elapsedMs }）
    celebration: null, // 大反馈演出（非存档：{ icon, title, sub, tone }）——首次转生 / 首次赛季满档
    loopTick: 0, // 全局循环计数：每引擎 tick +1，驱动进度条等 UI 刷新
    // 开发者面板（2026-09-18）：两个**非存档**标志。组件本体只在含开发者模式的构建里存在——
    // 生产构建下 DevPanel 的 import 会被静态替换掉（见 App.vue 的 DEV_PANEL_ENABLED 分支）。
    devGate: false, // 登录挡板（启动页连点标题 / Ctrl+Shift+D / ?dev=1 都打开它）
    showDevPanel: false, // 面板本体
    showOpsPanel: false, // 运营工作台（2026-09-25 第四角色，2026-10-02 由「运营调参员」重构为「运营 ops」：驾驶舱 + 实验台）
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
    /** 打开某个大类的导航工作区（2026-09-27 用户⑳ 第二轮）。落地页由调用方（Sidebar）决定 */
    openFeatureCat(id) {
      this.featureCat = id
    },
    closeFeatureCat() {
      this.featureCat = null
    },
    /** 只由 App.vue 调（导航栏显隐的真值来源） */
    setRailShown(v) {
      this.railShown = !!v
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
    /**
     * 追加日志；**同一 `mergeKey` 的连续动作合并成一行**（就地更新上一条，附「连续 ×N」）。
     *
     * 🔴 为什么需要（2026-09-29）：制作/练习是「每 3 秒一次」的动作，而批量制作弹窗一次做 999 份、
     * 心跳追赶一次最多 300 次 ⇒ 逐次 pushLog 会在几秒内把 500 条容量的日志**刷爆**，
     * 玩家反而看不到别的事件（老问题：一次 999 份 = 999 行）。合并后一行就够。
     * 合并窗口取 `windowMs`：队列是 3 秒/次 ⇒ 默认 6 秒能把连续动作圈在一行里，
     * 而中间停了（暂停/换配方）或超过窗口就另起一行，不会把半天前的记录续上。
     * `exp` 传**本次动作的经验**，合并时**累加**后渲染（否则一行「连续 ×12」旁边挂着单次经验，
     * 玩家会把它当成总数 —— 本项目最忌讳的「显示与结算不一致」）。
     */
    pushOrMergeLog(message, kind = 'info', mergeKey = null, { windowMs = 6000, exp = 0 } = {}) {
      const now = Date.now()
      const withSuffix = (base, count, expSum) =>
        `${base}${expSum > 0 ? `（+${expSum} 经验）` : ''}${count > 1 ? `（连续 ×${count}）` : ''}`
      if (mergeKey) {
        const last = this.log[this.log.length - 1]
        if (last && last.mergeKey === mergeKey && now - last.ts <= windowMs) {
          last.mergeCount = (last.mergeCount ?? 1) + 1
          last.mergeExp = (last.mergeExp ?? 0) + (exp > 0 ? exp : 0)
          last.baseMessage = message
          last.ts = now
          last.message = withSuffix(message, last.mergeCount, last.mergeExp)
          return
        }
      }
      this.log.push({
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        ts: now,
        message: withSuffix(message, 1, exp > 0 ? exp : 0),
        kind,
        ...(mergeKey ? { mergeKey, mergeCount: 1, mergeExp: exp > 0 ? exp : 0, baseMessage: message } : {}),
      })
      if (this.log.length > LOG_MAX) this.log.splice(0, this.log.length - LOG_MAX)
    },
    clearLog() {
      this.log = []
    },
  },
})
