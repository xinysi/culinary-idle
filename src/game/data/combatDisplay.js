// 对决的展示层小工具（2026-09-19）。
// ⚠️ 独立成文件而不是塞进 `data/combat.js`：那个文件里的**敌人数据（等级/属性/掉落/机制）是冻结层**，
//    不该为了「界面上放个图标」去动它。这里只放纯展示映射，不参与任何数值计算。
/** 风格 → 图标（对决页按风格给对手一个可扫读的图标位） */
export const STYLE_EMOJI = { knife: '🔪', plating: '🍽️', flavor: '🌶️' }

/** 对手图标：首领戴冠，其余按风格取；没有对手时给人形占位。
 *  ⚠️ 这是**占位**：`public/images` 下目前没有敌人立绘。等美术出图后把这里换成 `<img>`，
 *     调用方（`CombatPanel.vue` / `CombatView.vue`）都不用改。 */
export function foeEmojiOf(unit) {
  if (!unit) return '👤'
  if (unit.isBoss) return '👑'
  return STYLE_EMOJI[unit.style] ?? '👤'
}
