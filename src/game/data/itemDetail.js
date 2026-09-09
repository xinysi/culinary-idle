// 物品详细作用 — 背包/仓库查看、图鉴弹窗共用（所有物品类型）
import { getItem } from './items.js'
import { itemSources } from './itemSources.js'
import { SPIRITS } from './spirits.js'
import { CROPS } from '../skills/FarmingSkill.js'
import { gemDef, socketCountOf } from './gems.js'
import { equipSetOf } from './equipSets.js'
import { CELLAR_CATEGORIES } from './cellar.js'
import { EXCHANGE_POOL_CATEGORIES } from './exchange.js'

const TYPE_LABEL = { ingredient: '食材', food: '料理', drink: '饮品', spice: '调料', seed: '种子', consumable: '道具', equipment: '装备', spirit: '食灵' }

// 物品/食谱分类中文映射（图鉴/商店/制作页显示用）
export const CATEGORY_LABEL = {
  amulet: '饰品1', baking: '烘焙品', body: '身体', boots: '脚部', buff: '加成', crop: '作物', egg: '蛋类',
  fossil: '化石', fruit: '水果', fungus: '菌类', grain: '粮谷', helmet: '头盔', juice: '果汁', legs: '腿部', material: '材料',
  meat: '肉类', mineral: '矿物', mushroom: '蘑菇', offhand: '副手', pickled: '腌制品', preserving: '腌制品',
  ring: '饰品2', root: '根茎', sauce: '酱料', seafood: '海鲜', seasoning: '复合调料', seed: '种子',
  spice: '调料', spirit: '食灵', supply: '补给', tea: '茶饮', vegetable: '蔬菜', weapon: '武器', wine: '酒类',
  flower: '花卉', herb: '香草', dairy: '乳品', drinkBase: '饮品基底', legume: '豆类', spicePlant: '香料植物',
  '种植产物': '种植产物',
  // 全物品图鉴审计（2026-09-06）补齐的类别标签（仅展示层映射）
  '主菜': '主菜', '甜点': '甜点', '汤品': '汤品', '主食': '主食',
}
export const SLOT_LABEL = { weapon: '武器', offhand: '副手', body: '身体', helmet: '头盔', amulet: '饰品1', ring: '饰品2', legs: '腿部', boots: '脚部' }
const STAT_LABEL = { attack: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击率', hpBonus: '品鉴值加成', speedBonus: '攻速提升' }
const BUFF_LABEL = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击', speed: '攻速', duration: '持续' }
const SKILL_LABEL = { foraging: '采摘', fishing: '垂钓', hunting: '狩猎', excavation: '挖掘', farming: '农耕', cooking: '烹饪', baking: '烘焙', preserving: '腌制', brewing: '调酒', spiceMixing: '调料调配', craftsmithing: '厨具锻造', preservation: '食材保鲜', exploration: '美食探索', spiritSummoning: '食灵召唤', gastronomy: '美食知识', knife: '刀工', plating: '摆盘', flavor: '调味', heatControl: '火候', tasteAcumen: '品鉴力' }
const STYLE_LABEL = { knife: '刀工', plating: '摆盘', flavor: '调味' }

// 属性数字统一保留两位小数（仅展示层格式化，不改底层数据/计算）
export const fmtStat = (n) => Number(n ?? 0).toFixed(2)

function spiritEffectText(sp) {
  const e = sp.effect ?? {}
  const parts = []
  if (e.xpPct) for (const [k, v] of Object.entries(e.xpPct)) parts.push(`${SKILL_LABEL[k] ?? k}经验 +${v}%`)
  if (e.dmgPct) parts.push(`全对决伤害 +${e.dmgPct}%`)
  if (e.styleDmgPct) for (const [k, v] of Object.entries(e.styleDmgPct)) parts.push(`${STYLE_LABEL[k] ?? k}流派伤害 +${v}%`)
  if (e.healPerTurnPct) parts.push(`每回合回复 ${e.healPerTurnPct}% 最大品鉴值`)
  if (e.loseHpPerTurnPct) parts.push(`每回合损失 ${e.loseHpPerTurnPct}% 最大品鉴值`)
  if (e.fishingAccPct) parts.push(`垂钓成功率 +${e.fishingAccPct}%`)
  if (e.farmYieldBonus) parts.push(`农耕收获 +${e.farmYieldBonus}`)
  return parts.join('，') || '无效果'
}

/** 物品详细作用行：[[label, value], ...] */
export function itemDetailLines(id) {
  const it = getItem(id)
  if (!it) return []
  const lines = []
  lines.push(['类型', TYPE_LABEL[it.type] ?? it.category ?? '未知'])
  if (it.quality) lines.push(['品质', it.quality])
  if (it.slot) lines.push(['槽位', SLOT_LABEL[it.slot] ?? it.slot])
  lines.push(['档位', `T${it.tier}`])
  lines.push(['价值', `${it.value} 金币`])
  // 获取等级：从获取来源文字解析最低 LvX（只读展示，不改任何等级定义）
  const lvMatches = itemSources(id).map((s) => s.match(/Lv(\d+)/)).filter(Boolean).map((m) => parseInt(m[1], 10))
  if (lvMatches.length) lines.push(['获取等级', `Lv${Math.min(...lvMatches)}`])
  // 种子种植信息（只读 CROPS，不改数据）
  if (it.type === 'seed') {
    const crop = CROPS.find((c) => c.seedId === id)
    if (crop) {
      const cropIt = getItem(crop.itemId)
      lines.push(['种植产物', cropIt?.name ?? crop.itemId])
      lines.push(['种植等级', `Lv${crop.reqLevel}`])
      lines.push(['生长时间', crop.growSec >= 60 ? `${Math.round(crop.growSec / 60)} 分钟` : `${crop.growSec} 秒`])
    }
  }
  if (it.heal) lines.push(['对决回血', String(it.heal)])
  if (it.regen) lines.push(['持续回血', `每回合 ${it.regen.perTurn} × ${it.regen.turns} 回合`])
  if (it.flavorEnergy) lines.push(['调味能量', `+${it.flavorEnergy}`])
  if (it.buff) {
    const parts = Object.entries(it.buff).filter(([k]) => k !== 'duration').map(([k, v]) => `${BUFF_LABEL[k] ?? k} +${v}`)
    if (it.buff.duration) parts.push(`持续 ${it.buff.duration} 回合`)
    lines.push(['对决增益', parts.join('、')])
  }
  // 神秘调料：随机对决增益（数值见 MYSTERY_BUFFS，此处只读展示，不改数据）
  if (it.randomBuff) {
    lines.push(['对决增益', '随机获得 攻击/命中/防御/暴击 之一：攻击+8、命中+10、防御+6、暴击+10%、攻击+5·命中+5（持续 10 回合）'])
  }
  if (it.drunk) lines.push(['醉酒', '准确率 -15%（5 回合）'])
  if (it.stats) lines.push(['装备属性', Object.entries(it.stats).map(([k, v]) => `${STAT_LABEL[k] ?? k} ${fmtStat(v)}`).join('、')])
  // 宝石（2026-09-09）：可作为宝石镶嵌的矿物
  const gem = gemDef(id)
  if (gem) lines.push(['宝石镶嵌', `${gem.desc}（镶入装备插槽后生效）`])
  // 地窖陈酿（2026-09-10）：酒类/腌制品可入窖
  if (CELLAR_CATEGORIES.includes(it.category)) lines.push(['可陈酿', '可放入地窖，按档位成熟后出窖换金币（12h ×1.5 / 24h ×2 / 48h ×3）'])
  // 交易所（2026-09-10）：价值 20~300 的食材可能出现在货单上
  if (it.type === 'ingredient' && EXCHANGE_POOL_CATEGORIES.includes(it.category) && (it.value ?? 0) >= 20 && (it.value ?? 0) <= 300) {
    lines.push(['可交易', '可能出现在交易所货单上（行情价 0.6~1.6× 基准价值，每 4 小时轮换）'])
  }
  if (it.type === 'equipment') {
    const sockets = socketCountOf(it)
    if (sockets > 0) lines.push(['宝石插槽', `${sockets} 个（可镶入矿物宝石）`])
    const set = equipSetOf(id)
    if (set) lines.push(['所属套装', `${set.name}（穿戴 2/4/6 件触发加成）`])
  }
  if (it.use?.refreshSpoilMs) lines.push(['保鲜时长', `${Math.round(it.use.refreshSpoilMs / 3600000)} 小时`])
  if (it.use?.buffXp) lines.push(['经验增益', `×${it.use.buffXp.mult}（${it.use.buffXp.minutes} 分钟）`])
  if (it.use?.buffYield) lines.push(['产量增益', `×${it.use.buffYield.mult}（${it.use.buffYield.minutes} 分钟）`])
  if (it.spoilMs) lines.push(['腐坏时间', `${it.spoilMs / 3600000} 小时`])
  if (it.type === 'spirit') {
    const sp = SPIRITS.find((s) => s.id === id)
    if (sp) lines.push(['食灵效果', spiritEffectText(sp)])
  }
  return lines
}

/** 获取来源列表 */
export function itemSourcesOf(id) {
  return itemSources(id)
}
