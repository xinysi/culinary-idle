// 生成食灵 160 只：32 只 base × 5 阶级。
// 每阶级覆盖一个技能域 + 一个等级段；5 阶级合起来覆盖所有技能，等级从 1 起连续。
// 产物：src/game/data/spiritTiers.js（SPIRITS / SPIRIT_TIER / ITEMS_SUPPLEMENT / GET_SPIRIT_TIER_META）
import fs from 'node:fs'
import { MAT_POOL } from '../../src/game/data/combatLoot.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 输出路径按脚本自身位置解析，避免「必须在仓库根目录运行」的隐性约束
// 输出目录：默认写入仓库 src/game/data；设 GEN_OUT_DIR 可改写到别处（供 scripts/ci/gen_drift_audit.mjs 做无损漂移比对）
const __OUT_DIR = process.env.GEN_OUT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../../src/game/data')

// ── 5 技能域（每阶级一个）──
const TIERS = [
  { n: 1, name: '采耕', lo: 1, hi: 19, skills: ['foraging', 'fishing', 'hunting', 'excavation', 'farming'] },
  { n: 2, name: '烹制', lo: 20, hi: 39, skills: ['cooking', 'baking', 'heatControl', 'flavorArtistry', 'knife'] },
  { n: 3, name: '饮藏', lo: 40, hi: 59, skills: ['brewing', 'preserving', 'spiceMixing', 'preservation', 'gastronomy'] },
  { n: 4, name: '御对', lo: 60, hi: 79, skills: ['plating', 'tasteAcumen'] },
  { n: 5, name: '超凡', lo: 80, hi: 99, skills: ['craftsmithing', 'exploration'] },
]

// ── 32 只 base 精灵：id, name, 主题技能, 非xp效果（保留）, 主题材料（契约用，仅作数量）──
const BASE = [
  ['appleSpirit', '苹果精灵', ['foraging'], {}, 'apple'],
  ['wheatSpirit', '小麦精灵', ['cooking'], {}, 'wheat'],
  ['fishSpirit', '鱼灵', ['fishing', 'fishingAccPct'], { fishingAccPct: 3 }, 'crucian'],
  ['saltSpirit', '盐灵', ['excavation'], {}, 'saltOre'],
  ['chiliSpirit', '辣椒精灵', ['styleDmgPct_flavor'], { styleDmgPct: { flavor: 10 } }, 'chili'],
  ['cornSpirit', '玉米精灵', ['farmYield'], { farmYieldBonus: 1 }, 'corn'],
  ['herbSpirit', '香草精灵', ['spiceMixing'], {}, 'vanilla'],
  ['berrySpirit', '莓果精灵', ['brewing'], {}, 'strawberry'],
  ['knifeSpirit', '刀灵', ['styleDmgPct_knife'], { styleDmgPct: { knife: 10 } }, 'ironOre'],
  ['flameSpirit', '火苗精灵', ['heatControl'], {}, 'chili'],
  ['lingzhiSpirit', '灵芝精灵', ['heal'], { healPerTurnPct: 3 }, 'lingzhi'],
  ['dragonBreathSpirit', '龙息精灵', ['dmg'], { dmgPct: 15, loseHpPerTurnPct: -2 }, 'dragonPepper'],
  ['spirit_ext_01', '葡萄精灵', ['foraging'], {}, 'grape'],
  ['spirit_ext_02', '萝卜精灵', ['farmYield'], { farmYieldBonus: 1 }, 'excavation_ext_01'],
  ['spirit_ext_03', '对虾精灵', ['fishingAccPct'], { fishingAccPct: 3 }, 'fishing_ext_20'],
  ['spirit_ext_04', '野鸭精灵', ['hunting'], {}, 'hunting_ext_05'],
  ['spirit_ext_05', '莲藕精灵', ['heal'], { healPerTurnPct: 2 }, 'excavation_ext_07'],
  ['spirit_ext_06', '银耳精灵', ['cooking'], {}, 'foraging_ext_22'],
  ['spirit_ext_07', '抹茶精灵', ['brewing'], {}, 'brewing_ext_23'],
  ['spirit_ext_08', '星辰精灵', ['styleDmgPct_plating'], { styleDmgPct: { plating: 12 } }, 'smith_ext_30'],
  ['spirit_ext_09', '玄铁精灵', ['dmg'], { dmgPct: 10, loseHpPerTurnPct: 1 }, 'smith_ext_24'],
  ['spirit_ext_10', '饕餮精灵', ['dmg'], { dmgPct: 20, loseHpPerTurnPct: 3 }, 'godFeast'],
  ['spirit_ext2_01', '杏子精灵', ['foraging'], {}, 'foraging_ext2_01'],
  ['spirit_ext2_02', '河豚精灵', ['fishingAccPct'], { fishingAccPct: 4 }, 'fishing_ext2_02'],
  ['spirit_ext2_03', '紫貂精灵', ['hunting'], {}, 'hunting_ext2_07'],
  ['spirit_ext2_04', '钻石精灵', ['farmYield'], { farmYieldBonus: 2 }, 'excavation_ext2_15'],
  ['spirit_ext2_05', '披萨精灵', ['cooking'], {}, 'cooking_ext2_22'],
  ['spirit_ext2_06', '布丁精灵', ['heal'], { healPerTurnPct: 3 }, 'baking_ext2_17'],
  ['spirit_ext2_07', '腊肠精灵', ['preserving'], {}, 'preserving_ext2_24'],
  ['spirit_ext2_08', '普洱精灵', ['brewing'], {}, 'brewing_ext2_09'],
  ['spirit_ext2_09', '鎏金精灵', ['dmg'], { dmgPct: 12, loseHpPerTurnPct: 1 }, 'smith_ext2_30'],
  ['spirit_ext2_10', '真龙精灵', ['dmg'], { dmgPct: 25, loseHpPerTurnPct: 4 }, 'godFeast'],
]
// BASE 主题技能首项作为"主题技能"；用于在该技能所属阶级额外强化
const theme = {
  appleSpirit: 'foraging', wheatSpirit: 'cooking', fishSpirit: 'fishing', saltSpirit: 'excavation',
  chiliSpirit: 'flavorArtistry', cornSpirit: 'farming', herbSpirit: 'spiceMixing', berrySpirit: 'brewing',
  knifeSpirit: 'knife', flameSpirit: 'heatControl', lingzhiSpirit: 'heal', dragonBreathSpirit: 'dmg',
  spirit_ext_01: 'foraging', spirit_ext_02: 'farming', spirit_ext_03: 'fishing', spirit_ext_04: 'hunting',
  spirit_ext_05: 'heal', spirit_ext_06: 'cooking', spirit_ext_07: 'brewing', spirit_ext_08: 'plating',
  spirit_ext_09: 'dmg', spirit_ext_10: 'dmg', spirit_ext2_01: 'foraging', spirit_ext2_02: 'fishing',
  spirit_ext2_03: 'hunting', spirit_ext2_04: 'farming', spirit_ext2_05: 'cooking', spirit_ext2_06: 'heal',
  spirit_ext2_07: 'preserving', spirit_ext2_08: 'brewing', spirit_ext2_09: 'dmg', spirit_ext2_10: 'dmg',
}

// 非xp效果（保留）：styleDmgPct / farmYield / heal / dmg / fishingAcc
function nonXp(e) {
  const out = {}
  for (const [k, v] of Object.entries(e || {})) if (!k.startsWith('xp')) out[k] = v
  return out
}
const TIER_ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ']

const tiersBy = {} // baseId -> tier (按 baseReQ 分到 5 段，让每类精灵覆盖各段)
// 给每只 base 分配 5 阶级：reqLevel 落各段内（第 i 阶级用段 i），均匀分布在段内
const spirits = []
const items = []
let idx = 0
for (const [baseId, baseName, , extra, mat] of BASE) {
  const themeSkill = theme[baseId]
  for (const t of TIERS) {
    idx++
    const id = `${baseId}_${t.n}`
    const name = `${baseName}·${t.name}${TIER_ROMAN[t.n - 1]}`
    // reqLevel：段内按此 base 的索引分布，保证段内横跨多个等级
    const span = t.hi - t.lo
    const rel = Math.floor((idx % 32) * span / 31) // 0..span
    const reqLevel = t.lo + rel
    const s = reqLevel
    // 平衡曲线（按自身 reqLevel，单调递增）：
    //   xpPct 每技能 = 3 + floor(s/8)（Lv1≈3 → Lv99≈15）
    //   主题技能额外 = 2 + floor(s/10)（若主题技能在该阶级域）
    //   非xp效果统一缩放 mult = 1 + (s-1)*0.025（Lv1=1.0 → Lv99≈3.45），保留个体差异、随级增强
    //   契约材料 = 低阶通用盐矿/稻米（锚≈2，满足 balanceRecipeLevels 不抬 reqLevel），数量随 s 递增
    const mult = 1 + (s - 1) * 0.025
    const scaleXp = (base) => base + Math.floor(s / 8) // base 用 3
    const scaleNp = (v) => {
      if (typeof v !== 'number') return v
      const a = Math.abs(v) * mult
      const big = Math.max(Math.abs(v), Math.round(a))
      return Math.sign(v) * big
    }
    const xp = {}
    for (const sk of t.skills) xp[sk] = scaleXp(3)
    if (t.skills.includes(themeSkill)) xp[themeSkill] = scaleXp(3) + 2 + Math.floor(s / 10)
    // 非xp效果按 reqLevel 放大（数字项 × mult，取整且不低于 base）
    const nx = {}
    for (const [k, v] of Object.entries(nonXp(extra) || {})) {
      if (typeof v === 'number') nx[k] = scaleNp(v)
      else if (v && typeof v === 'object') { const o = {}; for (const [kk, vv] of Object.entries(v)) o[kk] = scaleNp(vv); nx[k] = o }
      else nx[k] = v
    }
    const effect = { xpPct: xp, ...nx }
    // 契约材料：按该食灵 reqLevel 的等级段，从 MAT_POOL 选 3 种不同材料（多样化、随级递增、材料锚≈食灵等级）
    const pool = MAT_POOL[Math.min(100, Math.floor(s / 5) * 5)] ?? []
    const pLen = pool.length
    const contract = {}
    if (pLen) {
      const seen = new Set()
      for (const off of [0, 5, 11]) {
        const mid = pool[(idx + off) % pLen]
        if (seen.has(mid)) continue
        seen.add(mid)
        if (Object.keys(contract).length === 0) contract[mid] = 3 + Math.floor(s / 8)
        else if (Object.keys(contract).length === 1) contract[mid] = 5 + Math.floor(s / 5)
        else contract[mid] = 2 + Math.floor(s / 6)
      }
    }
    if (!Object.keys(contract).length) contract.rice = 5 + Math.floor(s / 5)
    spirits.push({ id, name, reqLevel, contract, effect })
    items.push({ id, name, type: 'spirit', category: 'spirit', tier: t.n, value: Math.round(40 + s * 3) })
  }
}

// 输出数据文件
const literals = spirits.map((s) =>
  `  { id: '${s.id}', name: '${s.name}', reqLevel: ${s.reqLevel}, contract: ${JSON.stringify(s.contract)}, effect: ${JSON.stringify(s.effect)} },`
).join('\n')

const tierMap = {}
for (const t of TIERS) tierMap[`__${t.n}`] = t.name
const tierObj = spirits.map((s) => { const n = parseInt(s.id.split('_').pop()); return `${s.id}: ${n}` }).join(', ')

const outText = `// 食灵数据（§3.3.6）— 生成器 gen_spirit_tiers.mjs 产出，勿手改。
// 制作「食灵契约」（消耗高级食材+调料）召唤食灵，同时可携带 2 个出战；食灵提供被动增益。
// effect 字段含义：
//   xpPct: {skillId: pct} 某技能经验加成（%）
//   dmgPct: 全对决伤害加成（%）
//   styleDmgPct: {style: pct} 指定流派伤害加成（%）
//   healPerTurnPct: 每回合回复最大 生命值 百分比
//   loseHpPerTurnPct: 每回合损失最大 生命值 百分比（龙息精灵的代价）
//   fishingAccPct: 垂钓成功率加成（%）
//   farmYieldBonus: 农耕收获额外数量
//
// 共 160 只（32 位主题 × 5 阶级）。每阶级覆盖一个技能域 + 一个等级段：
//   Ⅰ采耕(1~19)、Ⅱ烹制(20~39)、Ⅲ饮藏(40~59)、Ⅳ御对(60~79)、Ⅴ超凡(80~99)，
//   5 阶级合起来覆盖所有技能，等级从 1 起连续（任何等级都有精灵可召唤）。
export const SPIRIT_TIER = { ${tierObj} }
export const SPIRITS = [
${literals}
]
export const ITEMS_SUPPLEMENT = [
${items.map((it) => `  { id: '${it.id}', name: '${it.name}', type: 'spirit', category: 'spirit', tier: ${it.tier}, value: ${it.value} },`).join('\n')}
]
export function getSpirit(id) { return SPIRITS.find((s) => s.id === id) ?? null }
export const SPIRIT_SLOTS = 2 // 同时可携带 2 个出战（§3.3.6）
`
fs.writeFileSync(join(__OUT_DIR, 'spiritTiers.js'), outText, 'utf-8')
console.log('已生成 spiritTiers.js，精灵数:', spirits.length, '物品数:', items.length)
// 校验 reqLevel 范围 / 覆盖
const lv = spirits.map((s) => s.reqLevel)
console.log('reqLevel 范围:', Math.min(...lv), '~', Math.max(...lv))
