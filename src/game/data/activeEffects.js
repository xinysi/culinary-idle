// 效果总览注册表（v2.6.0）——「当前正在生效的增益 / 效果 / 减益」的**唯一来源清单**。
//
// 为什么要有这张表：全项目只有 4 个真正的乘区聚合出口（`Skill.addXp` / `GatheringSkill.yieldExtraChance` /
// `player.restaurantHourlyIncome` / `Combat.playerStats`），其余 20 多个来源是**散装**在各技能与各视图里的
// （例如天气的农田产量只在 FarmingSkill 里读、节庆的采集产量只在 GatheringSkill 里读、农耕精通联动只在
// GatheringSkill 里读）。所以「只读聚合出口」必然漏项——页面必须逐条显式登记每个来源。
//
// 契约（改动前先读）：
// 1. 本表**只读**既有 player 状态与既有聚合函数，**不写入任何状态**，也**不新增存档字段**；
// 2. 每条 `read(player, ctx)` 返回 `{ on, text, why }`：`on` 此刻是否真的在起作用，`text` 是给玩家看的数值口径，
//    `why` 是未生效时的原因（页面把未生效的收进「本期未生效」折叠区，作为「没有漏掉」的证据）；
// 3. 新增任何效果来源时**必须**在本表加一行，并跑 `node scripts/ci/content_sync_audit.mjs`
//    （它会校验 `player.js` 里每个 `*Effects/*Boost/*Multiplier/*Pct/*Bonus/*Factor/*Chance` 访问器
//    都在本表出现或显式豁免，漏登记直接 FAIL）；
// 4. 文案面向玩家：不写内部字段名（档位 / 百分比 / 采摘 这类中文口径），技能 id 一律过 SKILL_CN。

import { getItem } from './items.js'
import { isHarshWeather } from './weather.js'
import { farmSeason } from './farmingSeason.js'
import { activeMarketEvents } from './marketEvents.js'
import { OFFLINE_CAP, DERIVED_MAX } from './caps.js'
import { RANCH_ANIMALS, POND_FISH } from './ranch.js'
import { MUSHROOM_MEDIA } from './mushroomHouse.js'
import { SPIRIT_PLANTS } from './spiritField.js'
import { HIVE_MEDIA, GREENHOUSE_HONEY_CHANCE } from './greenhouse.js'
import { SUPPLIER_PRICE_MULT } from './suppliers.js'
import { CARAVAN_LOSS_FLOOR } from './caravan.js'
import { PRIME_CATALYST_TIME, PRIME_MIN_LEVEL, PRIME_BASE_CHANCE, PRIME_MAX_CHANCE } from './primeCrop.js'
import { BISCUIT_TASTE_RATE } from './biscuitUse.js'
import { EXPEDITIONS, expeditionTier, expeditionYieldMult, expeditionRareBonus } from './expeditions.js'
import { SCHOOLS } from './schools.js'
import { getPatron } from './patrons.js'
import { STAFF } from './staff.js'
import { BRANCHES } from './branches.js'
import { RESTAURANT_DECOR_BY_ID } from './restaurantDecor.js'
import { TAKEOUT_PRICE_MULT } from './takeout.js'
import { masteryLevelFromCount, masteryDoubleChance, masteryYieldBonus } from '../core/mastery.js'

/** 分组（页面按此顺序分节） */
export const EFFECT_GROUPS = [
  { id: 'global', name: '全局环境', icon: '🌤', desc: '与日期 / 时段挂钩、对所有玩法同时生效的加成与减益' },
  { id: 'gather', name: '采集与产量', icon: '🌾', desc: '采摘 / 垂钓 / 狩猎 / 挖掘 / 采矿 / 伐木 / 农耕 每次动作的产出' },
  { id: 'craft', name: '经验与制作', icon: '📈', desc: '技能经验与制作成功率' },
  { id: 'income', name: '餐厅与经营', icon: '🍽', desc: '餐厅时收、订单、分店、地窖与金币' },
  { id: 'farm', name: '农田与产线', icon: '🌱', desc: '农田生长与挂机产线的运转状态（含停机与损耗）' },
  { id: 'combat', name: '对决与挑战', icon: '⚔️', desc: '对决属性、减伤回血，以及只在战斗内存在的临时状态' },
  { id: 'idle', name: '离线与容量', icon: '🛏', desc: '离线时长与效率、各类容量与槽位' },
]

/** 技能 id → 中文名（文案里不出现内部 id） */
export const SKILL_CN = {
  foraging: '采摘', fishing: '垂钓', hunting: '狩猎', excavation: '挖掘', woodcutting: '伐木', mining: '采矿', farming: '农耕',
  cooking: '烹饪', baking: '烘焙', preserving: '腌制', brewing: '调酒', spiceMixing: '调料调配',
  craftsmithing: '厨具锻造', woodworking: '木工', pottery: '陶艺', weaving: '编织', embroidery: '刺绣', candles: '蜡烛制作',
  knife: '刀工', heatControl: '火候掌控', flavorArtistry: '调味艺术',
  plating: '摆盘技巧', tasteAcumen: '品鉴力', spiritSummoning: '食灵召唤', gastronomy: '美食知识',
  preservation: '食材保鲜', exploration: '美食探索',
}

// ── 小工具 ─────────────────────────────────────────────────────────
const n1 = (v) => Math.round(v * 10) / 10
/** 百分比文案：+12.5% / −8% */
const pct = (v) => (v >= 0 ? `+${n1(v)}%` : `−${n1(Math.abs(v))}%`)
/** 倍率文案：×1.25 */
const mult = (v) => `×${n1(v)}`
const off = (why) => ({ on: false, text: '—', why })
/** 分钟 → 「N 小时 M 分」 */
function mins(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分`
}
/** 把 { 键: 值 } 里所有非中性项拼成一行 */
function joinParts(map, labels) {
  const out = []
  for (const [k, v] of Object.entries(map ?? {})) {
    if (typeof v !== 'number' || v === 0 || v === 1) continue
    if (!labels[k]) continue
    out.push(`${labels[k]} ${pct(v)}`)
  }
  return out
}
const KEY_LABEL = {
  xpPct: '经验', yieldPct: '产量', craftPct: '制作成功率', dmgPct: '伤害', styleDmgPct: '招式伤害',
  incomePct: '收入', healPct: '料理回血', cellarPct: '地窖出窖', attackPct: '攻击', defensePct: '减伤',
  maxHpPct: '品鉴值', maxHpBonus: '品鉴值', critPct: '暴击', critChance: '暴击', goldPct: '金币',
  orderGoldPct: '订单赏金', branchPct: '分店收入', gatherXpPct: '采集经验', craftXpPct: '制作经验',
  allXpPct: '全技能经验', seedChancePct: '采种概率', offlineHours: '离线上限', speedPct: '攻速',
  accuracyPct: '命中', evasionPct: '闪避', healPerTurnPct: '每回合回血', farmingPct: '农田',
  restaurant: '餐厅收入', gatherYield: '采集产量', gatherXp: '采集经验', craftXp: '制作经验',
  combatXp: '对决经验', farmYield: '农田产量',
}

/** 「按周期吃料」设施的缺料表：defs 里可含 null */
function missingFeed(defs, inv) {
  const miss = []
  for (const def of defs) {
    if (!def) continue
    const bad = Object.entries(def.feed ?? {}).filter(([id, q]) => (inv[id] ?? 0) < q)
    if (bad.length) miss.push(`${def.name} 缺 ${bad.map(([id, q]) => `${getItem(id)?.name ?? id} ×${q - (inv[id] ?? 0)}`).join('、')}`)
  }
  return miss
}
const animalOf = (pen) => (pen?.animalId ? RANCH_ANIMALS.find((a) => a.id === pen.animalId) ?? null : null)

// ── 注册表主体 ──────────────────────────────────────────────────────
// kind: 'buff' 增益 / 'debuff' 减益 / 'rule' 中性规则或基准
export const EFFECT_ROWS = [
  // ══ 全局环境 ══════════════════════════════════════════════════
  {
    id: 'weather', group: 'global', icon: '🌤', name: '今日天气', kind: 'buff', src: '天气与运势', view: 'weather',
    read: (p) => {
      const we = p.weatherEffects()
      const parts = joinParts(we, KEY_LABEL)
      if (!parts.length) return off('今日天气为中性：既没有加成，也没有减益（离线结算不受天气影响）')
      return { on: true, text: parts.join(' · '), tough: isHarshWeather(p.todayWeather()) }
    },
  },
  {
    id: 'fortune', group: 'global', icon: '🍀', name: '今日运势（只缓和不加重）', kind: 'rule', src: '天气与运势', view: 'weather',
    read: (p) => {
      const lv = p.todayFortune().level
      const we = p.weatherEffects()
      const hasDown = ['gatherYield', 'gatherXp', 'craftXp', 'combatXp', 'restaurant', 'farmYield'].some((k) => (we[k] ?? 1) < 1)
      if (!hasDown) return off('今日没有恶劣天气，运势的缓和效果没有作用对象')
      return { on: true, text: `${lv.name}：恶劣天气的减益只按 ${Math.round((lv.penaltyScale ?? 1) * 100)}% 生效（运势绝不加重）` }
    },
  },
  {
    id: 'luckyItem', group: 'global', icon: '🌟', name: '今日幸运食材', kind: 'buff', src: '天气与运势', view: 'weather',
    read: (p) => {
      const id = p.todayFortune().luckyItem
      const it = getItem(id)
      const bonus = p.luckyItemBonus?.(id) ?? 0
      if (!it) return off('今日没有抽到幸运食材')
      if (!bonus) return off(`今日的幸运食材是「${it.name}」，但当前采集目标不是它（换成它才吃这 +20%）`)
      return { on: true, text: `采集「${it.name}」时产量 ${pct(bonus * 100)}（正在采它）` }
    },
  },
  {
    id: 'festival', group: 'global', icon: '🌗', name: '节庆加成', kind: 'buff', src: '节庆', view: 'festival',
    read: (p) => {
      const f = p.festivalBoost()
      if (!f.active?.length) return off('今天不是节庆日（每月 8~10 日、21 日等固定档期）')
      const parts = joinParts({ restaurant: f.restaurant, gatherXp: f.gatherXp, craftXp: f.craftXp, combatXp: f.combatXp, gatherYield: f.gatherYield }, KEY_LABEL)
      return { on: true, text: `${f.active.map((x) => x.name).join('、')}：${parts.join(' · ') || '仅节日氛围'}` }
    },
  },
  {
    id: 'marketEvent', group: 'global', icon: '💹', name: '限时窗口', kind: 'buff', src: '行情（限时活动）', view: 'market',
    read: () => {
      const evs = activeMarketEvents()
      if (!evs.length) return off('当前时段没有限时窗口（每个窗口只在固定时段出现，看排班表）')
      const parts = evs.map((e) => {
        const eff = joinParts(e.effect ?? {}, KEY_LABEL)
        return `${e.icon}${e.name}${eff.length ? `（${eff.join(' · ')}）` : ''}`
      })
      return { on: true, text: parts.join('、') }
    },
  },
  {
    id: 'buffXp', group: 'global', icon: '🧪', name: '经验增益（消耗品）', kind: 'buff', src: '增益剂 / 蜂蜜 / 菌灵露', view: '',
    read: (p) => {
      const b = p.buffs?.xpMult
      if (!b || Date.now() >= b.expiresAt) return off('没有在效期内的经验增益（喝下增益剂 / 蜂蜜才生效）')
      return { on: true, text: `技能经验 ${mult(b.mult)}`, left: Math.max(1, Math.round((b.expiresAt - Date.now()) / 60000)) }
    },
  },
  {
    id: 'buffYield', group: 'global', icon: '🧪', name: '产量增益（消耗品）', kind: 'buff', src: '增益剂 / 蜂蜜 / 菌灵露', view: '',
    read: (p) => {
      const b = p.buffs?.yieldMult
      if (!b || Date.now() >= b.expiresAt) return off('没有在效期内的产量增益')
      return { on: true, text: `采集与农田产量 ${mult(b.mult)}`, left: Math.max(1, Math.round((b.expiresAt - Date.now()) / 60000)) }
    },
  },
  {
    id: 'buffGather', group: 'global', icon: '⏱', name: '采集间隔（消耗品）', kind: 'buff', src: '菌灵露 Ⅴ 档起 / 鲍汁', view: '',
    read: (p) => {
      const b = p.buffs?.gatherMult
      if (!b || Date.now() >= b.expiresAt) return off('没有在效期内的采集提速')
      return { on: true, text: `每次动作间隔 −${Math.round((1 - b.mult) * 100)}%（越小越快）`, left: Math.max(1, Math.round((b.expiresAt - Date.now()) / 60000)) }
    },
  },
  {
    id: 'buffRestaurant', group: 'global', icon: '🍽', name: '餐厅收入增益（消耗品）', kind: 'buff', src: '菌灵露 Ⅶ 档起 / 鸡油 / 虾油', view: '',
    read: (p) => {
      const b = p.buffs?.restaurantMult
      if (!b || Date.now() >= b.expiresAt) return off('没有在效期内的餐厅收入增益')
      return { on: true, text: `餐厅时收 ${pct((b.mult - 1) * 100)}`, left: Math.max(1, Math.round((b.expiresAt - Date.now()) / 60000)) }
    },
  },

  // ══ 采集与产量 ════════════════════════════════════════════════
  {
    id: 'aojiGather', group: 'gather', icon: '📖', name: '美食奥义·产量', kind: 'buff', src: '美食知识（已激活的奥义）', view: 'skill:gastronomy',
    read: (p) => {
      const v = p.gastronomyEffects().yieldPct
      if (!v) return off('没有激活带产量加成的奥义（或品鉴点耗尽已停摆）')
      return { on: true, text: `采集产量 ${pct(v)}` }
    },
  },
  {
    id: 'guildGather', group: 'gather', icon: '🛡', name: '公会被动·产量', kind: 'buff', src: '公会（采集型）', view: 'guild',
    read: (p) => {
      const v = p.guildEffects().yieldPct ?? 0
      if (!v) return off(p.guild?.id ? '当前公会的被动不在产量赛道上' : '还没有加入公会')
      return { on: true, text: `采集产量 ${pct(v)}` }
    },
  },
  {
    id: 'insightGather', group: 'gather', icon: '🕸', name: '菜系图谱·产量', kind: 'buff', src: '美食知识（菜系图谱）', view: 'skill:gastronomy',
    read: (p) => {
      const v = p.insightEffects().yieldPct
      if (!v) return off('图谱里还没有点亮产量节点')
      return { on: true, text: `采集产量 ${pct(v)}` }
    },
  },
  {
    id: 'patronBonus', group: 'gather', icon: '🏛', name: '食神信仰', kind: 'buff', src: '信仰（当前信奉的神明）', view: 'patrons',
    read: (p) => {
      const e = p.patronEffects()
      const parts = joinParts(e, KEY_LABEL)
      for (const [sid, v] of Object.entries(e.xpSkills ?? {})) if (v) parts.push(`${SKILL_CN[sid] ?? sid} 经验 ${pct(v)}`)
      const id = p.patronActiveId?.()
      const def = id ? getPatron(id) : null
      if (!def) return off('还没有选择信仰')
      if (!parts.length) return off(`当前信奉「${def.name}」，但该神明的加成都不在生效赛道（或信仰等级为 0）`)
      return { on: true, text: `${def.name}：${parts.join(' · ')}` }
    },
  },
  {
    id: 'honorGather', group: 'gather', icon: '🎖', name: '荣誉殿堂与称号', kind: 'buff', src: '荣誉殿堂 / 佩戴中的称号', view: 'honor',
    read: (p) => {
      const h = p.honorState()
      const parts = joinParts(h.perks ?? {}, KEY_LABEL)
      const t = p.equippedTitlePerk?.()
      if (!parts.length && !t) return off('荣誉等级为 0，且没有佩戴带加成的称号')
      const tail = t ? `（称号「${t.label ?? ''}」额外加成）` : ''
      return { on: true, text: `${parts.join(' · ') || '荣誉等级本身暂无加成'}${tail}` }
    },
  },
  {
    id: 'daoGather', group: 'gather', icon: '🛤', name: '厨神之路·产量与采种', kind: 'buff', src: '厨神之路（已解锁节点）', view: 'dao',
    read: (p) => {
      const e = p.daoEffects()
      const parts = joinParts({ yieldPct: e.yieldPct, seedChancePct: e.seedChancePct }, KEY_LABEL)
      if (!parts.length) return off('厨神之路还没有解锁产量 / 采种节点')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'shanhaiFlat', group: 'gather', icon: '📖', name: '山海食经·每次动作加件', kind: 'buff', src: '山海食经（已点亮节点）', view: 'shanhai',
    read: (p) => {
      const fy = p.shanhaiEffects()?.flatYield ?? {}
      const parts = Object.entries(fy).filter(([, v]) => v > 0).map(([sid, v]) => `${SKILL_CN[sid] ?? sid} 每次 +${v} 件`)
      if (!parts.length) return off('山海食经还没有点亮「每次动作 +1 件」的节点')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'farmMasteryLink', group: 'gather', icon: '🔗', name: '农耕精通→采集联动', kind: 'buff', src: '农耕（把作物种到精通）', view: 'skill:farming',
    read: (p) => {
      const list = []
      for (const [sid, inst] of Object.entries(ctx1.allSkills())) {
        if (sid !== 'farming') continue
        for (const it of inst.crops ?? []) {
          const c = p.farmMasteryGatherChance?.(it.itemId) ?? 0
          if (c > 0) list.push({ id: it.itemId, c })
        }
      }
      if (!list.length) return off('还没有把任何作物种到精通 10 级以上（每 10 级让采集该物品的额外产出几率 +2%，上限 +20%）')
      const top = list.sort((a, b) => b.c - a.c).slice(0, 3).map((x) => `${getItem(x.id)?.name ?? x.id} ${pct(x.c * 100)}`)
      return { on: true, text: `采集这些物品额外产出：${top.join('、')}${list.length > 3 ? ` 等 ${list.length} 种` : ''}` }
    },
  },
  {
    id: 'masteryBatch', group: 'gather', icon: '🏅', name: '采集精通·双倍与保底批量', kind: 'rule', src: '采集卡片精通（0~100 级）', view: 'skill',
    read: (p, c) => {
      const rows = []
      for (const inst of Object.values(c?.allSkills?.() ?? {})) {
        if (!inst?.id || !Object.keys(inst.mastery ?? {}).length) continue
        let best = 0
        let bestItem = null
        for (const [itemId, cnt] of Object.entries(inst.mastery)) {
          const lv = masteryLevelFromCount(cnt)
          if (lv > best) {
            best = lv
            bestItem = itemId
          }
        }
        if (best > 0) rows.push({ sid: inst.id, lv: best, itemId: bestItem, dbl: masteryDoubleChance(best), batch: masteryYieldBonus(best) })
      }
      if (!rows.length) return off('所有采集卡片的精通都还是 0 级（重复采集同一目标会累积精通）')
      const top = rows.sort((a, b) => b.lv - a.lv)[0]
      const name = getItem(top.itemId)?.name ?? top.itemId
      return { on: true, text: `${SKILL_CN[top.sid] ?? top.sid}精通最高「${name}」${top.lv} 级：双倍产出几率 ${pct(top.dbl * 100)}、保底每次 ${top.batch} 件（精通 50 / 100 级各提一档）` }
    },
  },
  {
    id: 'expedition', group: 'gather', icon: '🚢', name: '采集队加成', kind: 'buff', src: '采集队（已完成轮次 / 产地派驻）', view: 'expedition',
    read: (p) => {
      const parts = []
      for (const def of EXPEDITIONS) {
        const st = p.expeditions?.[def.id]
        if (!st) continue
        const tier = expeditionTier(st.completions ?? 0)
        const post = p.lineRegion?.(def.id)
        const y = (expeditionYieldMult(tier) - 1) * 100 + (post?.bonus?.qtyPct ?? 0)
        const r = expeditionRareBonus(tier) * 100 + (post?.bonus?.rarePct ?? 0)
        if (y || r) parts.push(`${def.name} 产量 ${pct(y)} · 稀有 ${pct(r)}`)
      }
      if (!parts.length) return off('采集队还没有完成过轮次，也没有派驻产地')
      return { on: true, text: parts.join('、') }
    },
  },
  {
    id: 'posting', group: 'gather', icon: '🌍', name: '产地派驻（当季加倍）', kind: 'buff', src: '产地与风土', view: 'regions',
    read: (p) => {
      const rows = []
      for (const lineId of Object.keys(p.regionPosting ?? {})) {
        const { def, bonus } = p.lineRegion?.(lineId) ?? {}
        if (!def) continue
        rows.push(`${def.name} 产量 ${pct(bonus?.qtyPct ?? 0)} · 稀有 ${pct(bonus?.rarePct ?? 0)}${bonus?.inSeason ? '（当季 ×1.5）' : ''}`)
      }
      if (!rows.length) return off('还没有考察并派驻任何产地（考察后派驻才有特产与加成）')
      return { on: true, text: rows.join('、') }
    },
  },
  {
    id: 'spiritFishing', group: 'gather', icon: '🎣', name: '食灵·垂钓命中', kind: 'buff', src: '出战食灵（羁绊加成）', view: 'skill:spiritSummoning',
    read: (p) => {
      const v = p.spiritEffects().fishingAccPct ?? 0
      if (!v) return off('没有出战带垂钓命中的食灵')
      return { on: true, text: `垂钓成功率 ${pct(v)}` }
    },
  },

  // ══ 经验与制作 ════════════════════════════════════════════════
  {
    id: 'spiritXp', group: 'craft', icon: '✨', name: '食灵·技能经验', kind: 'buff', src: '出战食灵（羁绊加成）', view: 'skill:spiritSummoning',
    read: (p) => {
      const m = p.spiritEffects().xpPct ?? {}
      const parts = Object.entries(m).filter(([, v]) => v > 0).map(([sid, v]) => `${SKILL_CN[sid] ?? sid} ${pct(v)}`)
      if (!parts.length) return off('没有出战带技能经验加成的食灵')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'aojiXp', group: 'craft', icon: '📖', name: '美食奥义·经验', kind: 'buff', src: '美食知识（已激活的奥义）', view: 'skill:gastronomy',
    read: (p) => {
      const v = p.gastronomyEffects().xpPct ?? 0
      if (!v) return off('没有激活带经验加成的奥义')
      return { on: true, text: `技能经验 ${pct(v)}` }
    },
  },
  {
    id: 'guildXp', group: 'craft', icon: '🛡', name: '公会被动·经验与制作', kind: 'buff', src: '公会（辅助型 / 制作型）', view: 'guild',
    read: (p) => {
      const g = p.guildEffects()
      const parts = joinParts({ xpPct: g.xpPct, craftPct: g.craftPct }, KEY_LABEL)
      if (!parts.length) return off(p.guild?.id ? '当前公会的被动不在经验 / 制作赛道上' : '还没有加入公会')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'insightCraft', group: 'craft', icon: '🕸', name: '菜系图谱·经验与制作', kind: 'buff', src: '美食知识（菜系图谱）', view: 'skill:gastronomy',
    read: (p) => {
      const e = p.insightEffects()
      const parts = joinParts({ xpPct: e.xpPct, craftPct: e.craftPct }, KEY_LABEL)
      if (!parts.length) return off('图谱里还没有点亮经验 / 制作节点')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'honorXp', group: 'craft', icon: '🎖', name: '荣誉殿堂·经验与制作', kind: 'buff', src: '荣誉殿堂与佩戴称号', view: 'honor',
    read: (p) => {
      const h = p.honorState()
      const parts = joinParts({ xpPct: h.perks?.xpPct ?? 0, craftPct: h.perks?.craftPct ?? 0 }, KEY_LABEL)
      if (!parts.length) return off('荣誉等级为 0，或佩戴的称号不带经验 / 制作加成')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'michelinXp', group: 'craft', icon: '⭐', name: '米其林星级·经验', kind: 'buff', src: '评级（米其林星数）', view: 'michelin',
    read: (p) => {
      const v = p.michelinXpPct()
      if (!v) return off('星级不足 2 星（2 星、3 星才给经验加成）')
      return { on: true, text: `技能经验 ${pct(v)}` }
    },
  },
  {
    id: 'daoXp', group: 'craft', icon: '🛤', name: '厨神之路·经验', kind: 'buff', src: '厨神之路（已解锁节点）', view: 'dao',
    read: (p) => {
      const e = p.daoEffects()
      const parts = joinParts({ allXpPct: e.allXpPct, gatherXpPct: e.gatherXpPct, craftXpPct: e.craftXpPct }, KEY_LABEL)
      if (!parts.length) return off('厨神之路还没有解锁经验节点')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'schoolCraftXp', group: 'craft', icon: '📜', name: '菜系研究·制作经验', kind: 'buff', src: '菜系研究（各学派等级）', view: 'schools',
    read: (p) => {
      const rows = SCHOOLS.map((s) => ({ name: s.name, lv: p.schools?.[s.id]?.level ?? 0, pct: p.schoolCraftXpPct?.(s.cats?.[0]) ?? 0 })).filter((x) => x.pct > 0)
      if (!rows.length) return off('还没有研究过任何菜系（学派等级 0，每级 +5%）')
      const text = rows.map((x) => `${x.name} ${pct(x.pct)}`).join('、')
      return { on: true, text: `${text}（对应类别的料理制作经验）` }
    },
  },
  {
    id: 'prestige', group: 'craft', icon: '♻', name: '转生加成', kind: 'rule', src: '传承（技能转生层数）', view: 'legacy',
    read: (p) => {
      const rows = Object.entries(p.skills ?? {}).filter(([, st]) => (st?.prestiges ?? 0) > 0).map(([sid, st]) => `${SKILL_CN[sid] ?? sid} ×${n1(1 + 0.2 * st.prestiges)}`)
      if (!rows.length) return off('还没有转生过任何技能（每次转生给该技能 +20% 经验）')
      return { on: true, text: `转生技能经验：${rows.join('、')}` }
    },
  },
  {
    id: 'xpSetting', group: 'craft', icon: '🎚', name: '经验倍率设置', kind: 'rule', src: '设置面板', view: '',
    read: (p) => {
      const v = p.settings?.xpMultiplier ?? 1
      if (v === 1) return off('当前经验倍率为 ×1（可在设置里调高；设置倍率与卡片精通取较高者）')
      return { on: true, text: `技能经验 ×${v}` }
    },
  },
  {
    id: 'catchup', group: 'craft', icon: '🎯', name: '对决经验追赶', kind: 'rule', src: '系统规则（对决类技能 61 级起）', view: 'skill',
    read: (p) => {
      const lv = p.skillState?.('knife')?.level ?? 1
      if (lv <= 60) return off(`刀工等对决类技能 61 级起才有追赶加成（当前 ${lv} 级）`)
      return { on: true, text: `对决类技能已 ${lv} 级：按等级放大经验（等级越高倍率越高）` }
    },
  },

  // ══ 餐厅与经营 ════════════════════════════════════════════════
  {
    id: 'restaurantLevel', group: 'income', icon: '🍽', name: '餐厅等级', kind: 'rule', src: '餐厅', view: 'restaurant',
    read: (p) => {
      const lv = p.restaurant?.level ?? 1
      return { on: true, text: `餐厅 ${lv} 级：时收 ${mult(1 + 0.3 * (lv - 1))}` }
    },
  },

  // ── 副业四支（v2.10.0）：每支**只接一条**乘区出口，四条全部登记在此 ──
  // 「效果总览一个都不能漏」：这四行就是那四条的**唯一登记点**，改出口数值时同步这里。
  {
    id: 'potteryCellar', group: 'income', icon: '🏺', name: '陶艺·地窖单槽上限', kind: 'buff', src: '副业·陶艺', view: 'skill:pottery',
    read: (p) => {
      const add = p.sidelineEffectTotal?.('cellarValue') ?? 0
      if (!add) return off('还没把陶器做成作品——每做 1 件，地窖单槽价值上限 +1,500')
      return { on: true, text: `单槽价值上限 ${(p.cellarSlotValueMax?.() ?? 0).toLocaleString()}（基础 16,000 + 陶器 ${add.toLocaleString()}）` }
    },
  },
  {
    id: 'weavingTip', group: 'income', icon: '🧶', name: '编织·餐厅小费', kind: 'buff', src: '副业·编织', view: 'skill:weaving',
    read: (p) => {
      const v = p.tipBonusPct?.() ?? 0
      if (!v) return off('还没把织物做成作品——每做 1 件，餐厅小费 +2%')
      return { on: true, text: `小费 ${pct(v)}（乘在顾客好感与常客小费之上）` }
    },
  },
  {
    id: 'embroiderySign', group: 'income', icon: '🪡', name: '刺绣·招牌绣屏评分', kind: 'buff', src: '副业·刺绣', view: 'skill:embroidery',
    read: (p) => {
      const v = p.michelinSignScore?.() ?? 0
      if (!v) return off('还没把绣品做成作品——每做 1 件，米其林评分 +12 分')
      return { on: true, text: `米其林评分 +${v} 分（第七维「招牌绣屏」，帮你跨星级门槛）` }
    },
  },
  {
    id: 'candleNightWindow', group: 'income', icon: '🕯️', name: '蜡烛·夜市狂潮时长', kind: 'buff', src: '副业·蜡烛制作', view: 'skill:candles',
    read: (p) => {
      const h = p.nightMarketExtraHours?.() ?? 0
      if (!h) return off('还没把蜡烛做成作品——每做 1 件，夜市狂潮延后 1 小时')
      const end = p.nightMarketEndHour?.() ?? 22
      return { on: true, text: `夜市狂潮 16:00–次日 ${String(end % 24).padStart(2, '0')}:00（+${h} 小时，餐厅收入 ×2 的时段更长）` }
    },
  },
  {
    id: 'schoolIncome', group: 'income', icon: '📜', name: '菜系研究·收入', kind: 'buff', src: '菜系研究（各学派等级）', view: 'schools',
    read: (p) => {
      const rows = SCHOOLS.map((s) => ({ name: s.name, pct: p.schoolIncomePct?.(s.cats?.[0]) ?? 0 })).filter((x) => x.pct > 0)
      if (!rows.length) return off('还没有研究过任何菜系（每级 +8% 对应类别料理的收入）')
      const text = rows.map((x) => `${x.name} ${pct(x.pct)}`).join('、')
      return { on: true, text }
    },
  },
  {
    id: 'decor', group: 'income', icon: '🛋', name: '餐厅装潢', kind: 'buff', src: '餐厅装潢', view: 'decor',
    read: (p) => {
      const list = p.restaurant?.decor ?? []
      let sum = 0
      for (const id of list) sum += (RESTAURANT_DECOR_BY_ID[id]?.effect ?? 0) / 100
      if (!list.length) return off('还没有摆放任何装潢（每件 +0.5%~3% 时收）')
      return { on: true, text: `已摆放 ${list.length} 件，合计时收 ${pct(sum * 100)}` }
    },
  },
  {
    id: 'favorTip', group: 'income', icon: '😊', name: '顾客好感小费', kind: 'buff', src: '餐厅（顾客好感）', view: 'restaurant',
    read: (p) => {
      const lv = p.favorLevel?.() ?? 1
      if (lv <= 1) return off('顾客好感还是 1 级（每级 +3%，封顶 20 级）')
      return { on: true, text: `好感 ${lv} 级：时收 ${pct((lv - 1) * 3)}` }
    },
  },
  {
    id: 'regularTip', group: 'income', icon: '👋', name: '常客小费', kind: 'buff', src: '常客', view: 'regulars',
    read: (p) => {
      const v = p.regularTipPct()
      if (!v) return off('还没有培养出常客（每位常客每级 +2%）')
      return { on: true, text: `常客合计时收 ${pct(v)}` }
    },
  },
  {
    id: 'michelinIncome', group: 'income', icon: '⭐', name: '米其林星级·收入', kind: 'buff', src: '评级（米其林星数）', view: 'michelin',
    read: (p) => {
      const v = p.michelinIncomePct()
      if (!v) return off('还没有获得米其林星（1 星起 +10%，3 星 +35%）')
      return { on: true, text: `餐厅时收 +${v}%` }
    },
  },
  {
    id: 'staffIncome', group: 'income', icon: '👨‍🍳', name: '班底加成', kind: 'buff', src: '班底（掌勺 / 采买 / 掌柜 / 账房 / 跑堂）', view: 'staff',
    read: (p) => {
      const parts = []
      const inc = p.staffIncomePct()
      const ord = p.staffOrderPct()
      if (inc) parts.push(`餐厅时收 ${pct(inc)}`)
      if (ord) parts.push(`订单赏金 ${pct(ord)}`)
      if (!parts.length) {
        const hired = STAFF.filter((d) => (p.staff?.[d.id]?.level ?? 0) > 0).length
        return off(hired ? '在岗班底都不在时收 / 订单赛道上，或已欠薪停工' : '还没有雇佣班底')
      }
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'staffUnpaid', group: 'income', icon: '💸', name: '班底欠薪停工', kind: 'debuff', src: '班底（金币不足付工资）', view: 'staff',
    read: (p) => {
      const list = STAFF.filter((d) => p.staff?.[d.id]?.unpaid && (p.staff?.[d.id]?.level ?? 0) > 0).map((d) => d.name)
      if (!list.length) return off('班底工资正常发放（欠薪时该雇工的加成会全部失效）')
      return { on: true, text: `${list.join('、')} 因欠薪停工，加成失效` }
    },
  },
  {
    id: 'setMeal', group: 'income', icon: '🍱', name: '套餐定食', kind: 'buff', src: '套餐定食（菜单凑齐类别）', view: 'setMeals',
    read: (p) => {
      const v = p.setMealBonus()
      if (!v) return off('当前菜单没有凑齐任何套餐（凑齐后取最高一档加分）')
      return { on: true, text: `餐厅时收 ${pct(v)}` }
    },
  },
  {
    id: 'branch', group: 'income', icon: '🏬', name: '分店店长与主题', kind: 'buff', src: '分店', view: 'branches',
    read: (p) => {
      const rows = []
      for (const def of BRANCHES) {
        const st = p.branches?.[def.id]
        if (!st) continue
        const th = p.branchThemeMult?.(def.id) ?? 1
        const parts = []
        if (st.manager) parts.push('店长托管')
        if (th > 1) parts.push(`主题 ${mult(th)}`)
        if (parts.length) rows.push(`${def.name}（${parts.join(' · ')}）`)
      }
      if (!rows.length) return off('分店没有店长也没有经营主题（或还没有开分店）')
      return { on: true, text: rows.join('、') }
    },
  },
  {
    id: 'cellar', group: 'income', icon: '🍶', name: '地窖出窖加成', kind: 'buff', src: '地窖（窖神信仰）', view: 'cellar',
    read: (p) => {
      const v = p.patronEffects().cellarPct ?? 0
      if (!v) return off('未信仰窖神（窖神按信仰等级提高地窖出窖收益）')
      return { on: true, text: `地窖出窖收益 ${pct(v)}` }
    },
  },
  {
    id: 'goldGain', group: 'income', icon: '🪙', name: '金币获取加成', kind: 'buff', src: '装备词条 / 厨神之路', view: 'gear',
    read: (p) => {
      const parts = []
      const gear = p.equippedStats?.goldPct ?? 0
      const dao = p.daoEffects().goldPct ?? 0
      if (gear) parts.push(`装备词条 ${pct(gear)}`)
      if (dao) parts.push(`厨神之路 ${pct(dao)}`)
      if (!parts.length) return off('没有装备词条或厨神之路的金币加成（荣誉的金币加成只作用于餐厅时收）')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'supplier', group: 'income', icon: '📦', name: '供应商合约', kind: 'buff', src: '供应商', view: 'suppliers',
    read: (p) => {
      const list = p.activeContracts?.() ?? []
      if (!list.length) return off('没有在有效期内的合约（签约后采购价 −22%）')
      const far = Math.max(...list.map((c) => c.expiresAt ?? 0))
      return { on: true, text: `${list.length} 份合约在效期：采购价 ${mult(SUPPLIER_PRICE_MULT)}（−22%），最长还剩 ${Math.max(0, Math.ceil((far - Date.now()) / 86400000))} 天` }
    },
  },
  {
    id: 'takeout', group: 'income', icon: '🚚', name: '外卖计价', kind: 'rule', src: '外卖', view: 'takeout',
    read: (p) => {
      const lv = p.takeoutLevel?.() ?? 0
      if (!lv) return off('还没有开通外卖业务')
      return { on: true, text: `外卖 ${lv} 级：单价 = 菜品价值 ${mult(TAKEOUT_PRICE_MULT)}（套餐定食另有加成），同时可接 ${p.takeoutConcurrency?.() ?? 1} 单` }
    },
  },
  {
    id: 'taskGold', group: 'income', icon: '📋', name: '任务金币随对决等级', kind: 'rule', src: '任务中心（每日 / 每周）', view: 'quests',
    read: (p) => {
      const lv = p.combatLevel ?? 0
      if (!lv) return off('对决等级为 0，任务金币按基础值发放')
      return { on: true, text: `每日 / 每周任务的金币奖励 ×${n1(1 + lv * 0.3)}（随对决等级放大）` }
    },
  },

  // ══ 农田与产线 ════════════════════════════════════════════════
  {
    id: 'farmWeather', group: 'farm', icon: '🌦', name: '天气·农田产量', kind: 'buff', src: '天气与运势（温室不受影响）', view: 'weather',
    read: (p) => {
      const v = p.weatherEffects().farmYield ?? 1
      if (v === 1) return off('今日天气对农田产量没有影响（温室本来就不吃天气）')
      return { on: true, text: `农田产量 ${mult(v)}`, tough: v < 1 }
    },
  },
  {
    id: 'farmSeason', group: 'farm', icon: '📅', name: '当季作物', kind: 'buff', src: '农时（按月份轮换）', view: 'skill:farming',
    read: () => {
      const s = farmSeason()
      return { on: true, text: `当季「${s.name}」：${s.label}类作物产量 ×1.5（每季只认固定几类作物，按月份轮换）` }
    },
  },
  {
    id: 'farmTool', group: 'farm', icon: '🧰', name: '农具等级', kind: 'buff', src: '农具（商店升级）', view: 'shop',
    read: (p) => {
      const lv = p.farmToolLevel?.() ?? 0
      const f = p.farmTimeFactor?.() ?? 1
      if (lv <= 0) return off('还没有升级农具（每级缩短 5% 生长时间，最高 6 级）')
      return { on: true, text: `农具 ${lv} 级：生长时间 ${mult(f)}（−${Math.round((1 - f) * 100)}%）` }
    },
  },
  {
    id: 'farmFertilizer', group: 'farm', icon: '🌰', name: '肥料护田', kind: 'buff', src: '肥料（施在农田地块上）', view: 'skill:farming',
    read: (p, c) => {
      const plots = c?.skill?.('farming')?.plots ?? []
      const n = plots.filter((x) => x?.fertilizer).length
      if (!n) return off('当前没有施过肥的地块（堆肥降枯萎率、沃肥完全免疫枯萎并 +1 产量）')
      return { on: true, text: `${n} 块地已施肥（堆肥把枯萎率 3% 降到 1%，沃肥免疫枯萎且产量 +1）` }
    },
  },
  {
    id: 'farmPrime', group: 'farm', icon: '🧺', name: '精耕作物附产', kind: 'buff', src: '农耕 · 等级 ' + PRIME_MIN_LEVEL + ' 以上的作物', view: 'skill:farming',
    read: () => ({
      on: true,
      text: `种 ${PRIME_MIN_LEVEL} 级以上的作物，收获时 ${Math.round(PRIME_BASE_CHANCE * 100)}%~${Math.round(PRIME_MAX_CHANCE * 100)}% 概率附产「精耕作物」（随精通提高）——采集 / 商店 / 抽奖都拿不到的农耕独占物，可给萃露炉加料省 ${Math.round((1 - PRIME_CATALYST_TIME) * 100)}% 时间`,
    }),
  },
  {
    id: 'essencePrime', group: 'farm', icon: '⚗', name: '萃露炉加料催化', kind: 'rule', src: '灵圃菌房·萃露炉', view: 'mycoField',
    read: (p) => {
      const n = p.inventory?.['primeCrop'] ?? 0
      if (!n) return off('背包里没有精耕作物（农耕附产，加料可省 40% 酿造时间）')
      return { on: true, text: `背包有 ${n} 份精耕作物：酿菌灵露时勾选加料可省 ${Math.round((1 - PRIME_CATALYST_TIME) * 100)}% 时间` }
    },
  },
  {
    id: 'wither', group: 'farm', icon: '🥀', name: '作物枯萎', kind: 'debuff', src: '农耕（地块枯萎判定）', view: 'skill:farming',
    read: (p, c) => {
      const plots = c?.skill?.('farming')?.plots ?? []
      const n = plots.filter((x) => x?.withered).length
      if (!n) return off('当前没有枯萎的地块（施肥可把枯萎率从 3% 降到 1% 或 0%）')
      return { on: true, text: `${n} 块地已枯萎，需要清理后重新播种` }
    },
  },
  {
    id: 'spoilage', group: 'farm', icon: '🦠', name: '食材腐坏', kind: 'debuff', src: '背包（荤食类，保鲜等级越高越慢）', view: 'skill:preservation',
    read: (p) => {
      const sp = p.spoilage ?? {}
      const keys = Object.keys(sp)
      if (!keys.length) return off('背包里没有正在倒计时的易腐食材（放进冷库可以停止腐坏）')
      const soon = Math.min(...keys.map((k) => (sp[k] ?? 0) - Date.now()))
      return { on: true, text: `${keys.length} 种易腐食材在倒计时，最近一份还有 ${mins(soon)} 腐坏（放冷库可延缓）` }
    },
  },
  {
    id: 'stallRanch', group: 'farm', icon: '🐄', name: '牧场缺料停机', kind: 'debuff', src: '牧场（饲料不足）', view: 'ranch',
    read: (p) => {
      if (!p.ranchUnlocked?.()) return off('牧场尚未解锁')
      const pens = p.ranchState().pens ?? []
      const miss = missingFeed(pens.map(animalOf), p.inventory ?? {})
      if (!miss.length) return off('栏位料齐，正常产出')
      return { on: true, text: `${miss.join('；')}——已停机，补料后从 0 开始一个完整周期` }
    },
  },
  {
    id: 'stallPond', group: 'farm', icon: '🐟', name: '网箱缺料停机', kind: 'debuff', src: '牧场·网箱（海苔不足）', view: 'ranch',
    read: (p) => {
      if (!p.ranchUnlocked?.()) return off('网箱尚未解锁（与牧场一同开放）')
      const ponds = p.pondState().ponds ?? []
      const miss = missingFeed(ponds.map((x) => POND_FISH.find((f) => f.id === x?.fishId) ?? null), p.inventory ?? {})
      if (!miss.length) return off('网箱料齐，正常产出')
      return { on: true, text: `${miss.join('；')}——已停机` }
    },
  },
  {
    id: 'stallMushroom', group: 'farm', icon: '🍄', name: '菇床缺料停机', kind: 'debuff', src: '灵圃菌房（肥料不足）', view: 'mycoField',
    read: (p) => {
      if (!p.mushroomUnlocked?.()) return off('菇床尚未解锁（采摘 12 级开放）')
      const beds = p.mushroomState().beds ?? []
      const miss = missingFeed(beds.map((b) => MUSHROOM_MEDIA.find((m) => m.id === b?.mediaId) ?? null), p.inventory ?? {})
      if (!miss.length) return off('菇床料齐，正常产出')
      return { on: true, text: `${miss.join('；')}——已停机` }
    },
  },
  {
    id: 'stallHive', group: 'farm', icon: '🐝', name: '蜂箱蜜源不足停机', kind: 'debuff', src: '温室蜂场（花类蜜源不足）', view: 'greenhouse',
    read: (p) => {
      if (!p.greenhouseUnlocked?.() || !(p.hiveCount?.() > 0)) return off('蜂箱尚未解锁（农耕 20 级、温室开放后）')
      const hives = p.greenhouseState().hives ?? []
      const miss = missingFeed(hives.map((h) => HIVE_MEDIA.find((m) => m.id === h?.mediaId) ?? null), p.inventory ?? {})
      if (!miss.length) return off('蜂箱蜜源充足，正常产蜜')
      return { on: true, text: `${miss.join('；')}——倒计时已停，补齐蜜源后重新走一个完整周期` }
    },
  },
  {
    id: 'greenhouseHoney', group: 'farm', icon: '🍯', name: '温室伴生蜂蜜', kind: 'buff', src: '温室蜂场', view: 'greenhouse',
    read: () => ({ on: true, text: `温室收获作物时有 ${Math.round(GREENHOUSE_HONEY_CHANCE * 100)}% 概率伴生蜂蜜，品级随作物等级（蜂蜜只能在这里得到）` }),
  },
  {
    id: 'hiveProduce', group: 'farm', icon: '🌼', name: '蜂箱产蜜', kind: 'buff', src: '温室蜂场·蜂箱', view: 'greenhouse',
    read: (p) => {
      if (!(p.hiveCount?.() > 0)) return off('还没有建蜂箱（用花类蜜源稳定产蜜，品级随花的等级）')
      return { on: true, text: `${HIVE_MEDIA.length} 种蜜源可选，${p.hiveCount()} 个蜂箱：品级由花的等级决定（2~4 品）` }
    },
  },
  {
    id: 'mushroomLine', group: 'farm', icon: '🍄', name: '菇床料线', kind: 'buff', src: '灵圃菌房·菇床', view: 'mycoField',
    read: (p) => {
      if (!p.mushroomUnlocked?.()) return off('菇床尚未解锁')
      return { on: true, text: `${MUSHROOM_MEDIA.length} 种培养基（堆肥 / 沃肥）：把金币买得到的肥料稳定换成菌菇与灵植原料` }
    },
  },
  {
    id: 'spiritFieldSeed', group: 'farm', icon: '🌿', name: '灵圃定向种植', kind: 'buff', src: '灵圃菌房·灵圃', view: 'mycoField',
    read: (p) => {
      if (!p.spiritUnlocked?.()) return off('灵圃尚未解锁（采摘 45 级开放）')
      const plots = p.spiritState().plots ?? []
      const used = plots.filter(Boolean)
      const held = SPIRIT_PLANTS.filter((pl) => (p.inventory?.[pl.seedId] ?? 0) > 0).map((pl) => pl.name)
      return { on: true, text: `${used.length}/${plots.length} 格在种（共 ${SPIRIT_PLANTS.length} 种灵植，种什么得什么，收获后背包有同类种子会自动续种）${held.length ? `；持有种子：${held.join('、')}` : '；当前没有稀有种子'}` }
    },
  },
  {
    id: 'caravanFloor', group: 'farm', icon: '🐫', name: '商队亏损保底', kind: 'rule', src: '商队线', view: 'caravan',
    read: () => ({ on: true, text: `商队按归队时刻的行情结算，行情再差也保底回款 ${Math.round(CARAVAN_LOSS_FLOOR * 100)}% 本金` }),
  },
  {
    id: 'productionQueue', group: 'farm', icon: '🍳', name: '制作队列暂停', kind: 'debuff', src: '制作类技能（材料不足）', view: 'skill',
    read: (p) => {
      const names = []
      for (const [sid, q] of Object.entries(p.craftQueues ?? {})) {
        if (Array.isArray(q) && q[0]?.paused) names.push(SKILL_CN[sid] ?? sid)
      }
      if (!names.length) return off('制作队列没有停滞（材料不足会暂停，补料后继续）')
      return { on: true, text: `${names.join('、')} 的队列因材料不足暂停` }
    },
  },

  // ══ 对决与挑战 ════════════════════════════════════════════════
  {
    id: 'spiritCombat', group: 'combat', icon: '✨', name: '食灵·对决加成', kind: 'buff', src: '出战食灵（羁绊加成）', view: 'skill:spiritSummoning',
    read: (p) => {
      const e = p.spiritEffects()
      const parts = joinParts({ dmgPct: e.dmgPct, healPerTurnPct: e.healPerTurnPct }, KEY_LABEL)
      const styleSum = Object.values(e.styleDmgPct ?? {}).reduce((a, v) => a + (v ?? 0), 0)
      if (styleSum) parts.push(`招式伤害 ${pct(styleSum)}`)
      if (e.loseHpPerTurnPct) parts.push(`每回合自损 ${pct(-e.loseHpPerTurnPct)}`)
      if (!parts.length) return off('没有出战食灵，或该食灵不带对决加成')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'equipStats', group: 'combat', icon: '🛡', name: '装备与强化', kind: 'buff', src: '装备（含词条 / 套装 / 宝石）', view: 'gear',
    read: (p) => {
      const e = p.equippedStats ?? {}
      const parts = []
      if (e.attack) parts.push(`攻击 ${e.attack}`)
      if (e.defense) parts.push(`防御 ${e.defense}`)
      if (e.accuracy) parts.push(`命中 ${e.accuracy}`)
      if (e.evasion) parts.push(`闪避 ${e.evasion}`)
      if (e.critChance) parts.push(`暴击 ${pct(e.critChance * 100)}`)
      if (!parts.length) return off('当前没有穿戴装备')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'maxHp', group: 'combat', icon: '❤', name: '品鉴值上限', kind: 'buff', src: '品鉴力 / 装备 / 奥义 / 厨神之路', view: 'skill:tasteAcumen',
    read: (p) => ({ on: true, text: `最大品鉴值 ${p.maxHp}（品鉴力等级 + 装备 + 奥义 + 厨神之路；图谱与秘境的加成只在战斗内叠加）` }),
  },
  {
    id: 'aojiCombat', group: 'combat', icon: '📖', name: '美食奥义·对决', kind: 'buff', src: '美食知识（已激活的奥义）', view: 'skill:gastronomy',
    read: (p) => {
      const e = p.gastronomyEffects()
      const parts = joinParts({ dmgPct: e.dmgPct, defensePct: e.defensePct, speedPct: e.speedPct, maxHpBonus: e.maxHpBonus, healPct: e.healPct }, KEY_LABEL)
      const styleSum = Object.values(e.styleDmgPct ?? {}).reduce((a, v) => a + (v ?? 0), 0)
      if (styleSum) parts.push(`招式伤害 ${pct(styleSum)}`)
      if (!parts.length) return off('没有激活带对决加成的奥义')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'guildCombat', group: 'combat', icon: '🛡', name: '公会被动·对决', kind: 'buff', src: '公会（战斗型）', view: 'guild',
    read: (p) => {
      const v = p.guildEffects().dmgPct ?? 0
      if (!v) return off(p.guild?.id ? '当前公会的被动不在对决赛道上' : '还没有加入公会')
      return { on: true, text: `造成伤害 ${pct(v)}` }
    },
  },
  {
    id: 'insightCombat', group: 'combat', icon: '🕸', name: '菜系图谱·对决', kind: 'buff', src: '美食知识（菜系图谱）', view: 'skill:gastronomy',
    read: (p) => {
      const e = p.insightEffects()
      const parts = joinParts({ attackPct: e.attackPct, defensePct: e.defensePct, maxHpPct: e.maxHpPct }, KEY_LABEL)
      if (!parts.length) return off('图谱里还没有点亮对决节点')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'daoCombat', group: 'combat', icon: '🛤', name: '厨神之路·对决', kind: 'buff', src: '厨神之路（已解锁节点）', view: 'dao',
    read: (p) => {
      const e = p.daoEffects()
      const parts = joinParts({ dmgPct: e.dmgPct, maxHpPct: e.maxHpPct, critPct: e.critPct }, KEY_LABEL)
      if (!parts.length) return off('厨神之路还没有解锁对决节点')
      return { on: true, text: parts.join(' · ') }
    },
  },
  {
    id: 'realmBuff', group: 'combat', icon: '🏯', name: '食神秘境·局内加成', kind: 'buff', src: '食神秘境（本局选择的加成）', view: 'realm',
    read: (p) => {
      const r = p.realmModifiers()
      if (!r) return off('当前不在秘境局内（秘境的加成只在本局有效）')
      const parts = joinParts(r, KEY_LABEL)
      return { on: true, text: parts.length ? parts.join(' · ') : '本局已选的加成都是中性项' }
    },
  },
  {
    id: 'healBoost', group: 'combat', icon: '🍲', name: '料理回血加成', kind: 'buff', src: '奥义 / 菜系研究 / 食神信仰', view: 'skill:gastronomy',
    read: (p) => {
      const parts = []
      const ao = p.gastronomyEffects().healPct ?? 0
      const pa = p.patronEffects().healPct ?? 0
      if (ao) parts.push(`奥义 ${pct(ao)}`)
      if (pa) parts.push(`信仰 ${pct(pa)}`)
      const sch = SCHOOLS.map((s) => ({ name: s.name, pct: p.schoolHealPct?.(s.cats?.[0]) ?? 0 })).filter((x) => x.pct > 0)
      if (sch.length) parts.push(`菜系研究 ${sch.map((x) => `${x.name} ${pct(x.pct)}`).join('、')}`)
      if (!parts.length) return off('没有会提高料理回血量的来源（只在战斗内吃料理时生效）')
      return { on: true, text: `战斗内吃料理回血 ${parts.join(' · ')}` }
    },
  },
  // —— 以下 7 条只在战斗进行中存在（读的是战斗实例的瞬时状态，战斗结束即清空）——
  {
    id: 'fightBuff', group: 'combat', icon: '⚔', name: '战斗内增益（酱料 / 饮品 / 调味）', kind: 'buff', src: '战斗中使用道具', view: 'skill:knife',
    read: (p, c) => {
      const cb = c?.combat
      if (!cb?.inFight) return off('当前不在战斗中（这类状态只在战斗内存在）')
      const L = { atk: '攻击', accuracy: '命中', defense: '防御', evasion: '闪避', critChance: '暴击' }
      const parts = []
      for (const [k, v] of Object.entries(cb.buff ?? {})) if (v) parts.push(`${L[k] ?? k} ${v > 0 ? '+' : ''}${n1(v)}`)
      if (cb.biscuitSpeedPct) parts.push(`攻速 ${pct(cb.biscuitSpeedPct)}`)
      if (!parts.length) return off('本场战斗还没有使用过增益道具')
      return { on: true, text: `${parts.join(' · ')}（剩余 ${cb.buffTurns ?? 0} 回合）` }
    },
  },
  {
    id: 'fightRegen', group: 'combat', icon: '💚', name: '料理持续回血', kind: 'buff', src: '战斗中使用料理', view: 'skill:knife',
    read: (p, c) => {
      const cb = c?.combat
      if (!cb?.inFight) return off('当前不在战斗中')
      if (!cb.regenTurns) return off('本场战斗没有生效中的料理回血')
      return { on: true, text: `每回合回复 ${cb.regenPerTurn ?? 0} 点品鉴值（剩余 ${cb.regenTurns} 回合）` }
    },
  },
  {
    id: 'fightBiscuit', group: 'combat', icon: '🍪', name: '能量补给（能量饼干）', kind: 'buff', src: '战斗中使用能量饼干', view: 'skill:knife',
    read: (p, c) => {
      const cb = c?.combat
      if (!cb?.inFight) return off('当前不在战斗中')
      if (!cb.biscuitSpeedPct && !(cb.biscuitCooldown > 0)) return off('本场战斗还没有使用能量饼干')
      return { on: true, text: `命中 +8、攻速 +10%、品鉴值回复 ${BISCUIT_TASTE_RATE}%（冷却剩 ${cb.biscuitCooldown ?? 0} 回合）` }
    },
  },
  {
    id: 'fightDrunk', group: 'combat', icon: '🍺', name: '醉酒', kind: 'debuff', src: '战斗中饮用酒类', view: 'skill:knife',
    read: (p, c) => {
      const cb = c?.combat
      if (!cb?.inFight) return off('当前不在战斗中')
      if (!cb.drunkTurns) return off('本场战斗没有醉酒状态（醉酒会降低命中）')
      return { on: true, text: `命中 −15%（剩余 ${cb.drunkTurns} 回合）` }
    },
  },
  {
    id: 'fightBurn', group: 'combat', icon: '🔥', name: '灼烧', kind: 'debuff', src: '对手施加', view: 'skill:knife',
    read: (p, c) => {
      const cb = c?.combat
      if (!cb?.inFight) return off('当前不在战斗中')
      if (!cb.burnTurns) return off('本场战斗没有灼烧状态')
      return { on: true, text: `每回合受到持续伤害（剩余 ${cb.burnTurns} 回合）` }
    },
  },
  {
    id: 'fightPoison', group: 'combat', icon: '☠', name: '中毒', kind: 'debuff', src: '对手施加', view: 'skill:knife',
    read: (p, c) => {
      const cb = c?.combat
      if (!cb?.inFight) return off('当前不在战斗中')
      if (!cb.poisonTurns) return off('本场战斗没有中毒状态')
      return { on: true, text: `治疗效果减半（剩余 ${cb.poisonTurns} 回合）` }
    },
  },
  {
    id: 'fightSlow', group: 'combat', icon: '🕸', name: '面之束缚', kind: 'debuff', src: '对手机制', view: 'skill:knife',
    read: (p, c) => {
      const cb = c?.combat
      if (!cb?.inFight) return off('当前不在战斗中')
      if (!cb.slowTurns) return off('本场战斗没有被减速')
      return { on: true, text: `出招间隔 ×1.5（剩余 ${cb.slowTurns} 回合）` }
    },
  },

  // ══ 离线与容量 ════════════════════════════════════════════════
  {
    id: 'offlineHours', group: 'idle', icon: '🛏', name: '离线结算上限', kind: 'buff', src: '基础 + 能量饼干 + 厨神之路 + 山海食经', view: 'automation',
    read: (p) => {
      const total = p.offlineMaxHours()
      if (total <= OFFLINE_CAP.baseHours) return off(`还没有任何时长加成（基础 ${OFFLINE_CAP.baseHours} 小时；能量饼干最多 +${OFFLINE_CAP.biscuitMaxHours} 小时，厨神之路 / 山海食经各最多 +${OFFLINE_CAP.daoMaxHours} 小时）`)
      const bis = p.offlineBonusH ?? 0
      const dao = p.daoEffects?.().offlineHours ?? 0
      const sh = p.shanhaiEffects?.().offlineH ?? 0
      const parts = [`基础 ${OFFLINE_CAP.baseHours}`]
      if (bis) parts.push(`能量饼干 +${n1(bis)}`)
      if (dao) parts.push(`厨神之路 +${n1(dao)}`)
      if (sh) parts.push(`山海食经 +${n1(sh)}`)
      return { on: true, text: `最多补 ${n1(total)} 小时（${parts.join(' + ')}；能量饼干封顶 ${OFFLINE_CAP.biscuitMaxHours} 小时，后两项各封顶 ${OFFLINE_CAP.daoMaxHours} 小时）` }
    },
  },
  {
    id: 'offlineEfficiency', group: 'idle', icon: '💤', name: '离线效率', kind: 'debuff', src: '系统规则（离线按 80% 结算）', view: 'automation',
    read: (p) => {
      const bonus = p.apprenticeOfflineBonus?.() ?? 0
      const eff = Math.min(1, 0.8 + bonus)
      return { on: true, text: `离线产出按 80% 结算${bonus > 0 ? `，徒弟传承把它提高到 ${Math.round(eff * 100)}%` : '（收徒弟可提高效率）'}` }
    },
  },
  {
    id: 'apprentice', group: 'idle', icon: '♻', name: '徒弟离线效率加成', kind: 'buff', src: '传承（徒弟等级）', view: 'legacy',
    read: (p) => {
      const bonus = p.apprenticeOfflineBonus?.() ?? 0
      if (bonus <= 0) return off('还没有收徒弟（每级 +0.4% 离线效率，封顶 +20%）')
      return { on: true, text: `离线效率 +${n1(bonus * 100)}%（80% → ${Math.round(Math.min(1, 0.8 + bonus) * 100)}%）` }
    },
  },
  {
    id: 'caps', group: 'idle', icon: '🎒', name: '容量与槽位', kind: 'rule', src: '商店「容量与扩建」/ 山海食经 / 成就', view: 'shop',
    read: (p, c) => {
      const plots = c?.skill?.('farming')?.maxPlots ?? 0
      return {
        on: true,
        text: `背包 ${p.inventorySlotsUsed ?? 0}/${p.inventoryCap ?? 0} 格 · 仓库 ${p.bankSlotsUsed ?? 0}/${p.bankCap ?? 0} 格 · 冷库 ${p.coldStorageSlotsUsed ?? 0}/${p.coldStorageCap ?? 0} 格 · 农田 ${plots}/${DERIVED_MAX.farmPlots} 块（扩容只影响能装多少，不产生加成）`,
      }
    },
  },
]

// 兼容旧引用（外部若曾用 setCropItemsCache）
export function setCropItemsCache() {}

/** 供 farmMasteryLink 使用的技能实例来源（延迟注入，避免模块循环引用） */
let ctx1 = { allSkills: () => ({}) }
export function bindSkillContext(fn) {
  if (typeof fn === 'function') ctx1 = { allSkills: fn }
}

/**
 * 汇总当前所有效果。
 * @param {object} player player store 实例
 * @param {object} ctx    可选上下文：{ combat, skill(id), allSkills() }
 * @returns {{ groups: Array, dormant: Array, stats: object }}
 */
export function collectEffects(player, ctx = {}) {
  const all = typeof ctx.allSkills === 'function' ? ctx.allSkills : ctx1.allSkills
  const full = { ...ctx, allSkills: all }
  ctx1 = { allSkills: all }
  const groups = EFFECT_GROUPS.map((g) => ({ ...g, items: [] }))
  const dormantMap = new Map(EFFECT_GROUPS.map((g) => [g.id, { ...g, items: [] }]))
  let onBuff = 0
  let onDebuff = 0
  let onRule = 0
  let offCount = 0
  for (const row of EFFECT_ROWS) {
    let res
    try {
      res = row.read(player, full) ?? off('—')
    } catch (err) {
      res = off(`读取失败：${err?.message ?? err}`)
    }
    const item = {
      id: row.id, name: row.name, icon: row.icon, kind: row.kind, src: row.src, view: row.view,
      on: !!res.on, text: res.text ?? '—', why: res.why ?? '', left: res.left ?? null,
      tough: !!res.tough || row.kind === 'debuff',
    }
    // ⚠️ 生效项与被压下的项**必须互斥**：groups[].items 只装生效项、dormant[].items 只装未生效项。
    // 两边都装会让「生效 + 未生效 = 总行数」不成立、页面也会重复渲染（C26 有专项断言）。
    if (item.on) {
      groups.find((g) => g.id === row.group)?.items.push(item)
      if (row.kind === 'debuff') onDebuff++
      else if (row.kind === 'buff') onBuff++
      else onRule++
    } else {
      offCount++
      dormantMap.get(row.group)?.items.push(item)
    }
  }
  const dormant = [...dormantMap.values()].filter((g) => g.items.length)
  return {
    groups: groups.filter((g) => g.items.length),
    dormant,
    stats: {
      total: EFFECT_ROWS.length,
      on: onBuff + onDebuff + onRule,
      onBuff,
      onDebuff,
      onRule,
      off: offCount,
      dormantTotal: dormant.reduce((a, g) => a + g.items.length, 0),
    },
  }
}
