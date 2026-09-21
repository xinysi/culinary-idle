// 获取来源 → 可跳转界面的唯一映射表（2026-09-10 抽出为独立模块）
//
// 起因：原先这张映射写死在 ItemDetailModal.vue 里，而 item_triple_audit.mjs 又手工维护了一份
// 「可跳转来源白名单」——两份镜像逐渐漂移，导致 17 种来源（约 408 条来源串，含「交易所（行情买入）」346 件）
// 在图鉴里根本没有跳转链接，而审计却以为它们都能跳。
// 现在两边共用本模块：新增来源串若没有对应规则，审计会直接 FAIL。
//
// 🔴 两级判定（2026-09-21 修）：下面 `SOURCE_JUMP_RULES` 是**首次命中的子串扫描**，
// 谁先命中谁赢。于是「赛季「香料远征季」奖励」里的『香料』会先撞上调料规则、
// 「游戏商店·精酿调料礼包」里的『调料』会先撞上调料规则、「远行采集队·伐木队」里的『伐木』
// 会先撞上伐木规则……实测 **211 个 (物品,来源) 对跳到了错误的页面**。
// ⇒ 凡是「来源串以某个系统名开头」的，一律先用 `SOURCE_PREFIX_RULES`（前缀锚定）判定，
//   再退回关键词扫描。**新增来源串时先想清楚它开头是不是一个系统名。**
//
// 判定顺序敏感：越具体的规则要越靠前（如「游戏商店」须先于「商店」）

/** 一级判定：来源串**以此开头** → 直接定目标（前缀锚定，不受下面通用关键词遮蔽）
 *  ⚠️ 前缀一律**不带左书名号**：带上它会写成括号不配平的字面量，会被
 *     content_sync_audit 的「面向玩家的中文串无括号不配平」检查判为 FAIL
 *     （该检查会扫到注释，所以这里连举例都不能写）。
 *     实测这些前缀**等价**：以「赛季」开头的来源串 100% 是赛季奖励形式，其余同理。 */
export const SOURCE_PREFIX_RULES = [
  ['炼金合成', { view: 'alchemy' }], // 「炼金合成（神秘调料×4）」曾被『调料』抢走
  ['赛季', { view: 'season' }], // 赛季奖励串曾被『香料』/『腌制』抢走
  ['游戏商店', { view: 'minigames' }], // 「游戏商店·…礼包」曾被『调料』/『锻造』抢走
  ['远行采集队', { view: 'expedition' }], // 「远行采集队·伐木队」曾被『伐木』抢走
  ['供应商合约', { view: 'suppliers' }], // 「供应商合约·香料铺」曾被『香料』抢走
  ['探索', { view: 'skill', skill: 'exploration' }], // 探索串曾被『美食评论家』/『调料』抢走
  ['成就', { view: 'achievements' }], // 成就串曾被『常客』/『赛季』抢走
]

export const SOURCE_JUMP_RULES = [
  // v2.8.1：新登记系统（越具体越靠前；顺序敏感）
  { kw: ['珍馐阁'], target: { view: 'deluxe' } },
  { kw: ['公会商店'], target: { view: 'guild' } },
  { kw: ['区域对手'], target: { view: 'skill', skill: 'knife' } },
  { kw: ['每日签到'], target: { view: 'today' } },
  { kw: ['周常任务', '每日任务'], target: { view: 'quests' } },
  { kw: ['每周挑战赛'], target: { view: 'quests' } },
  { kw: ['无尽挑战塔'], target: { view: 'tower' } },
  { kw: ['食神秘境'], target: { view: 'realm' } },
  { kw: ['厨神试炼'], target: { view: 'trials' } },
  { kw: ['厨具大赛'], target: { view: 'gearContest' } },
  { kw: ['风味搭配'], target: { view: 'flavorBook' } },
  { kw: ['同业竞争榜'], target: { view: 'rivals' } },
  { kw: ['食灵物语'], target: { view: 'spiritStories' } },
  { kw: ['常客'], target: { view: 'regulars' } },
  { kw: ['美食评论家'], target: { view: 'restaurant' } },
  { kw: ['宴会承办'], target: { view: 'banquet' } },
  { kw: ['美食节'], target: { view: 'fest' } },
  { kw: ['锻造套装'], target: { view: 'gear' } },
  { kw: ['卡牌对战'], target: { view: 'cards' } },
  { kw: ['采摘'], target: { view: 'skill', skill: 'foraging' } },
  { kw: ['垂钓'], target: { view: 'skill', skill: 'fishing' } },
  { kw: ['狩猎'], target: { view: 'skill', skill: 'hunting' } },
  { kw: ['挖掘'], target: { view: 'skill', skill: 'excavation' } },
  { kw: ['采矿'], target: { view: 'skill', skill: 'mining' } },
  { kw: ['伐木'], target: { view: 'skill', skill: 'woodcutting' } },
  { kw: ['农耕'], target: { view: 'skill', skill: 'farming' } },
  { kw: ['烹饪'], target: { view: 'skill', skill: 'cooking' } },
  { kw: ['烘焙'], target: { view: 'skill', skill: 'baking' } },
  { kw: ['腌制'], target: { view: 'skill', skill: 'preserving' } },
  { kw: ['调酒'], target: { view: 'skill', skill: 'brewing' } },
  { kw: ['调料', '香料'], target: { view: 'skill', skill: 'spiceMixing' } },
  { kw: ['锻造'], target: { view: 'skill', skill: 'craftsmithing' } },
  // 副业·木工（v2.9.0）：要放在别的规则之前能命中的位置不重要，
  // 但两条来源串「木工制作」与「餐厅装潢」都必须有规则，否则图鉴里是死文本（图鉴三查会 FAIL）
  { kw: ['木工'], target: { view: 'skill', skill: 'woodworking' } },
  // 副业四支（v2.10.0）：来源串「陶艺制作」等必须能跳（图鉴三查会查）
  { kw: ['陶艺'], target: { view: 'skill', skill: 'pottery' } },
  { kw: ['编织'], target: { view: 'skill', skill: 'weaving' } },
  { kw: ['刺绣'], target: { view: 'skill', skill: 'embroidery' } },
  { kw: ['蜡烛'], target: { view: 'skill', skill: 'candles' } },
  // v2.12.0 第一批：五支「干净轴」副业
  { kw: ['制箭'], target: { view: 'skill', skill: 'fletching' } },
  { kw: ['制网'], target: { view: 'skill', skill: 'netmaking' } },
  { kw: ['香道'], target: { view: 'skill', skill: 'incense' } },
  { kw: ['年货'], target: { view: 'skill', skill: 'festivalGoods' } },
  { kw: ['玉作'], target: { view: 'skill', skill: 'jadecraft' } },
  // v2.13.0 第二批（货签要放在『交易所』规则之前也无妨：来源串是「货签制作」，只含『货签』）
  { kw: ['货签'], target: { view: 'skill', skill: 'goodsTag' } },
  { kw: ['采掘器具'], target: { view: 'skill', skill: 'miningGear' } },
  // v2.14.0 四支
  { kw: ['造纸'], target: { view: 'skill', skill: 'papermaking' } },
  { kw: ['乐器'], target: { view: 'skill', skill: 'instrument' } },
  { kw: ['制皂'], target: { view: 'skill', skill: 'soapmaking' } },
  { kw: ['钱庄'], target: { view: 'skill', skill: 'exchequer' } },
  { kw: ['餐厅装潢', '装潢'], target: { view: 'decor' } },
  { kw: ['保鲜'], target: { view: 'skill', skill: 'preservation' } },
  { kw: ['探索'], target: { view: 'skill', skill: 'exploration' } },
  { kw: ['游戏商店'], target: { view: 'minigames' } }, // 小游戏游戏币商店（须先于通用「商店」判定）
  { kw: ['商店', '购买'], target: { view: 'shop' } },
  { kw: ['赛季'], target: { view: 'season' } },
  { kw: ['BOSS', '首领', '击败'], target: { view: 'skill', skill: 'knife' } },
  { kw: ['炼金'], target: { view: 'alchemy' } },
  // 成就与称号 2026-09-11 已从 LogView 独立成页 ⇒ 目标要写独立页，
  // 不能再写 { view:'log', logTab:'log' }（那会落到图鉴的**物品**页，实测 103 条来源串都跳错）
  { kw: ['成就'], target: { view: 'achievements' } },
  // 任务中心同样已独立成页；直接写 quests，不再绕 LogView 的 MIGRATED_TABS 迁移
  { kw: ['主线任务', '任务'], target: { view: 'quests' } },
  { kw: ['契约', '食灵'], target: { view: 'skill', skill: 'spiritSummoning' } },
  { kw: ['觅珍', '抽卡'], target: { view: 'mijian' } },
  { kw: ['竞技场'], target: { view: 'arena' } },
  // ── 2026-09-10 补：以下来源此前完全没有跳转规则（图鉴里是死文本）──
  { kw: ['远行采集队', '采集队'], target: { view: 'expedition' } },
  { kw: ['供应商合约', '供应商'], target: { view: 'suppliers' } },
  { kw: ['交易所'], target: { view: 'exchange' } },
  { kw: ['牧场养殖', '牧场'], target: { view: 'ranch' } },
  { kw: ['名厨挑战', '名厨'], target: { view: 'chefChallenge' } },
  { kw: ['产地与风土', '产地'], target: { view: 'regions' } },
  { kw: ['吉祥物'], target: { view: 'mascot' } },
  { kw: ['图鉴兑换所', '图鉴兑换'], target: { view: 'codexExchange' } },
  { kw: ['地窖', '陈酿'], target: { view: 'cellar' } },
  // ── 2026-09-14 挂机产线四套（来源串若无法命中会直接 FAIL 图鉴三查）──
  { kw: ['温室蜂场', '蜂箱'], target: { view: 'greenhouse' } },
  // v2.3.0：菌房与灵田合并为「灵圃菌房」，菌灵露的产区也在这里
  { kw: ['菌房', '灵圃', '萃露', '菌灵露'], target: { view: 'mycoField' } },
  { kw: ['商队'], target: { view: 'caravan' } },
  // ── 2026-09-11 补：随机奇遇（挂机动作 0.2% 触发的小事件奖励）──
  { kw: ['随机奇遇', '奇遇'], target: { view: 'encounters' } },
]

/** 来源串 → 跳转目标（无匹配返回 null）。先前缀锚定，再退回关键词扫描。 */
export function jumpForSource(s) {
  const t = String(s ?? '')
  for (const [prefix, target] of SOURCE_PREFIX_RULES) if (t.startsWith(prefix)) return target
  for (const r of SOURCE_JUMP_RULES) if (r.kw.some((k) => t.includes(k))) return r.target
  return null
}

