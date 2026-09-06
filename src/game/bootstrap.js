// 游戏启动流程 — 需求文档 §10.2
// 1. 读档（无档则新游戏）→ 2. 创建技能实例 → 3. 离线收益结算（§10.2.2）
// → 4. 启动主循环（§10.2.1）→ 5. 切后台自动存档（§8.2）
// 存档位操作（§8.2）：saveToSlot / loadSlot / deleteSlot / importSaveToSlot / exportSave

import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { GameEngine } from './core/GameEngine.js'
import { EventBus } from './core/EventBus.js'
import { SaveManager, SAVE_VERSION } from './core/SaveManager.js'
import { computeOfflineProgress, formatDuration, DEFAULT_MAX_OFFLINE_MS } from './core/OfflineProgress.js'
import { createSkillInstances, getSkillInstance, getAllSkillInstances } from './skills/registry.js'
import { itemName } from './data/items.js'
import { getSkillDef } from './data/skills.js'
import { Combat, setCombatInstance } from './combat/Combat.js'
import { applyItemBalance } from './data/itemBalance.js'
import { applyValueBalance } from './data/valueBalance.js'
import { applySpoilBalance } from './data/spoilBalance.js'
import { applyAojiBalance } from './data/aojis.js'
import { ENCOUNTERS } from './data/encounters.js'
import { FEST_MILESTONES } from './data/cookingFest.js'

export const saveManager = new SaveManager({ slot: 0 })
let engine = null
let gameRunning = false // 是否已进入游戏（进入后才允许自动存档，防止启动界面误覆盖存档）

// 制作品数值平衡：启动时按“权威制作等级”把装备/食物/饮品效果夹进随等级递增的合理区间
applyItemBalance()
applyValueBalance() // 采集材料/配方产物 value 平衡（忽略矿物）
applySpoilBalance() // 荤食腐坏：lv≥25 按 12+0.6×lv 小时设 spoilMs
applyAojiBalance() // 美食奥义 costPerSec 平衡

function buildSaveData() {
  const player = usePlayerStore()
  return { schemaVersion: SAVE_VERSION, savedAt: Date.now(), player: player.serialize() }
}

/** 离线收益结算（§10.2.2），应用于当前状态；多技能并行（§3.1）：各采集/探索分别结算
 *  返回 { reports, restGold, elapsedMs }（无收益返回 null）——供离线结算弹窗展示（2026-09-06） */
export function settleOffline(player, ui, elapsedMs) {
  // §8.1：基础 12h + 能量饼干加成（上限 +12h）
  const maxOfflineMs = DEFAULT_MAX_OFFLINE_MS + player.offlineBonusH * 3600_000

  const reports = []
  // 与在线一致：只结算并行上限内实际运行的挂机技能（§3.1 活动技能优先）
  for (const inst of player.getRunningIdleSkills()) {
    const r = computeOfflineProgress(inst, elapsedMs, maxOfflineMs)
    if (!r) continue
    inst.actionsDone += r.actions
    if (r.consumed) player.spendItems(r.consumed) // 离线消耗弹药等
    player.gainItems(r.items)
    inst.addCardXp(r.exp)
    if (r.gold > 0) player.gainGold(r.gold) // 探索等离线金币（§3.4.3）
    reports.push({ inst, r })
  }

  // 餐厅离线收入（§13）：80% 效率
  const restGold = Math.floor(player.restaurantHourlyIncome * (elapsedMs / 3600_000) * 0.8)
  if (restGold > 0) {
    player.gold += restGold
    player.stats.restaurantTotal = (player.stats.restaurantTotal ?? 0) + restGold
  }

  for (const { inst, r } of reports) {
    const first = Object.entries(r.items)[0]
    const consumedNote = r.consumed ? `，消耗 ${itemName(Object.keys(r.consumed)[0])} ×${Object.values(r.consumed)[0]}` : ''
    const goldNote = r.gold > 0 ? `，金币 +${r.gold}` : ''
    ui.pushLog(
      `离线 ${formatDuration(r.durationMs)}：${inst.def.name} +${r.exp} 经验，${first ? `${itemName(first[0])} ×${first[1]}` : '无产出'}${consumedNote}${goldNote}（80% 效率）`,
      'offline'
    )
  }
  if (reports.length === 0 && restGold > 0) ui.pushLog(`离线餐厅收入 ${restGold} 金币`, 'offline')
  return reports.length || restGold > 0 ? { reports, restGold, elapsedMs } : null
}

// ── 事件监听注册（一次性，供 startGame 与启动界面共用）──────────
let gameEventsRegistered = false
let lastEncounterAt = 0 // 奇遇触发防抖（模块级，不持久化）
export function registerGameEvents() {
  if (gameEventsRegistered) return
  gameEventsRegistered = true

  const ui = useUiStore()
  const player = usePlayerStore()

  // 切后台立即存档
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow()
  })

  // 事件 → 日志（技能动作 / 升级 / 弹药不足）
  EventBus.on('skill:action', (e) => {
    const { skillId, itemId, qty, doubled, outcome, extraItem } = e
    const skillName = getSkillDef(skillId)?.name
    const name = itemName(itemId)
    let msg = ''
    let kind = 'gain'
    switch (outcome) {
      case 'miss':
        msg = `${skillName}：鱼儿脱钩了……（少量经验）`
        kind = 'warn'
        break
      case 'rare':
        msg = `✨ 稀有收获！${skillName}钓到 ${name} ×${qty}！`
        kind = 'levelup'
        break
      case 'catch':
        msg = `${skillName}：钓到 ${name} ×${qty}${doubled ? '（双倍！）' : ''}`
        break
      case 'hunt':
        msg = `${skillName}：捕获 ${name} ×${qty}${doubled ? '（双倍！）' : ''}`
        break
      case 'dig':
        msg = `${skillName}：挖到 ${name} ×${qty}${doubled ? '（双倍！）' : ''}`
        break
      case 'plant':
        msg = `${skillName}：种下了 ${name}`
        kind = 'info'
        break
      case 'harvest':
        msg = `${skillName}：收获 ${name} ×${qty}`
        break
      case 'wither':
        msg = `${skillName}：${name} 枯萎了……`
        kind = 'warn'
        break
      case 'cleared':
        msg = `${skillName}：清理了枯萎的作物`
        kind = 'info'
        break
      case 'craft':
        msg = `${skillName}：制作成功 ${name} ×${qty}`
        break
      case 'craftfail':
        msg = `${skillName}：${name} 制作失败（材料已消耗，半额经验）`
        kind = 'warn'
        break
      case 'explore':
        msg = `${skillName}：${e.extraGain ? `获得 ${e.extraGain}` : '空手而归'}`
        kind = 'gain'
        break
      case 'explorefail':
        msg = `${skillName}：失手被抓住（${e.penalty}）`
        kind = 'warn'
        break
      default:
        msg = `${skillName}：获得 ${name} ×${qty}${doubled ? '（双倍！）' : ''}`
    }
    if (extraItem) msg += `，额外获得 ${extraItem.split(',').map((x) => itemName(x.trim())).join('、')} ×1`
    if (typeof e.expGained === 'number' && e.expGained > 0) msg += `（+${e.expGained} 经验）`
    ui.pushLog(msg, kind)

    // 主线任务 / 赛季 / 公会 / 每日周常进度（§7.2 / §13）
    const gatherOutcomes = ['catch', 'hunt', 'dig', 'gather', 'rare']
    if (gatherOutcomes.includes(outcome)) {
      player.bumpQuest('gather', itemId)
      player.bumpSeason('gather', itemId)
      player.bumpGuild('gather', itemId, skillId)
      player.bumpDaily('gather', itemId, skillId)
      // 随机奇遇：在线动作 0.2% 概率（10 秒防抖，一次只弹一个）
      if (Math.random() < 0.002 && Date.now() - lastEncounterAt > 10_000) {
        lastEncounterAt = Date.now()
        const enc = ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)]
        if (ui.openEncounter(enc)) ui.pushLog(`✨ 奇遇降临：「${enc.title}」`, 'info')
      }
    }
    if (outcome === 'craft') {
      player.bumpQuest('craft', itemId)
      player.bumpSeason('craft', itemId)
      player.bumpGuild('craft', itemId, skillId)
      player.bumpDaily('craft', itemId, skillId)
      if (skillId === 'craftsmithing') player.bumpGuild('craftEquip', itemId, skillId)
    }
    if (outcome === 'harvest') {
      player.bumpQuest('harvest', itemId)
      player.bumpSeason('harvest', itemId)
      player.bumpGuild('harvest', itemId, skillId)
      player.bumpDaily('harvest', itemId, skillId)
    }
    if (outcome === 'explore') {
      player.bumpSeason('explore', 'any')
      player.bumpGuild('explore', 'any')
      player.bumpDaily('explore', 'any')
    }
  })
  EventBus.on('player:levelup', ({ skillId, level }) => {
    ui.pushLog(`🎉 ${getSkillDef(skillId)?.name} 升到 ${level} 级！`, 'levelup')
  })
  EventBus.on('player:prestige', ({ skillId, prestiges }) => {
    ui.pushLog(`✨ ${getSkillDef(skillId)?.name} 转生！${prestiges} 转：+20% 经验，上限突破至 120 级`, 'levelup')
  })
  EventBus.on('skill:outofammo', ({ skillId, itemId }) => {
    ui.pushLog(`⚠️ ${getSkillDef(skillId)?.name}：缺少 ${itemName(itemId)}，请到商店购买！`, 'warn')
  })

  // 对决事件 → 日志（§4）
  EventBus.on('combat:start', ({ opponent }) => {
    ui.pushLog(`⚔️ 对决开始：${opponent}`, 'info')
  })
  EventBus.on('combat:end', ({ result, opponent, gold, drops, lost, isBoss }) => {
    if (result === 'win') {
      const dropText = drops?.length ? '，掉落：' + drops.map((d) => `${itemName(d.itemId)} ×${d.qty}`).join('、') : ''
      ui.pushLog(`🏆 击败 ${opponent}！获得 ${gold} 金币${dropText}`, 'levelup')
      // 赛季 / 公会 / 每日周常进度（§13）
      player.bumpSeason('combatWin', 'any')
      player.bumpGuild('combatWin', 'any')
      player.bumpDaily('combatWin', 'any')
      if (isBoss) {
        player.bumpSeason('boss', opponent)
        player.bumpGuild('boss', opponent)
        player.bumpDaily('boss', opponent)
      }
    } else {
      ui.pushLog(`💀 败给 ${opponent}${lost ? `，失去了 ${itemName(lost)}` : ''}`, 'warn')
    }
  })

  // §13 扩展事件
  EventBus.on('restaurant:upgrade', ({ level }) => ui.pushLog(`🏮 餐厅升级到 ${level} 级！`, 'levelup'))
  EventBus.on('guild:join', ({ name }) => ui.pushLog(`🤝 加入公会：${name}`, 'info'))
  EventBus.on('guild:task', ({ name, points, gold }) => ui.pushLog(`📋 公会任务完成：${name}（+${points} 公会点${gold ? `，${gold} 金币` : ''}）`, 'levelup'))
  EventBus.on('season:claim', ({ name, tier }) => ui.pushLog(`🎖️ ${name}奖励领取：${tier}`, 'levelup'))
  EventBus.on('season:mission', ({ name, points }) => ui.pushLog(`🎪 赛季任务完成：${name}（+${points} 赛季点）`, 'levelup'))

  // 每日/周常（2026-09-06）
  EventBus.on('daily:claim', ({ name, gold }) => ui.pushLog(`📋 每日任务完成：${name}（+${gold} 金币）`, 'levelup'))
  EventBus.on('daily:bonus', ({ gold, items, streak }) => {
    const prefix = streak > 1 ? `（连续第 ${streak} 天！）` : ''
    ui.pushLog(`🎁 ${prefix}每日任务全部完成，额外礼包 +${gold} 金币、能量饼干 ×1`, 'levelup')
  })
  EventBus.on('weekly:claim', ({ name, gold }) => ui.pushLog(`🏆 本周挑战完成：${name}（+${gold} 金币）`, 'levelup'))

  // 挑战塔 / 厨艺大赛（2026-09-06）
  EventBus.on('tower:milestone', ({ floor, gold, items }) => {
    const parts = [`🗼 挑战塔第 ${floor} 层里程碑：+${gold} 金币`]
    if (items?.energyBiscuit) parts.push('能量饼干 ×1')
    if (items?.mysterySpice) parts.push('神秘调料 ×1')
    ui.pushLog(parts.join('、'), 'levelup')
  })
  EventBus.on('fest:submit', ({ itemId, score }) => ui.pushLog(`🏆 大赛参赛：${itemName(itemId)}（+${score} 分）`, 'gain'))
  EventBus.on('fest:milestone', ({ index, gold, items }) => {
    const parts = [`🏆 大赛月度里程碑「${FEST_MILESTONES[index]?.score ?? ''} 分」达成：+${gold} 金币`]
    if (items?.energyBiscuit) parts.push('能量饼干 ×1')
    if (items?.mysterySpice) parts.push(`神秘调料 ×${items.mysterySpice}`)
    ui.pushLog(parts.join('、'), 'levelup')
  })
  // 食灵羁绊升级（2026-09-06）
  EventBus.on('spirit:bond', ({ spiritId, level }) => {
    ui.pushLog(`💞 羁绊升级！${itemName(spiritId)} Lv${level}（效果 +${level * 4}%）`, 'levelup')
  })
  // 锻造套装集齐（2026-09-06）
  EventBus.on('set:bonus', ({ name, gold }) => {
    ui.pushLog(`🏅 套装集齐：「${name}」+${gold} 金币、神秘调料 ×1`, 'levelup')
  })

  // 背包/仓库满（§5.4）
  EventBus.on('inventory:full', () => ui.pushLog('🎒 背包已满！请整理、存入仓库或出售（商店可扩展容量）', 'warn'))
  EventBus.on('bank:full', () => ui.pushLog('📦 仓库已满！请取出物品或扩展仓库', 'warn'))

  // 硬核模式死亡：删除当前存档并重置（§4.1/§8.2）
  EventBus.on('hardcore:death', () => {
    saveManager.clear()
    const p2 = usePlayerStore()
    p2.$reset()
    p2.newGame()
    createSkillInstances(p2)
    ui.pushLog('☠️ 硬核模式：死亡即删档！新游戏开始', 'lose')
  })

  // 成就 / 任务 / 腐坏 / 奥义事件 → 日志（§6 / §7 / §5.4 / §3.4.1）
  EventBus.on('achievement:unlock', ({ name, reward }) => {
    const parts = []
    if (reward?.gold) parts.push(`${reward.gold} 金币`)
    if (reward?.items) {
      for (const [id, qty] of Object.entries(reward.items)) parts.push(`${itemName(id)} ×${qty}`)
    }
    ui.pushLog(`🏅 成就达成：${name}${parts.length ? `（奖励：${parts.join('、')}）` : ''}`, 'levelup')
  })
  EventBus.on('quest:complete', ({ name, reward }) => {
    const parts = []
    if (reward?.gold) parts.push(`${reward.gold} 金币`)
    if (reward?.items) {
      for (const [id, qty] of Object.entries(reward.items)) parts.push(`${itemName(id)} ×${qty}`)
    }
    ui.pushLog(`📜 任务完成：${name}（奖励：${parts.join('、') || '无'}）`, 'levelup')
  })
  EventBus.on('spoilage:spoil', ({ itemId }) => {
    ui.pushLog(`⚠️ ${itemName(itemId)} 腐坏了……（可用保鲜剂防止）`, 'warn')
  })
  EventBus.on('gastronomy:off', () => {
    ui.pushLog('品鉴点数耗尽，全部奥义已关闭', 'warn')
  })
}

// ── 进入游戏（由启动界面选择存档后调用）──────────
export function startGame({ slot, newGame = false } = {}) {
  const player = usePlayerStore()
  const ui = useUiStore()
  let loaded = false

  // 1. 加载存档 / 新游戏
  if (newGame) {
    saveManager.slot = slot ?? 0
    player.$reset()
    player.newGame()
  } else if (slot !== undefined) {
    const data = saveManager.loadSlot(slot)
    if (!data) {
      ui.pushLog(`存档位 ${slot + 1} 是空的`, 'warn')
      return false
    }
    saveManager.slot = slot
    player.$reset()
    player.applySave(data.player)
    if (player.combat.hp > player.maxHp) player.setCombat({ hp: player.maxHp })
    loaded = true
  } else {
    // 默认：读当前位，无档则新游戏
    saveManager.slot = 0
    const data = saveManager.load()
    if (data) {
      player.applySave(data.player)
      loaded = true
    } else {
      player.newGame()
    }
  }

  // 2. 技能实例（需玩家状态就绪）+ 对决引擎
  createSkillInstances(player)
  setCombatInstance(new Combat(player))

  // 3. 离线结算
  const now = Date.now()
  const elapsed = now - (player.lastOnlineAt || now)
  const report = settleOffline(player, ui, elapsed)
  if (report) {
    ui.openOfflineReport(report) // 离线结算详情弹窗（2026-09-06）
  } else {
    if (loaded) ui.pushLog('欢迎回来，存档已加载', 'info')
    else ui.pushLog('新游戏开始：选择采摘目标开始挂机', 'info')
  }

  // 4. 主循环
  engine = new GameEngine({
    onTick: (deltaMs) => {
      player.tick(deltaMs)
      ui.bumpLoop() // 驱动进度条等 UI（§3.1）
    },
    onAutosave: () => saveNow(),
  })
  engine.start()

  // 5. 进入游戏标记：此后自动存档才会写入，防止启动界面阶段覆盖已有存档
  gameRunning = true

  // 新游戏：立即落盘初始档（此时 gameRunning 已 true，允许写入），避免误刷新丢失
  if (!loaded) saveNow()

  // 6. 事件监听（一次性，进入游戏后注册）
  registerGameEvents()

  // 7. 切换到游戏主界面
  ui.phase = 'game'
  return true
}

/** 兼容入口：注册监听并立即按当前位启动（向后兼容，可被替代为 startGame） */
export function bootstrapGame() {
  registerGameEvents()
  startGame({})
}

// ── 存档操作（§8.2）──────────────────────────────

export function currentSlot() {
  return saveManager.slot
}

export function saveNow() {
  if (!gameRunning) return // 未进入游戏（启动界面阶段）不写档，防止覆盖已有存档
  saveManager.save(buildSaveData())
}

/** 保存当前游戏到指定存档位（不影响当前位） */
export function saveToSlot(slot) {
  saveManager.saveSlot(slot, buildSaveData())
}

/** 在指定空槽位新建空白存档（1 级/100 金）并切换当前会话；
 *  注意：不是「把当前进度存过去」，而是真正的新开档（2026-09-06 修复「新建=99級」语义问题） */
export function newGameSlot(slot, { hardcore = false } = {}) {
  const player = usePlayerStore()
  const ui = useUiStore()
  saveManager.saveSlot(saveManager.slot, buildSaveData()) // 当前进度先写入当前位（显式操作，与 saveToSlot 一致）
  saveManager.slot = slot
  player.$reset()
  player.newGame()
  if (hardcore) player.hardcore = true
  createSkillInstances(player) // 重建技能实例（绑定当前 store）
  saveManager.saveSlot(slot, buildSaveData()) // 立即落盘新档
  ui.pushLog(`已新建空白存档于存档位 ${slot + 1}${hardcore ? '（硬核模式）' : ''}，当前进度切换为新档`, 'info')
  return true
}

/** 读取指定存档位并切换当前游戏（当前位先自动保存） */
export function loadSlot(slot) {  const player = usePlayerStore()
  const ui = useUiStore()
  const data = saveManager.loadSlot(slot)
  if (!data) {
    ui.pushLog(`存档位 ${slot + 1} 是空的`, 'warn')
    return false
  }
  saveNow() // 当前进度先写入当前位
  saveManager.slot = slot
  player.$reset()
  player.applySave(data.player)
  // 品鉴值不超过当前上限
  if (player.combat.hp > player.maxHp) player.setCombat({ hp: player.maxHp })
  createSkillInstances(player) // 重建技能实例（绑定同一 store）
  const now = Date.now()
  const report = settleOffline(player, ui, now - (player.lastOnlineAt || now))
  if (report) ui.openOfflineReport(report)
  ui.pushLog(`已读取存档位 ${slot + 1}`, 'info')
  return true
}

/** 删除指定存档位 */
export function deleteSlot(slot) {
  saveManager.clearSlot(slot)
  const ui = useUiStore()
  if (saveManager.slot === slot) {
    // 删除当前存档位：立即重置为新游戏——否则后续自动/手动保存会把旧档写回被删槽位（刷新后旧档复活）
    const player = usePlayerStore()
    player.$reset()
    player.newGame()
    createSkillInstances(player)
    ui.pushLog(`已删除存档位 ${slot + 1}，当前进度已清空并开始新游戏`, 'warn')
  } else {
    ui.pushLog(`已删除存档位 ${slot + 1}`, 'warn')
  }
}

/** 将 存档文件 存档文件导入到指定存档位 */
export async function importSaveToSlot(file, slot) {
  const ui = useUiStore()
  try {
    const data = await saveManager.importFromFile(file)
    saveManager.saveSlot(slot, data)
    ui.pushLog(`存档已导入存档位 ${slot + 1}`, 'info')
    return true
  } catch (err) {
    ui.pushLog(`导入失败：${err.message}`, 'warn')
    return false
  }
}

/** 导出当前存档位为 存档文件 文件 */
export function exportSave() {
  const data = saveManager.load()
  if (!data) {
    useUiStore().pushLog('当前存档位是空的，无可导出', 'warn')
    return false
  }
  saveManager.exportToFile(data)
  return true
}

export function getEngine() {
  return engine
}
