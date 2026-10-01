// 美食奥义的**解锁等级**门槛（2026-09-27 用户⑧「美食奥义或许要加入某技能等级要求才能解锁呢？」）
//
// 为什么另开一个模块、而不是往 `aojis.js` 的条目上加第 7 个字段：
//   铁律把 `AOJIS` 的 **6 个字段**（id/name/category/desc/costPerSec/effect）钉为「已固定」，
//   加字段等于改冻结数据的**条目结构**。门槛是**规则**不是数据 ⇒ 放这里，唯一出口 `aojiGateLevel()`。
//
// 口径：门槛 = **美食知识（gastronomy）技能等级**（它随对决胜利成长，与战斗三技能同节奏）。
//   阶梯按「批次」给（同批内部按强度递增），而不是逐条拍数字 —— 这样以后加奥义只要归批：
//     · 入门 12 条（`aojis.js` 手写那批，id 无前缀）  → **不设门槛（Lv1）**，他们是教程组
//     · `aoji_*`（扩展 1 批 10 条）                  → Lv12 起，每条 +3
//     · `aoji2_*`（扩展 2 批 10 条）                 → Lv45 起，每条 +4
//     · `aojiSideline_*`（2026-09-27 新增副业线 10 条）→ Lv8 起，每条 +4
// ⚠️ 门槛只挡「开启」：已经在场上的奥义若因转生掉级而不再达标，由 `drainAoji` 收走（见 player.js）。
export const AOJI_GATE_BATCHES = [
  { prefix: '', base: 1, step: 0, note: '入门 12 条：不设门槛（教程组）' },
  { prefix: 'aoji_', base: 12, step: 3, note: '扩展 1 批' },
  { prefix: 'aoji2_', base: 45, step: 4, note: '扩展 2 批' },
  { prefix: 'aojiSideline_', base: 8, step: 4, note: '副业线' },
]

/** 显式门槛表（**先生成后落表**，便于人眼审：`id → 要求的美食知识等级`；缺省 = 1 表示不设门槛） */
export const AOJI_GATE = {
  // 副业线（10 条）——最便宜的一批，门槛从 Lv8 起
  aojiSideline_woodcraft: 8,
  aojiSideline_kiln: 12,
  aojiSideline_loom: 16,
  aojiSideline_needle: 20,
  aojiSideline_candle: 24,
  aojiSideline_arrow: 28,
  aojiSideline_net: 32,
  aojiSideline_incense: 36,
  aojiSideline_festive: 40,
  aojiSideline_jade: 44,
  // 扩展 1 批（10 条）
  aoji_secret_knife: 12,
  aoji_secret_plating: 15,
  aoji_secret_flavor: 18,
  aoji_perfect_heat: 21,
  aoji_wind_step: 24,
  aoji_iron_gut2: 27,
  aoji_harvest_feast: 30,
  aoji_knowledge_spring: 33,
  aoji_soul_of_food: 36,
  aoji_berserk: 39,
  // 扩展 2 批（10 条）
  aoji2_blade_tide: 45,
  aoji2_plate_feast: 49,
  aoji2_flavor_harmony: 53,
  aoji2_iron_wall: 57,
  aoji2_swift_thunder: 61,
  aoji2_bedrock: 65,
  aoji2_grain_abund: 69,
  aoji2_erudite: 73,
  aoji2_life_praise: 77,
  aoji2_berserk2: 81,
}

/** 某条奥义要求的美食知识等级（未登记 = 1，即不设门槛） */
export function aojiGateLevel(aojiId) {
  const lv = AOJI_GATE[aojiId]
  return Number.isFinite(lv) && lv > 1 ? lv : 1
}

/** 给定等级是否已解锁该奥义 */
export function aojiUnlockedAt(aojiId, level) {
  return (Number(level) || 1) >= aojiGateLevel(aojiId)
}

/** 给界面用的门槛文案（未设门槛返回 null ⇒ 那一行不显示） */
export function aojiGateText(aojiId) {
  const lv = aojiGateLevel(aojiId)
  return lv > 1 ? `需美食知识 Lv${lv}` : null
}

/**
 * 规则说明（**唯一文案出口**，页头 / 攻略都读它，别在页面里手抄一遍数字）。
 * 数字从 `AOJI_GATE_BATCHES` + `AOJI_GATE` 派生 ⇒ 以后调门槛，这句话自动跟着变。
 */
export const AOJI_GATE_NOTE = (() => {
  const maxLv = Math.max(...Object.values(AOJI_GATE))
  const gated = Object.keys(AOJI_GATE).length
  return `奥义按批次设解锁门槛（共 ${gated} 条有门槛、最高 Lv${maxLv}）：入门 12 条 1 级可用，`
    + `扩展 1 批 Lv12~39、扩展 2 批 Lv45~81、副业线 Lv8~44。门槛看的是「美食知识」等级（随对决胜利成长）；`
    + `若因转生掉级而不再达标，已开启的会被自动关闭并停止扣点。`
})()
