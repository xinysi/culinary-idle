// 赛季系统 — 需求文档 §13（可选扩展）
// 每赛季新主题、新食材、新限定装备；按时间轮换（durationDays 求和取模），
// 赛季任务（复用主线任务 objective 种类）+ 赛季点数 + 奖励档位。
// 进度按赛季 id 持久化（player.seasons[id]），限定装备赛季结束后仍保留。
// 共 20 个赛季：id/名称/限定装备/任务目标物品全局唯一（season_check.mjs 校验）。

export const SEASONS = [
  // 1. 盛夏果味季
  {
    id: 'summer',
    name: '盛夏果味季',
    theme: '水果 · 冰饮 · 甜蜜对决',
    durationDays: 14,
    limitedItem: 'summerHat',
    missions: [
      { id: 's1m1', name: '采摘草莓 ×30', kind: 'gather', param: 'strawberry', qty: 30, points: 10 },
      { id: 's1m2', name: '钓到龙虾 ×5', kind: 'gather', param: 'lobster', qty: 5, points: 15 },
      { id: 's1m3', name: '酿制苹果汁 ×10', kind: 'craft', param: 'appleJuice', qty: 10, points: 15 },
      { id: 's1m4', name: '击败 首领「甜品女王」', kind: 'boss', param: '甜品女王', qty: 1, points: 30 },
      { id: 's1m5', name: '对决胜利 ×20', kind: 'combatWin', param: 'any', qty: 20, points: 20 },
      { id: 's1m6', name: '餐厅累计赚取 5000 金币', kind: 'restaurant', param: 'any', qty: 5000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { energyBiscuit: 3 } } },
      { points: 80, reward: { items: { summerHat: 1 } }, name: '限定装备：盛夏草帽' },
      { points: 110, reward: { gold: 3000, items: { spiritBrew: 2 } } },
    ],
  },
  // 2. 暖冬火锅季
  {
    id: 'winter',
    name: '暖冬火锅季',
    theme: '火锅 · 烈酒 · 暖身对决',
    durationDays: 14,
    limitedItem: 'winterCrown',
    missions: [
      { id: 's2m1', name: '狩猎熊肉 ×10', kind: 'gather', param: 'bearMeat', qty: 10, points: 10 },
      { id: 's2m2', name: '挖掘灵芝 ×10', kind: 'gather', param: 'lingzhi', qty: 10, points: 15 },
      { id: 's2m3', name: '酿造糯米酒 ×5', kind: 'craft', param: 'riceWine', qty: 5, points: 15 },
      { id: 's2m4', name: '击败 首领「火锅真君」', kind: 'boss', param: '火锅真君', qty: 1, points: 30 },
      { id: 's2m5', name: '对决胜利 ×20', kind: 'combatWin', param: 'any', qty: 20, points: 20 },
      { id: 's2m6', name: '餐厅累计赚取 5000 金币', kind: 'restaurant', param: 'any', qty: 5000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { energyBiscuit: 3 } } },
      { points: 80, reward: { items: { winterCrown: 1 } }, name: '限定装备：暖冬厨师冠' },
      { points: 110, reward: { gold: 3000, items: { dragonBreathWine: 2 } } },
    ],
  },
  // 3. 春鲜新笋季
  {
    id: 'spring',
    name: '春鲜新笋季',
    theme: '春蔬 · 新芽 · 万物复苏',
    durationDays: 14,
    limitedItem: 'springBasket',
    missions: [
      { id: 's3m1', name: '挖掘土豆 ×50', kind: 'gather', param: 'potato', qty: 50, points: 10 },
      { id: 's3m2', name: '收获小麦 ×10', kind: 'harvest', param: 'wheat', qty: 10, points: 15 },
      { id: 's3m3', name: '制作蔬菜沙拉 ×10', kind: 'craft', param: 'vegSalad', qty: 10, points: 15 },
      { id: 's3m4', name: '采摘胡萝卜 ×40', kind: 'gather', param: 'carrot', qty: 40, points: 10 },
      { id: 's3m5', name: '击败 首领「面条之王」', kind: 'boss', param: '面条之王', qty: 1, points: 30 },
      { id: 's3m6', name: '对决胜利 ×15', kind: 'combatWin', param: 'any', qty: 15, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { xpTonic: 2 } } },
      { points: 80, reward: { items: { springBasket: 1 } }, name: '限定装备：春鲜竹篮' },
      { points: 110, reward: { gold: 3000, items: { mysterySpice: 2 } } },
    ],
  },
  // 4. 金秋丰收季
  {
    id: 'autumn',
    name: '金秋丰收季',
    theme: '五谷 · 丰收 · 金黄原野',
    durationDays: 14,
    limitedItem: 'autumnWreath',
    missions: [
      { id: 's4m1', name: '收获玉米 ×15', kind: 'harvest', param: 'corn', qty: 15, points: 10 },
      { id: 's4m2', name: '收获南瓜 ×10', kind: 'harvest', param: 'pumpkin', qty: 10, points: 15 },
      { id: 's4m3', name: '采摘葡萄 ×40', kind: 'gather', param: 'grape', qty: 40, points: 15 },
      { id: 's4m4', name: '制作南瓜派 ×5', kind: 'craft', param: 'pumpkinPie', qty: 5, points: 15 },
      { id: 's4m5', name: '击败 首领「寿司之神」', kind: 'boss', param: '寿司之神', qty: 1, points: 30 },
      { id: 's4m6', name: '餐厅累计赚取 6000 金币', kind: 'restaurant', param: 'any', qty: 6000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { yieldTonic: 2 } } },
      { points: 80, reward: { items: { autumnWreath: 1 } }, name: '限定装备：金秋花环' },
      { points: 110, reward: { gold: 3000, items: { wine: 2 } } },
    ],
  },
  // 5. 碧海渔获季
  {
    id: 'ocean',
    name: '碧海渔获季',
    theme: '海鲜 · 渔获 · 浪涛之味',
    durationDays: 14,
    limitedItem: 'oceanPearl',
    missions: [
      { id: 's5m1', name: '钓到鲫鱼 ×30', kind: 'gather', param: 'crucian', qty: 30, points: 10 },
      { id: 's5m2', name: '钓到金枪鱼 ×20', kind: 'gather', param: 'tuna', qty: 20, points: 15 },
      { id: 's5m3', name: '钓到螃蟹 ×15', kind: 'gather', param: 'crab', qty: 15, points: 15 },
      { id: 's5m4', name: '制作寿司拼盘 ×3', kind: 'craft', param: 'sushiPlatter', qty: 3, points: 15 },
      { id: 's5m5', name: '击败 首领「火锅真君」', kind: 'boss', param: '火锅真君', qty: 1, points: 30 },
      { id: 's5m6', name: '对决胜利 ×20', kind: 'combatWin', param: 'any', qty: 20, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { preservative: 3 } } },
      { points: 80, reward: { items: { oceanPearl: 1 } }, name: '限定装备：海珠项链' },
      { points: 110, reward: { gold: 3000, items: { spiritBrew: 2 } } },
    ],
  },
  // 6. 森林菌菇季
  {
    id: 'forest',
    name: '森林菌菇季',
    theme: '菌菇 · 野味 · 林间珍馐',
    durationDays: 14,
    limitedItem: 'forestCloak',
    missions: [
      { id: 's6m1', name: '采摘松茸 ×10', kind: 'gather', param: 'matsutake', qty: 10, points: 15 },
      { id: 's6m2', name: '采摘松露 ×5', kind: 'gather', param: 'truffle', qty: 5, points: 20 },
      { id: 's6m3', name: '捕获兔肉 ×30', kind: 'gather', param: 'rabbitMeat', qty: 30, points: 10 },
      { id: 's6m4', name: '制作松露意面 ×2', kind: 'craft', param: 'trufflePasta', qty: 2, points: 20 },
      { id: 's6m5', name: '击败 首领「甜品女王」', kind: 'boss', param: '甜品女王', qty: 1, points: 30 },
      { id: 's6m6', name: '餐厅累计赚取 5000 金币', kind: 'restaurant', param: 'any', qty: 5000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { xpTonic: 2 } } },
      { points: 80, reward: { items: { forestCloak: 1 } }, name: '限定装备：林间斗篷' },
      { points: 110, reward: { gold: 3000, items: { mysterySpice: 2 } } },
    ],
  },
  // 7. 沙漠辛香季
  {
    id: 'desert',
    name: '沙漠辛香季',
    theme: '香料 · 干燥 · 大漠风味',
    durationDays: 14,
    limitedItem: 'desertVessel',
    missions: [
      { id: 's7m1', name: '收获藏红花 ×10', kind: 'gather', param: 'saffron', qty: 10, points: 20 },
      { id: 's7m2', name: '收获龙息椒 ×5', kind: 'gather', param: 'dragonPepper', qty: 5, points: 20 },
      { id: 's7m3', name: '调配咖喱粉 ×5', kind: 'craft', param: 'curryPowder', qty: 5, points: 15 },
      { id: 's7m4', name: '调配烧烤粉 ×5', kind: 'craft', param: 'bbqPowder', qty: 5, points: 15 },
      { id: 's7m5', name: '击败 首领「分子料理博士」', kind: 'boss', param: '分子料理博士', qty: 1, points: 30 },
      { id: 's7m6', name: '探索成功 ×10', kind: 'explore', param: 'any', qty: 10, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { strongPreservative: 1 } } },
      { points: 80, reward: { items: { desertVessel: 1 } }, name: '限定装备：沙漠陶罐' },
      { points: 110, reward: { gold: 3000, items: { dragonBreathWine: 2 } } },
    ],
  },
  // 8. 浆果狂欢季
  {
    id: 'berry',
    name: '浆果狂欢季',
    theme: '热带果 · 甜点 · 缤纷色彩',
    durationDays: 14,
    limitedItem: 'berryRing',
    missions: [
      { id: 's8m1', name: '采摘菠萝 ×20', kind: 'gather', param: 'pineapple', qty: 20, points: 15 },
      { id: 's8m2', name: '采摘芒果 ×15', kind: 'gather', param: 'mango', qty: 15, points: 15 },
      { id: 's8m3', name: '制作草莓蛋糕 ×5', kind: 'craft', param: 'strawberryCake', qty: 5, points: 15 },
      { id: 's8m4', name: '制作水果拼盘 ×10', kind: 'craft', param: 'fruitPlatter', qty: 10, points: 10 },
      { id: 's8m5', name: '击败 首领「中华一番」', kind: 'boss', param: '中华一番', qty: 1, points: 30 },
      { id: 's8m6', name: '对决胜利 ×20', kind: 'combatWin', param: 'any', qty: 20, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { energyBiscuit: 3 } } },
      { points: 80, reward: { items: { berryRing: 1 } }, name: '限定装备：浆果之戒' },
      { points: 110, reward: { gold: 3000, items: { wine: 2 } } },
    ],
  },
  // 9. 雪山寻参季
  {
    id: 'summit',
    name: '雪山寻参季',
    theme: '高寒 · 珍材 · 雪域灵药',
    durationDays: 14,
    limitedItem: 'mountainPick',
    missions: [
      { id: 's9m1', name: '挖掘人参 ×10', kind: 'gather', param: 'ginseng', qty: 10, points: 20 },
      { id: 's9m2', name: '挖掘山药 ×20', kind: 'gather', param: 'yam', qty: 20, points: 10 },
      { id: 's9m3', name: '挖掘生姜 ×20', kind: 'gather', param: 'ginger', qty: 20, points: 10 },
      { id: 's9m4', name: '制作人参炖山鸡 ×3', kind: 'craft', param: 'ginsengPheasant', qty: 3, points: 20 },
      { id: 's9m5', name: '击败 首领「黑暗料理王」', kind: 'boss', param: '黑暗料理王', qty: 1, points: 30 },
      { id: 's9m6', name: '餐厅累计赚取 7000 金币', kind: 'restaurant', param: 'any', qty: 7000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { superTonic: 1 } } },
      { points: 80, reward: { items: { mountainPick: 1 } }, name: '限定装备：山巅冰镐' },
      { points: 110, reward: { gold: 3000, items: { mysterySpice: 2 } } },
    ],
  },
  // 10. 茶道雅集季
  {
    id: 'tea',
    name: '茶道雅集季',
    theme: '茶饮 · 雅致 · 一壶清香',
    durationDays: 14,
    limitedItem: 'teaKettle',
    missions: [
      { id: 's10m1', name: '收获香草 ×15', kind: 'gather', param: 'vanilla', qty: 15, points: 15 },
      { id: 's10m2', name: '收获罗勒 ×15', kind: 'gather', param: 'basil', qty: 15, points: 15 },
      { id: 's10m3', name: '泡制香草茶 ×10', kind: 'craft', param: 'herbalTea', qty: 10, points: 15 },
      { id: 's10m4', name: '泡制果茶 ×10', kind: 'craft', param: 'fruitTea', qty: 10, points: 15 },
      { id: 's10m5', name: '击败 首领「初代食神」', kind: 'boss', param: '初代食神', qty: 1, points: 30 },
      { id: 's10m6', name: '探索成功 ×10', kind: 'explore', param: 'any', qty: 10, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { xpTonic: 2 } } },
      { points: 80, reward: { items: { teaKettle: 1 } }, name: '限定装备：茶道铜壶' },
      { points: 110, reward: { gold: 3000, items: { spiritBrew: 2 } } },
    ],
  },
  // 11. 香料远征季
  {
    id: 'spice',
    name: '香料远征季',
    theme: '香料 · 环球 · 风味之旅',
    durationDays: 14,
    limitedItem: 'spiceSatchel',
    missions: [
      { id: 's11m1', name: '收获花椒 ×30', kind: 'gather', param: 'peppercorn', qty: 30, points: 15 },
      { id: 's11m2', name: '收获八角 ×15', kind: 'gather', param: 'starAnise', qty: 15, points: 15 },
      { id: 's11m3', name: '收获桂皮 ×10', kind: 'gather', param: 'cassia', qty: 10, points: 20 },
      { id: 's11m4', name: '调配五香粉 ×5', kind: 'craft', param: 'fiveSpice', qty: 5, points: 20 },
      { id: 's11m5', name: '击败 首领「寿司之神」', kind: 'boss', param: '寿司之神', qty: 1, points: 30 },
      { id: 's11m6', name: '对决胜利 ×15', kind: 'combatWin', param: 'any', qty: 15, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { energyBiscuit: 3 } } },
      { points: 80, reward: { items: { spiceSatchel: 1 } }, name: '限定装备：香料束囊' },
      { points: 110, reward: { gold: 3000, items: { mysterySpice: 3 } } },
    ],
  },
  // 12. 坛香腌制季
  {
    id: 'pickle',
    name: '坛香腌制季',
    theme: '腌制 · 发酵 · 岁月之味',
    durationDays: 14,
    limitedItem: 'candyJar',
    missions: [
      { id: 's12m1', name: '腌制泡菜 ×10', kind: 'craft', param: 'pickledCabbage', qty: 10, points: 10 },
      { id: 's12m2', name: '腌制咸蛋 ×10', kind: 'craft', param: 'preservedEgg', qty: 10, points: 15 },
      { id: 's12m3', name: '酿制酱油 ×5', kind: 'craft', param: 'soySauce', qty: 5, points: 15 },
      { id: 's12m4', name: '制作泡菜 ×5', kind: 'craft', param: 'kimchi', qty: 5, points: 15 },
      { id: 's12m5', name: '击败 首领「面条之王」', kind: 'boss', param: '面条之王', qty: 1, points: 30 },
      { id: 's12m6', name: '餐厅累计赚取 5000 金币', kind: 'restaurant', param: 'any', qty: 5000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { preservative: 3 } } },
      { points: 80, reward: { items: { candyJar: 1 } }, name: '限定装备：蜜饯陶罐' },
      { points: 110, reward: { gold: 3000, items: { superTonic: 1 } } },
    ],
  },
  // 13. 荷塘月色季
  {
    id: 'lotus',
    name: '荷塘月色季',
    theme: '稻香 · 荷塘 · 月下清宴',
    durationDays: 14,
    limitedItem: 'lotusLamp',
    missions: [
      { id: 's13m1', name: '收获稻米 ×40', kind: 'gather', param: 'rice', qty: 40, points: 10 },
      { id: 's13m2', name: '制作炖鲤鱼汤 ×8', kind: 'craft', param: 'carpSoup', qty: 8, points: 15 },
      { id: 's13m3', name: '制作开水白菜 ×10', kind: 'craft', param: 'boiledCabbage', qty: 10, points: 10 },
      { id: 's13m4', name: '制作番茄炒蛋 ×8', kind: 'craft', param: 'tomatoEgg', qty: 8, points: 15 },
      { id: 's13m5', name: '击败 首领「火锅真君」', kind: 'boss', param: '火锅真君', qty: 1, points: 30 },
      { id: 's13m6', name: '对决胜利 ×20', kind: 'combatWin', param: 'any', qty: 20, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { xpTonic: 2 } } },
      { points: 80, reward: { items: { lotusLamp: 1 } }, name: '限定装备：荷塘花灯' },
      { points: 110, reward: { gold: 3000, items: { wine: 2 } } },
    ],
  },
  // 14. 炭火烧烤季
  {
    id: 'ember',
    name: '炭火烧烤季',
    theme: '烧烤 · 炭火 · 烟火气息',
    durationDays: 14,
    limitedItem: 'emberBracelet',
    missions: [
      { id: 's14m1', name: '收获辣椒 ×30', kind: 'gather', param: 'chili', qty: 30, points: 10 },
      { id: 's14m2', name: '捕获鹿肉 ×20', kind: 'gather', param: 'venison', qty: 20, points: 15 },
      { id: 's14m3', name: '制作野味烧烤 ×8', kind: 'craft', param: 'wildBBQ', qty: 8, points: 15 },
      { id: 's14m4', name: '制作铁板兔肉 ×8', kind: 'craft', param: 'ironPlateRabbit', qty: 8, points: 15 },
      { id: 's14m5', name: '击败 首领「寿司之神」', kind: 'boss', param: '寿司之神', qty: 1, points: 30 },
      { id: 's14m6', name: '探索成功 ×10', kind: 'explore', param: 'any', qty: 10, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { energyBiscuit: 3 } } },
      { points: 80, reward: { items: { emberBracelet: 1 } }, name: '限定装备：余烬手环' },
      { points: 110, reward: { gold: 3000, items: { dragonBreathWine: 2 } } },
    ],
  },
  // 15. 冰雪甜点季
  {
    id: 'snow',
    name: '冰雪甜点季',
    theme: '冰雪 · 甜点 · 冬日烘焙',
    durationDays: 14,
    limitedItem: 'snowflakePin',
    missions: [
      { id: 's15m1', name: '制作香草蛋糕 ×5', kind: 'craft', param: 'vanillaCake', qty: 5, points: 20 },
      { id: 's15m2', name: '制作甜面包 ×10', kind: 'craft', param: 'sweetBread', qty: 10, points: 10 },
      { id: 's15m3', name: '制作白面包 ×10', kind: 'craft', param: 'whiteBread', qty: 10, points: 10 },
      { id: 's15m4', name: '烘焙能量饼干 ×5', kind: 'craft', param: 'energyBiscuit', qty: 5, points: 20 },
      { id: 's15m5', name: '探索成功 ×10', kind: 'explore', param: 'any', qty: 10, points: 20 },
      { id: 's15m6', name: '餐厅累计赚取 5000 金币', kind: 'restaurant', param: 'any', qty: 5000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { xpTonic: 2 } } },
      { points: 80, reward: { items: { snowflakePin: 1 } }, name: '限定装备：雪花胸针' },
      { points: 110, reward: { gold: 3000, items: { spiritBrew: 2 } } },
    ],
  },
  // 16. 中秋赏月季
  {
    id: 'moon',
    name: '中秋赏月季',
    theme: '面点 · 佳酿 · 花好月圆',
    durationDays: 14,
    limitedItem: 'moonAmulet',
    missions: [
      { id: 's16m1', name: '酿制葡萄酒 ×3', kind: 'craft', param: 'wine', qty: 3, points: 20 },
      { id: 's16m2', name: '制作玉米饼 ×10', kind: 'craft', param: 'cornTortilla', qty: 10, points: 10 },
      { id: 's16m3', name: '磨制面粉 ×20', kind: 'craft', param: 'flour', qty: 20, points: 10 },
      { id: 's16m4', name: '制作烤土豆 ×15', kind: 'craft', param: 'roastPotato', qty: 15, points: 10 },
      { id: 's16m5', name: '击败 首领「甜品女王」', kind: 'boss', param: '甜品女王', qty: 1, points: 30 },
      { id: 's16m6', name: '对决胜利 ×20', kind: 'combatWin', param: 'any', qty: 20, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { energyBiscuit: 3 } } },
      { points: 80, reward: { items: { moonAmulet: 1 } }, name: '限定装备：玉兔坠' },
      { points: 110, reward: { gold: 3000, items: { mysterySpice: 2 } } },
    ],
  },
  // 17. 麻辣挑战季
  {
    id: 'chili',
    name: '麻辣挑战季',
    theme: '辣椒 · 麻辣 · 极限味觉',
    durationDays: 14,
    limitedItem: 'chiliWreath',
    missions: [
      { id: 's17m1', name: '制作龙息火锅 ×2', kind: 'craft', param: 'dragonHotpot', qty: 2, points: 25 },
      { id: 's17m2', name: '制作咖喱野鸡 ×5', kind: 'craft', param: 'curryPheasant', qty: 5, points: 20 },
      { id: 's17m3', name: '调配辣椒粉 ×10', kind: 'craft', param: 'chiliPowder', qty: 10, points: 10 },
      { id: 's17m4', name: '制作辣椒酱 ×5', kind: 'craft', param: 'hotSauce', qty: 5, points: 20 },
      { id: 's17m5', name: '击败 首领「分子料理博士」', kind: 'boss', param: '分子料理博士', qty: 1, points: 30 },
      { id: 's17m6', name: '餐厅累计赚取 6000 金币', kind: 'restaurant', param: 'any', qty: 6000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { strongPreservative: 1 } } },
      { points: 80, reward: { items: { chiliWreath: 1 } }, name: '限定装备：椒麻桂冠' },
      { points: 110, reward: { gold: 3000, items: { dragonBreathWine: 2 } } },
    ],
  },
  // 18. 藏宝海湾季
  {
    id: 'pirate',
    name: '藏宝海湾季',
    theme: '宝藏 · 冒险 · 深海秘藏',
    durationDays: 14,
    limitedItem: 'treasureUrn',
    missions: [
      { id: 's18m1', name: '钓到蓝鳍金枪鱼 ×5', kind: 'gather', param: 'bluefin', qty: 5, points: 20 },
      { id: 's18m2', name: '钓到鲍鱼 ×10', kind: 'gather', param: 'abalone', qty: 10, points: 15 },
      { id: 's18m3', name: '钓到龙趸 ×3', kind: 'gather', param: 'grouper', qty: 3, points: 25 },
      { id: 's18m4', name: '制作佛跳墙 ×1', kind: 'craft', param: 'buddhaJump', qty: 1, points: 25 },
      { id: 's18m5', name: '探索成功 ×15', kind: 'explore', param: 'any', qty: 15, points: 20 },
      { id: 's18m6', name: '餐厅累计赚取 7000 金币', kind: 'restaurant', param: 'any', qty: 7000, points: 25 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { xpTonic: 2 } } },
      { points: 80, reward: { items: { treasureUrn: 1 } }, name: '限定装备：藏宝瓮' },
      { points: 110, reward: { gold: 3000, items: { superTonic: 1 } } },
    ],
  },
  // 19. 珊瑚礁季
  {
    id: 'coral',
    name: '珊瑚礁季',
    theme: '珊瑚 · 深海 · 秘境珍味',
    durationDays: 14,
    limitedItem: 'coralTrident',
    missions: [
      { id: 's19m1', name: '钓到海参 ×8', kind: 'gather', param: 'seaCucumber', qty: 8, points: 20 },
      { id: 's19m2', name: '制作龙虾粥 ×5', kind: 'craft', param: 'lobsterCongee', qty: 5, points: 15 },
      { id: 's19m3', name: '制作鲍鱼炖品 ×3', kind: 'craft', param: 'abaloneStew', qty: 3, points: 20 },
      { id: 's19m4', name: '酿制鱼露 ×3', kind: 'craft', param: 'fishSauce', qty: 3, points: 20 },
      { id: 's19m5', name: '击败 首领「黑暗料理王」', kind: 'boss', param: '黑暗料理王', qty: 1, points: 30 },
      { id: 's19m6', name: '对决胜利 ×25', kind: 'combatWin', param: 'any', qty: 25, points: 20 },
    ],
    tiers: [
      { points: 20, reward: { gold: 500 } },
      { points: 50, reward: { items: { strongPreservative: 1 } } },
      { points: 80, reward: { items: { coralTrident: 1 } }, name: '限定装备：珊瑚三叉' },
      { points: 110, reward: { gold: 3000, items: { spiritBrew: 2 } } },
    ],
  },
  // 20. 星空饕宴季
  {
    id: 'galaxy',
    name: '星空饕宴季',
    theme: '星空 · 传说 · 终焉之宴',
    durationDays: 14,
    limitedItem: 'starAmulet',
    missions: [
      { id: 's20m1', name: '采摘灵果 ×5', kind: 'gather', param: 'spiritFruit', qty: 5, points: 25 },
      { id: 's20m2', name: '挖掘龙根 ×5', kind: 'gather', param: 'dragonRoot', qty: 5, points: 25 },
      { id: 's20m3', name: '钓到金龙鱼 ×2', kind: 'gather', param: 'goldenDragonFish', qty: 2, points: 30 },
      { id: 's20m4', name: '制作食神盛宴 ×1', kind: 'craft', param: 'godFeast', qty: 1, points: 30 },
      { id: 's20m5', name: '击败 首领「初代食神」', kind: 'boss', param: '初代食神', qty: 1, points: 40 },
      { id: 's20m6', name: '餐厅累计赚取 10000 金币', kind: 'restaurant', param: 'any', qty: 10000, points: 30 },
    ],
    tiers: [
      { points: 30, reward: { gold: 1000 } },
      { points: 70, reward: { items: { superTonic: 1 } } },
      { points: 110, reward: { items: { starAmulet: 1 } }, name: '限定装备：星辉吊坠' },
      { points: 150, reward: { gold: 5000, items: { dragonBreathWine: 2 } } },
    ],
  },
]

const SEASON_MS = (days) => days * 24 * 3600 * 1000

// 内容扩充：+20 赛季（生成器 expansion2.js 产出）
import { SEASONS_EXT2 } from './expansion2.js'
SEASONS.push(...SEASONS_EXT2)

// 赛季装备套件：每季一套 8 件（武器/头盔/身体/腿部/脚部/副手/饰品1/饰品2），分 4 档奖励发放
import { SEASONS_GEAR } from './expansion_gear.js'
import { seasonMissions, seasonTiers } from './seasonContent.js'
for (const g of SEASONS_GEAR) {
  const s = SEASONS.find((x) => x.id === g.seasonId)
  if (!s) continue
  s.limitedItems = g.slots // 套件 8 件（图鉴/赛季展示用）
  s.tiers = g.tiers
}

// 每季通用任务补齐到 8 个（对决/探索），一期/二期统一
const PAD_TASKS = [
  ['combatWin', '赢得 20 场对决', 20],
  ['explore', '探索成功 15 次', 15],
  ['combatWin', '赢得 30 场对决', 30],
]
for (const s of SEASONS) {
  let pi = 0
  while (s.missions.length < 8) {
    const [kind, name, qty] = PAD_TASKS[pi++ % PAD_TASKS.length]
    s.missions.push({ id: `${s.id}pad${pi}`, name, kind, param: 'any', qty, points: 15 })
  }
}

// 任务点数统一：任务点数总和 = 10 档奖励需求总和（1100）+ 15（§13 富余）
// 物品 130 / 首领 150 / 餐厅 170 / 对决 130 / 探索 145；不足的差值校准到该季最后任务
const KIND_POINTS = { gather: 130, craft: 130, harvest: 130, boss: 150, restaurant: 170, combatWin: 130, explore: 145 }
const TIER_TOTAL = 1100
for (const s of SEASONS) {
  for (const m of s.missions) m.points = KIND_POINTS[m.kind] ?? 130
  const sum = s.missions.reduce((a, m) => a + m.points, 0)
  s.missions[s.missions.length - 1].points += TIER_TOTAL + 15 - sum // 每季任务总和校准为 1115
}

// 采集/制作/收获任务需求数量统一为 1000-5000（挂机深度的赛季目标）
const ITEM_QTY = [1000, 2000, 3000, 4000, 5000]
let seasonQtyIdx = 0
for (const s of SEASONS) {
  for (const m of s.missions) {
    if (['gather', 'craft', 'harvest'].includes(m.kind)) m.qty = ITEM_QTY[seasonQtyIdx++ % ITEM_QTY.length]
  }
}

// ── 补齐每季任务类型覆盖：确保每季含 采集/制作/对决/首领/餐厅收入（points/qty 固定，不参与上方 1115 校准）──
const _ptsKind = { gather: 130, craft: 130, combatWin: 130, boss: 150, restaurant: 170 }
const _fbBoss = ['面条之王','火锅真君','寿司之神','甜品女王','分子料理博士','中华一番','黑暗料理王','初代食神']
const _fbCraft = [['vegSalad','蔬菜沙拉'],['appleJuice','苹果汁'],['pickledCabbage','腌白菜'],['curryPowder','咖喱粉'],['strawberryCake','草莓蛋糕'],['riceWine','糯米酒'],['whiteBread','白面包'],['pumpkinPie','南瓜派'],['boiledCabbage','开水白菜'],['cornTortilla','玉米饼']]
const _fbGather = [['apple','苹果'],['carrot','胡萝卜'],['strawberry','草莓'],['grape','葡萄'],['wheat','小麦'],['rice','稻米'],['corn','玉米'],['cabbage','白菜'],['potato','土豆'],['tomato','番茄']]
let _fbI = 0
for (const s of SEASONS) {
  if (!s.missions) continue
  const kinds = new Set(s.missions.map((m) => m.kind))
  for (const k of ['gather', 'craft', 'combatWin', 'boss', 'restaurant']) {
    if (kinds.has(k)) continue
    _fbI++
    const rid = s.id + '_pad' + _fbI
    let m
    if (k === 'gather') { const [pi, nm] = _fbGather[_fbI % _fbGather.length]; m = { id: rid, name: '采集 ' + nm, kind: 'gather', param: pi, qty: 5000, points: _ptsKind.gather } }
    else if (k === 'craft') { const [pi, nm] = _fbCraft[_fbI % _fbCraft.length]; m = { id: rid, name: '制作 ' + nm, kind: 'craft', param: pi, qty: 5000, points: _ptsKind.craft } }
    else if (k === 'combatWin') { m = { id: rid, name: '赢得 20 场对决', kind: 'combatWin', param: 'any', qty: 20, points: _ptsKind.combatWin } }
    else if (k === 'boss') { const bn = _fbBoss[_fbI % _fbBoss.length]; m = { id: rid, name: '击败 ' + bn, kind: 'boss', param: bn, qty: 1, points: _ptsKind.boss } }
    else { m = { id: rid, name: '餐厅累计赚取 5000 金币', kind: 'restaurant', param: 'any', qty: 5000, points: _ptsKind.restaurant } }
    s.missions.push(m)
  }
}

/** 当前活跃赛季（按时间轮换，全部赛季时长求和取模） */
export function activeSeasonId() {
  const total = SEASONS.reduce((s, x) => s + SEASON_MS(x.durationDays), 0)
  let t = Date.now() % total
  for (const s of SEASONS) {
    const d = SEASON_MS(s.durationDays)
    if (t < d) return s.id
    t -= d
  }
  return SEASONS[0].id
}

export function getSeason(id) {
  const s = SEASONS.find((x) => x.id === id) ?? null
  if (!s) return null
  // 按赛季主题动态生成任务 / 主题化奖励（铁律：装备数值与档位固定，只动任务目标与非装备道具）
  if (!s._resolved) {
    s.missions = seasonMissions(s)
    s.tiers = seasonTiers(s)
    s._resolved = true
  }
  return s
}

/** 赛季剩余时长（毫秒） */
export function seasonRemainingMs(id) {
  const s = getSeason(id)
  if (!s) return 0
  const total = SEASONS.reduce((acc, x) => acc + SEASON_MS(x.durationDays), 0)
  const cycleStart = Math.floor(Date.now() / total) * total
  let acc = 0
  for (const x of SEASONS) {
    const d = SEASON_MS(x.durationDays)
    if (x.id === id) return cycleStart + acc + d - Date.now()
    acc += d
  }
  return 0
}
