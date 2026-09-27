// 美食探索的**专属装备**（2026-09-27 用户⑥：两套，属性只有「美食探索成功率」，合计 +5% / +10%）
//
// 用户口径： 「专属装备属性只有加美食探索时的成功概率（这里补足剩下的 10%），
//             第一套总共只加 5%，第二套总共才加 10%」，掉落概率 **0.01%**，每套 **2 件**（用户已确认）。
//   ⇒ 第一套 2 件 × +2.5% = 5%；第二套 2 件 × +5% = 10%。
//   ⇒ 装备在**卡片 90% 上限之外**相加（见 `explorationBalance.exploreSuccessChance`）⇒ 满配 100%。
//
// 为什么另开手写模块：`items.js` 里的既有条目属冻结层，新增内容一律走
// 「手写扩展模块 + `ITEMS[def.id] = def` 合并行」（同 `pickles.js` / `timbers.js` 那一代）。
//
// ⚠️ 图片：用户会提供（2 套各 2 件 = 4 张）。落位 `public/images/items/equipment/<中文名>.png`（64×64 RGBA）——
//    与其它装备**同一约定**，代码里不写 `image:` 字段（写了会和 `itemImage()` 的解析打架）。
//    出图前先放**占位图**（复制一件既有装备的图改名），否则图鉴三查的图片检查会 FAIL。
// ⚠️ `stats` 里只放 `exploreSuccessPP` 这一项（用户明确：专属装备只加探索成功率）——
//    守卫会断言这 4 件**没有**任何其它战斗/生活属性，免得以后被人顺手加成万能装。
export const EXPLORE_GEAR_SETS = [
  {
    id: 'flavorTrail',
    name: '寻味行装',
    pieces: [
      { id: 'exploreGearFlavorCompass', name: '寻味罗盘', slot: 'offhand', exploreSuccessPP: 2.5, tier: 6 },
      { id: 'exploreGearFlavorCloak', name: '寻味旅披', slot: 'body', exploreSuccessPP: 2.5, tier: 6 },
    ],
  },
  {
    id: 'relicHunt',
    name: '遗珍行装',
    pieces: [
      { id: 'exploreGearRelicLantern', name: '遗珍风灯', slot: 'offhand', exploreSuccessPP: 5, tier: 8 },
      { id: 'exploreGearRelicBoots', name: '遗珍踏屐', slot: 'boots', exploreSuccessPP: 5, tier: 8 },
    ],
  },
]

/** 展开成 `items.js` 能合并的物品定义（品质「传说」——0.01% 掉率的东西不该看起来像杂货） */
export const EXPLORE_GEAR_ITEMS = EXPLORE_GEAR_SETS.flatMap((set) =>
  set.pieces.map((p) => ({
    id: p.id,
    name: p.name,
    type: 'equipment',
    // category 与既有装备**同一口径**：就是槽位名（`copperPot` 也是 'offhand'）——
    // 写成 'tool' 会让「物品类别中文表覆盖全部在用类别」与「详情行完整」两条审计同时 FAIL
    category: p.slot,
    tier: p.tier,
    // 价值只填占位：启动时 `applyValueBalance()` 按等级曲线重算（与其它装备同一条口径）
    value: 500,
    stackable: false,
    slot: p.slot,
    quality: '传说',
    // 只加探索成功率；数值是**百分点**（2.5 = +2.5%）
    // ⚠️ 不写 `image:` —— 与其它装备一样由 `itemImage()` 解析成 `images/items/equipment/<名字>.png`
    //    （写 `images/items/tool/...` 会被图鉴三查判成缺图）。用户出图后放到那 4 个路径即可覆盖占位图。
    stats: { exploreSuccessPP: p.exploreSuccessPP },
    // ⚠️ 不要在这里挂 `set` / `setLabel` 这类自定义字段：图鉴三查有「物品字段无未登记项」的断言，
    //    新字段必须先登记；套装信息已经在本模块的 EXPLORE_GEAR_SETS 里，不必重复存到物品上。
  })),
)

/** 套装 id → 中文名（图鉴/装备页显示用；避免到处手抄） */
export const EXPLORE_GEAR_SET_NAMES = Object.fromEntries(EXPLORE_GEAR_SETS.map((s) => [s.id, s.name]))

/** 四件 id（**探索独占**：觅珍各池按这张表剔除成员，见 `mijianDraws.js` 的池过滤） */
export const EXPLORE_GEAR_IDS = EXPLORE_GEAR_ITEMS.map((g) => g.id)

/** 一套合计加多少百分点（提示文案与守卫共用同一份派生值，不手抄 5/10） */
export function exploreSetTotalPP(setId) {
  const s = EXPLORE_GEAR_SETS.find((x) => x.id === setId)
  return s ? s.pieces.reduce((a, p) => a + p.exploreSuccessPP, 0) : 0
}

/** 每次**探索动作**（成功与否都算，2026-09-28 用户定口径）掉出专属装备的概率：0.01% */
export const EXPLORE_GEAR_DROP_CHANCE = 0.0001
