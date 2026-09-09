// 内容扩充二期生成器 — 各系统再 +30 不重复条目（数值/掉落/限定装备同步）
// 运行：node scripts/gen_expansion2.mjs  → 产出 src/game/data/expansion2.js
// 规则：所有 id/名称唯一；食谱材料引用已存在物品；等级递增；赛季任务目标从「未用过」物品池分配
import { writeFileSync } from 'node:fs'
import { ITEMS } from '../src/game/data/items.js'
import { SEASONS } from '../src/game/data/seasons.js'

const L = (i) => 1 + Math.floor((i * 98) / 29)
const IV = (level, base = 3) => Math.min(8, base + level * 0.16)
const XP = (level) => 8 + level * 4
const VAL = (level) => Math.round(5 + level * 3.2)

// ── 二期名称库（30/类，与一期不重复） ──
const FORAGING = ['杏', '李子', '青梅', '杨桃', '莲雾', '百香果', '山竹', '番石榴', '火龙果', '甘蔗', '椰子', '腰果', '榛子', '开心果', '松子', '枸杞', '桑葚', '油桃', '蟠桃', '蜜柑', '金桔', '佛手柑', '番荔枝', '释迦', '菠萝蜜', '人参果', '雪莲果', '沙棘', '橄榄', '酸枣']
const FISHING = ['鲷鱼', '河豚', '银鱼', '凤尾鱼', '虹鳟', '香鱼', '鲟鱼', '白鲢', '花鲢', '青鱼', '草鱼', '罗非鱼', '巴沙鱼', '武昌鱼', '石花菜', '龙须菜', '裙带菜', '海带', '紫菜', '淡菜', '赤贝', '鸟贝', '血蛤', '毛蚶', '象拔蚌', '带子', '青蟹', '花蟹', '梭子蟹', '海蜇']
const HUNTING = ['獐子', '麋鹿', '黄羊', '青羊', '岩貂', '紫貂', '雪貂', '松鼠', '飞鼠', '蜜獾', '狼獾', '猞猁', '豹猫', '田鼠', '鼬', '鼢鼠', '竹蜂', '蝗虫', '蝉', '蝎子', '鹧鸪', '白鹇', '锦鸡', '孔雀', '鸸鹋', '斑马', '角马', '食蚁兽', '箭猪', '水豚']
const EXCAVATION = ['半夏', '苦参', '柴胡', '防风', '苍术', '厚朴', '杜仲', '女贞子', '五味子', '金樱子', '山茱萸', '吴茱萸', '紫石英', '绿松石', '红宝石矿', '祖母绿矿', '钻石矿', '黄金矿', '白银矿', '锡矿', '铅矿', '锌矿', '镍矿', '钴矿', '钨矿', '钛矿', '锰矿', '钒矿', '石墨', '萤石']
const COOKING = ['香酥鸭', '口水鸡', '夫妻肺片', '毛血旺', '辣子鸡', '干锅花菜', '家常鱼香肉丝', '京酱肉丝', '木须肉', '锅包肉', '地三鲜', '虎皮青椒', '红烧茄子', '蒜香油焖大虾', '白灼虾', '清蒸鲈鱼', '红烧鲫鱼', '糖醋鱼', '烤鱼', '石锅拌饭', '咖喱鸡', '泰式咖喱', '意大利面', '披萨', '汉堡', '三明治', '寿司卷', '天妇罗', '关东煮', '部队锅']
const BAKING = ['佛卡夏', '恰巴塔', '布里欧修', '丹麦酥', '蝴蝶酥', '杏仁酥', '桃酥', '沙琪玛', '米花糖', '麻薯', '大福', '铜锣烧', '鲷鱼烧', '可丽饼', '班戟', '舒芙蕾', '布丁', '焦糖布丁', '法式吐司', '面包布丁', '肉桂面包', '核桃欧包', '黑芝麻包', '抹茶面包', '红豆糕', '绿豆糕', '桂花糕', '马拉糕', '萝卜糕', '枣泥糕']
const PRESERVING = ['酱油膏', '老抽', '生抽', '梅子酱', '菠萝酱', '草莓酱', '蓝莓酱', '苹果酱', '橙子酱', '桃子酱', '杏子酱', '柚子酱', '樱桃酱', '葡萄酱', '芒果酱', '猕猴桃酱', '山楂酱', '枣泥', '豆沙', '莲蓉', '椰蓉', '芝麻馅', '五仁馅', '腊肠', '烟熏腊肉', '酱鸭', '酱肘子', '酱牛肉', '咸鸭蛋', '皮蛋']
const BREWING = ['酸梅汤', '冬瓜茶', '洛神花茶', '桂圆红枣茶', '枸杞茶', '茉莉花茶', '乌龙茶', '铁观音', '普洱茶', '龙井', '碧螺春', '白桃汽水', '姜汁汽水', '柠檬苏打水', '苹果汽水', '葡萄汽水', '杨梅酒', '荔枝酒', '龙眼酒', '桃酒', '青苹果酒', '梨酒', '西瓜酒', '香蕉酒', '金芒酒', '菠萝酒', '椰子酒', '青柠汁', '百香果汁', '山竹汁']
const SPICE = ['麻辣粉', '香辣粉', '椒麻粉', '照烧汁', '甜辣酱', '金银蒜蓉酱', '香草酱', '薄荷酱', '柠檬胡椒盐', '黑松露盐', '海盐', '玫瑰盐', '竹盐', '低钠盐', '烤肉酱', '蜜汁酱', '咖喱膏', '沙姜粉', '卤味五香粉', '桂皮粉', '花椒粉', '青花椒粉', '黑胡椒粉', '迷迭香盐', '百里香粉', '牛至粉', '罗勒粉', '鼠尾草粉', '欧芹碎', '莳萝粉']
const SMITH_METALS2 = ['寒铁', '陨铁', '龙鳞', '琉璃', '鎏金']
const SMITH_SLOTS = [
  ['Knife', '刀', 'weapon', { attack: 12, accuracy: 8, critChance: 0.03, speedBonus: 0.2 }],
  ['Pot', '锅', 'offhand', { defense: 16, hpBonus: 22 }],
  ['Board', '砧板', 'offhand', { defense: 12, evasion: 8 }],
  ['Apron', '围裙', 'body', { defense: 13, hpBonus: 15 }],
  ['Hat', '厨师帽', 'helmet', { defense: 9, accuracy: 9 }],
  ['Bottle', '调味瓶', 'amulet', { attack: 6, accuracy: 15, critChance: 0.03 }],
]
const SMITH_QUALITY2 = { 寒铁: '传说', 陨铁: '传说', 龙鳞: '神话', 琉璃: '神话', 鎏金: '神话' }

const items = {}
const gatheringExt2 = {}
const gatheringDefs = [
  ['foraging', FORAGING, 'fruit'],
  ['fishing', FISHING, 'seafood'],
  ['hunting', HUNTING, 'meat'],
  ['excavation', EXCAVATION, 'root'],
]
for (const [skill, names, cat] of gatheringDefs) {
  gatheringExt2[skill] = names.map((name, i) => {
    const itemId = `${skill}_ext2_${String(i + 1).padStart(2, '0')}`
    const level = L(i)
    items[itemId] = { id: itemId, name, type: 'ingredient', category: cat, tier: Math.min(10, 1 + Math.floor(i / 3)), value: VAL(level), stackable: true, maxStack: 9999 }
    return { itemId, reqLevel: level, xpPerAction: XP(level), intervalSec: Math.round(IV(level) * 10) / 10 }
  })
}

const PROD = {
  cooking: { names: COOKING, type: 'food', cats: ['主食', '主菜', '汤品', '甜点'], heal: (l) => 15 + l * 8 },
  baking: { names: BAKING, type: 'food', cats: ['主食', '甜点'], heal: (l) => 12 + l * 6, regen: true },
  preserving: { names: PRESERVING, type: 'ingredient', cats: ['pickled', 'sauce'] },
  brewing: { names: BREWING, type: 'drink', cats: ['juice', 'tea', 'wine'], heal: (l) => 12 + l * 7 },
  spiceMixing: { names: SPICE, type: 'spice', cats: ['seasoning'] },
}
const prodExt2 = {}
for (const [skill, cfg] of Object.entries(PROD)) {
  prodExt2[skill] = cfg.names.map((name, i) => {
    const level = L(i)
    const outId = `${skill}_ext2_${String(i + 1).padStart(2, '0')}`
    const extra = {}
    if (cfg.heal) extra.heal = cfg.heal(level)
    if (cfg.regen) extra.regen = { perTurn: 2 + Math.floor(level / 5), turns: 4 }
    items[outId] = { id: outId, name, type: cfg.type, category: cfg.cats[i % cfg.cats.length], tier: Math.min(10, 1 + Math.floor(i / 3)), value: VAL(level), stackable: true, maxStack: 9999, ...extra }
    const pool = Object.values(gatheringExt2).flat().filter((t) => t.reqLevel <= level)
    const ings = {}
    for (let k = 0; k < 2 + (i % 2); k++) {
      const pick = pool[(i * 3 + k * 5) % pool.length]
      ings[pick.itemId] = 1 + ((i + k) % 3)
    }
    return { id: `${skill}_rec2_${String(i + 1).padStart(2, '0')}`, name, category: cfg.cats[i % cfg.cats.length], reqLevel: level, xp: level * 14, successChance: Math.max(0.5, Math.round((0.92 - level * 0.0035) * 100) / 100), ingredients: ings, output: { itemId: outId, qty: 1 } }
  })
}

// 锻造二期：5 金属 × 6 槽
const smithExt2 = []
let si = 0
for (const metal of SMITH_METALS2) {
  for (const [suf, cn, slot, baseStats] of SMITH_SLOTS) {
    si++
    const level = L(si - 1)
    const outId = `smith_ext2_${String(si).padStart(2, '0')}`
    const stats = {}
    for (const [k, v] of Object.entries(baseStats)) stats[k] = Math.round(v * (1 + si * 0.08) * 10) / 10
    items[outId] = { id: outId, name: `${metal}${cn}`, type: 'equipment', category: slot, tier: Math.min(10, 1 + Math.floor(si / 6)), value: VAL(level) * 10, stackable: false, slot, quality: SMITH_QUALITY2[metal], stats }
    smithExt2.push({ id: `smith_rec2_${String(si).padStart(2, '0')}`, name: `${metal}${cn}`, category: cn, reqLevel: level, xp: level * 16, successChance: Math.max(0.5, Math.round((0.9 - level * 0.0035) * 100) / 100), ingredients: { ironOre: 4 + Math.floor(si / 6), saltOre: 2, spiritFruit: 1 }, output: { itemId: outId, qty: 1 } })
  }
}

// 保鲜二期 +10
const preserveExt2 = []
for (let i = 0; i < 10; i++) {
  const level = L(i)
  const outId = `pres_ext2_${String(i + 1).padStart(2, '0')}`
  if (i < 5) {
    const hours = [72, 120, 168, 240, 360][i]
    const names = ['凝霜保鲜剂', '冰晶保鲜剂', '永鲜保鲜剂', '时光保鲜剂', '不朽保鲜剂']
    items[outId] = { id: outId, name: names[i], type: 'consumable', category: 'preserving', tier: 2 + i, value: 150 + i * 80, stackable: true, maxStack: 9999, use: { refreshSpoilMs: hours * 3600_000 } }
    preserveExt2.push({ id: `pres_rec2_${String(i + 1).padStart(2, '0')}`, name: names[i], category: '保鲜', reqLevel: level, xp: level * 14, successChance: 0.7, ingredients: { saltOre: 3, truffle: 1 + (i % 2), dragonRoot: 1 }, output: { itemId: outId, qty: 1 } })
  } else {
    const kind = i % 2 === 0 ? 'xp' : 'yield'
    const mult = 3 + (i - 5)
    const names = ['天启增益剂', '神谕增益剂', '混沌增益剂', '创世增益剂', '真理增益剂']
    items[outId] = { id: outId, name: names[i - 5], type: 'consumable', category: 'preserving', tier: 5 + i, value: 400 + i * 200, stackable: true, maxStack: 9999, use: kind === 'xp' ? { buffXp: { mult, minutes: 60 + i * 15 } } : { buffYield: { mult, minutes: 60 + i * 15 } } }
    preserveExt2.push({ id: `pres_rec2_${String(i + 1).padStart(2, '0')}`, name: names[i - 5], category: '增益', reqLevel: level, xp: level * 14, successChance: 0.65, ingredients: { saltOre: 3, dragonRoot: 2, lingzhi: 2 }, output: { itemId: outId, qty: 1 } })
  }
}

// 奥义二期 +10
const AOJI2 = [
  ['aoji2_blade_tide', '刀势如虹', '攻击', '刀工伤害 +25%', 1.1, { styleDmgPct: { knife: 25 } }],
  ['aoji2_plate_feast', '盛宴摆盘', '攻击', '摆盘伤害 +25%', 1.1, { styleDmgPct: { plating: 25 } }],
  ['aoji2_flavor_harmony', '百味调和', '攻击', '调味伤害 +25%', 1.1, { styleDmgPct: { flavor: 25 } }],
  ['aoji2_iron_wall', '铁壁铜墙', '防御', '受到伤害 -30%', 1.3, { defensePct: 30 }],
  ['aoji2_swift_thunder', '疾风迅雷', '防御', '攻击速度 +25%', 0.8, { speedPct: 25 }],
  ['aoji2_bedrock', '磐石之躯', '防御', '最大品鉴值 +80', 1.6, { maxHpBonus: 80 }],
  ['aoji2_grain_abund', '五谷丰登', '采集', '采集产量 +60%', 0.9, { yieldPct: 60 }],
  ['aoji2_erudite', '博学多才', '采集', '全部技能经验 +30%', 2.2, { xpPct: 30 }],
  ['aoji2_life_praise', '生命礼赞', '防御', '对决中料理回血 +150%', 1.8, { healPct: 150 }],
  ['aoji2_berserk2', '狂怒爆发', '攻击', '伤害 +30%，防御 -20%', 1.7, { dmgPct: 30, defensePct: -20 }],
]

// 探索二期 +20
const EXPLORE2 = ['云雾茶庄', '火山温泉', '古墓食堂', '龙宫宴厅', '云端天厨', '海底食城', '沙漠绿洲', '极地冰屋', '雨林部落', '石窟壁画坊', '铁匠酒馆', '药膳堂', '夜市烟火', '宫廷御膳房', '江湖客栈', '魔界食堂', '精灵果园', '机械厨房', '未来餐厅', '神话盛宴']
const explorationExt2 = EXPLORE2.map((name, i) => {
  const level = 2 + Math.floor((i * 96) / 19)
  const pool = Object.values(gatheringExt2).flat()
  return {
    id: `explore_ext2_${String(i + 1).padStart(2, '0')}`,
    name,
    reqLevel: level,
    intervalSec: Math.round((3.2 + i * 0.2) * 10) / 10,
    xp: XP(level),
    baseSuccess: Math.max(0.55, Math.round((0.85 - i * 0.012) * 100) / 100),
    failGold: 5 + level,
    loot: [
      { type: 'gold', min: 5 + level, max: 15 + level * 2, chance: 0.6 },
      { type: 'item', itemId: pool[i % pool.length].itemId, min: 1, max: 3, chance: 0.3 },
      { type: 'item', itemId: pool[(i * 7 + 3) % pool.length].itemId, min: 1, max: 2, chance: 0.2 },
    ],
  }
})

// 食灵二期 +10
const SPIRITS2 = [
  ['spirit_ext2_01', '杏子精灵', 50, { foraging_ext2_01: 20, salt: 5 }, { xpPct: { foraging: 5 } }],
  ['spirit_ext2_02', '河豚精灵', 55, { fishing_ext2_02: 15, tuna: 5 }, { fishingAccPct: 4 }],
  ['spirit_ext2_03', '紫貂精灵', 60, { hunting_ext2_07: 10, rabbitMeat: 5 }, { xpPct: { hunting: 8 } }],
  ['spirit_ext2_04', '钻石精灵', 65, { excavation_ext2_15: 5, spiritFruit: 3 }, { farmYieldBonus: 2 }],
  ['spirit_ext2_05', '披萨精灵', 70, { cooking_ext2_22: 5, wheat: 10 }, { xpPct: { cooking: 8 } }],
  ['spirit_ext2_06', '布丁精灵', 75, { baking_ext2_17: 5, vanilla: 5 }, { healPerTurnPct: 3 }],
  ['spirit_ext2_07', '腊肠精灵', 80, { preserving_ext2_24: 5, saltOre: 10 }, { xpPct: { preserving: 8 } }],
  ['spirit_ext2_08', '普洱精灵', 85, { brewing_ext2_09: 5, vanilla: 5 }, { xpPct: { brewing: 8 } }],
  ['spirit_ext2_09', '鎏金精灵', 90, { smith_ext2_30: 1, dragonRoot: 3 }, { dmgPct: 12, loseHpPerTurnPct: 1 }],
  ['spirit_ext2_10', '真龙精灵', 95, { godFeast: 1, dragonMeat: 2 }, { dmgPct: 25, loseHpPerTurnPct: 4 }],
]
const spiritExt2 = []
for (const [spId, name, reqLevel, contract, effect] of SPIRITS2) {
  items[spId] = { id: spId, name, type: 'spirit', category: 'spirit', tier: Math.min(10, Math.ceil(reqLevel / 10)), value: reqLevel * 40, stackable: false }
  spiritExt2.push({ id: spId, name, reqLevel, contract, effect })
}

// 区域对手二期：10 区域 × 10（新名字池：属性×身份）
const ROLE2 = ['食客', '厨娘', '掌柜', '伙计', '商人', '猎人', '僧侣', '道士', '剑客', '侠客']
const FLAVOR2 = ['山', '水', '火', '土', '风', '雷', '光', '暗', '金', '木']
const REGION_RANGES = [[1, 10], [10, 20], [20, 35], [30, 45], [40, 55], [50, 65], [60, 75], [70, 85], [80, 95], [90, 99]]
const STYLES = ['knife', 'plating', 'flavor']
const regionExt2 = []
for (let r = 0; r < 10; r++) {
  const [lo, hi] = REGION_RANGES[r]
  const list = []
  for (let k = 0; k < 10; k++) {
    const lvl = lo + Math.floor(((hi - lo) * (k + 0.5)) / 10)
    list.push({ name: `${FLAVOR2[(r + k) % 10]}${ROLE2[(r * 3 + k) % 10]}`, level: lvl, style: STYLES[(r + k) % 3] })
  }
  regionExt2.push({ regionIndex: r, opponents: list })
}

// BOSS 二期 +10（机制复用，名称/等级/掉落新）
const BOSS2 = [
  ['砧板王', 14, 'plating', { slowEvery: 5 }, 'cuttingBoardKing'],
  ['白汤圣手', 34, 'flavor', { regen: true }, 'brothSaint'],
  ['铁锅将军', 50, 'knife', { burn: true }, 'ironPotGeneral'],
  ['炙烤魔', 62, 'knife', { burn: true, slowEvery: 5 }, 'roastFiend'],
  ['珍珠皇后', 72, 'plating', { poison: true, regen: true }, 'pearlQueen'],
  ['狂乱主厨', 82, 'plating', { randomStyle: true, instantKill: true }, 'madChef'],
  ['深渊食客', 90, 'flavor', { poison: true, phases: true }, 'abyssDiner'],
  ['星辰面点师', 94, 'knife', { randomStyle: true, phases: true }, 'starBaker'],
  ['灭世烤箱', 97, 'flavor', { slowEvery: 4, phases: true }, 'doomOven'],
  ['寰宇食尊', 101, 'knife', { instantKill: true, randomStyle: true, phases: true }, 'universeLord'],
]
const bossExt2 = BOSS2.map(([name, level, style, mechanic, key]) => ({ key, name, level, style, mechanic }))

// 赛季二期 +20：主题 + 限定装备 + 任务目标（从「未用过」物品池分配 4 个/季）
const SEASON2 = [
  ['blossom', '樱吹雪季', '樱花·春宴', 'cherryBlossomHairpin', '樱吹雪簪'],
  ['mooncake2', '中秋蟹宴季', '金蟹·赏月', 'crabCrown', '蟹黄冠'],
  ['grape', '紫葡庄园季', '葡萄·酒庄', 'grapeEarrings', '紫葡耳坠'],
  ['honey2', '蜜香花田季', '蜂蜜·花田', 'honeyComb2', '蜜香花环'],
  ['citrus', '柑橘阳光季', '柑橘·暖阳', 'citrusPendant', '柑橘胸针'],
  ['chestnut', '板栗秋收季', '板栗·糖炒', 'chestnutPouch', '板栗挂坠'],
  ['snow2', '雾凇冰晶季', '冰晶·雾凇', 'frostTiara', '雾凇发饰'],
  ['bamboo', '翠竹清风季', '竹笋·清风', 'bambooFlute', '翠竹笛'],
  ['ocean2', '碧波珍珠季', '珍珠·碧波', 'waveNecklace', '碧波珠链'],
  ['pine', '松涛炖雪季', '松茸·炖雪', 'pineBrocade', '松涛披肩'],
  ['plum', '踏雪寻梅季', '腊梅·雪酿', 'plumBlossomPin', '雪梅钗'],
  ['eggplant', '紫茄墨香季', '茄香·墨韵', 'eggplantFan', '紫茄扇'],
  ['goat', '羊汤暖冬季', '羊肉·暖汤', 'muttonBadge', '暖羊徽章'],
  ['ginkgo', '银杏鎏金季', '银杏·鎏金', 'ginkgoLeaf', '银杏叶饰'],
  ['taro', '芋泥绵甜季', '芋泥·绵甜', 'taroPendant', '芋泥坠'],
  ['sesame', '芝麻开门季', '芝麻·香脆', 'sesameAmulet', '芝麻护符'],
  ['chili2', '红椒烈焰季', '红椒·烈焰', 'emberHeadband', '烈焰头带'],
  ['wine', '琼浆玉液季', '陈酿·琼浆', 'jadeGoblet', '玉液觥'],
  ['phoenix', '浴火凤鸣季', '凤羽·火候', 'phoenixFeather', '凤羽饰'],
  ['dragon2', '龙腾四海季', '龙宴·四海', 'dragonScaleRing', '龙鳞戒'],
]
const usedSeasonItems = new Set(SEASONS.flatMap((s) => s.missions.filter((m) => ['gather', 'craft', 'harvest'].includes(m.kind)).map((m) => m.param)))
const targetPool = Object.keys(ITEMS).filter((id) => {
  const t = ITEMS[id].type
  if (!['ingredient', 'food', 'drink', 'spice'].includes(t)) return false
  if (usedSeasonItems.has(id)) return false
  return true
})
const SEASON_MISSION_KINDS = ['gather', 'craft', 'harvest', 'gather', 'boss', 'restaurant', 'combatWin', 'explore']
const BOSS_NAMES = ['面条之王', '火锅真君', '寿司之神', '甜品女王', '分子料理博士', '中华一番', '黑暗料理王', '初代食神']
const seasonExt2 = []
let poolIdx = 0
SEASON2.forEach(([id, name, theme, limitedItem, gearName], sIdx) => {
  const missions = []
  const qty = [40, 15, 5, 30]
  for (let m = 0; m < 6; m++) {
    const kind = SEASON_MISSION_KINDS[m]
    if (kind === 'boss') {
      missions.push({ id: `${id}m${m + 1}`, name: `击败 ${BOSS_NAMES[sIdx % BOSS_NAMES.length]}`, kind: 'boss', param: BOSS_NAMES[sIdx % BOSS_NAMES.length], qty: 1, points: 18 })
    } else if (kind === 'restaurant') {
      missions.push({ id: `${id}m${m + 1}`, name: '餐厅累计收入', kind: 'restaurant', param: 'any', qty: 8000 + sIdx * 400, points: 22 })
    } else if (kind === 'combatWin') {
      missions.push({ id: `${id}m${m + 1}`, name: '赢得 20 场对决', kind: 'combatWin', param: 'any', qty: 20, points: 15 })
    } else if (kind === 'explore') {
      missions.push({ id: `${id}m${m + 1}`, name: '探索成功 15 次', kind: 'explore', param: 'any', qty: 15, points: 15 })
    } else {
      const param = targetPool[poolIdx % targetPool.length]
      poolIdx++
      const label = kind === 'gather' ? '采集' : kind === 'craft' ? '制作' : '收获'
      missions.push({ id: `${id}m${m + 1}`, name: `${label} ${ITEMS[param]?.name ?? param}`, kind, param, qty: qty[m], points: 12 })
    }
  }
  items[limitedItem] = { id: limitedItem, name: gearName, type: 'equipment', category: 'amulet', tier: 6, value: 1400, stackable: false, slot: 'amulet', quality: '传说', stats: { attack: 6, accuracy: 10, hpBonus: 12 } }
  seasonExt2.push({
    id,
    name,
    theme,
    durationDays: 14,
    limitedItem,
    missions,
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { energyBiscuit: 3 } } },
      { points: 80, reward: { items: { [limitedItem]: 1 } } },
      { points: 110, reward: { gold: 3000, items: sIdx % 2 === 0 ? { spiritBrew: 2 } : { mysterySpice: 2 } } },
    ],
  })
})

const out = `// 内容扩充二期（生成器产出，勿手改）— ${new Date().toISOString().slice(0, 10)}
// 覆盖：10 技能各 +30 · 奥义 +10 · 保鲜 +10 · 探索 +20 · 食灵 +10 · 区域对手 +100 · BOSS +10 · 赛季 +20
export const EXPANSION_ITEMS2 = ${JSON.stringify(items, null, 1)}
export const GATHERING_EXT2 = ${JSON.stringify(gatheringExt2, null, 1)}
export const PRODUCTION_EXT2 = ${JSON.stringify(prodExt2, null, 1)}
export const SMITHING_EXT2 = ${JSON.stringify(smithExt2, null, 1)}
export const PRESERVE_EXT2 = ${JSON.stringify(preserveExt2, null, 1)}
export const AOJI_EXT2 = ${JSON.stringify(AOJI2.map(([id, name, category, desc, costPerSec, effect]) => ({ id, name, category, desc, costPerSec, effect })), null, 1)}
export const EXPLORATION_EXT2 = ${JSON.stringify(explorationExt2, null, 1)}
export const SPIRIT_EXT2 = ${JSON.stringify(spiritExt2, null, 1)}
export const REGION_EXT2 = ${JSON.stringify(regionExt2, null, 1)}
export const BOSS_EXT2 = ${JSON.stringify(bossExt2, null, 1)}
export const SEASONS_EXT2 = ${JSON.stringify(seasonExt2, null, 1)}
`
writeFileSync(new URL('../src/game/data/expansion2.js', import.meta.url), out)
console.log('generated expansion2.js')
console.log(`items=${Object.keys(items).length}  gather=${Object.values(gatheringExt2).reduce((s, a) => s + a.length, 0)}  prod=${Object.values(prodExt2).reduce((s, a) => s + a.length, 0) + smithExt2.length + preserveExt2.length}  aojis=${AOJI2.length}  explore=${EXPLORE2.length}  spirits=${SPIRITS2.length}  opponents=${regionExt2.reduce((s, r) => s + r.opponents.length, 0)}  bosses=${BOSS2.length}  seasons=${SEASON2.length}`)
