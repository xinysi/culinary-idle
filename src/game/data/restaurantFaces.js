// 餐厅实景里的「食客立绘」池（2026-09-23 换成专门出的食客图）。
//
// 单一出口：组件不许手写文件名，只调 `guestPortrait(名字)`。
//
// 📦 素材来源（2026-09-23 用户出图，20 张）：`docs/ui-pixel/restaurant/patrons-raw/`（1024×1024，**纯洋红底**）
//    → 处理脚本 `scripts/dev/key_patrons.py` → 输出 `public/images/restaurant/guests/patron_*.webp`（512×512，透明）。
//    ⚠️ 2026-09-25 起是 **`.webp`（q92）**：2.27MB → 0.48MB，分辨率没降（餐厅立绘最大显示 ~315px，源图仍 512）。
//    档位口径唯一出口 = `scripts/dev/image_quality.py`。
//
// 🔴 为什么这次要用洋红底出图（上一版踩的坑必须记住）：
//    最早图省事，食客立绘**借用对决的 248 张**（`public/images/enemies/`）。那批是按「近白背景」抠的，
//    而 AI 出图时**白背心 / 白袍 / 白围裙与背景是同一种纯白** ⇒ 被身体包住的白块（腋下、围裙缝）原样留着，
//    深色房间里看着就是「一块没抠干净的白」。逐张量过：110 张里 **58 张**有 ≥100px 的封闭纯白块；
//    试过两条几何判据（「边界是否贴空气」全是 0%；「到空气的最小距离」那些块 18~26px，比某些白袍还远）——
//    **衣服和背景在几何上分不开**。所以改为：出图时用**纯洋红 #FF00FF**，洋红不可能出现在人物配色里
//    ⇒ 键控零歧义、封闭区域也能安全清掉（这 20 张实测残留洋红 0 像素）。
//    要再加食客：照 `docs/ui-pixel/食客立绘_出图提示词.md` 出图（洋红底），丢进 `patrons-raw/` 重跑脚本即可。
//
// 兜底：图片加载失败时调用方回落 emoji 脸（见 RestaurantScene 的 `picOk`），不破图、不静默留白。
import { assetUrl } from './itemImage.js'

/** 食客立绘清单（顺序即 `guestPortrait` 的取样顺序，改动只影响「谁长什么样」） */
const IDS = [
  'patron_01_elderly_man',
  'patron_02_elderly_woman',
  'patron_03_young_woman',
  'patron_04_girl',
  'patron_05_sturdy_man',
  'patron_06_scholar',
  'patron_07_merchant',
  'patron_08_child',
  'patron_09_porter',
  'patron_10_honoured_guest',
  'patron_11_elderly_man_2',
  'patron_12_elderly_woman_2',
  'patron_13_young_woman_2',
  'patron_14_girl_2',
  'patron_15_sturdy_man_2',
  'patron_16_scholar_2',
  'patron_17_merchant_2',
  'patron_18_child_2',
  'patron_19_porter_2',
  'patron_20_honoured_guest_2',
]

/** 「像评委」的那几位：评论家用这一小批取脸（否则可能抽到小孩/挑夫，与「美食评论家」的气质不符） */
const CRITIC_IDS = [
  'patron_10_honoured_guest',
  'patron_20_honoured_guest_2',
  'patron_06_scholar',
  'patron_16_scholar_2',
  'patron_07_merchant',
  'patron_17_merchant_2',
  'patron_01_elderly_man',
  'patron_02_elderly_woman',
]

/** 立绘总数（守卫与调试用） */
export const GUEST_PORTRAIT_COUNT = IDS.length

/**
 * 按一个稳定的种子取立绘（同一个名字每次拿到同一张脸 —— 食客「老饕老王」不会换脸）。
 * @param {string} seed 一般传食客名字
 * @returns {string} 图片相对路径（走 assetUrl，兼容 exe 的 file://）
 */
/** 名字 → 指定立绘：**手动配一次**，比纯哈希好看得多。
 *  纯哈希会出现「隔壁张姨是一位老大爷」「挑嘴的评论家是个小孩」这种错配（名字里没有任何性别/年龄信息）；
 *  这 12 个名字来自 `restaurantOrders.NAMES`（固定池），配一次就长期有效。
 *  改名字池或加立绘时，这里没有的走哈希兜底，不会报错。 */
const NAME_FACE = {
  老饕老王: 'patron_05_sturdy_man',
  顾小姐: 'patron_03_young_woman',
  美食同好: 'patron_06_scholar',
  夜市常客: 'patron_09_porter',
  旅行美食家: 'patron_10_honoured_guest',
  神秘食客: 'patron_07_merchant',
  隔壁张姨: 'patron_02_elderly_woman',
  退休大厨: 'patron_01_elderly_man',
  挑嘴的评论家: 'patron_20_honoured_guest_2',
  深夜打工人: 'patron_15_sturdy_man_2',
  远道而来的客人: 'patron_19_porter_2',
  半熟美食家: 'patron_04_girl',
}

function hashOf(seed) {
  let h = 0
  for (const ch of String(seed ?? '')) h = (h * 131 + ch.codePointAt(0)) % 100003
  return h
}

export function guestPortrait(seed) {
  // 1) 订单 id（唯一）→ 稳定取一张；2) 名字在指定表里 → 用配好的那张；3) 其余走哈希兜底
  const id = NAME_FACE[seed]
  if (id) return assetUrl(`images/restaurant/guests/${id}.webp`)
  return assetUrl(`images/restaurant/guests/${IDS[hashOf(seed) % IDS.length]}.webp`)
}

/** 评论家的脸（只从「像评委」那一小批里取，同一个名字每次同一张） */
export function criticPortrait(seed) {
  return assetUrl(`images/restaurant/guests/${CRITIC_IDS[hashOf(seed) % CRITIC_IDS.length]}.webp`)
}
