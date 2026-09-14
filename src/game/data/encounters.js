// 随机奇遇 — 挂机途中偶发事件（2026-09-06 长线日活钩子）
// 触发：在线采集/制作动作 0.2% 概率（bootstrap 监听 skill:action），弹窗 3 选 1。
// 效果：gold 为基准（领取时按对决等级放大），item 为固定物品 id。纯新增层，不触碰铁律数据。

export const ENCOUNTERS = [
  {
    id: 'wanderer',
    title: '🗺️ 迷路的旅人',
    body: '一位风尘仆仆的旅人在你摊位前停下：「我沿着香味走了二十里……能告诉我这是什么菜吗？」',
    choices: [
      { label: '请他尝一口（开朗）', effect: { gold: 120, item: null } },
      { label: '指个路（善良）', effect: { gold: 40, items: { apple: 5 } } },
      { label: '不予理会（冷漠）', effect: { gold: 20 } },
    ],
  },
  {
    id: 'connoisseur',
    title: '🥢 神秘食客',
    body: '一个戴斗笠的人吃完了你做的菜，放下钱袋默默走出门。留下一句话：「后生可畏。」',
    choices: [
      { label: '追上去讨教', effect: { gold: 180 } },
      { label: '收起钱袋继续干活', effect: { gold: 90, items: { wheat: 10 } } },
    ],
  },
  {
    id: 'merchant',
    title: '💰 收购商人',
    body: '路过的商人看到你的存货眼睛一亮：「这批货我全要了！价格好商量。」',
    choices: [
      { label: '卖个急价', effect: { gold: 200 } },
      { label: '婉拒（货比三家）', effect: { gold: 60 } },
      { label: '请他也吃一顿', effect: { gold: 100, items: { mysterySpice: 1 } } },
    ],
  },
  {
    id: 'cat',
    title: '🐱 馋嘴的猫',
    body: '一只胖橘猫跳上你的柜台，对着刚出锅的菜喵喵直叫，尾巴摇得像风车。',
    choices: [
      { label: '喂它一块', effect: { gold: 30, items: { pheasantEgg: 3 } } },
      { label: '轰走它', effect: { gold: 30 } },
      { label: '它真可爱，多喂点', effect: { gold: 50, items: { milk: 2 } } },
    ],
  },
  {
    id: 'apprentice',
    title: '🧒🏼 偷师的小学徒',
    body: '一个系着围裙的小孩扒着门框偷看你做菜，见你发现，红着脸躲到柱子后面。',
    choices: [
      { label: '手把手教他', effect: { gold: 80, items: { rice: 10 } } },
      { label: '让他帮你打下手', effect: { gold: 110 } },
      { label: '严厉赶走', effect: { gold: 30, items: { trap: 1 } } },
    ],
  },
  {
    id: 'rat',
    title: '🐭 深夜的偷食贼',
    body: '半夜，米缸传来窸窸窣窣的声音——一只肥硕的老鼠正拖着你的干粮逃跑！',
    choices: [
      { label: '抓住它！', effect: { gold: 60, items: { baking_ext_10: 2 } } },
      { label: '用香料薰走它（耗花椒 ×2）', effect: { gold: 40 }, costItem: { peppercorn: 2 } },
      { label: '就当破财消灾', effect: { gold: 15 } },
    ],
  },
  {
    id: 'tournament',
    title: '🏟️ 街角挑战赛',
    body: '街口贴出新告示：本周厨艺角斗！胜者可得巨额赏金。围观人群已经围了三层。',
    choices: [
      { label: '直接下场', effect: { gold: 150 } },
      { label: '先观望再决定', effect: { gold: 70 } },
      { label: '街头厨神是幌子', effect: { gold: 40, items: { garlic: 3 } } },
    ],
  },
  {
    id: 'thief',
    title: '💰 大胆的扒手',
    body: '有人撞了你一下！口袋里金币的数量不太对劲——一个黑影正钻进巷子。',
    choices: [
      { label: '追上去', effect: { gold: 90 } },
      { label: '喊人帮忙', effect: { gold: 50, items: { wood: 5 } } },
      { label: '吃一堑长一智', effect: { gold: 10 } },
    ],
  },
  // ── 2026-09-14 扩充：+14 个奇遇（用户要求「奇遇图鉴应该再加个十几种」）──
  // 口径与原有 8 个完全一致：金币为基准（领取时按对决等级放大）、物品只用**现存**物品 id；
  // 带 costItem 的分支是「先付出再回报」的取舍项，数值与原有分支同区间（gold 15~220）。
  {
    id: 'fishElder',
    title: '🎣 河边的老渔翁',
    body: '收竿的老人把湿漉漉的渔网搭在石头上：「小伙子，看你锅气足，这条最大的鲈鱼换你一碗汤如何？」',
    choices: [
      { label: '煮一碗热汤给他', effect: { gold: 90, items: { rice: 8 } } },
      { label: '买下这条鱼', effect: { gold: 140 }, costItem: { water: 2 } },
      { label: '陪他钓一会儿', effect: { gold: 55, items: { cabbage_young: 6 } } },
    ],
  },
  {
    id: 'noodleStall',
    title: '🍜 深夜面摊',
    body: '收摊前最后一位客人抬头看你：「老板临时有事，能帮我看半小时摊吗？汤底随你喝。」',
    choices: [
      { label: '帮忙看摊', effect: { gold: 120, items: { flour: 6 } } },
      { label: '教他一手熬汤', effect: { gold: 70, items: { saltOre: 2 } } },
      { label: '婉拒，回去备料', effect: { gold: 30 } },
    ],
  },
  {
    id: 'lostHen',
    title: '🐔 走失的母鸡',
    body: '一只花母鸡在你门口踱步，脚上系着邻家的布条，还时不时往你菜筐里瞟。',
    choices: [
      { label: '送回邻家', effect: { gold: 80, items: { pheasantEgg: 4 } } },
      { label: '收下它今日的蛋', effect: { gold: 45, items: { pheasantEgg: 2 } } },
      { label: '喂它把菜叶再赶回去', effect: { gold: 25, items: { cabbage_young: 4 } } },
    ],
  },
  {
    id: 'lanternRiddle',
    title: '🏮 庙会灯谜',
    body: '灯会中央挂着一盏走马灯，谜面写：「一勺入锅，万丈生香。」摊主笑看你：「答对，案上点心随你挑。」',
    choices: [
      { label: '答：油', effect: { gold: 110, items: { garnish: 3 } } },
      { label: '不猜，买两串糖葫芦', effect: { gold: 60, items: { apple: 6 } } },
      { label: '看热闹就走', effect: { gold: 20 } },
    ],
  },
  {
    id: 'redPacket',
    title: '🧧 街坊的红包',
    body: '隔壁开面馆的大叔塞来一个红封：「上回你教我的那勺高汤，回头客多了三成——这点心意收着。」',
    choices: [
      { label: '收下并道谢', effect: { gold: 160 } },
      { label: '回赠一坛酱料', effect: { gold: 90, items: { garlic: 4 } } },
      { label: '坚决不收', effect: { gold: 35, items: { water: 5 } } },
    ],
  },
  {
    id: 'wildHive',
    title: '🐝 后山的野蜂巢',
    body: '老槐树上挂着一只拳头大的蜂巢，蜜香顺着风飘下来。蜂群正忙着，暂时没空理你。',
    choices: [
      { label: '取一小块就撤', effect: { gold: 130, items: { apple: 8 } }, costItem: { wood: 3 } },
      { label: '熏烟取蜜', effect: { gold: 70, items: { garlic: 3 } }, costItem: { chili_young: 2 } },
      { label: '不惹它们', effect: { gold: 20 } },
    ],
  },
  {
    id: 'oldRecipe',
    title: '📜 旧书摊的菜谱',
    body: '旧书摊最下面压着一本油渍斑斑的手抄菜谱，摊主开价不高：「缺页的，你看着给。」',
    choices: [
      { label: '买下整本', effect: { gold: 60, items: { baking_ext_10: 2 } } },
      { label: '只抄一页', effect: { gold: 30, items: { flour: 4 } } },
      { label: '翻翻就放下', effect: { gold: 15 } },
    ],
  },
  {
    id: 'suddenRain',
    title: '🌧️ 突来的阵雨',
    body: '乌云压城，豆大的雨点砸下来。街口只剩一把旧伞，还有半扇遮不住人的屋檐。',
    choices: [
      { label: '借伞去取货', effect: { gold: 100, items: { water: 8 } } },
      { label: '躲屋檐下歇脚', effect: { gold: 40, items: { ginger_young: 4 } } },
      { label: '冒雨赶回去看灶', effect: { gold: 70 } },
    ],
  },
  {
    id: 'vegCart',
    title: '🥬 菜农的推车',
    body: '菜农的推车卡在巷口，青翠的白菜滚了一地，他一个人扶不过来。',
    choices: [
      { label: '帮他推上坡', effect: { gold: 50, items: { cabbage_young: 10 } } },
      { label: '买下滚落的那几棵', effect: { gold: 90, items: { cabbage_young: 4 } }, costItem: { water: 2 } },
      { label: '绕过赶路', effect: { gold: 15 } },
    ],
  },
  {
    id: 'strayDog',
    title: '🐕 门口的流浪狗',
    body: '一只瘦狗蹲在后门，尾巴摇了摇又停下，眼睛却盯着你手里的骨头汤。',
    choices: [
      { label: '分它一碗', effect: { gold: 55, items: { wood: 6 } } },
      { label: '给它搭个窝', effect: { gold: 40, items: { corn: 5 } }, costItem: { wood: 3 } },
      { label: '关门不理', effect: { gold: 15 } },
    ],
  },
  {
    id: 'nightMarket',
    title: '🕯️ 鬼市的夜话',
    body: '半夜的市集只点着几盏豆灯，摊上摆着说不出来历的调料。戴斗笠的摊主压低声音：「识货的才看得见。」',
    choices: [
      { label: '买一小撮神秘调料', effect: { gold: 120, items: { mysterySpice: 1 } }, costItem: { saltOre: 2 } },
      { label: '听摊主讲古', effect: { gold: 65, items: { ginger_young: 5 } } },
      { label: '快步走过', effect: { gold: 10 } },
    ],
  },
  {
    id: 'folkOpera',
    title: '🎪 流动戏班',
    body: '戏班在街口搭起棚子，锣鼓一响，半条街的人都围了过来。班主喊：「哪位老板赞助一台戏，管你们吃！」',
    choices: [
      { label: '请全班吃一顿', effect: { gold: 150, items: { rice: 12 } }, costItem: { rice: 4 } },
      { label: '借他们的灶火试新菜', effect: { gold: 95, items: { corn: 6 } } },
      { label: '听半场就走', effect: { gold: 25 } },
    ],
  },
  {
    id: 'saltTrader',
    title: '🧂 盐商的私话',
    body: '盐商压低草帽凑过来：「产地涨了价，手上这批我按老价给你——过了今晚可就不是这个数了。」',
    choices: [
      { label: '吃下这批货', effect: { gold: 80, items: { saltOre: 5 } } },
      { label: '只买两斤试水', effect: { gold: 45, items: { saltOre: 2 } } },
      { label: '打听行情就撤', effect: { gold: 30 } },
    ],
  },
  {
    id: 'teaStall',
    title: '☕ 隔壁的茶摊',
    body: '茶摊老板给你续了一碗粗茶：「每天都闻着你家灶香干活，今日这碗茶我请。」',
    choices: [
      { label: '坐下聊两句', effect: { gold: 60, items: { water: 6 } } },
      { label: '买两斤茶叶回礼', effect: { gold: 100, items: { redBean: 4 } } },
      { label: '谢过就回去掌勺', effect: { gold: 35 } },
    ],
  },

]

const ENCOUNTER_INDEX = new Map(ENCOUNTERS.map((e) => [e.id, e]))

/** 按 id 取奇遇定义（图鉴/年鉴展示用） */
export function getEncounter(id) {
  return ENCOUNTER_INDEX.get(id) ?? null
}
