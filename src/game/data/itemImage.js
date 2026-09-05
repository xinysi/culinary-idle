// 物品图片映射：物品 → images/items/{类型}/{名称}.png（相对路径，兼容浏览器与 Electron file://）
// 类型目录：food（食材/料理/饮品/调料）、tool（道具）、seed（种子）、spirit（食灵）、equipment（装备）
import { getItem } from './items.js'

const TYPE_DIR = {
  food: 'food',
  drink: 'food',
  spice: 'food',
  ingredient: 'food',
  consumable: 'tool',
  seed: 'seed',
  spirit: 'spirit',
  equipment: 'equipment',
}

/** 返回物品图片 URL（相对路径）；无匹配时返回 null（调用方用 @error 隐藏） */
export function itemImage(id) {
  const it = getItem(id)
  if (!it) return null
  // 显式指定图片（如保鲜/增益剂复用旧图）
  if (it.image) return it.image
  // 所有种子统一使用 🌱 占位图（原 15 张真实种子图也一并替换，保持视觉统一）
  if (it.type === 'seed') return 'images/items/seed/_seed.png'
  const dir = TYPE_DIR[it.type]
  if (!dir) return null
  // 食灵名称带「·采耕Ⅰ」等后缀，图片文件名用基础名（去掉 · 后缀），否则匹配不到实际图片
  const base = it.type === 'spirit' ? (it.name.split('·')[0] || it.name) : it.name
  return `images/items/${dir}/${encodeURIComponent(base)}.png`
}
