// 餐厅装饰生成器：读 restaurantDecorBase.js（100 件基线 id/name）→ 补 200 件新增 → 按统一曲线重铺 price/effect/category → 产出 restaurantDecor.js
// 数值曲线：price 从 500 → 750000 单调递增（低段平缓、高段陡），effect 随 price 从 +0.5% → +3% 线性（无倒挂）
// 勿手改产物 restaurantDecor.js，改曲线/新增请改本脚本并重跑
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { RESTAURANT_DECOR_BASE } from '../src/game/data/restaurantDecorBase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../src/game/data/restaurantDecor.js')

// 8 类新增家具（每类 25，共 200）；category 即类别 key；名字带 emoji（补全装饰图标）
const NEW_BY_CATEGORY = {
  lighting: [
    '🌈 霓虹吊灯', '💡 琥珀射灯', '🕯️ 黄铜壁灯', '🔮 琉璃夜灯', '💡 落地阅读灯', '💎 水晶台灯', '🏮 暖光灯笼', '🌌 星空氛围灯', '🌿 吊兰壁灯', '💡 节能吸顶灯',
    '🕯️ 香氛烛灯', '⛏️ 复古矿灯', '🐂 牛角壁灯', '🔔 铜铃吊灯', '💠 云母灯罩', '🕯️ 烛光吊灯', '⭐ 星星串灯', '🎨 莫兰迪射灯', '☀️ 无影日光灯', '🌈 落地霓虹',
    '🌙 桌面小夜灯', '🌅 落日氛围灯', '🪟 花窗灯箱', '💡 琥珀壁灯', '✨ 鎏金吊灯',
  ],
  furniture: [
    '🪑 橡木餐桌', '🛋️ 软包餐椅', '🛋️ 真皮卡座', '🪑 吧台高脚凳', '🗄️ 雕花餐边柜', '📚 原木书架', '🪵 胡桃木屏风', '🪞 复古梳妆台', '🪑 日式矮桌', '🏛️ 大理石吧台',
    '🪜 铁艺置物架', '🧺 藤编屏风', '🛋️ 欧式沙发', '🗄️ 橡木橱柜', '🛋️ 布艺软座', '🍵 紫檀茶桌', '🪑 可折叠餐桌', '👶 儿童餐椅', '🍺 长条吧台', '🗄️ 木质展柜',
    '👟 玄关鞋柜', '🍽️ 旋转餐台', '🪑 靠背长凳', '🔍 玻璃展示柜', '🍷 红木酒柜',
  ],
  tableware: [
    '🍽️ 骨瓷餐盘', '🔪 鎏金刀叉', '🥣 青花瓷碗', '🥂 琉璃高脚杯', '🥢 竹制筷子', '🍷 水晶醒酒器', '🥗 珐琅沙拉碗', '🍜 陶瓷汤碗', '🍎 银质果盘', '🍮 雕花点心盘',
    '☕ 欧式咖啡杯', '🍣 日式寿司盘', '🥣 抛光钵碗', '🥄 白瓷调羹', '🔪 复古黄油刀', '🍰 水晶甜品杯', '🫖 珐琅茶壶', '🍽️ 银质餐巾环', '🪵 木质餐板', '🥗 玻璃沙拉碗',
    '🍯 陶瓷蘸料碟', '🥂 鎏金镀银杯', '🍵 青瓷茶碗', '🍽️ 大理石餐盘', '🥄 玫瑰金餐具',
  ],
  kitchen: [
    '🍳 铸铁炒锅', '🍲 珐琅炖锅', '🍳 铜制平底锅', '🍲 不锈钢蒸锅', '🍲 陶瓷砂锅', '🍖 铁艺烤盘', '🧃 石磨豆浆机', '🍲 紫铜汤锅', '🫕 玻璃炖盅', '🍳 双耳铁锅',
    '🍳 深口煎锅', '🍚 竹蒸笼', '🍲 高压焖锅', '🔥 铜质热铛', '🍲 陶土煲仔', '🍲 珐琅焗盘', '🍢 铸铁烤网', '🍲 陶瓷焖罐', '🍜 不锈钢汤桶', '🍲 砂锅盖盅',
    '🍖 铁板扒炉', '🍲 铜质火锅', '🥛 搪瓷奶锅', '🏺 陶制药罐', '🍲 紫砂焖锅',
  ],
  plants: [
    '🌸 杜鹃盆景', '🌿 文竹绿植', '🪴 吊兰盆栽', '🌿 龟背竹', '🌿 琴叶榕', '🌱 薄荷盆', '🌳 发财树', '🌸 君子兰', '🌵 多肉盆景', '🍀 苔藓微景',
    '🌿 铁线蕨', '🌹 月季盆栽', '💜 紫罗兰', '🌼 茉莉盆景', '🌿 常春藤', '🌿 虎皮兰', '🌳 橡皮树', '🌺 秋海棠', '🍃 彩叶草', '🌿 藤蔓绿墙',
    '🌿 香草盆栽', '💧 水培绿萝', '💐 绣球盆栽', '🌿 兰草盆景', '🎋 棕竹盆栽',
  ],
  decor: [
    '🖼️ 水墨挂画', '🧣 丝绸挂毯', '🎋 竹编壁挂', '🎐 铁艺风铃', '🏺 陶瓷香薰', '🐚 贝壳风铃', '🪶 羽毛挂饰', '🥁 铜锣挂件', '🪵 木雕挂屏', '⛓️ 流苏帘子',
    '📿 珍珠挂链', '🧺 藤编挂篮', '🪔 锡兰挂灯', '🎍 竹质挂轴', '🔮 琉璃挂饰', '🪡 刺绣挂幅', '🟠 琥珀挂件', '🔴 玛瑙挂坠', '🪸 珊瑚摆件', '⬛ 黑曜石摆件',
    '🔮 水晶洞摆件', '🌾 生石花摆件', '🐚 海螺摆件', '💠 和田玉坠', '💍 泰银挂饰',
  ],
  art: [
    '🖼️ 油画静物', '🏔️ 国画山水', '🖌️ 书法条幅', '🏺 景泰蓝瓶', '🎨 漆器屏风', '📦 螺钿匣', '🛕 鎏金铜佛', '🙏 青瓷观音', '🐎 唐三彩马', '🐲 玉雕貔貅',
    '🗿 木雕罗汉', '🦁 铜狮镇纸', '🏺 珐琅彩瓶', '🏺 紫砂雕塑', '🦴 骨雕摆件', '⚪ 象牙球雕', '🧵 银胎掐丝', '🎁 漆盒摆件', '🦄 石雕麒麟', '🖊️ 竹雕笔筒',
    '🪬 玉如意', '🐎 陶瓷骏马', '🙏 琉璃观音', '🏺 景泰蓝盘', '🪔 鎏金香炉',
  ],
  appliance: [
    '🧊 商用冰柜', '🧊 双门冰箱', '♨️ 嵌入式烤箱', '📡 微波炉', '☕ 咖啡机', '🧊 制冰机', '🧊 保鲜柜', '🧼 消毒柜', '🔩 抽油烟机', '❄️ 空调挂机',
    '🌬️ 空气净化器', '🔊 音响设备', '🎬 投影幕布', '📺 液晶电视', '💰 收银机', '🧾 点单机', '🍷 温控酒柜', '☕ 热饮机', '🍦 冰淇淋机', '🥚 打蛋器',
    '🥘 料理机', '🥤 破壁机', '🔥 电陶炉', '♨️ 热风烘箱', '♨️ 蒸汽烤箱',
  ],
}
const CATEGORY_LABEL = {
  lighting: '灯光照明', furniture: '实用家具', tableware: '精致餐具', kitchen: '炊具厨具',
  plants: '绿植园艺', decor: '挂饰摆件', art: '艺术品', appliance: '电器设备',
}

// 按名称关键词给基线件归类
function classify(name) {
  const s = name
  if (/吊灯|烛台|灯|灯笼|灯罩|灯箱|夜灯|射灯/.test(s)) return 'lighting'
  if (/桌椅|椅|沙发|吧台|柜|书架|屏风|桌|凳|展柜|餐台|卡座|软座/.test(s)) return 'furniture'
  if (/餐具|盘|碗|刀叉|筷|杯|壶|勺|碟|醒酒器|餐巾环|餐板|餐盘|调羹|汤碗|果盘/.test(s)) return 'tableware'
  if (/锅|灶|烤箱|蒸笼|烤|煲|蒸锅|煎|焖|炖|炉|汤桶|扒炉/.test(s)) return 'kitchen'
  if (/盆栽|绿植|盆景|盆|花|蕨|竹|榕|兰|薇|薄荷|发财树|藤蔓|绿萝|常春藤|虎皮兰|橡皮树|秋海棠|彩叶/.test(s)) return 'plants'
  if (/挂画|挂毯|风铃|香薰|挂件|挂饰|挂屏|挂链|挂篮|挂灯|挂轴|挂幅|摆件|帘|香炉|香/.test(s)) return 'decor'
  if (/画|书法|瓶|屏|匣|佛|观音|马|貔貅|罗汉|镇纸|雕塑|摆件|雕|如意|香炉|器/.test(s)) return 'art'
  if (/冰箱|冰柜|烤箱|微波|咖啡机|制冰|保鲜柜|消毒柜|油烟机|空调|净化器|音响|投影|电视|收银|点单|酒柜|热饮|冰淇|打蛋|料理机|破壁|电陶炉|烘/.test(s)) return 'appliance'
  return 'decor'
}

// 组装全部件：基线（保持 name，重新归类）+ 新增（decor_101~decor_300）
const items = []
for (const b of RESTAURANT_DECOR_BASE) {
  items.push({ id: b.id, name: b.name })
}
let nid = 100
for (const [cat, names] of Object.entries(NEW_BY_CATEGORY)) {
  for (const nm of names) {
    nid++
    items.push({ id: `decor_${nid}`, name: nm, _cat: cat })
  }
}
if (items.length !== 300) { console.error('期望 300，实际', items.length); process.exit(1) }

// 统一曲线：按全局 index 计算 price（500→750000 单调）与 effect（随 price 0.5%→3%）
const MIN_P = 500, MAX_P = 750000
const N = items.length
const priceFor = (i) => Math.round(MIN_P + (MAX_P - MIN_P) * Math.pow(i / (N - 1), 1.35))
const effectFor = (p) => +(0.5 + ((p - MIN_P) / (MAX_P - MIN_P)) * 2.5).toFixed(1)

const rich = items.map((it, i) => {
  const price = priceFor(i)
  const effect = effectFor(price)
  const category = it._cat || classify(it.name)
  return { id: it.id, name: it.name, category, price, effect }
})

// 按 category 分组（组内按价格升序）
const byCat = {}
for (const r of rich) {
  ;(byCat[r.category] = byCat[r.category] || []).push(r)
}
for (const k of Object.keys(byCat)) byCat[k].sort((a, b) => a.price - b.price)

// 生成 JS 文件（按分类固定顺序输出）
const catOrder = Object.keys(CATEGORY_LABEL)
let body = `// 餐厅装饰（生成器自动生成，勿手改）：${rich.length} 件（基线 ${RESTAURANT_DECOR_BASE.length} + 新增 ${rich.length - RESTAURANT_DECOR_BASE.length}）
// 曲线：price ${MIN_P}→${MAX_P} 单调；effect 随 price 从 +0.5% → +3% 递增（收入%梯度，无倒挂）
// 生成：node scripts/gen_restaurant_decor.mjs
import { RESTAURANT_DECOR_BASE } from './restaurantDecorBase.js'

// 类别显示名
export const DECOR_CATEGORIES = [
`
for (const k of catOrder) body += `  { id: '${k}', label: '${CATEGORY_LABEL[k]}' },\n`
body += `]

// 全部装饰（按类别分组，组内价格升序）
export const RESTAURANT_DECOR = [
`
for (const k of catOrder) {
  const list = byCat[k] || []
  body += `  // ── ${CATEGORY_LABEL[k]}（${list.length} 件）──\n`
  for (const r of list) body += `  { id: '${r.id}', name: '${r.name}', category: '${r.category}', price: ${r.price}, effect: ${r.effect} },\n`
}
body += `]

// 兼容旧用法：仍从 baseline 复用 id/name（供 buyDecor 显示）
export const RESTAURANT_DECOR_BY_ID = Object.fromEntries(RESTAURANT_DECOR.map((d) => [d.id, d]))
`
fs.writeFileSync(OUT, body, 'utf8')
console.log(`已生成 ${OUT}: ${rich.length} 件`)
// 审计：价格与 effect 是否单调
let monotonic = true
for (let i = 1; i < rich.length; i++) {
  if (rich[i].price < rich[i - 1].price) monotonic = false
  if (rich[i].effect < rich[i - 1].effect) monotonic = false
}
console.log('整体价格/效果随 index 单调:', monotonic)
