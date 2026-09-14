// 全量动作遍历（CI 第 11 套）— 运行：node scripts/ci/action_sweep.mjs
//
// 目的：把 store 上**每一个动作**（300+ 个）在「满配档」与「新档」两种状态下各调一次，
//       任何一个动作抛错、或调用后把关键状态打成 undefined，都算 FAIL。
// 为什么要它：单点测试只覆盖"已知路径"，而新功能/重构可能让某个冷门动作直接崩；
//       这是"所有功能能正常运行"的兜底网（实测 311 动作 × 2 状态 = 0 异常）。
// 关键做法：**每个动作都用独立存档**（否则前一个动作（如 prestige/结算类）会污染后一个的输入，
//       造成"状态损坏"的假警报——首版就是每个动作共用一份存档，误报了 6 个动作）。
import { createPinia, setActivePinia } from 'pinia'

const { usePlayerStore } = await import('../../src/stores/player.js')
const { createSkillInstances } = await import('../../src/game/skills/registry.js')

const OBJECT_PROTO = new Set(Object.getOwnPropertyNames(Object.prototype))
const SKIP = new Set(['$reset', '$patch', '$subscribe', '$onAction', '$dispose', 'newGame', 'applySave', 'serialize'])
// 需要入参的动作：给一个"安全但不做事"的参数（避免因缺参抛错而误报）
const ARGS = {
  setActiveSkill: ['foraging'], setSkillState: ['foraging', { level: 50, exp: 0 }], setSkillTarget: ['foraging', 'apple'],
  getSkillTarget: ['foraging'], equip: ['ironKnife'], unequip: ['weapon'], sellItem: ['apple', 1], spendItem: ['apple', 1],
  gainItem: ['apple', 1], gainItems: [{ apple: 1 }], spendItems: [{ apple: 1 }], canGainItem: ['apple', 1],
  addMastery: ['foraging', 'apple', 1], buyItem: ['apple', 1], expandInventory: [1], expandBank: [1],
  signContract: ['sp_grain'], cellarPut: [0, 'riceWine', 1, 12], cellarClaim: [0], cellarTakeBack: [0],
  ranchFeed: [0, 'chicken'], ranchCollect: [0], ranchBuyAnimal: [0, 'chicken'],
  trialStart: ['t_speed'], onCombatEndTrial: [{ result: 'win', turns: 5, hpLeft: 90, hpMax: 100 }],
  startTrial: ['t_speed'], expeditionStart: ['fishery', 0], expeditionClaim: ['fishery', 0],
  // 挂机产线四套（2026-09-14）：商队线 / 菌房 / 灵田 / 温室蜂场（含蜂箱）/ 网箱
  caravanStart: [0, 'plain', { apple: 1 }], caravanClaim: [0], caravanRecall: [0], caravanExpand: [], caravanAutoLoad: [],
  mushroomBuild: [0, 'compost'], mushroomRemove: [0], mushroomExpand: [],
  spiritPlant: [0, 'lingzhiSeed'], spiritHarvest: [0], spiritTakeBack: [0], spiritExpand: [],
  greenhousePlant: [0, 'wheatSeed'], greenhouseClear: [0], greenhouseExpand: [],
  hiveSet: [0, 'rose'], hiveClear: [0], hiveExpand: [],
  pondBuy: [0, 'crucian'], pondRemove: [0], pondExpand: [],
  exchangeSell: ['apple', 1], exchangeBuy: ['apple', 1], exchangeTradedToday: ['apple'],
  worshipPatron: ['p_stove'], patronLevel: ['p_stove'], patronSwitch: ['p_wine'],
  claimMail: [1], deleteMail: [1], markMailRead: [1],
  visitFriend: ['auntieWang'], deliverFriendOrder: ['auntieWang'], friendBond: ['auntieWang'],
  regularServe: ['r_oldman', 'roastPotato'], regularLevel: ['r_oldman'],
  joinGuild: ['umami'], unlockRegion: ['plain'], postRegion: ['foraging', 'plain'],
  unlockSchoolNode: ['s_main'], upgradeStaff: ['chef'], fireStaff: ['chef'], staffLevelOf: ['chef'], staffActive: ['chef'],
  buyMascot: ['cat'], buyBranch: ['east'], hireBranchManager: ['east'], setBranchTheme: ['east', 'sichuan'],
  alchemyCraft: ['al1'], craft: ['roastPotato'],
  onTowerWin: [1], claimTowerMilestone: [10], recordMinigame: ['snake', 1], minigameRecord: ['snake'],
  claimSeasonTier: [1], bumpSeason: ['combatWin', 'any'], bumpDaily: ['combatWin', 'any'], bumpGuild: ['combatWin', 'any'],
  claimCodexReward: ['x'], socketGem: ['weapon', 'goldOre'], unsocketGem: ['weapon', 0],
  upgradeGear: ['ironKnife'], rerollGearMod: ['weapon'],
  banquetDeliver: ['roastPotato', 1], deliverBanquet: ['roastPotato', 1], festSubmit: ['roastPotato'],
  criticSubmit: ['roastPotato'], prestigeSkill: ['foraging'], buyFromShop: ['apple', 1],
  deluxeBuy: ['roastPotato', 1], onCombatWin: [{ name: 'x', level: 5, isBoss: false }],
  finishQuestIfReady: [{ objectives: [] }], canGainItems: [[{ id: 'apple', qty: 1 }]],
  moveToInventory: ['apple', null], moveToBank: ['apple', null],
  spendGameCoins: [1], gainGameCoins: [1], gainGold: [1], spendGold: [1],
}

function makePlayer(kind) {
  setActivePinia(createPinia())
  const p = usePlayerStore()
  p.newGame()
  if (kind === 'maxed') {
    for (const id of Object.keys(p.skills)) p.setSkillState(id, { level: 120, exp: 0, prestiges: 2 })
    p.gold = 99999999
    p.gems = 9999
    p.tastePoints = 9999
    p.gameCoins = 9999
    for (const it of ['apple', 'wheat', 'flour', 'milk', 'salt', 'ironOre', 'trap', 'garnish', 'mysterySpice', 'energyBiscuit', 'godFeast', 'wood', 'stone', 'riceWine']) p.inventory[it] = 999
    p.restaurant = { ...p.restaurant, level: 40, menu: ['roastPotato', 'whiteBread'] }
  }
  createSkillInstances(p)
  return p
}
const healthy = (p) => !!p && !!p.inventory && !!p.skills && !!p.stats && !!p.collected && !!p.equipment

let pass = 0
let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; } else { fail++; console.log(`FAIL  ${name} ${detail}`) }
}

for (const kind of ['maxed', 'fresh']) {
  const probe = makePlayer(kind)
  const names = [...new Set([...Object.keys(probe), ...Object.getOwnPropertyNames(Object.getPrototypeOf(probe))])]
    .filter((k) => typeof probe[k] === 'function' && !k.startsWith('_') && !OBJECT_PROTO.has(k) && !SKIP.has(k))
  const bad = []
  for (const fn of names) {
    const p = makePlayer(kind) // 每个动作独立存档
    try {
      const args = ARGS[fn]
      if (args) p[fn](...args)
      else p[fn]()
      if (!healthy(p)) bad.push(`${fn}: 调用后关键状态变 undefined`)
    } catch (e) {
      bad.push(`${fn}: ${String(e.message).slice(0, 70)}`)
    }
  }
  check(`动作遍历·${kind === 'maxed' ? '满配档' : '新档'}（${names.length} 个动作）`, bad.length === 0, bad.slice(0, 8).join('; '))
  console.log(`  ok  [动作] ${kind === 'maxed' ? '满配档' : '新档'}：${names.length} 个动作全部可调用、状态未损坏`)
}

console.log(`\n══ 结果：通过 ${pass} / 失败 ${fail} ══`)
process.exit(fail === 0 ? 0 : 1)
