// 技能注册表 — 需求文档 §3：23 个技能，5 大类（v2.7.0：+伐木、+采矿；v2.9.0：+副业·木工）
// category: gathering(采集) / production(制作) / combat(对决) / support(辅助) / sideline(副业)
// 等级上限 100（§3），转生后可突破至 120（后续迭代）
// 图标约定：挖掘从 ⛏️ 改为 🥔（镐子让给采矿），避免两个技能撞图标
//
// ⚠️ 副业（sideline）是**独立第三页签**，与「技能/功能」并列（2026-09-16 用户决策）：
// 它**不吃食灵经验加成**（食灵域是白名单，见 spiritTiers.js）也**不入山海食经**
// （山海线↔技能 1:1 绑定，加线会改写已定稿的 552 节点布局），故 category 必须与 production 分开。

export const SKILL_DEFS = {
  // ── 采集类（§3.1）──
  foraging: { id: 'foraging', name: '采摘', category: 'gathering', desc: '从植物上采集水果、蔬菜、坚果等食材' },
  fishing: { id: 'fishing', name: '垂钓', category: 'gathering', desc: '在不同水域钓取鱼类和海鲜' },
  hunting: { id: 'hunting', name: '狩猎', category: 'gathering', desc: '猎取野味和家禽，获得肉类食材' },
  excavation: { id: 'excavation', name: '挖掘', category: 'gathering', desc: '挖掘根茎类食材与食用菌（矿物已独立为采矿）' },
  woodcutting: { id: 'woodcutting', name: '伐木', category: 'gathering', desc: '砍伐 20 档木材，供厨具锻造与装备强化按档取用' },
  mining: { id: 'mining', name: '采矿', category: 'gathering', desc: '开采矿物与宝石原料（v2.7.0 从挖掘独立）' },
  farming: { id: 'farming', name: '农耕', category: 'gathering', desc: '种植作物，定时收获' },

  // ── 制作类（§3.2）──
  cooking: { id: 'cooking', name: '烹饪', category: 'production', desc: '核心技能：将食材组合制作成料理' },
  baking: { id: 'baking', name: '烘焙', category: 'production', desc: '制作面包、糕点、饼干等烘焙食品' },
  preserving: { id: 'preserving', name: '腌制', category: 'production', desc: '制作腌菜、酱料、发酵食品' },
  brewing: { id: 'brewing', name: '调酒', category: 'production', desc: '酿造果汁、茶饮和酒类' },
  spiceMixing: { id: 'spiceMixing', name: '调料调配', category: 'production', desc: '调配复合调料和香料' },
  craftsmithing: { id: 'craftsmithing', name: '厨具锻造', category: 'production', desc: '打造厨具装备' },

  // ── 对决类（§3.3）──
  knife: { id: 'knife', name: '刀工', category: 'combat', desc: '近战风格：精准切割伤害' },
  heatControl: { id: 'heatControl', name: '火候掌控', category: 'combat', desc: '防御：减伤率与闪避率' },
  flavorArtistry: { id: 'flavorArtistry', name: '调味艺术', category: 'combat', desc: '魔法风格：调味冲击，消耗调味能量' },
  plating: { id: 'plating', name: '摆盘技巧', category: 'combat', desc: '远程风格：视觉冲击，消耗装饰食材' },
  tasteAcumen: { id: 'tasteAcumen', name: '品鉴力', category: 'combat', desc: '生命值：每级 +10 最大 生命值' },
  spiritSummoning: { id: 'spiritSummoning', name: '食灵召唤', category: 'combat', desc: '召唤食灵协助对决' },

  // ── 辅助类（§3.4）──
  gastronomy: { id: 'gastronomy', name: '美食知识', category: 'support', desc: '激活美食奥义提供被动加成（消耗品鉴点数）' },
  preservation: { id: 'preservation', name: '食材保鲜', category: 'support', desc: '制作保鲜剂和增益剂' },
  exploration: { id: 'exploration', name: '美食探索', category: 'support', desc: '探索美食秘境，偷师学艺' },

  // ── 副业类（§3.5，v2.9.0 木工；v2.10.0 陶艺/编织/刺绣/蜡烛）──
  // 与制作类的区别：制作类把食材变成**能吃/能用**的东西，副业把**采集原料**变成
  // 「采集拿不到、只能自己做」的经营侧乘区与独占品。
  // 每支只接**一条**乘区出口（陶艺→地窖单槽价值上限 / 编织→小费 / 刺绣→米其林招牌分 / 蜡烛→夜市窗口），
  // 定义与口径见 `data/sidelineWorks.js`。
  woodworking: { id: 'woodworking', name: '木工', category: 'sideline', desc: '伐木所得的木料做成木器与手工装潢（餐厅收入）' },
  pottery: { id: 'pottery', name: '陶艺', category: 'sideline', desc: '木料与矿物烧制陶器，给地窖扩容（单槽能陈酿更贵的酒）' },
  weaving: { id: 'weaving', name: '编织', category: 'sideline', desc: '竹木条与茎叶编成织物，提升餐厅小费' },
  embroidery: { id: 'embroidery', name: '刺绣', category: 'sideline', desc: '木料与果染绣成绣品，进米其林「招牌绣屏」评分' },
  candles: { id: 'candles', name: '蜡烛制作', category: 'sideline', desc: '木料与动物脂熬制蜡烛，延长夜市狂潮的营业时段' },
  // v2.12.0 第一批：五支「干净轴」副业（每支占一条此前**没人占**的乘区）
  fletching: { id: 'fletching', name: '制箭', category: 'sideline', desc: '木料与矿物做猎具，让狩猎更省陷阱（离线结算按陷阱数封顶动作数，省箭 = 提高离线吞吐）' },
  netmaking: { id: 'netmaking', name: '制网', category: 'sideline', desc: '木料与茎叶纤维做渔具，让稀有鱼（金龙鱼）更容易上钩' },
  incense: { id: 'incense', name: '香道', category: 'sideline', desc: '木料与香料做香品，让食客订单到访更快' },
  festivalGoods: { id: 'festivalGoods', name: '年货', category: 'sideline', desc: '木料与腌味年货做节礼，放大节庆日的加成' },
  jadecraft: { id: 'jadecraft', name: '玉作', category: 'sideline', desc: '木料与贝玉做玉器，增强宝石镶嵌的效果' },
}

/**
 * 左栏页签分组：技能页签显示前四类，副业页签只显示 sideline（2026-09-16）。
 * ⚠️ **`tab` 的取值必须与 Sidebar.vue 里 `sideTab` 的三个 key 完全一致**（`'skills'` / `'features'` / `'side'`）。
 * 2026-09-17 实测踩过：这里写成单数 `'skill'`，而侧栏三个 `v-show` 判的是 `'skills'`，
 * 于是**点任何技能都会把三个列表全部隐藏、左栏空白**（v2.9.0 引入，v2.10.1 修）。C32 有派生断言读 Sidebar 源码钉住这条。
 */
export const SKILL_CATEGORIES = [
  { id: 'gathering', name: '采集', tab: 'skills' },
  { id: 'production', name: '制作', tab: 'skills' },
  { id: 'combat', name: '对决', tab: 'skills' },
  { id: 'support', name: '辅助', tab: 'skills' },
  { id: 'sideline', name: '副业', tab: 'side' },
]

/** 某页签下要显示的分类（Sidebar 与守卫共用同一口径） */
export function skillCategoriesOfTab(tab) {
  return SKILL_CATEGORIES.filter((c) => c.tab === tab)
}

// 技能图标（emoji）
const SKILL_ICONS = {
  foraging: '🌿', fishing: '🎣', hunting: '🏹', excavation: '🥔', farming: '🌾',
  woodcutting: '🪓', mining: '⛏️',
  cooking: '🍳', baking: '🥖', preserving: '🫙', brewing: '🍷', spiceMixing: '🌶️', craftsmithing: '🔨',
  knife: '🔪', heatControl: '🔥', flavorArtistry: '✨', plating: '🍽️', tasteAcumen: '❤️', spiritSummoning: '👻',
  gastronomy: '📜', preservation: '❄️', exploration: '🕵️',
  woodworking: '🪚', pottery: '🏺', weaving: '🧶', embroidery: '🪡', candles: '🕯️',
  fletching: '🏹', netmaking: '🎣', incense: '🧴', festivalGoods: '🧧', jadecraft: '🔮',
}
for (const [id, icon] of Object.entries(SKILL_ICONS)) {
  if (SKILL_DEFS[id]) SKILL_DEFS[id].icon = icon
}

export function getSkillDef(id) {
  return SKILL_DEFS[id] ?? null
}
