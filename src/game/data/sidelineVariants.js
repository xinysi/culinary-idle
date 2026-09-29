// 副业「同物变体」（2026-09-30，成长平衡体检 §7「不足 4：16 支副业又平又短」/ T3）——**手写扩展模块**。
//
// 目标：16 支副业各给**最高档产物（基底 Lv112）**加 3 个变体（`·精` / `·珍` / `·御`），
//   等级 = 基底 **+2 / +5 / +8** ⇒ **Lv114 / Lv117 / Lv120**。
// 为什么：16 支副业是「**恒定 10 级/件**」（采集线是 1.3~5.0 级/件），且 Lv112 之后到 120 共 8 级没有内容。
//   新增 48 件 ⇒ Lv101-120 段的内容从 69 件 → **117 件**（内容/时间比 0.40 → 0.68）。
//
// 🔴 三条纪律（体检报告 + 本项目铁律，改之前先读）：
//   ① **只加新配方、绝不改老配方** —— 配方材料属**冻结层**（`lead` 里的历史教训）。
//   ② **产物价值不手写** —— 由 `valueBalance.applySidelineProductValues()` 按 `effIngredients` 锚回材料，
//      变体材料更贵 ⇒ 价值自动更高，「**卖一件 = 把这份材料整包卖掉**」的不变量原样成立。
//   ③ **独占品口径自动继承** —— 变体的 `category` 与基底**同一类别**（pottery / textile / … / furniture），
//      而那份清单是唯一来源 `SIDELINE_ITEM_CATEGORIES` ⇒ 5 个消费方（礼包池 / 抽卡池 / 自动出售 /
//      交易所 / 商队）**一个都不用改**（守卫会逐条断言）。
//
// 材料口径：木沿用基底那一档（**天罡沉香** `late_wood_02`，Lv112 ≤ 114/117/120 + 5 ✓）数量 6/7/8；
//   辅料沿用**基底那一味**（从 `LATE_SIDELINE_ROWS` 的 Lv112 行取，见 `sidelineWorks.js` 的展开循环）数量 3/4/5。
//   ⇒「材料获取等级 ≤ 配方等级 + 5」恒成立，`recipeBalance` 对它们是**恒等变换**。
//
// 图片：`public/images/items/tool/<物品名>.png`（用户 2026-09-30 提供 48 张 64×64 RGBA）。
// 展开在 `sidelineWorks.js`（15 支）与 `woodworking.js`（木工那 3 件，它与那两支同形状）。
export const VARIANT_SPECS = [
  { suffix: '·精', delta: 2, woodQty: 6, auxQty: 3 },
  { suffix: '·珍', delta: 5, woodQty: 7, auxQty: 4 },
  { suffix: '·御', delta: 8, woodQty: 8, auxQty: 5 },
]

/** 变体用的木材（沿用基底那一档；20 档木材体系只到 Lv100，Lv102/112 由「补档」批点名） */
export const VARIANT_WOOD = 'late_wood_02'

/** 变体只加在**基底所在的等级**上（Lv112）——展开循环据此筛行，避免与将来新增的其它档混淆 */
export const VARIANT_BASE_LEVEL = 112
