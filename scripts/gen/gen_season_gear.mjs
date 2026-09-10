// 赛季装备套件生成器 — 每赛季一套 8 件（武器/头盔/身体/腿部/脚部/副手/饰品1/饰品2）
// 装备名 = 赛季名（去「季」）+ 槽位词缀；套件按 10 档奖励发放（每档 1 件 + 原限定并入末档）
// 运行：node scripts/gen/gen_season_gear.mjs → 产出 src/game/data/expansion_gear.js
import { writeFileSync } from 'node:fs'
import { SEASONS } from '../../src/game/data/seasons.js'

// 槽位顺序与基础属性（§5.1 八槽位）
const SLOT_GEAR = [
  ['weapon', { attack: 26, accuracy: 14, speedBonus: 0.15 }],
  ['helmet', { defense: 12, accuracy: 8 }],
  ['body', { defense: 18, hpBonus: 20 }],
  ['legs', { defense: 14, evasion: 6 }],
  ['boots', { defense: 10, evasion: 8 }],
  ['offhand', { defense: 16, hpBonus: 18 }],
  ['amulet', { attack: 7, accuracy: 12 }],
  ['ring', { attack: 6, critChance: 0.03 }],
]

// 命名多样化：同季 8 件使用不同修饰词 + 不同槽位词（一套名字各不相同，非仅换尾字）
const MODIFIERS = ['琉璃', '秘银', '星辰', '烈焰', '寒霜', '紫金', '玄晶', '玉髓']
const SUFFIX_POOL = {
  weapon: ['刃', '剑', '刀', '锏'],
  helmet: ['冠', '冕', '盔'],
  body: ['袍', '铠', '衣'],
  legs: ['腿甲', '裙甲', '裤'],
  boots: ['靴', '履'],
  offhand: ['釜', '锅', '盾', '匣'],
  amulet: ['链', '坠', '珠'],
  ring: ['戒', '环'],
}
// 每季独立主题前缀：与赛季名不重复、贴合赛季主题（40 个互不相同）
const SEASON_PREFIXES = {
  summer: '烈阳流金', winter: '暖釜凝霜', spring: '春霖破土', autumn: '金穗满仓', ocean: '碧涛逐浪', forest: '林深菌语',
  desert: '沙暴藏香', berry: '浆果醉甜', summit: '雪岭觅灵', tea: '茶烟袅袅', spice: '香途万里', pickle: '坛藏岁月',
  lotus: '荷风映月', ember: '炭火炙香', snow: '冰霜蜜语', moon: '蟾宫折桂', chili: '赤焰灼心', pirate: '碧湾藏珍',
  coral: '珊瑚叠影', galaxy: '星河盛宴', blossom: '樱雪纷飞', mooncake2: '蟹肥菊黄', grape: '紫葡凝露', honey2: '蜜意花间',
  citrus: '金橙暖阳', chestnut: '栗香满城', snow2: '雾凇凝华', bamboo: '竹影清风', ocean2: '珠辉碧波', pine: '松风煮雪',
  plum: '雪径寻梅', eggplant: '紫茄晕墨', goat: '羊脂暖冬', ginkgo: '杏叶鎏金', taro: '芋香绵柔', sesame: '芝香盈门',
  chili2: '赤烬焚天', wine: '玉露琼浆', phoenix: '凤舞九天', dragon2: '龙吟四海',
}
// 一套装备前缀各不相同：每件 = 季核心字(前缀前 2 字) + 不同意境词（8 件 8 个不同前缀）
const CORE_WORDS = ['焚天', '燎原', '裂空', '涅槃', '熔岩', '星火', '映日', '流霞']
const TIER_POINTS = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200] // 10 档需求，总和 1100

const gearItems = {}
const seasonGear = []
const usedNames = new Set()

for (const s of SEASONS) {
  const base = SEASON_PREFIXES[s.id] ?? s.name.replace('季', '').trim()
  const core = base.slice(0, 2) // 季核心字（2 字）
  const ids = []
  SLOT_GEAR.forEach(([slot, stats], slotIdx) => {
    const itemId = `${s.id}_gear_${slot}`
    const suffixPool = SUFFIX_POOL[slot]
    const suffix = suffixPool[(s.id.length + slotIdx) % suffixPool.length]
    const modifier = MODIFIERS[(slotIdx + s.id.length) % MODIFIERS.length]
    const word = CORE_WORDS[(slotIdx + s.id.length) % CORE_WORDS.length] // 每件不同意境词 → 前缀各不相同
    const prefix = `${core}${word}`
    let name = `${prefix}${modifier}${suffix}`
    let n = 2
    while (usedNames.has(name)) name = `${prefix}${modifier}${suffix}${n++}`
    usedNames.add(name)
    gearItems[itemId] = { id: itemId, name, type: 'equipment', category: slot, tier: 7, value: 1500, stackable: false, slot, quality: '传说', stats: { ...stats } }
    ids.push(itemId)
  })
  // 10 档奖励（逐档稀有）：金币/道具 + 套件 8 件分散发放（末档含原限定）
  const tiers = [
    { points: TIER_POINTS[0], reward: { gold: 300 } },
    { points: TIER_POINTS[1], reward: { items: { energyBiscuit: 3 } } },
    { points: TIER_POINTS[2], reward: { items: { [ids[0]]: 1 } } },
    { points: TIER_POINTS[3], reward: { items: { mysterySpice: 2 } } },
    { points: TIER_POINTS[4], reward: { items: { [ids[1]]: 1, [ids[2]]: 1 } } },
    { points: TIER_POINTS[5], reward: { items: { pres_ext2_06: 1 } } },
    { points: TIER_POINTS[6], reward: { items: { [ids[3]]: 1, [ids[4]]: 1 } } },
    { points: TIER_POINTS[7], reward: { gold: 2000 } },
    { points: TIER_POINTS[8], reward: { items: { [ids[5]]: 1, [ids[6]]: 1 } } },
    { points: TIER_POINTS[9], reward: { gold: 5000, items: { [ids[7]]: 1, [s.limitedItem]: 1 } } },
  ]
  seasonGear.push({ seasonId: s.id, slots: ids, tiers })
}

const out = `// 赛季装备套件（生成器产出，勿手改）— ${new Date().toISOString().slice(0, 10)}
// 每赛季一套 8 件（武器/头盔/身体/腿部/脚部/副手/饰品1/饰品2），名字随赛季适配，按 10 档奖励发放
export const EXPANSION_GEAR_ITEMS = ${JSON.stringify(gearItems, null, 1)}
export const SEASONS_GEAR = ${JSON.stringify(seasonGear, null, 1)}
`
writeFileSync(new URL('../src/game/data/expansion_gear.js', import.meta.url), out)
console.log('generated expansion_gear.js')
console.log(`gear items=${Object.keys(gearItems).length}  seasons=${seasonGear.length}（每季 8 件）`)
