// 灵田 Ⅵ/Ⅶ 档的「稀有种子」（2026-09-30，成长平衡体检 §9.1 的 1-A ④ / T2）—— **手写扩展模块**。
//
// 为什么需要新种子：灵田的定位是「**种本来采不到的东西**」（种什么得什么、长周期、定向），
//   而既有 184 颗种子里**最高只到 Lv99**（`foraging_ext_30Seed` / `foraging_ext2_30Seed`）
//   ⇒ 要把灵田的等级轴铺到末段（Lv105 / 115），只能补两颗种子。
//
// 🔴 但它**仍然是「零美术」**：`farmSeeds.js` 的种子一律**不配图片**
//   （`itemImage()` 返回空 → `ItemImg` 的 `@error` 把它隐藏），所以这一批不加任何美术资源。
//
// 获取方式（与既有稀有种子同源，两条路都接上，避免变成「图鉴里有、却拿不到」的死物品）：
//   ① **采集附产**：并入 `farmSeeds.js` 的 `SEED_MAP` ⇒ 采摘/挖掘该物品时按既有 **10%** 概率附产种子
//      （判定与显示都读同一张表，见 `ForagingSkill.performAction` / `ExcavationSkill.performAction`）；
//   ② **杂货铺购买**：并入 `shop.js` 的 `SHOP_ITEMS`（照 `LATE_SEED_SHOP` 先例）。
//
// 数值口径沿 `lateGameFood.js` 那批种子（`value = round(食材 value × 0.1)`，两味主料 value 都是 363 ⇒ 36）。
export const SPIRIT_FIELD_SEEDS = [
  { id: 'late_for_03Seed', name: '九畹灵芝种子', type: 'seed', category: '种植产物', tier: 10, value: 36, stackable: true, maxStack: 9999 },
  { id: 'late_exc_02Seed', name: '无根玉参种子', type: 'seed', category: '种植产物', tier: 10, value: 36, stackable: true, maxStack: 9999 },
]

/** 商店上架（`shop.js` 并入 `SHOP_ITEMS`）。价格沿既有末段种子（value×3.3 量级：late_far_02Seed 36→110）。 */
export const SPIRIT_FIELD_SEED_SHOP = [
  { itemId: 'late_for_03Seed', price: 120 },
  { itemId: 'late_exc_02Seed', price: 130 },
]

// 并进 `SEED_MAP`（采摘/挖掘的「附产种子」判定与图鉴来源串都读它）——
// 与 `lateGameFood.js` 同一套做法：`farmSeeds.js` 是零 import 的纯数据文件，mutate 它导出的常量对象即可，
// **不改生成器产物一个字节**（`gen_drift_audit` 比的是文件内容，运行时 mutate 不影响）。
import { SEED_MAP } from './farmSeeds.js'
Object.assign(SEED_MAP, {
  late_for_03: 'late_for_03Seed',
  late_exc_02: 'late_exc_02Seed',
})
