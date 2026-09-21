// 玩家（厨师）标准形象（2026-09-21 用户要求：「两个标准形象，一个男厨师，一个女厨师」）。
//
// 用途：战斗屏左侧「你」那一格、以及将来任何要显示玩家本人的地方。
// 文件约定（放进去就生效，不需要改代码）：
//     public/images/chef/chef_male.png    男厨师
//     public/images/chef/chef_female.png  女厨师
// 规格：**256×256 透明 PNG**（战斗屏按 112px 显示，2 倍图便于将来放大；像素风保持硬边）。
// 生图提示词见仓库根目录 `厨师形象提示词.md`；处理脚本 `scripts/dev/process_enemy_images.py`
// （与敌人立绘同一套抠底/裁剪/降采样，`chef_` 前缀按 256 出图）。
//
// ⚠️ 图还没就位时**回落 emoji**（不破图）；设置页里也标了「图片未就位」的提示，
//    避免出现「开关点了没反应」的静默失效（AGENTS 的静默失效纪律）。
import { assetUrl } from './itemImage.js'

export const CHEF_AVATARS = [
  { id: 'male', name: '男厨师', icon: '🧑‍🍳' },
  { id: 'female', name: '女厨师', icon: '👩‍🍳' },
]

/** 玩家形象图 URL（相对路径，走 assetUrl 才能兼容 exe 的 file://）；无 id 时返回 null */
export function chefImage(id) {
  const a = CHEF_AVATARS.find((x) => x.id === id)
  return a ? assetUrl(`images/chef/chef_${a.id}.png`) : null
}

/** 该形象的 emoji 兜底（图未就位时用） */
export function chefEmoji(id) {
  return CHEF_AVATARS.find((x) => x.id === id)?.icon ?? '🧑‍🍳'
}
