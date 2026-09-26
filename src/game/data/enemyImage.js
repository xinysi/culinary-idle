// 对决敌人立绘图（2026-09-21）——与 `public/images/enemies/` 一一对应。
//
// 单一来源：文件名由数据里的 `imgKey` 决定（区域对手在 `enemyNames.js` 改名时按「区内等级升序」打，
// 首领在 `combat.js` 里按 `key` 或等级下标打），**组件里不许手写路径或文件名**。
//
// ⚠️ 与物品图（`itemImage.js`）的区别：物品图是 64×64 一个规格；敌人立绘**统一 512×512**
//    （2026-09-21 第三轮：用户报「主角/敌人/卡片形象都糊糊的」—— 实测根因是 256 源图在
//    DPR≥1.5 的屏幕上不够用 + CSS 的 `image-rendering: pixelated` 在**降采样**时反而出锯齿；
//    现改为 512 源图 + 默认平滑缩放 ⇒ 176px 战斗屏立绘在 DPR 2 下也是原生像素）。
//    全部来自同一批 1024×1024 原图，处理脚本见 `scripts/dev/process_enemy_images.py`。
import { COMBAT_REGIONS, COMBAT_BOSSES } from './combat.js'
import { assetUrl } from './itemImage.js'

// ⚠️ 必须走 `assetUrl()`（同一出口）：**不能用根绝对路径 `/images/…`** ——
//    Electron 打包后页面是 `file:///…/dist/index.html`，`/images/…` 会解析到磁盘根 → 图全 404
//    （2026-09-17 用户报过「exe 里很多图片不显示」，`image_path_audit` 也有 A 组断言钉住这条）。
// ⚠️ 扩展名是 **`.webp`**（2026-09-25 图片瘦身）：248 张 512×512 PNG 合计 31.7MB → WebP q92 后 6.5MB，
//    分辨率**一点没降**（卡片显示 140~176px、战斗屏 176px，源图仍是 512）；档位口径见 `scripts/dev/image_quality.py`，
//    出图脚本 `process_enemy_images.py` 现在直接写 `.webp`。
const DIR = 'images/enemies/'

/** 全部敌人（区域对手 + 首领），供守卫与图鉴遍历 */
export const ALL_ENEMIES = [
  ...COMBAT_REGIONS.flatMap((r) => r.opponents.map((o) => ({ ...o, regionId: r.id, regionName: r.name }))),
  ...COMBAT_BOSSES,
]

/** 该敌人的立绘路径；没有 `imgKey` 时返回 null（组件回落到 emoji，不会破图） */
export function enemyImage(unit) {
  return unit?.imgKey ? assetUrl(`${DIR}${unit.imgKey}.webp`) : null
}
