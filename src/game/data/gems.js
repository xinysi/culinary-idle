// 宝石镶嵌（2026-09-09 新增）— 用现有矿物作为宝石，镶嵌到装备插槽提供属性加成。
// 设计约束：不新增物品、不改动矿物数值与配方；宝石加成在 `equippedStats` 中叠加（与套装/词条同级）。
// 插槽数按装备品质：普通 0 / 精良 1 / 稀有 1 / 史诗 2 / 传说 3 / 神话 3。
// 宝石与拆卸：镶嵌消耗 1 个矿物（物品），拆卸/换装自动返还（不会丢失）。

export const GEM_SOCKETS_BY_QUALITY = { 普通: 0, 精良: 1, 稀有: 1, 史诗: 2, 传说: 3, 神话: 3 }

/** 可用宝石（全部为既有矿物；bonus 为该宝石镶嵌后提供的属性） */
export const GEM_DEFS = [
  { itemId: 'saltOre', bonus: { hpBonus: 10 }, desc: '生命 +10' },
  { itemId: 'silverOre', bonus: { accuracy: 4 }, desc: '命中 +4' },
  { itemId: 'goldOre', bonus: { attack: 5 }, desc: '攻击 +5' },
  { itemId: 'excavation_ext2_13', bonus: { defense: 5 }, desc: '防御 +5' }, // 紫石英
  { itemId: 'excavation_ext2_14', bonus: { evasion: 4 }, desc: '闪避 +4' }, // 绿松石
  { itemId: 'excavation_ext2_15', bonus: { attack: 9 }, desc: '攻击 +9' }, // 红宝石矿
  { itemId: 'excavation_ext2_16', bonus: { hpBonus: 30 }, desc: '生命 +30' }, // 祖母绿矿
  { itemId: 'excavation_ext2_17', bonus: { critChance: 0.01 }, desc: '暴击 +1%' }, // 钻石矿
  { itemId: 'excavation_ext_28', bonus: { speedBonus: 0.03 }, desc: '攻速 +3%' }, // 翡翠矿
  { itemId: 'excavation_ext_30', bonus: { attack: 4, defense: 4, accuracy: 4, evasion: 4 }, desc: '攻/防/命中/闪避 +4' }, // 蓝晶矿
]

const GEM_INDEX = new Map(GEM_DEFS.map((g) => [g.itemId, g]))

export function gemDef(itemId) {
  return GEM_INDEX.get(itemId) ?? null
}

/** 某件装备的插槽数（按品质） */
export function socketCountOf(item) {
  return GEM_SOCKETS_BY_QUALITY[item?.quality] ?? 0
}

/** 一组镶嵌宝石的属性合计（跳过空位与未知宝石） */
export function gemsBonus(gems) {
  const out = {}
  for (const id of gems ?? []) {
    const def = id ? GEM_INDEX.get(id) : null
    if (!def) continue
    for (const [k, v] of Object.entries(def.bonus)) out[k] = (out[k] ?? 0) + v
  }
  return out
}
