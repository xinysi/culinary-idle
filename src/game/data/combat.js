// 料理对决数据 — 需求文档 §3.3 / §4
// 对决三角（§3.3）：刀工 克 摆盘 克 调味 克 刀工（+15% 伤害）
import { EQUIP_POOL, MAT_POOL, ITEM_LEVEL, EQUIP_SLOT, LEGENDARY, LEGENDARY_LEVEL } from './combatLoot.js'

export const STYLE_INFO = {
  knife: { id: 'knife', name: '刀工流', skillId: 'knife', desc: '近战：高伤害、高命中、中等速度，克制摆盘流', ammo: null },
  plating: { id: 'plating', name: '摆盘流', skillId: 'plating', desc: '远程：中等伤害、高暴击、快速度，克制调味流；每次攻击消耗装饰食材', ammo: 'garnish' },
  flavor: { id: 'flavor', name: '调味流', skillId: 'flavorArtistry', desc: '魔法：高爆发、消耗调味能量、慢速度，克制刀工流', ammo: null },
}

/** key 克 value */
export const STYLE_ADVANTAGE = { knife: 'plating', plating: 'flavor', flavor: 'knife' }

/** 按等级生成对手属性（数值档位：随等级线性成长） */
export function opp(level, name, style, extra = {}) {
  return {
    id: `${style}-${level}-${name}`,
    name,
    level,
    style, // knife | plating | flavor
    styleName: STYLE_INFO[style].name,
    hp: 12 + level * 6,
    atk: 1 + level * 0.7,
    acc: 10 + level * 2,
    def: Math.round(level * 1.5),
    eva: 4 + level * 1.5,
    crit: Math.min(0.04 + level * 0.002, 0.3),
    speedMs: Math.max(1400, 2400 - level * 8),
    drops: [],
    mechanic: null,
    ...extra,
  }
}

const REGION_DROP_BASIC = [
  { itemId: 'apple', chance: 0.3 },
  { itemId: 'potato', chance: 0.3 },
  { itemId: 'wood', chance: 0.25 },
]

// ── 普通对决区域 §4.4.1（10 个，按品鉴力等级解锁）──
export const COMBAT_REGIONS = [
  {
    id: 'newbieKitchen', name: '新手厨房', reqLevel: 1, desc: '基础食材、铜制厨具',
    opponents: [
      opp(1, '学徒厨师', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'copperKnife', chance: 0.03 }, { itemId: 'copperPot', chance: 0.03 }] }),
      opp(4, '杂役帮厨', 'plating', { drops: [...REGION_DROP_BASIC, { itemId: 'copperBoard', chance: 0.03 }] }),
    ],
  },
  {
    id: 'streetFood', name: '街边小吃街', reqLevel: 10, desc: '面食食材、铁制厨具',
    opponents: [
      opp(12, '小吃摊主', 'flavor', { drops: [...REGION_DROP_BASIC, { itemId: 'wheat', chance: 0.4 }, { itemId: 'ironKnife', chance: 0.02 }] }),
      opp(16, '烤串师傅', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'chili', chance: 0.3 }, { itemId: 'ironPot', chance: 0.02 }] }),
    ],
  },
  {
    id: 'chineseRestaurant', name: '中餐厅', reqLevel: 20, desc: '中式食材、钢制厨具',
    opponents: [
      opp(24, '中餐厨师', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'onion', chance: 0.35 }, { itemId: 'garlic', chance: 0.3 }, { itemId: 'ironBoard', chance: 0.03 }] }),
      opp(30, '川菜师傅', 'flavor', { drops: [...REGION_DROP_BASIC, { itemId: 'peppercorn', chance: 0.3 }, { itemId: 'chili', chance: 0.3 }, { itemId: 'ironHat', chance: 0.03 }] }),
    ],
  },
  {
    id: 'westernRestaurant', name: '西餐厅', reqLevel: 30, desc: '西式食材、银制厨具',
    opponents: [
      opp(34, '西餐主厨', 'plating', { drops: [...REGION_DROP_BASIC, { itemId: 'vanilla', chance: 0.3 }, { itemId: 'basil', chance: 0.3 }, { itemId: 'ironBottle', chance: 0.03 }] }),
      opp(40, '法餐大厨', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'rosemary', chance: 0.3 }, { itemId: 'ironApron', chance: 0.03 }] }),
    ],
  },
  {
    id: 'sushiShop', name: '日料店', reqLevel: 40, desc: '海鲜食材、精美餐具',
    opponents: [
      opp(44, '寿司师傅', 'plating', { drops: [...REGION_DROP_BASIC, { itemId: 'salmon', chance: 0.35 }, { itemId: 'tuna', chance: 0.3 }, { itemId: 'ironKnife', chance: 0.03 }] }),
      opp(50, '刺身达人', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'eel', chance: 0.3 }, { itemId: 'lobster', chance: 0.25 }, { itemId: 'ironBottle', chance: 0.03 }] }),
    ],
  },
  {
    id: 'dessertWorkshop', name: '甜品工坊', reqLevel: 50, desc: '甜点食材、金制厨具',
    opponents: [
      opp(54, '甜点师', 'flavor', { drops: [...REGION_DROP_BASIC, { itemId: 'strawberry', chance: 0.35 }, { itemId: 'eggplant', chance: 0.3 }, { itemId: 'ironHat', chance: 0.03 }] }),
      opp(60, '蛋糕大师', 'plating', { drops: [...REGION_DROP_BASIC, { itemId: 'saffron', chance: 0.2 }, { itemId: 'ironPot', chance: 0.03 }] }),
    ],
  },
  {
    id: 'culinaryAcademy', name: '美食学院', reqLevel: 60, desc: '高级食材与食谱、传说厨具碎片',
    opponents: [
      opp(64, '美食教授', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'ginger', chance: 0.35 }, { itemId: 'lingzhi', chance: 0.3 }, { itemId: 'ironBoard', chance: 0.04 }] }),
      opp(70, '学院首席', 'flavor', { drops: [...REGION_DROP_BASIC, { itemId: 'matsutake', chance: 0.3 }, { itemId: 'ironApron', chance: 0.04 }] }),
    ],
  },
  {
    id: 'undergroundKitchen', name: '地下食肆', reqLevel: 70, desc: '稀有食材、暗黑厨具',
    opponents: [
      opp(74, '黑暗料理师', 'flavor', { drops: [...REGION_DROP_BASIC, { itemId: 'truffle', chance: 0.25 }, { itemId: 'dragonPepper', chance: 0.2 }, { itemId: 'ironHat', chance: 0.04 }] }),
      opp(80, '疯癫厨师', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'ginseng', chance: 0.3 }, { itemId: 'ironBottle', chance: 0.04 }] }),
    ],
  },
  {
    id: 'gourmetArena', name: '食神赛场', reqLevel: 80, desc: '传说食谱、传说厨具',
    opponents: [
      opp(85, '食神候选人', 'plating', { drops: [...REGION_DROP_BASIC, { itemId: 'spiritFruit', chance: 0.25 }, { itemId: 'dragonRoot', chance: 0.2 }, { itemId: 'ironPot', chance: 0.05 }] }),
      opp(90, '冠军候选', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'truffle', chance: 0.3 }, { itemId: 'ironKnife', chance: 0.05 }] }),
    ],
  },
  {
    id: 'abyssKitchen', name: '食之深渊', reqLevel: 90, desc: '神话食材、神话厨具',
    opponents: [
      opp(95, '堕落食神', 'flavor', { drops: [...REGION_DROP_BASIC, { itemId: 'dragonMeat', chance: 0.25 }, { itemId: 'spiritFruit', chance: 0.25 }, { itemId: 'goldenWhisk', chance: 0.02 }] }),
      opp(98, '深渊守卫', 'knife', { drops: [...REGION_DROP_BASIC, { itemId: 'dragonRoot', chance: 0.3 }, { itemId: 'taijiPot', chance: 0.02 }] }),
    ],
  },
]

// ── 首领 §4.4.2（8 个，特殊机制 + 独有掉落）──
export const COMBAT_BOSSES = [
  opp(25, '面条之王', 'knife', { mechanic: { slowEvery: 5 }, drops: [...REGION_DROP_BASIC, { itemId: 'rollingPin', chance: 0.25 }] }),
  opp(40, '火锅真君', 'flavor', { mechanic: { burn: true }, drops: [...REGION_DROP_BASIC, { itemId: 'taijiPot', chance: 0.25 }] }),
  opp(55, '寿司之神', 'plating', { crit: 0.2, eva: 20 + 55 * 1.5, speedMs: 1500, drops: [...REGION_DROP_BASIC, { itemId: 'godKnife', chance: 0.25 }] }),
  opp(65, '甜品女王', 'plating', { mechanic: { regen: true }, drops: [...REGION_DROP_BASIC, { itemId: 'goldenWhisk', chance: 0.25 }] }),
  opp(75, '分子料理博士', 'knife', { mechanic: { randomStyle: true }, drops: [...REGION_DROP_BASIC, { itemId: 'molecularCooker', chance: 0.25 }] }),
  opp(85, '中华一番', 'knife', { mechanic: { instantKill: true }, drops: [...REGION_DROP_BASIC, { itemId: 'eternalKnife', chance: 0.2 }] }),
  opp(92, '黑暗料理王', 'flavor', { mechanic: { poison: true }, drops: [...REGION_DROP_BASIC, { itemId: 'darkPot', chance: 0.2 }] }),
  opp(99, '初代食神', 'knife', { mechanic: { phases: true }, drops: [...REGION_DROP_BASIC, { itemId: 'godCrown', chance: 0.15 }] }),
]

// 内容扩充：每区域 +10 对手、首领 +10（生成器 expansion1.js）
// 扩充数据为裸条目（name/level/style），此处用 opp() 补全 hp/攻/防/命中/闪避/暴击/攻速/风格名
import { REGION_EXT, BOSS_EXT } from './expansion1.js'
import { REGION_EXT2, BOSS_EXT2 } from './expansion2.js'

// 扩充对手按等级分配独有掉落池（基础掉落 + 对应等级段装备）
const EXT_LOOT_POOL = [
  { max: 15, pool: ['copperKnife', 'copperPot', 'copperBoard'] },
  { max: 35, pool: ['ironKnife', 'ironPot', 'ironHat'] },
  { max: 55, pool: ['steelKnife', 'steelHat', 'silverKnife'] },
  { max: 75, pool: ['goldKnife', 'goldPot', 'goldHat'] },
  { max: 99, pool: ['crystalKnife', 'crystalPot', 'smith_ext_24', 'smith_ext_30'] },
]
function extDrops(level, idx) {
  const tier = EXT_LOOT_POOL.find((t) => level <= t.max) ?? EXT_LOOT_POOL[EXT_LOOT_POOL.length - 1]
  const item = tier.pool[idx % tier.pool.length]
  return [...REGION_DROP_BASIC, { itemId: item, chance: 0.05 }]
}
for (const r of REGION_EXT) {
  COMBAT_REGIONS[r.regionIndex].opponents.push(...r.opponents.map((o, k) => {
    const lvl = Math.min(99, o.level + 5) // 前期节奏：扩充对手上浮 5 级，需先刷基础对手升级
    return opp(lvl, o.name, o.style, { drops: extDrops(lvl, r.regionIndex * 10 + k) })
  }))
}
for (const r of REGION_EXT2) {
  COMBAT_REGIONS[r.regionIndex].opponents.push(...r.opponents.map((o, k) => {
    const lvl = Math.min(99, o.level + 5)
    return opp(lvl, o.name, o.style, { drops: extDrops(lvl, r.regionIndex * 10 + k) })
  }))
}
const BOSS_DROP_POOL = ['godKnife', 'goldenWhisk', 'molecularCooker', 'eternalKnife', 'darkPot', 'godCrown', 'smith_ext_30', 'smith_ext_29', 'smith_ext_28', 'smith_ext_27']
BOSS_EXT.forEach((b, i) => {
  const full = opp(b.level, b.name, b.style, { mechanic: b.mechanic, key: b.key })
  full.drops = [...REGION_DROP_BASIC, { itemId: BOSS_DROP_POOL[i % BOSS_DROP_POOL.length], chance: 0.2 }]
  COMBAT_BOSSES.push(full)
})
const BOSS_DROP_POOL2 = ['smith_ext2_30', 'smith_ext2_29', 'smith_ext2_28', 'smith_ext2_27', 'smith_ext2_24', 'goldenWhisk', 'molecularCooker', 'eternalKnife', 'godCrown', 'darkPot']
BOSS_EXT2.forEach((b, i) => {
  const full = opp(b.level, b.name, b.style, { mechanic: b.mechanic, key: b.key })
  full.drops = [...REGION_DROP_BASIC, { itemId: BOSS_DROP_POOL2[i % BOSS_DROP_POOL2.length], chance: 0.2 }]
  COMBAT_BOSSES.push(full)
})

// §4.4.2 首领 标记（成就/任务/掉落统计用）
for (const b of COMBAT_BOSSES) b.isBoss = true

// ── 对决掉落定级平衡 ───────────────────────────────────────────────
// 目标：每件普通掉落物（装备/材料）的等级应与敌人等级匹配（≤ 敌级+5、≥ 敌级-15），
// 去掉超纲/低纲/无等级占位掉落；传说/神话装备为专属掉落，保留 itemId 交由档位定级。
// 只改掉落物 id（保留 chance/qty），不改物品本身、不改敌人等级。
function tierOf(lv) { return Math.min(100, Math.floor(lv / 5) * 5) }
function pickEquip(slot, lv, seed) {
  const pool = EQUIP_POOL[tierOf(lv)]
  const list = pool?.[slot] ?? []
  const all = pool ? Object.values(pool).flat() : []
  const arr = list.length ? list : all
  if (!arr.length) return null
  return arr[seed % arr.length]
}
function pickMat(lv, seed) {
  const pool = MAT_POOL[tierOf(lv)]
  return pool?.[seed % pool.length] ?? null
}
const LEGENDARY_SET = new Set(LEGENDARY)
function rebalanceDrops(e, seed) {
  if (!e || !Array.isArray(e.drops)) return
  const out = []
  let k = seed
  for (const d of e.drops) {
    // 传说/神话专属掉落：按等效等级匹配 BOSS 档位（±8）才保留，否则替换为同级装备/材料
    if (LEGENDARY_SET.has(d.itemId)) {
      const ll = LEGENDARY_LEVEL[d.itemId]
      const LEG = ITEM_LEVEL[d.itemId] == null && ll != null
      if (LEG && Math.abs(e.level - ll) <= 8) { out.push(d); continue }
      // 传说匹配失败 → 按槽位/当材料定级
      const slotLeg = EQUIP_SLOT[d.itemId]
      if (slotLeg) { const nid = pickEquip(slotLeg, e.level, k++); if (nid) out.push({ ...d, itemId: nid }) }
      else { const nid = pickMat(e.level, k++); if (nid) out.push({ ...d, itemId: nid }) }
      continue
    }
    const lv = ITEM_LEVEL[d.itemId]
    const slot = EQUIP_SLOT[d.itemId]
    const ok = lv != null && lv <= e.level + 5 && lv >= e.level - 15
    if (ok) { out.push(d); continue }
    // 装备 → 同级同槽装备；材料/无等级 → 同级材料
    if (slot) {
      const nid = pickEquip(slot, e.level, k++)
      if (nid) out.push({ ...d, itemId: nid })
    } else {
      const nid = pickMat(e.level, k++)
      if (nid) out.push({ ...d, itemId: nid })
    }
  }
  e.drops = out
}
COMBAT_REGIONS.forEach((r, ri) => r.opponents.forEach((o, oi) => rebalanceDrops(o, ri * 10 + oi)))
COMBAT_BOSSES.forEach((b, bi) => rebalanceDrops(b, 1000 + bi))

// 确保每件传说/神话专属掉落至少由一个「档位匹配(±8)」的 BOSS 掉落，避免传说完全断供
function assignLegends() {
  for (const [id, ll] of Object.entries(LEGENDARY_LEVEL)) {
    const has = COMBAT_BOSSES.some((b) => b.drops.some((d) => d.itemId === id))
    if (has) continue
    const best = COMBAT_BOSSES
      .filter((b) => Math.abs(b.level - ll) <= 8)
      .sort((a, b2) => Math.abs(a.level - ll) - Math.abs(b2.level - ll))[0]
    if (best) best.drops.push({ itemId: id, chance: 0.25 })
  }
}
assignLegends()

// 机制定级：强机制只分配给相应等级段的 BOSS（低段禁用秒杀/多阶段等），避免低段失衡
function balanceMechanic(b) {
  if (!b.mechanic) return
  const m = b.mechanic
  if (m.instantKill && b.level < 75) delete m.instantKill
  if (m.phases && b.level < 70) delete m.phases
  if (m.regen && b.level < 30) delete m.regen
  if (m.slowEvery && b.level < 20) delete m.slowEvery
}
COMBAT_BOSSES.forEach((b) => balanceMechanic(b))

