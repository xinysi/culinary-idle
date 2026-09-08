import fs from 'node:fs'
const edit = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8')
  let n = 0
  for (const [from, to] of pairs) {
    if (!t.includes(from)) { console.log('  MISS:', from.slice(0, 50)); continue }
    t = t.split(from).join(to)
    n++
  }
  fs.writeFileSync(file, t, 'utf8')
  console.log(file.split('/').pop(), '替换', n, '处')
}
// ── 火候炉：快速档奖励下调（速率封顶 ~150 币/分），慢速档不变 ──
edit('src/views/HeatView.vue', [
  ["speed: 0.5, every: 5, reward: 70", "speed: 0.5, every: 5, reward: 40"],
  ["speed: 0.62, every: 5, reward: 75", "speed: 0.62, every: 5, reward: 33"],
  ["speed: 0.8, every: 5, reward: 110", "speed: 0.8, every: 5, reward: 26"],
  ["speed: 0.3, every: 4, reward: 80", "speed: 0.3, every: 4, reward: 55"],
  ["speed: 0.3, dualSpeed: 0.24, every: 5, reward: 90", "speed: 0.3, dualSpeed: 0.24, every: 5, reward: 65"],
  ["speed: 0.42, dualSpeed: 0.33, every: 5, reward: 130", "speed: 0.42, dualSpeed: 0.33, every: 5, reward: 45"],
  ["speed: 0.55, dualSpeed: 0.41, every: 5, reward: 180", "speed: 0.55, dualSpeed: 0.41, every: 5, reward: 35"],
])
// ── 讲堂：徽章兑换下调 ──
edit('src/views/TriviaView.vue', [
  ["label: '游戏币 200', cost: 1", "label: '游戏币 80', cost: 1"],
  ["label: '游戏币 450', cost: 2", "label: '游戏币 180', cost: 2"],
  ["label: '游戏币 800', cost: 3", "label: '游戏币 300', cost: 3"],
  ["gainGameCoins(item.id === 'gold600' ? 200 : item.id === 'gold1500' ? 450 : 800)", "gainGameCoins(item.id === 'gold600' ? 80 : item.id === 'gold1500' ? 180 : 300)"],
])
// ── 消消乐：高难档奖励下调 ──
edit('src/views/Match3View.vue', [
  ["t2: { label: '60秒1500', steps: null, time: 60, goal: 1500, gold: 160, desc: '60 秒内达 1500 分 · +160 币' }", "t2: { label: '60秒1500', steps: null, time: 60, goal: 1500, gold: 130, desc: '60 秒内达 1500 分 · +130 币' }"],
  ["t3: { label: '90秒2000', steps: null, time: 90, goal: 2000, gold: 220, desc: '90 秒内达 2000 分 · +220 币' }", "t3: { label: '90秒2000', steps: null, time: 90, goal: 2000, gold: 180, desc: '90 秒内达 2000 分 · +180 币' }"],
  ["t4: { label: '90秒3200', steps: null, time: 90, goal: 3200, gold: 340, desc: '90 秒内达 3200 分 · +340 币 —— 高难高速' }", "t4: { label: '90秒3200', steps: null, time: 90, goal: 3200, gold: 260, desc: '90 秒内达 3200 分 · +260 币 —— 高难高速' }"],
  ["x1: { label: '硬核15', steps: 15, time: null, goal: 2200, gold: 280, desc: '仅 15 步达 2200 分 · +280 币' }", "x1: { label: '硬核15', steps: 15, time: null, goal: 2200, gold: 220, desc: '仅 15 步达 2200 分 · +220 币' }"],
  ["x2: { label: '地狱15', steps: 15, time: null, goal: 3800, gold: 450, desc: '仅 15 步达 3800 分 · +450 币 —— 极限连消' }", "x2: { label: '地狱15', steps: 15, time: null, goal: 3800, gold: 320, desc: '仅 15 步达 3800 分 · +320 币 —— 极限连消' }"],
])
// ── 大胃王：短时档奖励下调 ──
edit('src/views/FoodRushView.vue', [
  ["tiers: [{ need: 50, gold: 15 }, { need: 90, gold: 30 }, { need: 130, gold: 43 }], desc: '15 秒 · 50/90/130 碗 → 15/30/43 币", "tiers: [{ need: 50, gold: 10 }, { need: 90, gold: 20 }, { need: 130, gold: 28 }], desc: '15 秒 · 50/90/130 碗 → 10/20/28 币"],
  ["tiers: [{ need: 80, gold: 26 }, { need: 140, gold: 46 }, { need: 200, gold: 66 }], desc: '30 秒 · 80/140/200 碗 → 26/46/66 币", "tiers: [{ need: 80, gold: 20 }, { need: 140, gold: 36 }, { need: 200, gold: 52 }], desc: '30 秒 · 80/140/200 碗 → 20/36/52 币"],
])
// ── 拼图：2×2 入门奖励下调 ──
edit('src/views/PuzzleView.vue', [
  ["s2: { label: '2×2 入门', size: 2, gold: 40, desc: '2×2 · 4 块 · +40 币 —— 入门热身' }", "s2: { label: '2×2 入门', size: 2, gold: 20, desc: '2×2 · 4 块 · +20 币 —— 入门热身' }"],
])
