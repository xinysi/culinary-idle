// 左栏「功能页」页签的磁贴清单（2026-09-21 从 Sidebar.vue 抽成数据模块）
//
// 为什么抽出来：① 「指南」按钮要按**当前视图**找到对应的攻略条目，需要「视图 → 功能名」这张表；
//   ② 内容同步审计此前是**正则抽 Sidebar.vue 源码**拿这张表（HACK）——现在视图与守卫共用同一份。
// ⚠️ 磁贴的 `badge` 是运行期闭包（读 player 的待办数），所以这里是**工厂**：调用方传自己的 player。
// 视图清单 = 左栏「功能」页签要显示的页；技能与副业走另一条路径（SKILL_CATEGORIES）。

export function featureGroups(player) {
  return [{
    id: 'today',
    icon: '🗓️',
    name: '今日',
    items: [
      // 「今日待办」放本组第一格：它是「上线先看什么」的落地页（汇总其余每日动作）
      { icon: '📌', name: '今日待办', view: 'today', badge: () => player.pendingClaimCount() + player.mailUnclaimedCount() + player.friendsVisitableCount() },
      // 「效果总览」（v2.6.0）：此刻生效的全部增益 / 效果 / 减益，含本期未生效的原因清单
      { icon: '🧿', name: '效果总览', view: 'effects' },
      { icon: '🌤', name: '天气运势', view: 'weather' },
      { icon: '🍀', name: '吉祥物', view: 'mascot' },
      { icon: '📋', name: '任务中心', view: 'quests', badge: () => player.pendingClaimCount() },
      { icon: '📬', name: '信箱', view: 'mail', badge: () => player.mailUnclaimedCount() },
      { icon: '📈', name: '行情', view: 'market' },
      { icon: '❓', name: '奇遇图鉴', view: 'encounters' },
    ],
  },
  {
    id: 'buy',
    icon: '🧺',
    name: '采买与转化',
    items: [
      { icon: '🛒', name: '商店', view: 'shop' },
      { icon: '🍽️', name: '珍馐阁', view: 'deluxe' },
      { icon: '🧪', name: '炼金', view: 'alchemy' },
    ],
  },
  {
    id: 'idle',
    icon: '🌾',
    name: '挂机产线',
    items: [
      // 顺序按用户 2026-09-14 指定：采集队 → 产地 → 商队线 → 自动化 → 地窖 → 牧场 → 灵圃菌房 → 温室蜂场
      // （网箱并入牧场页，不另立瓦片）
      { icon: '🚢', name: '采集队', view: 'expedition' },
      { icon: '🌍', name: '产地', view: 'regions' },
      { icon: '🐫', name: '商队线', view: 'caravan', unlock: (p) => p.caravanUnlocked() },
      { icon: '🤖', name: '自动化', view: 'automation' },
      { icon: '🍶', name: '地窖', view: 'cellar', unlock: (p) => p.cellarUnlocked() },
      { icon: '🐄', name: '牧场', view: 'ranch', unlock: (p) => p.ranchUnlocked() },
      { icon: '🌿', name: '灵圃菌房', view: 'mycoField', unlock: (p) => p.mushroomUnlocked() },
      { icon: '🐝', name: '温室蜂场', view: 'greenhouse', unlock: (p) => p.greenhouseUnlocked() },
    ],
  },
  {
    id: 'study',
    icon: '📚',
    name: '研究与收集',
    items: [
      { icon: '📓', name: '厨房笔记', view: 'kitchenNotes' },
      { icon: '📔', name: '风味册', view: 'flavorBook' },
      { icon: '📜', name: '菜系研究', view: 'schools' },
      { icon: '📖', name: '山海食经', view: 'shanhai' },
      { icon: '🛡️', name: '装备总览', view: 'gear' },
    ],
  },
  {
    id: 'biz',
    icon: '🥢',
    name: '餐厅经营',
    items: [
      { icon: '⭐', name: '评级', view: 'michelin', unlock: (p) => p.michelinUnlocked() },
      { icon: '👨‍🍳', name: '班底', view: 'staff' },
      { icon: '🏬', name: '分店', view: 'branches', unlock: (p) => p.branchUnlocked() },
      { icon: '💹', name: '交易所', view: 'exchange', unlock: (p) => p.exchangeUnlocked() },
      { icon: '🥂', name: '宴会', view: 'banquet' },
      { icon: '🚚', name: '外卖', view: 'takeout' },
      { icon: '📦', name: '供应商', view: 'suppliers' },
      { icon: '👋', name: '常客', view: 'regulars' },
      { icon: '🍻', name: '厨友', view: 'friends', badge: () => player.friendsVisitableCount() },
      { icon: '🏪', name: '同业榜', view: 'rivals' },
      { icon: '🍱', name: '套餐定食', view: 'setMeals' },
      { icon: '🛋️', name: '餐厅装潢', view: 'decor' },
    ],
  },
  {
    id: 'fight',
    icon: '🎯',
    name: '挑战与休闲',
    items: [
      // 「厨神试炼」：与页面标题一致；顶栏那个「试炼塔」(`tower`) 是另一个系统，名字近似易混（2026-09-11 改名区分）
      { icon: '🏅', name: '厨神试炼', view: 'trials', unlock: (p) => p.trialsUnlocked() },
      { icon: '⚒️', name: '厨具赛', view: 'gearContest', unlock: (p) => p.gearContestUnlocked() },
      { icon: '🃏', name: '名厨', view: 'chefChallenge' },
      { icon: '🏯', name: '食神秘境', view: 'realm' },
      { icon: '🎮', name: '小游戏', view: 'minigames' },
    ],
  },
  {
    id: 'record',
    icon: '🗃️',
    name: '记录与回顾',
    items: [
      { icon: '🏁', name: '里程碑', view: 'milestones' },
      { icon: '📰', name: '年鉴', view: 'chronicle' },
      { icon: '📜', name: '故事', view: 'story' },
      { icon: '🎴', name: '卡牌对战', view: 'cards' },
      { icon: '📅', name: '赛季回顾', view: 'seasonReview' },
      { icon: '🎖', name: '荣誉殿堂', view: 'honor' },
      // 简写「成就称号」：4 列后瓦片只有 54px，「成就与称号」（5 字）会换行；全称仍用在页面标题与跳转文案里
      { icon: '🥇', name: '成就称号', view: 'achievements' },
      { icon: '🎟️', name: '图鉴兑换', view: 'codexExchange' },
      { icon: '🗂', name: '系统日志', view: 'logs' },
    ],
  },
  {
    id: 'grow',
    icon: '🌱',
    name: '成长与信仰',
    items: [
      { icon: '✨', name: '食灵物语', view: 'spiritStories' },
      { icon: '♻️', name: '传承', view: 'legacy' },
      { icon: '🛤️', name: '厨神之路', view: 'dao', badge: () => (player.daoPoints() > 0 ? player.daoPoints() : 0) },
      { icon: '🏛', name: '信仰', view: 'patrons' },
      { icon: '🌗', name: '节庆', view: 'festival' },
    ],
  },
]
}

/** 视图 → 功能名（磁贴清单的派生表）。
 *  ⚠️ 只读 `name`/`view` 两个字段，`badge` 闭包**不会被调用** ⇒ 传 null 当 player 是安全的。 */
export function featureViewNames(player = null) {
  const m = {}
  for (const g of featureGroups(player)) for (const it of g.items) m[it.view] = it.name
  return m
}

/** `攻略总览`里的条目名与左栏磁贴名**不一定逐字相同**（2026-09-21 从内容同步审计搬来）：
 *  这里是「视图 id → 攻略关键词」的唯一映射，审计与页面内的「指南」按钮共用同一份。
 *  没列出的视图 = 磁贴名本身就是关键词。 */
export const VIEW_GUIDE_KEYWORD = {
  weather: '天气', quests: '任务', achievements: '成就',
  flavorBook: '风味搭配', gear: '装备', setMeals: '套餐', rivals: '同业竞争',
  decor: '装饰', gearContest: '厨具大赛', chefChallenge: '名厨挑战', realm: '秘境',
  deluxe: '珍馐阁', michelin: '米其林', legacy: '师徒传承', patrons: '食神信仰',
  codexExchange: '图鉴兑换', festival: '节庆', spiritStories: '食灵',
  // 🔴 **顶栏主页也要有「指南」**（2026-09-22 补）：它们不在左栏磁贴清单里，但玩家心里的「功能页」
  //    就是这几页 —— 只挂在左栏磁贴上时，玩家停在厨藏/图鉴/装备/统计只会看到「什么都没变」
  //    （2026-09-22 用户实测报「没看到变动啊」就是这么来的）。这四页在攻略总览里都有条目，补映射即可。
  inventory: '厨藏', log: '图鉴', equipment: '装备', stats: '统计',
  // 顶栏第一组那 7 个（`App.vue` 的 TOP_NAV）同样不是磁贴 —— 用户第二次报「顶部栏的功能都没有指南」
  // 就是它们。关键词按攻略总览里的条目名挑**唯一**子串（`大赛` 会先撞上「厨具大赛」，故用「厨艺大赛」）。
  restaurant: '餐厅经营', guild: '公会', season: '赛季', arena: '竞技场',
  tower: '挑战塔', fest: '厨艺大赛', mijian: '觅珍',
}

/** 某个视图在「攻略总览」里对应的关键词（磁贴名优先，例外查上表） */
export function guideKeywordOf(view, player = null) {
  return VIEW_GUIDE_KEYWORD[view] ?? featureViewNames(player)[view] ?? null
}
