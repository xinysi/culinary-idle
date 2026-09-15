// 农时（2026-09-14 新增，v2.4.0）— 让「农耕」从「种→等→收」变成**看天吃饭 + 按季轮作**。
//
// 起因（用户 2026-09-14）：「耕地的功能也挺单一的，毕竟采集解锁后就可以无限刷了」。
// 诊断：农耕真正的独特点是**不占 0-3 的并行挂机槽**（速率与一条采集线同量级），但它缺少「决策」——
//   ① 它**完全不接天气**（weather.js 里没有农业项），所以「今天种什么」无所谓；
//   ② 种什么都一样，没有**按季换作物**的理由（这一点产地早就有：`regions.js` 的 seasonMonths ×1.5）。
//
// 本模块补上 ②：**当季作物**（按月份轮换类别）吃到 **×1.5**；配合天气新增的 `farmYield` 乘区，
// 农耕就有了「今天的天气 + 这个月的当季」两层判断；而**温室不接天气**，于是它成了坏天气时的避风港
// （这也终于给了温室一个不可替代的定位，此前它只是「农田的加位提速版」）。
//
// 约束：纯日期计算（无存档字段）、不新增物品、不改动任何固定数据（作物等级/产物/效果一律不动）。
export const SEASONAL_BONUS = 1.5

/** 四季当季作物（按月轮换；类别取自作物自身的 category） */
export const FARM_SEASONS = [
  { id: 'spring', name: '春', months: [3, 4, 5], cats: ['vegetable'], label: '蔬菜' },
  { id: 'summer', name: '夏', months: [6, 7, 8], cats: ['fruit'], label: '水果' },
  { id: 'autumn', name: '秋', months: [9, 10, 11], cats: ['root', 'grain'], label: '根茎与谷物' },
  { id: 'winter', name: '冬', months: [12, 1, 2], cats: ['herb', 'fungus', 'flower'], label: '香草 / 菌菇 / 花卉' },
]

/** 某月对应的当季（默认取当前月） */
export function farmSeason(month = new Date().getMonth() + 1) {
  return FARM_SEASONS.find((s) => s.months.includes(month)) ?? FARM_SEASONS[0]
}

/** 该类别此刻是否当季 → 返回倍率（1.5 或 1） */
export function seasonalCropBonus(category, month = new Date().getMonth() + 1) {
  const s = farmSeason(month)
  return s.cats.includes(category) ? SEASONAL_BONUS : 1
}

/** 供 UI 显示：本月当季说明 */
export function seasonalTip(month = new Date().getMonth() + 1) {
  const s = farmSeason(month)
  return `本月当季：${s.name}季 · ${s.label} ×${SEASONAL_BONUS}`
}
