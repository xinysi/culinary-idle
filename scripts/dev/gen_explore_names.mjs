// 按「掉落材料」为 1-100 的探索目标生成候选新名（**打印**出来供人工筛选，不写文件）。
//
// 规则（对齐 101-120 那批的观感：3 字、摊位/铺面名、一眼看出这儿有什么）：
//   ① 取**第一个物品战利品**当"招牌"（生成器把该档最代表性的料排在最前）。
//   ② 去掉做法前缀（清炒/红烧/凉拌/蒸/煮/椒盐…）与新鲜度前缀（嫩/老/生/熟/鲜/干），
//      留最后 2 字当核心词（辣椒 / 鲱鱼 / 麋鹿 / 土豆…）；只剩 1 字就补一个「小/老/鲜」。
//   ③ 后缀按**品类**挑（原料→摊/铺/棚/坊/集/行；料理→馆/楼/居/堂/斋；矿产→坊/窑） +
//      按下标轮换，避免清一色。
//   ④ 重名就换后缀，再不行加前缀字。
import { createPinia, setActivePinia } from 'pinia'
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
usePlayerStore().newGame()
const { EXPLORATION_TARGETS_ALL } = await import('../../src/game/data/explorationTargets.js')
const { ITEMS } = await import('../../src/game/data/items.js')

const COOK = /^(清炒|红烧|凉拌|清蒸|椒盐|糖醋|香煎|油焖|白灼|蜜汁|蒜蓉|酸辣|麻辣|卤煮|炭烤|干煸|爆炒|炖|煮|蒸|烤|炸|煎|卤|腌|糟|醉|拌|炒|焖|烧|烩|羹|汤)/
const FRESH = /^(嫩|老|生|熟|鲜|干|小|大)/
const RAW = ['摊', '铺', '棚', '坊', '集', '行']
const DISH = ['馆', '楼', '居', '堂', '斋', '家']
const ORE = ['坊', '窑', '铺', '行']

function core(name) {
  let s = name.replace(COOK, '').replace(FRESH, '')
  if (s.length >= 2) return s.slice(-2)
  return s.length === 1 ? s : name.slice(-2)
}

const used = new Set()
const rows = []
for (const [i, t] of EXPLORATION_TARGETS_ALL.filter((x) => !String(x.id).startsWith('explore_late_')).entries()) {
  const first = (t.loot ?? []).find((l) => l.itemId)
  const it = first ? ITEMS[first.itemId] : null
  const iname = it?.name ?? '杂货'
  const cat = it?.category ?? ''
  const isDish = ['food', 'drink'].includes(it?.type) || ['主菜', '主食', '汤品', 'baking', '腌制品'].includes(cat)
  const isOre = ['mineral'].includes(cat) || ['material'].includes(it?.type)
  const suffixes = isOre ? ORE : (isDish ? DISH : RAW)
  const c = core(iname)
  let name = ''
  for (let k = 0; k < suffixes.length; k++) {
    const cand = c + suffixes[(i + k) % suffixes.length]
    if (!used.has(cand)) { name = cand; break }
  }
  if (!name) { for (const p of ['小', '老', '新', '大', '南', '北']) { const cand = p + c + (suffixes[i % suffixes.length]); if (!used.has(cand)) { name = cand; break } } }
  used.add(name)
  rows.push([t.id, t.reqLevel, t.name, name, iname, cat])
}
for (const [id, lv, oldN, newN, iname, cat] of rows) {
  console.log([id, lv, oldN, newN, iname, cat].join('\t'))
}
console.error('共', rows.length, '件；重名', rows.length - new Set(rows.map((r) => r[3])).size)
