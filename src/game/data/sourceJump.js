// 获取来源 → 可跳转界面的唯一映射表（2026-09-10 抽出为独立模块）
//
// 起因：原先这张映射写死在 ItemDetailModal.vue 里，而 item_triple_audit.mjs 又手工维护了一份
// 「可跳转来源白名单」——两份镜像逐渐漂移，导致 17 种来源（约 408 条来源串，含「交易所（行情买入）」346 件）
// 在图鉴里根本没有跳转链接，而审计却以为它们都能跳。
// 现在两边共用本模块：新增来源串若没有对应规则，审计会直接 FAIL。

/** 判定顺序敏感：越具体的规则要越靠前（如「游戏商店」须先于「商店」） */
export const SOURCE_JUMP_RULES = [
  { kw: ['采摘'], target: { view: 'skill', skill: 'foraging' } },
  { kw: ['垂钓'], target: { view: 'skill', skill: 'fishing' } },
  { kw: ['狩猎'], target: { view: 'skill', skill: 'hunting' } },
  { kw: ['挖掘'], target: { view: 'skill', skill: 'excavation' } },
  { kw: ['农耕'], target: { view: 'skill', skill: 'farming' } },
  { kw: ['烹饪'], target: { view: 'skill', skill: 'cooking' } },
  { kw: ['烘焙'], target: { view: 'skill', skill: 'baking' } },
  { kw: ['腌制'], target: { view: 'skill', skill: 'preserving' } },
  { kw: ['调酒'], target: { view: 'skill', skill: 'brewing' } },
  { kw: ['调料', '香料'], target: { view: 'skill', skill: 'spiceMixing' } },
  { kw: ['锻造'], target: { view: 'skill', skill: 'craftsmithing' } },
  { kw: ['保鲜'], target: { view: 'skill', skill: 'preservation' } },
  { kw: ['探索'], target: { view: 'skill', skill: 'exploration' } },
  { kw: ['游戏商店'], target: { view: 'minigames' } }, // 小游戏游戏币商店（须先于通用「商店」判定）
  { kw: ['商店', '购买'], target: { view: 'shop' } },
  { kw: ['赛季'], target: { view: 'season' } },
  { kw: ['BOSS', '首领', '击败'], target: { view: 'skill', skill: 'knife' } },
  { kw: ['炼金'], target: { view: 'alchemy' } },
  { kw: ['成就'], target: { view: 'log', logTab: 'log' } },
  { kw: ['主线任务', '任务'], target: { view: 'log', logTab: 'quest' } },
  { kw: ['契约', '食灵'], target: { view: 'skill', skill: 'spiritSummoning' } },
  { kw: ['觅珍', '抽卡'], target: { view: 'mijian' } },
  { kw: ['竞技场'], target: { view: 'arena' } },
  // ── 2026-09-10 补：以下来源此前完全没有跳转规则（图鉴里是死文本）──
  { kw: ['远行采集队', '采集队'], target: { view: 'expedition' } },
  { kw: ['供应商合约', '供应商'], target: { view: 'suppliers' } },
  { kw: ['交易所'], target: { view: 'exchange' } },
  { kw: ['牧场养殖', '牧场'], target: { view: 'ranch' } },
  { kw: ['名厨挑战', '名厨'], target: { view: 'chefChallenge' } },
  { kw: ['图鉴兑换所', '图鉴兑换'], target: { view: 'codexExchange' } },
  { kw: ['地窖', '陈酿'], target: { view: 'cellar' } },
  // ── 2026-09-11 补：随机奇遇（挂机动作 0.2% 触发的小事件奖励）──
  { kw: ['随机奇遇', '奇遇'], target: { view: 'encounters' } },
]

/** 来源串 → 跳转目标（无匹配返回 null） */
export function jumpForSource(s) {
  const t = String(s ?? '')
  for (const r of SOURCE_JUMP_RULES) if (r.kw.some((k) => t.includes(k))) return r.target
  return null
}

