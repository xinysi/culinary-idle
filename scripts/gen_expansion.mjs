// 内容扩充生成器 — 为各系统确定性生成 30+ 个不重复条目
// 运行：node .toolchain/gen_expansion.mjs  → 产出 src/game/data/expansion1.js
// 规则：所有 id/名称唯一；食谱材料引用已存在或本批新增的物品；等级递增
import { writeFileSync } from 'node:fs'

const L = (i) => 1 + Math.floor((i * 98) / 29) // 30 个等级均匀分布 1..99
const IV = (level, base = 3) => Math.min(8, base + level * 0.16) // 间隔秒
const XP = (level) => 8 + level * 4 // 经验/次
const VAL = (level) => Math.round(5 + level * 3.2) // 物品价值

// ── 名称库（每类 30 个，不重复） ──
const FORAGING = ['桃子', '梨', '橙子', '柠檬', '柚子', '樱桃', '蓝莓', '覆盆子', '猕猴桃', '石榴', '红枣', '无花果', '柿子', '荔枝', '龙眼', '枇杷', '山楂', '板栗', '核桃', '杏仁', '花生', '木耳', '银耳', '竹笋', '芦笋', '菠菜', '旱芹', '西兰花', '生菜', '苤蓝']
const FISHING = ['沙丁鱼', '鲱鱼', '鳕鱼', '比目鱼', '石斑鱼', '多宝鱼', '秋刀鱼', '旗鱼', '剑鱼', '黄花鱼', '带鱼', '鲳鱼', '鱿鱼', '章鱼', '墨鱼', '牡蛎', '扇贝', '蛤蜊', '蛏子', '海胆', '海螺', '贻贝', '对虾', '皮皮虾', '罗氏沼虾', '小龙虾', '鲶鱼', '黑鱼', '黄鳝', '泥鳅']
const HUNTING = ['麻雀', '鹌鹑', '鸽子', '斑鸠', '野鸭', '大雁', '獾肉', '果子狸', '豪猪', '羚羊', '岩羊', '盘羊', '麂子', '狍子', '驼鹿', '驯鹿', '野驴', '刺猬', '蛇肉', '蜥蜴', '田鸡', '牛蛙', '竹鼠', '旱獭', '河狸', '水獭', '香猪', '竹鸡', '火鸡', '鸵鸟']
const EXCAVATION = ['白萝卜', '青萝卜', '芜菁', '甜菜', '荸荠', '慈姑', '莲藕', '菱角', '芋头', '木薯', '葛根', '茯苓', '白术', '黄芪', '当归', '川芎', '麦冬', '天麻', '石斛', '黄精', '白芷', '石膏', '硝石', '硫磺', '明矾', '云母', '石英', '翡翠矿', '玛瑙矿', '蓝晶矿']
const COOKING = ['东坡肉', '麻婆豆腐', '宫保鸡丁', '糖醋里脊', '回锅肉', '水煮牛肉', '鱼香茄子', '蚂蚁上树', '干煸豆角', '酸菜鱼', '剁椒鱼尾', '啤酒鸭', '板栗烧鸡', '香菇滑鸡', '白切鸡', '盐焗鸡', '烧鹅', '蜜汁叉烧', '蜜汁火腿', '红烧狮子头', '腌笃鲜', '蟹粉豆腐', '清炒时蔬', '上汤娃娃菜', '蒜蓉炒西兰花', '拔丝苹果', '冰糖雪梨', '银耳莲子羹', '杨枝甘露', '八宝饭']
const BAKING = ['牛角包', '吐司', '贝果', '法棍', '碱水包', '全麦面包', '黑麦面包', '黄油面包', '蒜香面包', '芝士面包', '肉松面包', '红豆面包', '菠萝包', '蛋挞', '马芬', '玛德琳', '可露丽', '泡芙', '提拉米苏', '慕斯蛋糕', '芝士蛋糕', '巧克力蛋糕', '红丝绒蛋糕', '戚风蛋糕', '磅蛋糕', '曲奇', '玛格丽特饼干', '司康', '华夫饼', '肉桂卷']
const PRESERVING = ['腐乳', '豆豉', '甜面酱', '沙茶酱', '花生酱', '芝麻酱', '蛋黄酱', '芥末酱', '黑胡椒酱', '蘑菇酱', '藤椒油', '香醋', '陈醋', '苹果醋', '泡椒', '酸豆角', '梅干菜', '萝卜干', '榨菜', '雪菜', '咸鱼', '鱼干', '虾酱', '蟹酱', '蚝油', '橄榄菜', '酸梅', '酱黄瓜', '卤蛋', '咸柠檬']
const BREWING = ['西瓜汁', '哈密瓜汁', '橙汁', '柠檬汁', '鲜榨猕猴桃汁', '鲜榨蓝莓汁', '鲜榨樱桃汁', '水蜜桃汁', '梨汁', '蜜柚茶', '柠檬茶', '菊花茶', '玫瑰茶', '薄荷凉茶', '姜枣茶', '大麦茶', '玄米茶', '抹茶', '奶茶', '冰红茶', '青梅酒', '桂花酒', '樱桃酒', '蓝莓酒', '黄酒', '清酒', '烧酒', '白兰地', '朗姆酒', '果味汽水']
const SPICE = ['孜然粉', '茴香粉', '香叶粉', '丁香粉', '豆蔻粉', '草果粉', '砂仁粉', '甘草粉', '陈皮粉', '姜黄粉', '芥末粉', '十三香', '卤料包', '火锅底料', '烧烤撒料', '藤椒粉', '山椒粉', '七味粉', '番茄粉', '蘑菇精', '鸡肉精', '高汤块', '虾粉', '海苔粉', '芝麻盐', '蒜盐', '洋葱粉', '芹菜盐', '姜盐', '香草盐粒']
const SMITH_METALS = ['青铜', '秘银', '精金', '玄铁', '星辰']
const SMITH_SLOTS = [
  ['Knife', '刀', 'weapon', { attack: 12, accuracy: 8, critChance: 0.03, speedBonus: 0.2 }],
  ['Pot', '锅', 'offhand', { defense: 16, hpBonus: 22 }],
  ['Board', '砧板', 'offhand', { defense: 12, evasion: 8 }],
  ['Apron', '围裙', 'body', { defense: 13, hpBonus: 15 }],
  ['Hat', '厨师帽', 'helmet', { defense: 9, accuracy: 9 }],
  ['Bottle', '调味瓶', 'amulet', { attack: 6, accuracy: 15, critChance: 0.03 }],
]
const SMITH_QUALITY = { 青铜: '精良', 秘银: '稀有', 精金: '史诗', 玄铁: '传说', 星辰: '神话' }

// 新增采集物品 id：skill 前缀 + 序号
const id = (skill, i, name) => ({ id: `${skill}_ext_${String(i + 1).padStart(2, '0')}`, name, tier: Math.min(10, 1 + Math.floor(i / 3)) })

// ── 组装 ──
const items = {}
const gatheringExt = {}
const gatheringDefs = [
  ['foraging', FORAGING, 'fruit'],
  ['fishing', FISHING, 'seafood'],
  ['hunting', HUNTING, 'meat'],
  ['excavation', EXCAVATION, 'root'],
]
for (const [skill, names, cat] of gatheringDefs) {
  gatheringExt[skill] = names.map((name, i) => {
    const { id: itemId, tier } = id(skill, i, name)
    items[itemId] = { id: itemId, name, type: 'ingredient', category: cat, tier, value: VAL(L(i)), stackable: true, maxStack: 9999 }
    return { itemId, reqLevel: L(i), xpPerAction: XP(L(i)), intervalSec: Math.round(IV(L(i)) * 10) / 10 }
  })
}

// 制作类扩展：材料池 = 现有食材（tier 匹配）+ 新采集物
const PROD = {
  cooking: { names: COOKING, type: 'food', cats: ['主食', '主菜', '汤品', '甜点'], heal: (l) => 15 + l * 8 },
  baking: { names: BAKING, type: 'food', cats: ['主食', '甜点'], heal: (l) => 12 + l * 6, regen: true },
  preserving: { names: PRESERVING, type: 'ingredient', cats: ['pickled', 'sauce'] },
  brewing: { names: BREWING, type: 'drink', cats: ['juice', 'tea', 'wine'], heal: (l) => 12 + l * 7 },
  spiceMixing: { names: SPICE, type: 'spice', cats: ['seasoning'] },
}
const prodExt = {}
for (const [skill, cfg] of Object.entries(PROD)) {
  prodExt[skill] = cfg.names.map((name, i) => {
    const level = L(i)
    const outId = `${skill}_ext_${String(i + 1).padStart(2, '0')}`
    const tier = Math.min(10, 1 + Math.floor(i / 3))
    const extra = {}
    if (cfg.heal) extra.heal = cfg.heal(level)
    if (cfg.regen) extra.regen = { perTurn: 2 + Math.floor(level / 5), turns: 4 }
    items[outId] = { id: outId, name, type: cfg.type, category: cfg.cats[i % cfg.cats.length], tier, value: VAL(level), stackable: true, maxStack: 9999, ...extra }
    // 材料：从新采集物品池里选 2-3 个 tier 匹配的（确定性轮转）
    const pool = Object.values(gatheringExt).flat().filter((t) => t.reqLevel <= level)
    const ings = {}
    for (let k = 0; k < 2 + (i % 2); k++) {
      const pick = pool[(i * 3 + k * 5) % pool.length]
      ings[pick.itemId] = 1 + ((i + k) % 3)
    }
    return { id: `${skill}_rec_${String(i + 1).padStart(2, '0')}`, name, category: cfg.cats[i % cfg.cats.length], reqLevel: level, xp: level * 14, successChance: Math.max(0.5, Math.round((0.92 - level * 0.0035) * 100) / 100), ingredients: ings, output: { itemId: outId, qty: 1 } }
  })
}

// 厨具锻造 +30：5 种新金属 × 6 槽
const smithExt = []
let smithIdx = 0
for (const metal of SMITH_METALS) {
  for (const [suf, cn, slot, baseStats] of SMITH_SLOTS) {
    smithIdx++
    const level = L(smithIdx - 1)
    const outId = `smith_ext_${String(smithIdx).padStart(2, '0')}`
    const stats = { ...baseStats }
    const mult = 1 + smithIdx * 0.06
    for (const k of Object.keys(stats)) stats[k] = Math.round(stats[k] * mult * 10) / 10
    items[outId] = { id: outId, name: `${metal}${cn}`, type: 'equipment', category: slot, tier: Math.min(10, 1 + Math.floor(smithIdx / 6)), value: VAL(level) * 8, stackable: false, slot, quality: SMITH_QUALITY[metal], stats }
    smithExt.push({ id: `smith_rec_${String(smithIdx).padStart(2, '0')}`, name: `${metal}${cn}`, category: cn, reqLevel: level, xp: level * 16, successChance: Math.max(0.5, Math.round((0.9 - level * 0.0035) * 100) / 100), ingredients: { ironOre: 4 + Math.floor(smithIdx / 6), saltOre: 2, spiritFruit: 1 }, output: { itemId: outId, qty: 1 } })
  }
}

// 食材保鲜 +10
const PRESERVE = [
  ['pres_ext_01', '黄金保鲜剂', 96 * 3600_000],
  ['pres_ext_02', '翡翠保鲜剂', 144 * 3600_000],
  ['pres_ext_03', '龙涎保鲜剂', 216 * 3600_000],
  ['pres_ext_04', '急速保鲜剂', 48 * 3600_000],
  ['pres_ext_05', '云雾保鲜剂', 72 * 3600_000],
]
const preserveExt = []
for (let i = 0; i < 10; i++) {
  const level = L(i)
  if (i < 5) {
    const [outId, name, ms] = PRESERVE[i]
    items[outId] = { id: outId, name, type: 'consumable', category: 'preserving', tier: 1 + Math.floor(i / 2), value: 100 + i * 60, stackable: true, maxStack: 9999, use: { refreshSpoilMs: ms } }
    preserveExt.push({ id: `pres_rec_${String(i + 1).padStart(2, '0')}`, name, category: '保鲜', reqLevel: level, xp: level * 14, successChance: 0.7, ingredients: { saltOre: 3, truffle: 1 + (i % 2), spiritFruit: 1 + (i % 3) }, output: { itemId: outId, qty: 1 } })
  } else {
    const kind = i % 2 === 0 ? 'xp' : 'yield'
    const mult = 1.5 + (i % 4) * 0.5
    const outId = `pres_ext_${String(i + 1).padStart(2, '0')}`
    const name = `${kind === 'xp' ? '智慧' : '丰饶'}增益剂${['·精英', '·大师', '·宗师', '·传说', '·神话'][i - 5]}`
    items[outId] = { id: outId, name, type: 'consumable', category: 'preserving', tier: 3 + i, value: 200 + i * 120, stackable: true, maxStack: 9999, use: kind === 'xp' ? { buffXp: { mult, minutes: 30 + i * 10 } } : { buffYield: { mult, minutes: 30 + i * 10 } } }
    preserveExt.push({ id: `pres_rec_${String(i + 1).padStart(2, '0')}`, name, category: '增益', reqLevel: level, xp: level * 14, successChance: 0.65, ingredients: { saltOre: 3, dragonRoot: 1, lingzhi: 1 + (i % 2) }, output: { itemId: outId, qty: 1 } })
  }
}

// 美食知识（奥义）+10
const AOJI = [
  ['aoji_secret_knife', '秘传刀工', '攻击', '刀工伤害 +15%', 0.7, { styleDmgPct: { knife: 15 } }],
  ['aoji_secret_plating', '精准摆盘', '攻击', '摆盘伤害 +15%', 0.7, { styleDmgPct: { plating: 15 } }],
  ['aoji_secret_flavor', '调香大师', '攻击', '调味伤害 +15%', 0.7, { styleDmgPct: { flavor: 15 } }],
  ['aoji_perfect_heat', '完美火候', '防御', '受到伤害 -20%', 0.9, { defensePct: 20 }],
  ['aoji_wind_step', '疾风步', '防御', '攻击速度 +15%', 0.5, { speedPct: 15 }],
  ['aoji_iron_gut2', '钢铁肠胃', '防御', '最大品鉴值 +40', 1.0, { maxHpBonus: 40 }],
  ['aoji_harvest_feast', '丰收盛宴', '采集', '采集产量 +40%', 0.6, { yieldPct: 40 }],
  ['aoji_knowledge_spring', '智慧泉涌', '采集', '全部技能经验 +20%', 1.6, { xpPct: 20 }],
  ['aoji_soul_of_food', '料理之魂', '防御', '对决中料理回血 +100%', 1.4, { healPct: 100 }],
  ['aoji_berserk', '狂澜之心', '攻击', '伤害 +15%，防御 -10%', 1.2, { dmgPct: 15, defensePct: -10 }],
]
const aojiExt = AOJI.map(([id, name, category, desc, costPerSec, effect]) => ({ id, name, category, desc, costPerSec, effect }))

// 美食探索 +20
const EXPLORE_NAMES = ['巷口茶寮', '渔市码头', '山货猎人', '古法豆坊', '野炊营地', '庙会食摊', '蒸汽小吃铺', '温泉旅馆', '粮仓守夜人', '蜂农小屋', '盐田工人', '果园园主', '酿酒作坊', '老茶庄', '古籍食阁', '江湖厨侠', '御膳房旧部', '食神侍从', '传说面馆', '饕餮秘窟']
const explorationExt = EXPLORE_NAMES.map((name, i) => {
  const level = 2 + Math.floor((i * 96) / 19)
  const pool = Object.values(gatheringExt).flat()
  const loot = [
    { type: 'gold', min: 5 + level, max: 15 + level * 2, chance: 0.6 },
    { type: 'item', itemId: pool[i % pool.length].itemId, min: 1, max: 3, chance: 0.3 },
    { type: 'item', itemId: pool[(i * 7 + 3) % pool.length].itemId, min: 1, max: 2, chance: 0.2 },
  ]
  return { id: `explore_ext_${String(i + 1).padStart(2, '0')}`, name, reqLevel: level, intervalSec: Math.round((3.2 + i * 0.2) * 10) / 10, xp: XP(level), baseSuccess: Math.max(0.55, Math.round((0.85 - i * 0.012) * 100) / 100), failGold: 5 + level, loot }
})

// 食灵召唤 +10
const SPIRITS = [
  ['spirit_ext_01', '葡萄精灵', 50, { grape: 20, salt: 5 }, { xpPct: { foraging: 5 } }],
  ['spirit_ext_02', '萝卜精灵', 55, { excavation_ext_01: 20, potato: 10 }, { farmYieldBonus: 1 }],
  ['spirit_ext_03', '对虾精灵', 60, { fishing_ext_20: 15, tuna: 5 }, { fishingAccPct: 3 }],
  ['spirit_ext_04', '野鸭精灵', 65, { hunting_ext_05: 10, rabbitMeat: 5 }, { xpPct: { hunting: 8 } }],
  ['spirit_ext_05', '莲藕精灵', 70, { excavation_ext_07: 10, lingzhi: 3 }, { healPerTurnPct: 2 }],
  ['spirit_ext_06', '银耳精灵', 75, { foraging_ext_22: 10, truffle: 2 }, { xpPct: { cooking: 8 } }],
  ['spirit_ext_07', '抹茶精灵', 80, { brewing_ext_23: 5, vanilla: 5 }, { xpPct: { brewing: 8 } }],
  ['spirit_ext_08', '星辰精灵', 85, { smith_ext_30: 1, spiritFruit: 3 }, { styleDmgPct: { plating: 12 } }],
  ['spirit_ext_09', '玄铁精灵', 90, { smith_ext_24: 1, dragonRoot: 3 }, { dmgPct: 10, loseHpPerTurnPct: 1 }],
  ['spirit_ext_10', '饕餮精灵', 95, { godFeast: 1, goldenDragonFish: 2 }, { dmgPct: 20, loseHpPerTurnPct: 3 }],
]
const spiritExt = []
for (const [spId, name, reqLevel, contract, effect] of SPIRITS) {
  items[spId] = { id: spId, name, type: 'spirit', category: 'spirit', tier: Math.min(10, Math.ceil(reqLevel / 10)), value: reqLevel * 40, stackable: false }
  spiritExt.push({ id: spId, name, reqLevel, contract, effect })
}

// 对决：10 区域 × 10 新对手（组合名生成）
const ROLE = ['学徒', '厨师', '摊主', '师傅', '大厨', '主厨', '店长', '老板', '达人', '高手']
const FLAVOR = ['青', '红', '白', '甜', '辣', '麻', '酸', '咸', '香', '油']
const regionExt = []
const REGION_RANGES = [
  [1, 10], [10, 20], [20, 35], [30, 45], [40, 55], [50, 65], [60, 75], [70, 85], [80, 95], [90, 99],
]
const STYLES = ['knife', 'plating', 'flavor']
for (let r = 0; r < 10; r++) {
  const [lo, hi] = REGION_RANGES[r]
  const list = []
  for (let k = 0; k < 10; k++) {
    const lvl = lo + Math.floor(((hi - lo) * (k + 0.5)) / 10)
    list.push({ name: `${FLAVOR[(r + k) % 10]}${ROLE[(r * 3 + k) % 10]}`, level: lvl, style: STYLES[(r + k) % 3] })
  }
  regionExt.push({ regionIndex: r, opponents: list })
}

// BOSS +10
const BOSSES = [
  ['汤王', 12, 'flavor', { regen: true }, 'brothKing'],
  ['刀圣', 30, 'knife', { slowEvery: 6 }, 'bladeSaint'],
  ['酒仙', 45, 'flavor', { burn: true }, 'drunkMaster'],
  ['面神', 58, 'plating', { instantKill: true }, 'noodleGod'],
  ['蟹皇', 68, 'plating', { poison: true }, 'crabEmperor'],
  ['火魔', 78, 'knife', { burn: true, phases: true }, 'fireDemon'],
  ['冰王', 88, 'flavor', { regen: true, slowEvery: 4 }, 'iceKing'],
  ['毒后', 93, 'flavor', { poison: true, instantKill: true }, 'poisonQueen'],
  ['混沌厨魔', 96, 'knife', { randomStyle: true, phases: true }, 'chaosChef'],
  ['禁忌食神', 100, 'flavor', { instantKill: true, phases: true }, 'forbiddenGod'],
]
const bossExt = BOSSES.map(([name, level, style, mechanic, key]) => ({ key, name, level, style, mechanic }))

// ── 输出模块 ──
const out = `// 内容扩充（生成器产出，勿手改）— ${new Date().toISOString().slice(0, 10)}
// 覆盖：采摘/垂钓/狩猎/挖掘 各+30 食材 · 烹饪/烘焙/腌制/调酒/调料调配 各+30 食谱 ·
// 厨具锻造+30 装备 · 食材保鲜+10 · 美食知识+10 奥义 · 美食探索+20 目标 · 食灵+10 · 对决区域+100 对手 · BOSS+10
export const EXPANSION_ITEMS = ${JSON.stringify(items, null, 1)}
export const GATHERING_EXT = ${JSON.stringify(gatheringExt, null, 1)}
export const PRODUCTION_EXT = ${JSON.stringify(prodExt, null, 1)}
export const SMITHING_EXT = ${JSON.stringify(smithExt, null, 1)}
export const PRESERVE_EXT = ${JSON.stringify(preserveExt, null, 1)}
export const AOJI_EXT = ${JSON.stringify(aojiExt, null, 1)}
export const EXPLORATION_EXT = ${JSON.stringify(explorationExt, null, 1)}
export const SPIRIT_EXT = ${JSON.stringify(spiritExt, null, 1)}
export const REGION_EXT = ${JSON.stringify(regionExt, null, 1)}
export const BOSS_EXT = ${JSON.stringify(bossExt, null, 1)}
`
writeFileSync(new URL('../src/game/data/expansion1.js', import.meta.url), out)
console.log('generated expansion1.js')
// 摘要
const total = Object.keys(items).length
const recipeCount = Object.values(prodExt).reduce((s, a) => s + a.length, 0) + smithExt.length + preserveExt.length
console.log(`items=${total}  recipes=${recipeCount}  aojis=${AOJI.length}  explore=${EXPLORE_NAMES.length}  spirits=${SPIRITS.length}  opponents=${regionExt.reduce((s, r) => s + r.opponents.length, 0)}  bosses=${BOSSES.length}`)
