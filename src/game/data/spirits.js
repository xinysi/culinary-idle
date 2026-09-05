// 食灵数据 — 需求文档 §3.3.6
// 制作「食灵契约」（消耗高级食材+调料）召唤食灵，同时可携带 2 个出战；
// 食灵提供被动增益。effect 字段含义：
//   xpPct: {skillId: pct} 某技能经验加成（%）
//   dmgPct: 全对决伤害加成（%）
//   styleDmgPct: {style: pct} 指定流派伤害加成（%）
//   healPerTurnPct: 每回合回复最大 生命值 百分比
//   loseHpPerTurnPct: 每回合损失最大 生命值 百分比（龙息精灵的代价）
//   fishingAccPct: 垂钓成功率加成（%）
//   farmYieldBonus: 农耕收获额外数量
//
// §3.3.6：食灵共 160 只（32 位主题 × 5 阶级）。每阶级覆盖一个技能域 + 一个等级段：
//   Ⅰ采耕(1~19)、Ⅱ烹制(20~39)、Ⅲ饮藏(40~59)、Ⅳ御对(60~79)、Ⅴ超凡(80~99)，
//   5 阶级合起来覆盖所有技能，等级从 1 起连续（任何等级都有精灵可召唤）。
// 数据由生成器 gen_spirit_tiers.mjs 产出（勿手改），此处仅重新导出。
import { SPIRITS, SPIRIT_TIER, getSpirit } from './spiritTiers.js'

export { SPIRITS, SPIRIT_TIER, getSpirit }

export const SPIRIT_SLOTS = 2 // 同时可携带 2 个出战（§3.3.6）
