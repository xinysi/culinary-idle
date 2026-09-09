// 装备「档位 T / 品质」随制作等级的唯一口径（2026-09-09 修复）
// 背景：锻造 20 品质套的 tier 曾有三套并存的口径（手写段位 1/3/5/7/9/10、补齐件 ceil(seg×0.6) 1~12、
// 独立矿套 ceil(lv/10)），且补齐件硬编码 quality:'神话' —— 与真实制作等级脱钩（最多差 57 级）。
// 现统一为：tier = ceil(制作等级 / 10)（1~10），品质 = 随等级单调的六档。
// 本模块无任何 import，供运行时平衡层（itemBalance）与生成器（gen_smith_sets）共用，避免口径漂移。

export const EQUIP_TIER_MAX = 10

/** 制作等级 → 装备档位 T（1~10） */
export function equipTierFor(lv) {
  return Math.max(1, Math.min(EQUIP_TIER_MAX, Math.ceil((lv ?? 1) / 10)))
}

/** 制作等级 → 装备品质（六档，随等级单调；与手写基底装备的既有品质完全一致） */
export function equipQualityFor(lv) {
  if (lv <= 10) return '普通'
  if (lv <= 25) return '精良'
  if (lv <= 35) return '稀有'
  if (lv <= 45) return '史诗'
  if (lv <= 60) return '传说'
  return '神话'
}
