// 新增腌制品（2026-09-27 用户⑬「食材保鲜页要不要扩充物品」→ 答「走小扩」）
//
// **为什么另开模块**：`items.js` 里既有条目的 id/等级/配方/效果属铁律冻结层（只读不改）。
// 新增内容一律走**手写扩展模块**（同 `sidelineWorks.js` / `timbers.js` 那一代），
// 再由 `items.js` 底部按既有方式 `ITEMS[def.id] = def` 合并进去 —— 冻结字节一个不动。
//
// **补的是什么**：实测「腌制品」150 件里 **菌类只有 2 条，且都是酱**（松露酱 / 蘑菇酱），
// 没有「腌整菇 / 干菌 / 醋渍」这类**即食腌菜**；蔬菜 23 条、水果 39 条已较密，
// 所以这批 3 条按「填菌类空档 + 补一个泡菜式蔬菜工艺」选。
//
// ⚠️ 图片：先**复用**原材料图（`image:` 字段，先例 `preserveTiers.js` 的保鲜剂）。
//    美术要单独出图时只需删掉 `image:` 并放 `public/images/items/food/<名称>.png`（图鉴三查会断言存在）。
// ⚠️ `value` 只填占位：启动时 `applyValueBalance()` 按**配方等级**重算（曲线 2 + 等级×2.5，±30% 夹取）。
// ⚠️ 不新增 category（`content_sync_audit` 的「类别表必须覆盖在用类别」会挡）。
export const PICKLE_ITEMS = [
  { id: 'pickledMushroom', name: '腌蘑菇', type: 'ingredient', category: 'pickled', tier: 4, value: 90, image: 'images/items/food/蘑菇.png' },
  { id: 'pickledLotusRoot', name: '腌藕片', type: 'ingredient', category: 'pickled', tier: 5, value: 120, image: 'images/items/food/莲藕.png' },
  { id: 'driedFungus', name: '菌干', type: 'ingredient', category: 'pickled', tier: 7, value: 260, image: 'images/items/food/木耳.png' },
]

/** 配方（与 `PreservingSkill.js` 里手写那批同格式）：3× 主料 + 盐，`reqLevel` 取在主料档位之上 */
// ⚠️ `reqLevel` 必须写成**生效值**（= 主料获取等级 − 5，见 `recipeBalance.raiseRecipeLevels`）：
//    写低了引擎会悄悄抬上去，于是「表内等级」与「生效等级」不一致 ⇒ 图鉴来源串与配方卡各说一个数。
export const PICKLE_RECIPES = [
  { id: 'pickledMushroom', name: '腌蘑菇', category: '腌制品', reqLevel: 28, xp: 175, successChance: 0.81, ingredients: { mushroom: 3, saltOre: 1 }, output: { itemId: 'pickledMushroom', qty: 1 } },
  { id: 'pickledLotusRoot', name: '腌藕片', category: '腌制品', reqLevel: 36, xp: 240, successChance: 0.79, ingredients: { excavation_ext_07: 3, saltOre: 1 }, output: { itemId: 'pickledLotusRoot', qty: 1 } },
  // 菌干：木耳（foraging_ext_22）获取等级 71 ⇒ 产物等级取 71 − 5 = **66**
  { id: 'driedFungus', name: '菌干', category: '腌制品', reqLevel: 66, xp: 370, successChance: 0.76, ingredients: { foraging_ext_22: 3, saltOre: 2 }, output: { itemId: 'driedFungus', qty: 1 } },
]
