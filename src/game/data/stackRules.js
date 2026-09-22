// 堆叠规则（2026-09-22）——**运行时策略**，不改任何物品数据。
//
// 用户要求两条：
//   ① 「有什么办法让没有词条的装备可堆叠」
//   ② 「物品堆叠上限需要调到 100 亿，用可以容纳这个数值的格式」
//
// 🔴 为什么走「运行时策略」而不是改 `ITEMS` 的 `stackable/maxStack`：
//   物品数据属**冻结数据**（铁律 §4），且装备的 `stackable: false` 是 93 件装备逐条写死的。
//   与 `difficulty.js` / `materialCost.js` / `growthRate.js` 同一套做法：**数据一个字节不动**，
//   在读取点（`player.stackCapOf`）按规则算出「生效上限」。想调回旧行为只改本文件。
//   （守卫会断言 `ITEMS` 里装备仍是 `stackable: false`，即「数据确实没被动过」。）
//
// 🟢 为什么装备堆叠在语义上安全（不是凑合）：
//   · **词条**按 `itemId` 存（`player.gearMods[itemId]`）⇒ 同款多件本来就共享同一份词条，
//     堆叠与「5 个独立条目」在状态上完全等价；
//   · **镶嵌**按**槽位**存（`player.gemSockets[slot]`）⇒ 与背包里的件数无关；
//   · 所以「无词条装备可堆叠」不会出现「哪一件带词条」的歧义。
//   ⚠️ 一旦该 id 洗练出词条，上限立刻回到 1（`stackCapOf` 每次现算）——
//      已经堆起来的那一堆**不会被强行拆掉**（上限只影响「还能不能再进」，这是刻意选择的保守行为）。

/** 生效堆叠上限：100 亿（1e10）。⚠️ 这是**安全整数**（< 2^53），JS Number 精确表示；
 *  别改成 32 位运算（`| 0` / `>>> 0` 会在 21 亿处回绕）或 Int32Array。 */
export const STACK_MAX = 10_000_000_000

/** 「可堆叠」的语义标签（物品详情/文案用）：1 = 不可堆叠，否则为上限 */
export function isStackableCap(cap) {
  return cap > 1
}

/**
 * 生效堆叠上限（**唯一出口**）——`player.stackCapOf()` 调它，别在别处重写这段判断。
 * @param item 物品定义（`ITEMS[id]`）
 * @param hasMods 该 id 是否已有洗练词条（无词条的装备才可堆叠）
 */
export function effectiveStackCap(item, hasMods = false) {
  if (!item) return 1
  if (item.type === 'equipment') return hasMods ? 1 : STACK_MAX
  // 非装备（食材/材料/消耗品/宝石…）：一律 100 亿。
  // 数据里的 `maxStack: 9999` 是历史默认值，用户要求统一抬到 1e10（没有任何物品用到别的值）。
  return STACK_MAX
}

/**
 * 数量缩写（2026-09-22 从 `InventoryView.shortQty` 提出来做**唯一出口**）。
 * 1 万以下给精确数字；1 万以上依次用 万 / 亿 / 万亿 —— 上限抬到 100 亿后，
 * 旧实现只到「万」会写出「1000000.00万」这种没人读得出的数。
 */
export function shortCount(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  if (v < 10000) return Math.round(v).toLocaleString()
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}万亿`
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  return `${(v / 1e4).toFixed(2)}万`
}
