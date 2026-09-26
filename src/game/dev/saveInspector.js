// 存档体检：把 CI 守卫里那套「不变量」搬到浏览器里跑一遍，答辩时可现场自证数据没坏。
//
// 与 `scripts/ci/*` 的分工：CI 守卫查的是**源码与数据层**（配方引用、赛季结构、图鉴三查…），
// 这里查的是**这一份运行时存档**（NaN 金币、幽灵物品、越界等级、超上限容量…）——
// 正是「玩家点进去才发现」的那类脏档。
//
// 🔴 口径必须与引擎同源（2026-09-25 全面同步）：等级上限来自 Skill.js 的 levelCapFor（转生 120 / 常规 100），
//    容量来自 caps.js 的 STORAGE_*（存储合一后厨藏真值 2500~3232；旧 CAP_MAX.inventory=376 只描述「奖励档名」），
//    堆叠上限来自 stackRules.js 的 effectiveStackCap（100 亿 / 有词条装备 1）。
//    上一版把这三处写成旧常量 ⇒ 转生档、扩容档会被体检**假红**。
import { ITEMS, getItem } from '../data/items.js'
import { SEASONS } from '../data/seasons.js'
import { ALL_ACHIEVEMENTS } from '../data/achievements.js'
import { SKILL_DEFS } from '../data/skills.js'
import { CAP_BASE, CAP_MAX, STORAGE_BASE, STORAGE_MAX, safeCap } from '../data/caps.js'
import { effectiveStackCap, STACK_MAX } from '../data/stackRules.js'
import { MAX_LEVEL, PRESTIGE_MAX_LEVEL, levelCapFor } from '../skills/Skill.js'

const num = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * @returns {{ ok:boolean, label:string, detail:string }[]}
 */
export function inspectSave(player) {
  const out = []
  const push = (ok, label, detail = '') => out.push({ ok, label, detail })

  // ① 金币 / 游戏币 / 品鉴点：必须是有限非负数（NaN 会让所有上限与消费静默失效）
  for (const [key, label] of [['gold', '金币'], ['gameCoins', '游戏币'], ['tastePoints', '品鉴点数']]) {
    const v = player[key]
    push(num(v) && v >= 0, `${label}是有限非负数`, `= ${String(v)}`)
  }

  // ② 背包/仓库：物品 id 必须存在、数量必须为正整数（`spendItem` 归零会删键，残留 0 也是脏的）
  for (const [key, label] of [['inventory', '背包'], ['bank', '仓库']]) {
    const bag = player[key] ?? {}
    const ghosts = Object.keys(bag).filter((id) => !getItem(id))
    const bad = Object.entries(bag).filter(([, q]) => !num(q) || q <= 0 || !Number.isInteger(q))
    push(ghosts.length === 0, `${label}无幽灵物品`, ghosts.length ? `幽灵 id：${ghosts.slice(0, 5).join(', ')}` : `${Object.keys(bag).length} 种`)
    push(bad.length === 0, `${label}数量均为正整数`, bad.length ? `异常：${bad.slice(0, 5).map(([k, v]) => `${k}=${v}`).join(', ')}` : '')
  }

  // ②b 堆叠上限（2026-09-25 新增，与 stackRules.js 同源）：数量不得超 100 亿，
  //     **有词条的装备上限 1**——手改存档塞出超限数量会让经济对账失真。
  const overStack = []
  for (const [key, label] of [['inventory', '背包'], ['bank', '仓库'], ['coldStorage', '冷库']]) {
    for (const [id, q] of Object.entries(player[key] ?? {})) {
      const it = ITEMS[id]
      const cap = it ? effectiveStackCap(it, !!(player.gearMods?.[id])) : STACK_MAX
      if (num(q) && q > cap) overStack.push(`${label}:${id}=${q}>${cap}`)
    }
  }
  push(overStack.length === 0, `数量未超堆叠上限（${STACK_MAX.toLocaleString()} / 有词条装备 1）`, overStack.slice(0, 5).join(', '))

  // ③ 技能等级/经验（等级越界会让 interval 变负、经验 NaN 会让升级判定恒假）。
  //    🔴 上限走 levelCapFor：**转生档合法上限是 120**——旧检查用单一 MAX_LEVEL(100) 会把
  //    101~120 级的合法转生档判成假红。
  const badSkill = Object.entries(player.skills ?? {}).filter(([, s]) => {
    const cap = levelCapFor(s?.prestiges ?? 0)
    return !num(s?.level) || s.level < 1 || s.level > cap || !num(s?.exp) || s.exp < 0
  })
  const unknownSkill = Object.keys(player.skills ?? {}).filter((id) => !SKILL_DEFS[id])
  push(badSkill.length === 0, `技能等级/经验合法（1~${MAX_LEVEL}，转生档 1~${PRESTIGE_MAX_LEVEL}）`, badSkill.length ? badSkill.slice(0, 4).map(([id, s]) => `${id}={lv:${s?.level},exp:${s?.exp}}`).join(' ') : '')
  push(unknownSkill.length === 0, '无未知技能键', unknownSkill.join(', ') || '')

  // ④ 图鉴/成就 id 必须存在
  const badCollected = Object.keys(player.collected ?? {}).filter((id) => !getItem(id))
  const badAch = (player.achievements ?? []).filter((id) => !ALL_ACHIEVEMENTS.some((a) => a.id === id))
  push(badCollected.length === 0, '图鉴无幽灵条目', badCollected.slice(0, 5).join(', ') || `${Object.keys(player.collected ?? {}).length} 件`)
  push(badAch.length === 0, '成就 id 全部有效', badAch.slice(0, 5).join(', ') || `${(player.achievements ?? []).length} 个`)

  // ⑤ 赛季键必须是有效赛季 id（脏 id 会让赛季页显示空白）
  const badSeason = Object.keys(player.seasons ?? {}).filter((id) => !SEASONS.some((s) => s.id === id))
  push(badSeason.length === 0, '赛季键全部有效', badSeason.slice(0, 5).join(', ') || `${Object.keys(player.seasons ?? {}).length} 季`)

  // ⑥ 容量（2026-09-25 同步「存储合一」后的真值）：
  //    厨藏 = inventoryCap ∈ [STORAGE_BASE, STORAGE_MAX]（旧仓库容量已并入，读档时按此夹取）；
  //    bankCap 是**旧档遗留字段**，存储合一后恒 0；冷库仍走 [CAP_BASE.cold, CAP_MAX.cold]。
  //    旧检查对 CAP_MAX.inventory(376)/bank(956) 断言，会把合法扩容的档判成假红。
  const invCap = player.inventoryCap
  push(num(invCap) && invCap === safeCap(invCap, STORAGE_BASE, STORAGE_MAX), `厨藏容量在合法区间（${STORAGE_BASE}~${STORAGE_MAX}）`, `= ${String(invCap)}`)
  push(num(player.bankCap) && player.bankCap === 0, 'bankCap = 0（旧仓库字段，存储合一后恒 0）', `= ${String(player.bankCap)}`)
  const coldCap = player.coldStorageCap
  push(num(coldCap) && coldCap === safeCap(coldCap, CAP_BASE.cold, CAP_MAX.cold), `冷库容量在合法区间（≤ ${CAP_MAX.cold}）`, `= ${String(coldCap)}`)

  // ⑦ 腐坏计时：时间戳必须有限（脏值会让食材永远不腐坏或立刻腐坏）
  const badSpoil = Object.entries(player.spoilage ?? {}).filter(([, at]) => !num(at))
  push(badSpoil.length === 0, '腐坏计时戳合法', badSpoil.slice(0, 5).map(([k]) => k).join(', '))

  // ⑧ 存档体积（localStorage 有 5MB 软上限，接近时该提醒清理年鉴/日志类数据）
  let sizeKb = 0
  try { sizeKb = Math.round(JSON.stringify(player.serialize()).length / 1024) } catch { sizeKb = -1 }
  push(sizeKb >= 0 && sizeKb < 4096, '存档体积 < 4MB', sizeKb >= 0 ? `${sizeKb} KB（年鉴 ${(player.chronicle ?? []).length} 条 · 轶事进度 ${Object.keys(player.storyProgress ?? {}).length} 键）` : '序列化失败')

  return out
}

export function summarizeInspection(rows) {
  const bad = rows.filter((r) => !r.ok)
  return { total: rows.length, bad: bad.length, badRows: bad }
}
