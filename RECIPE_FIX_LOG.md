# 美食放置：食之契约 — 项目修改与维护记录

> 本文件记录项目开发过程中的全部改动（数据完整性校验、炼金、赛季、图鉴交互、UI 毛玻璃等），每次改动留档「问题描述、修改内容、新增项」，并保留校验结果。

## 📌 当前状态总览（最新）
- **数据完整性**：制作物品与采集材料双向校验完成——配方引用**无无效材料**、未用采集材料 **0**、加工品无下游 **0**；配方总数 857、被使用材料 454；全部制作链条（基础原料→加工品→成品）闭环。
- **炼金**：全类别融炼覆盖、转换数量按价值比平衡、高端需盐矿催化、**装备已移除**、无重复 id/无效引用。
- **赛季**：每季覆盖 采集/制作/对决/首领/餐厅收入 5 类、文案同步、任务「前往界面」跳转按钮、补齐任务季点数正常。
- **图鉴**：分类名全部中文、物品「获取来源」点击跳转对应界面。
- **UI**：启动页/自定义背景 + 全局毛玻璃——框（card/gather-card/opp-row 等）、弹窗、按钮、左/中/右导航栏均为毛玻璃质感；左右导航栏用启动页/自定义图片背景 + 白磨砂层 + 内容 z-index 提升；导航项（侧栏/顶部）透明毛玻璃 + 虚线分隔、未选中即显示。
- **校验**：`vite build` 通过；`npx playwright test e2e-test.spec.mjs` **9/9 通过**。

---

## 校验方法（脚本化）
- 全量配方收集：cooking/baking/brewing/preserving/spiceMixing/craftsmithing/preservation 七类技能（基础 RECIPES + expansion1/2 对应数组）。
- 材料全集：items.js（type=ingredient）+ 各采集/挖掘/狩猎/垂钓/探索/农耕目标产出 itemId。
- 双向校验：①配方引用的材料是否全部存在（无效引用）；②每个可采集材料是否被至少一条配方消耗（未用材料）。
- 基线诊断（初始）：配方总数 553，被使用材料 285，可采集目标 299，未用材料 172，无效引用 0。

## 场景A — 成品已有、配方缺原料/用错原料（改配方补材料）

### 鎏金系列（craftsmithing, expansion2.js 中 smith_rec2_23~30 高端锻冶）
- 问题：鎏金系列（鎏金刀/锅/砧板/围裙/厨师帽/调味瓶）配方材料为 铁矿 ironOre + 盐矿 saltOre + 灵果 spiritFruit，与"鎏金（镀金）"题材不符；应按用户示例"鎏金围裙→金矿"改用金/银。
- 修改：将 smith_rec2_25/26/27/28/29/30 六个配方的 ingredients 改为黄金矿 excavation_ext2_18 + 白银矿 excavation_ext2_19（数量沿用原主材量：8/8/8/6/8/9 + 银 2）。
- 新增项：无（复用已有挖掘矿 id excavation_ext2_18/19）。
- 删除项：items.js 中重复新增的 goldOre、silverOre 两个条目（改为复用现有挖掘矿石 id，避免重复与无法获取）。

### 咸柠檬（preserving, expansion1.js preserving_rec_30）
- 问题：配方材料误用 竹鸡/芜菁/菱角，与"咸柠檬"题材无关。
- 修改：ingredients 改为柠檬 foraging_ext_04 ×3 + 盐矿 saltOre ×2（柠檬为已有材料）。

### 青柠汁（brewing, expansion2.js brewing_rec2_28）
- 问题：配方材料误用 斑马/柴胡/女贞子，与"青柠汁"无关。
- 修改：ingredients 改为青柠 lime ×4 + 盐矿 saltOre ×1（lime / 青柠为新增材料）。

## 场景B — 采集材料无成品消耗（新增可制作物品+完整配方）

### 第 1 批：常见水果 → 果汁/茶饮（brewing）
- 规则：成品为 drink（果汁/茶饮）；配方 reqLevel 取材料采集等级之上；消耗主材 3（茶饮 2-3）+ 水 water。
- 新增物品（items.js）：orangeJuice / pomeloTea / cherryJuice / blueberryJuice / raspberryJuice / kiwiJuice / pomegranateJuice / redDateTea / coconutJuice / lycheeJuice。
- 新增配方（BrewingSkill.js BREWING_RECIPES 末尾 10 条）：见下表。

| 采集材料 | 新增成品 | 品类 | 配方reqLevel | 配方材料 | 成品value/heal |
|---|---|---|---|---|---|
| foraging_ext_03 橙子 | 鲜橙汁 orangeJuice | 果汁 | 12 | 橙子×3+水×1 | v24/heal24 |
| foraging_ext_05 柚子 | 柚子茶 pomeloTea | 茶饮 | 20 | 柚子×2+水×2 | v46/flavorEnergy14 |
| foraging_ext_06 樱桃 | 樱桃汁 cherryJuice | 果汁 | 24 | 樱桃×3+水×1 | v52/heal34 |
| foraging_ext_07 蓝莓 | 蓝莓汁 blueberryJuice | 果汁 | 28 | 蓝莓×3+水×1 | v64/heal42 |
| foraging_ext_08 覆盆子 | 覆盆子汁 raspberryJuice | 果汁 | 30 | 覆盆子×3+水×1 | v72/heal48 |
| foraging_ext_09 猕猴桃 | 猕猴桃汁 kiwiJuice | 果汁 | 34 | 猕猴桃×3+水×1 | v84/heal55 |
| foraging_ext_10 石榴 | 石榴汁 pomegranateJuice | 果汁 | 38 | 石榴×3+水×1 | v95/heal62 |
| foraging_ext_11 红枣 | 红枣茶 redDateTea | 茶饮 | 40 | 红枣×3+水×2 | v100/flavorEnergy20 |
| foraging_ext2_11 椰子 | 椰汁 coconutJuice | 果汁 | 42 | 椰子×3+水×1 | v105/heal66 |
| foraging_ext_14 荔枝 | 荔枝饮 lycheeJuice | 果汁 | 46 | 荔枝×3+水×1 | v130/heal72 |

## 校验闭环结果
- 每批改动后重跑诊断：配方引用全部有效（无无效引用）；对应材料从"未用"清单移除。
- 场景A 后：未用材料 172 → 170（鎏金金/银矿打通）。
- 第 1 批后：未用材料 170 → 160；brewing 配方 99 → 109；使用材料 285 → 295。
- 第 2 批后：未用材料 160 → 143；cooking 配方 110 → 127；使用材料 295 → 312。
- 第 3 批后：未用材料 143 → 128；cooking 配方 127 → 142；使用材料 312 → 327。
- 第 4 批后：未用材料 128 → 113；cooking 配方 142 → 157；使用材料 327 → 342。
- 第 5 批后：未用材料 113 → 98；cooking 配方 157 → 172；使用材料 342 → 357。
- 第 6 批后：未用材料 98 → 87；cooking 配方 172 → 183；使用材料 357 → 368。（seafood 全部清空）
- 第 7 批后：未用材料 87 → 79；cooking 配方 183 → 191；使用材料 368 → 376。（meat 与 vegetable 全部清空；剩余仅 fruit/root/mineral）
- 第 8 批后：未用材料 79 → 60；spiceMixing 配方 75 → 94；使用材料 376 → 395。（root 全部清空；剩余仅 fruit/mineral）
- 第 9 批后：未用材料 60 → 45；preserving 配方 72 → 87；使用材料 395 → 410。（剩余 fruit 18 / mineral 25）
- 第 10 批后：未用材料 45 → 27；brewing 配方 109 → 124、preserving 配方 87 → 90；使用材料 410 → 428。（fruit 全部清空；剩余仅 mineral 25）
- 第 11 批后：未用材料 27 → 0；craftsmithing 配方 96 → 121、baking 70 → 71、cooking 191 → 192；使用材料 428 → 455。（mineral 全部清空，另补齐榴莲/野牛肉；**未用材料归零**）
- `vite build` 通过（✓ built in ~1.6s；exit code 1 仅为既有 500KB chunk 警告）。
- 回归测试 `npx playwright test e2e-test.spec.mjs`：9/9 通过。

### 第 2 批：蔬菜/根茎/菌类 → 烹饪菜品（cooking）
- 规则：成品为 food（主菜/汤品/主食）；配方 reqLevel 取材料采集等级之上；主材 + 常用佐料（saltOre/soySauce/garlic/ginger/fiveSpice/bacon/rice）。
- 新增物品（items.js）：radishSoup / greenRadishSalad / beetSalad / waterChestnutStir / arrowheadSoup / lotusRootSoup / poriaPorridge / taroBraised / tapiocaStew / kudzuSoup / braisedPeanut / fungusStir / silverFungusSoup / braisedBamboo / asparagusStir / spinachSoup / celeryStir。
- 新增配方（CookingSkill.js COOKING_RECIPES 末尾 17 条）：见下表。

| 采集材料 | 新增成品 | 品类 | reqLevel | 配方材料 | heal |
|---|---|---|---|---|---|
| excavation_ext_01 白萝卜 | 萝卜汤 radishSoup | 汤品 | 3 | 白萝卜×3+盐矿×1 | 18 |
| excavation_ext_02 青萝卜 | 凉拌青萝卜 greenRadishSalad | 主菜 | 6 | 青萝卜×2+酱油×1+大蒜×1 | 22 |
| excavation_ext_04 甜菜 | 甜菜沙拉 beetSalad | 主菜 | 13 | 甜菜×2+盐矿×1 | 32 |
| excavation_ext_05 荸荠 | 清炒荸荠 waterChestnutStir | 主菜 | 16 | 荸荠×2+酱油×1+大蒜×1 | 36 |
| excavation_ext_06 慈姑 | 慈姑汤 arrowheadSoup | 汤品 | 19 | 慈姑×2+生姜×1+盐矿×1 | 40 |
| excavation_ext_07 莲藕 | 莲藕汤 lotusRootSoup | 汤品 | 22 | 莲藕×2+生姜×1+盐矿×1 | 46 |
| excavation_ext_12 茯苓 | 茯苓粥 poriaPorridge | 主食 | 40 | 茯苓×2+稻米×2 | 70 |
| excavation_ext_09 芋头 | 红烧芋头 taroBraised | 主菜 | 30 | 芋头×2+酱油×2+大蒜×1 | 56 |
| excavation_ext_10 木薯 | 木薯炖肉 tapiocaStew | 主菜 | 32 | 木薯×2+腊肉×1+酱油×1 | 60 |
| excavation_ext_11 葛根 | 葛根汤 kudzuSoup | 汤品 | 36 | 葛根×2+生姜×1+盐矿×1 | 66 |
| foraging_ext_21 花生 | 卤煮花生 braisedPeanut | 主菜 | 70 | 花生×3+五香粉×1+盐矿×1 | 120 |
| foraging_ext_22 木耳 | 木耳炒肉 fungusStir | 主菜 | 72 | 木耳×2+腊肉×1+大蒜×1 | 130 |
| foraging_ext_23 银耳 | 银耳羹 silverFungusSoup | 汤品 | 76 | 银耳×2+生姜×1 | 140 |
| foraging_ext_24 竹笋 | 油焖竹笋 braisedBamboo | 主菜 | 80 | 竹笋×2+酱油×2+盐矿×1 | 150 |
| foraging_ext_25 芦笋 | 清炒芦笋 asparagusStir | 主菜 | 84 | 芦笋×2+大蒜×1+盐矿×1 | 165 |
| foraging_ext_26 菠菜 | 菠菜汤 spinachSoup | 汤品 | 86 | 菠菜×2+生姜×1+盐矿×1 | 175 |
| foraging_ext_27 芹菜 | 芹菜炒肉 celeryStir | 主菜 | 89 | 芹菜×2+腊肉×1+盐矿×1 | 185 |

### 第 3 批：海鲜鱼类/贝类 → 烹饪菜品（cooking）
- 新增物品（items.js）：codSteak / whitebaitStir / flounderSteam / grouperSteam / turbotSoup / anchoviesFry / rainbowTroutRoast / ayuGrill / sauryGrill / sturgeonSteam / swordfishSteak / marlinSteak / oysterGarlic / scallopGarlic / clamSoup。
- 新增配方（CookingSkill.js COOKING_RECIPES 末尾 15 条）。

| 采集材料 | 新增成品 | 品类 | reqLevel | 配方材料 | heal |
|---|---|---|---|---|---|
| fishing_ext_03 鳕鱼 | 香煎鳕鱼 codSteak | 主菜 | 9 | 鳕鱼×2+盐矿×1+生姜×1 | 30 |
| fishing_ext2_03 银鱼 | 银鱼炒蛋 whitebaitStir | 主菜 | 9 | 银鱼×2+野鸡蛋×1+盐矿×1 | 32 |
| fishing_ext_04 比目鱼 | 清蒸比目鱼 flounderSteam | 主菜 | 13 | 比目鱼×2+生姜×1+酱油×1 | 40 |
| fishing_ext_05 石斑鱼 | 清蒸石斑 grouperSteam | 主菜 | 16 | 石斑×2+生姜×1+酱油×1 | 46 |
| fishing_ext_06 多宝鱼 | 多宝鱼汤 turbotSoup | 汤品 | 19 | 多宝鱼×2+生姜×1+盐矿×1 | 52 |
| fishing_ext2_04 凤尾鱼 | 香酥凤尾鱼 anchoviesFry | 主菜 | 13 | 凤尾鱼×2+盐矿×1+辣椒×1 | 40 |
| fishing_ext2_05 虹鳟 | 烤虹鳟 rainbowTroutRoast | 主菜 | 16 | 虹鳟×2+辣椒×1+盐矿×1 | 46 |
| fishing_ext2_06 香鱼 | 盐烤香鱼 ayuGrill | 主菜 | 19 | 香鱼×2+盐矿×1 | 52 |
| fishing_ext_07 秋刀鱼 | 盐烤秋刀鱼 sauryGrill | 主菜 | 23 | 秋刀鱼×2+盐矿×1 | 56 |
| fishing_ext2_07 鲟鱼 | 清蒸鲟鱼 sturgeonSteam | 主菜 | 23 | 鲟鱼×2+生姜×1+酱油×1 | 58 |
| fishing_ext_08 旗鱼 | 香煎旗鱼 swordfishSteak | 主菜 | 26 | 旗鱼×2+酱油×1+生姜×1 | 62 |
| fishing_ext_09 剑鱼 | 剑鱼排 marlinSteak | 主菜 | 30 | 剑鱼×2+酱油×1+大蒜×1 | 70 |
| fishing_ext_16 牡蛎 | 蒜蓉烤牡蛎 oysterGarlic | 主菜 | 53 | 牡蛎×2+大蒜×2+辣椒×1 | 120 |
| fishing_ext_17 扇贝 | 蒜蓉蒸扇贝 scallopGarlic | 主菜 | 57 | 扇贝×2+大蒜×2+盐矿×1 | 132 |
| fishing_ext_18 蛤蜊 | 蛤蜊汤 clamSoup | 汤品 | 60 | 蛤蜊×2+生姜×1+盐矿×1 | 140 |

### 第 4 批：海鲜贝/螺/虾蟹/鱼（第二批）→ 烹饪菜品（cooking）
- 新增物品（items.js）：silverCarpBraised / fishHeadSteam / yellowCroakerBraised / hairtailFry / pomfretSteam / blackCarpBraised / grassCarpBoiled / squidStir / octopusGarlic / cuttlefishSoup / razorClamOil / seaUrchinEgg / conchSauce / prawnBoiled / mantisShrimpSalt。
- 新增配方（CookingSkill.js COOKING_RECIPES 末尾 15 条）。

| 采集材料 | 新增成品 | 品类 | reqLevel | 配方材料 | heal |
|---|---|---|---|---|---|
| fishing_ext2_08 白鲢 | 红烧白鲢 silverCarpBraised | 主菜 | 26 | 白鲢×2+酱油×1+生姜×1 | 60 |
| fishing_ext2_09 花鲢 | 剁椒鱼头 fishHeadSteam | 主菜 | 30 | 花鲢×2+辣椒×2+生姜×1 | 70 |
| fishing_ext_10 黄花鱼 | 红烧黄花鱼 yellowCroakerBraised | 主菜 | 33 | 黄花鱼×2+酱油×1+生姜×1 | 78 |
| fishing_ext_11 带鱼 | 香煎带鱼 hairtailFry | 主菜 | 36 | 带鱼×2+盐矿×1+生姜×1 | 85 |
| fishing_ext_12 鲳鱼 | 清蒸鲳鱼 pomfretSteam | 主菜 | 40 | 鲳鱼×2+生姜×1+酱油×1 | 92 |
| fishing_ext2_10 青鱼 | 红烧青鱼 blackCarpBraised | 主菜 | 33 | 青鱼×2+酱油×1+生姜×1 | 78 |
| fishing_ext2_11 草鱼 | 水煮草鱼 grassCarpBoiled | 主菜 | 36 | 草鱼×2+辣椒×2+大蒜×1 | 85 |
| fishing_ext_13 鱿鱼 | 爆炒鱿鱼 squidStir | 主菜 | 43 | 鱿鱼×2+辣椒×1+大蒜×1 | 100 |
| fishing_ext_14 章鱼 | 蒜香章鱼 octopusGarlic | 主菜 | 46 | 章鱼×2+大蒜×2+盐矿×1 | 108 |
| fishing_ext_15 墨鱼 | 墨鱼炖汤 cuttlefishSoup | 汤品 | 50 | 墨鱼×2+生姜×1+盐矿×1 | 115 |
| fishing_ext_19 蛏子 | 葱油蛏子 razorClamOil | 主菜 | 63 | 蛏子×2+盐矿×1+大蒜×1 | 145 |
| fishing_ext_20 海胆 | 蒸蛋海胆 seaUrchinEgg | 主菜 | 67 | 海胆×2+野鸡蛋×2+盐矿×1 | 155 |
| fishing_ext_21 海螺 | 酱爆海螺 conchSauce | 主菜 | 70 | 海螺×2+酱油×2+辣椒×1 | 165 |
| fishing_ext_23 对虾 | 白灼对虾 prawnBoiled | 主菜 | 77 | 对虾×3+生姜×1+盐矿×1 | 180 |
| fishing_ext_24 皮皮虾 | 椒盐皮皮虾 mantisShrimpSalt | 主菜 | 80 | 皮皮虾×3+盐矿×1+五香粉×1 | 190 |

### 第 5 批：海鲜鲍/藻/贝/虾蟹（第三批）→ 烹饪菜品（cooking）
- 新增物品（items.js）：tilapiaBraised / bassaFry / wuchangSteam / agarSalad / asparagusSeaStir / wakameSoup / kelpSoup / laverSoup / musselSoup / akagaiStir / musselGarlic / birdClamBoiled / bloodClamSalad / arkShellGinger / braisedPrawn。
- 新增配方（CookingSkill.js COOKING_RECIPES 末尾 15 条）。

| 采集材料 | 新增成品 | 品类 | reqLevel | 配方材料 | heal |
|---|---|---|---|---|---|
| fishing_ext2_12 罗非鱼 | 红烧罗非鱼 tilapiaBraised | 主菜 | 40 | 罗非鱼×2+酱油×1+生姜×1 | 92 |
| fishing_ext2_13 巴沙鱼 | 香煎巴沙鱼 bassaFry | 主菜 | 43 | 巴沙鱼×2+盐矿×1+生姜×1 | 100 |
| fishing_ext2_14 武昌鱼 | 清蒸武昌鱼 wuchangSteam | 主菜 | 46 | 武昌鱼×2+生姜×1+酱油×1 | 108 |
| fishing_ext2_15 石花菜 | 凉拌石花菜 agarSalad | 主菜 | 50 | 石花菜×2+盐矿×1+大蒜×1 | 115 |
| fishing_ext2_16 龙须菜 | 清炒龙须菜 asparagusSeaStir | 主菜 | 53 | 龙须菜×2+大蒜×1+盐矿×1 | 120 |
| fishing_ext2_17 裙带菜 | 裙带菜汤 wakameSoup | 汤品 | 57 | 裙带菜×2+盐矿×1+生姜×1 | 128 |
| fishing_ext2_18 海带 | 海带汤 kelpSoup | 汤品 | 60 | 海带×2+盐矿×1+生姜×1 | 134 |
| fishing_ext2_19 紫菜 | 紫菜蛋汤 laverSoup | 汤品 | 63 | 紫菜×2+野鸡蛋×2+盐矿×1 | 144 |
| fishing_ext2_20 淡菜 | 淡菜汤 musselSoup | 汤品 | 67 | 淡菜×2+生姜×1+盐矿×1 | 155 |
| fishing_ext2_21 赤贝 | 辣炒赤贝 akagaiStir | 主菜 | 70 | 赤贝×2+辣椒×2+大蒜×1 | 165 |
| fishing_ext_22 贻贝 | 蒜蓉贻贝 musselGarlic | 主菜 | 73 | 贻贝×2+大蒜×2+盐矿×1 | 170 |
| fishing_ext2_22 鸟贝 | 白灼鸟贝 birdClamBoiled | 主菜 | 73 | 鸟贝×3+生姜×1+盐矿×1 | 172 |
| fishing_ext2_23 血蛤 | 凉拌血蛤 bloodClamSalad | 主菜 | 77 | 血蛤×3+大蒜×1+酱油×1 | 180 |
| fishing_ext2_24 毛蚶 | 姜葱毛蚶 arkShellGinger | 主菜 | 80 | 毛蚶×3+生姜×2+盐矿×1 | 188 |
| fishing_ext_25 罗氏沼虾 | 油焖大虾 braisedPrawn | 主菜 | 84 | 罗氏沼虾×3+酱油×2+生姜×1 | 200 |

### 第 6 批：海鲜剩余（第四批，清空 seafood）→ 烹饪菜品（cooking）
- 新增物品（items.js）：crayfishSpicy / catfishStew / geoduckSteam / scallopBroad / greenCrabSteam / blackFishSoup / eelBraised / loachSoup / flowerCrabSteam / swimCrabStir / jellyfishSalad。
- 新增配方（CookingSkill.js COOKING_RECIPES 末尾 11 条）。

| 采集材料 | 新增成品 | 品类 | reqLevel | 配方材料 | heal |
|---|---|---|---|---|---|
| fishing_ext_26 小龙虾 | 麻辣小龙虾 crayfishSpicy | 主菜 | 87 | 小龙虾×3+辣椒×3+大蒜×1 | 215 |
| fishing_ext_27 鲶鱼 | 鲶鱼炖豆腐 catfishStew | 汤品 | 90 | 鲶鱼×2+生姜×1+盐矿×1 | 230 |
| fishing_ext2_25 象拔蚌 | 清蒸象拔蚌 geoduckSteam | 主菜 | 84 | 象拔蚌×2+生姜×1+酱油×1 | 205 |
| fishing_ext2_26 带子 | 蒜蓉带子 scallopBroad | 主菜 | 87 | 带子×2+大蒜×2+盐矿×1 | 215 |
| fishing_ext2_27 青蟹 | 清蒸青蟹 greenCrabSteam | 主菜 | 90 | 青蟹×2+生姜×2+酱油×1 | 230 |
| fishing_ext_28 黑鱼 | 黑鱼汤 blackFishSoup | 汤品 | 94 | 黑鱼×2+生姜×1+盐矿×1 | 245 |
| fishing_ext_29 黄鳝 | 红烧黄鳝 eelBraised | 主菜 | 97 | 黄鳝×2+酱油×2+大蒜×1 | 260 |
| fishing_ext_30 泥鳅 | 泥鳅豆腐汤 loachSoup | 汤品 | 99 | 泥鳅×2+生姜×1+盐矿×1 | 280 |
| fishing_ext2_28 花蟹 | 清蒸花蟹 flowerCrabSteam | 主菜 | 94 | 花蟹×2+生姜×2+酱油×1 | 245 |
| fishing_ext2_29 梭子蟹 | 梭子蟹炒年糕 swimCrabStir | 主菜 | 97 | 梭子蟹×2+酱油×1+大蒜×1 | 260 |
| fishing_ext2_30 海蜇 | 凉拌海蜇 jellyfishSalad | 主菜 | 99 | 海蜇×2+大蒜×1+酱油×1 | 280 |

### 第 7 批：肉类 + 剩余蔬菜（清空 meat 与 vegetable）→ 烹饪菜品（cooking）
- 新增物品（items.js）：roastTurkey / ostrichSteak / porcupineBraised / capybaraStew / honeySugarcane / broccoliGarlic / lettuceOyster / kohlrabiStir。
- 新增配方（CookingSkill.js COOKING_RECIPES 末尾 8 条）。

| 采集材料 | 新增成品 | 品类 | reqLevel | 配方材料 | heal |
|---|---|---|---|---|---|
| hunting_ext_29 火鸡 | 烤火鸡 roastTurkey | 主菜 | 97 | 火鸡×2+酱油×1+大蒜×1 | 265 |
| hunting_ext_30 鸵鸟 | 鸵鸟排 ostrichSteak | 主菜 | 99 | 鸵鸟×2+酱油×1+生姜×1 | 285 |
| hunting_ext2_29 箭猪 | 红烧箭猪 porcupineBraised | 主菜 | 97 | 箭猪×2+酱油×2+生姜×1 | 265 |
| hunting_ext2_30 水豚 | 炖水豚 capybaraStew | 汤品 | 99 | 水豚×2+生姜×1+盐矿×1 | 285 |
| foraging_ext2_10 甘蔗 | 蜜汁甘蔗 honeySugarcane | 主菜 | 33 | 甘蔗×2+生姜×1+盐矿×1 | 80 |
| foraging_ext_28 西兰花 | 蒜蓉西兰花 broccoliGarlic | 主菜 | 94 | 西兰花×2+大蒜×2+盐矿×1 | 245 |
| foraging_ext_29 生菜 | 蚝油生菜 lettuceOyster | 主菜 | 97 | 生菜×2+酱油×2+大蒜×1 | 265 |
| foraging_ext_30 苤蓝 | 清炒苤蓝 kohlrabiStir | 主菜 | 99 | 苤蓝×2+大蒜×1+盐矿×1 | 285 |

### 第 8 批：根茎药材 → 药膳调料粉（spiceMixing）
- 新增物品（items.js）：banxiaPowder / kushenPowder / fangfengPowder / cangzhuPowder / houpuPowder / duzhongPowder / wuweiziPowder / jinyingziPowder / shanzhuyuPowder / wuzhuyuPowder / baizhuPowder / huangqiPowder / dangguiPowder / chuanxiongPowder / maidongPowder / tianmaPowder / shihuPowder / huangjingPowder / baizhiPowder。
- 新增配方（SpiceMixingSkill.js SPICE_RECIPES 末尾 19 条，成品为 spice/seasoning）。

| 采集材料 | 新增成品 | reqLevel | 配方材料 | value |
|---|---|---|---|---|
| excavation_ext2_01 半夏 | 半夏粉 banxiaPowder | 8 | 半夏×2+食盐×1 | 20 |
| excavation_ext2_02 苦参 | 苦参粉 kushenPowder | 12 | 苦参×2+食盐×1 | 32 |
| excavation_ext2_04 防风 | 防风粉 fangfengPowder | 15 | 防风×2+食盐×1 | 48 |
| excavation_ext2_05 苍术 | 苍术粉 cangzhuPowder | 18 | 苍术×2+食盐×1 | 55 |
| excavation_ext2_06 厚朴 | 厚朴粉 houpuPowder | 21 | 厚朴×2+食盐×1 | 62 |
| excavation_ext2_07 杜仲 | 杜仲粉 duzhongPowder | 25 | 杜仲×2+食盐×1 | 72 |
| excavation_ext2_09 五味子 | 五味子粉 wuweiziPowder | 32 | 五味子×2+食盐×1 | 88 |
| excavation_ext2_10 金樱子 | 金樱子粉 jinyingziPowder | 35 | 金樱子×2+食盐×1 | 95 |
| excavation_ext2_11 山茱萸 | 山茱萸粉 shanzhuyuPowder | 38 | 山茱萸×2+食盐×1 | 102 |
| excavation_ext2_12 吴茱萸 | 吴茱萸粉 wuzhuyuPowder | 42 | 吴茱萸×2+食盐×1 | 110 |
| excavation_ext_13 白术 | 白术粉 baizhuPowder | 45 | 白术×2+食盐×1 | 118 |
| excavation_ext_14 黄芪 | 黄芪粉 huangqiPowder | 48 | 黄芪×2+食盐×1 | 128 |
| excavation_ext_15 当归 | 当归粉 dangguiPowder | 52 | 当归×2+食盐×1 | 138 |
| excavation_ext_16 川芎 | 川芎粉 chuanxiongPowder | 55 | 川芎×2+食盐×1 | 148 |
| excavation_ext_17 麦冬 | 麦冬粉 maidongPowder | 60 | 麦冬×2+食盐×1 | 158 |
| excavation_ext_18 天麻 | 天麻粉 tianmaPowder | 62 | 天麻×2+食盐×1 | 168 |
| excavation_ext_19 石斛 | 石斛粉 shihuPowder | 64 | 石斛×2+食盐×1 | 178 |
| excavation_ext_20 黄精 | 黄精粉 huangjingPowder | 68 | 黄精×2+食盐×1 | 188 |
| excavation_ext_21 白芷 | 白芷粉 baizhiPowder | 70 | 白芷×2+食盐×1 | 200 |

### 第 9 批：水果 → 果脯/蜜饯/果酱/炒货（preserving）
- 新增物品（items.js）：greenPlumPreserve / waxApplePreserve / passionFruitJam / mangosteenPreserve / guavaJam / dragonFruitJam / figPreserve / cashewRoast / persimmonDry / hazelnutRoast / pistachioRoast / longanDry / pineNutRoast / loquatPreserve / hawthornPreserve（均为 ingredient/pickled）。
- 新增配方（PreservingSkill.js PRESERVING_RECIPES 末尾 15 条）。

| 采集材料 | 新增成品 | 类别 | reqLevel | 配方材料 |
|---|---|---|---|---|
| foraging_ext2_03 青梅 | 青梅果脯 | 果脯 | 9 | 青梅×3+盐矿×1 |
| foraging_ext2_05 莲雾 | 莲雾蜜饯 | 蜜饯 | 16 | 莲雾×3+盐矿×1 |
| foraging_ext2_06 百香果 | 百香果酱 | 果酱 | 19 | 百香果×3+盐矿×1 |
| foraging_ext2_07 山竹 | 山竹蜜饯 | 蜜饯 | 23 | 山竹×3+盐矿×1 |
| foraging_ext2_08 番石榴 | 番石榴酱 | 果酱 | 26 | 番石榴×3+盐矿×1 |
| foraging_ext2_09 火龙果 | 火龙果酱 | 果酱 | 30 | 火龙果×3+盐矿×1 |
| foraging_ext_12 无花果 | 无花果蜜饯 | 蜜饯 | 40 | 无花果×3+盐矿×1 |
| foraging_ext2_12 腰果 | 盐焗腰果 | 炒货 | 40 | 腰果×3+盐矿×1 |
| foraging_ext_13 柿子 | 柿饼 | 果干 | 43 | 柿子×3+盐矿×1 |
| foraging_ext2_13 榛子 | 盐焗榛子 | 炒货 | 43 | 榛子×3+盐矿×1 |
| foraging_ext2_14 开心果 | 盐焗开心果 | 炒货 | 46 | 开心果×3+盐矿×1 |
| foraging_ext_15 龙眼 | 桂圆干 | 果干 | 50 | 龙眼×3+盐矿×1 |
| foraging_ext2_15 松子 | 盐焗松子 | 炒货 | 50 | 松子×3+盐矿×1 |
| foraging_ext_16 枇杷 | 枇杷蜜饯 | 蜜饯 | 53 | 枇杷×3+盐矿×1 |
| foraging_ext_17 山楂 | 山楂蜜饯 | 蜜饯 | 57 | 山楂×3+盐矿×1 |

### 第 10 批：水果 → 果酒（brewing）+ 坚果 → 炒货（preserving），清空 fruit
- 新增物品（items.js）：果酒 15 个（gojiWine / mulberryWine / nectarineWine / peachWine / mandarinWine / kumquatWine / bergamotWine / custardAppleWine / sugarAppleWine / jackfruitWine / ginsengFruitWine / yaconWine / seaBuckthornWine / oliveWine / jujubeWine，drink/wine）+ 坚果炒货 3 个（chestnutRoast / walnutRoast / almondRoast，ingredient/pickled）。
- 新增配方：BrewingSkill.js BREWING_RECIPES 末尾 15 条果酒（主材 fruit×3 + 酵母×1 + 水×2）；PreservingSkill.js PRESERVING_RECIPES 末尾 3 条坚果（主材 fruit×3 + 盐矿×1/2）。

| 采集材料 | 新增成品 | 归属技能 | reqLevel | 配方材料 |
|---|---|---|---|---|
| foraging_ext2_16 枸杞 | 枸杞酒 | brewing | 53 | 枸杞×3+酵母×1+水×2 |
| foraging_ext2_17 桑葚 | 桑葚酒 | brewing | 57 | 桑葚×3+酵母×1+水×2 |
| foraging_ext2_18 油桃 | 油桃酒 | brewing | 60 | 油桃×3+酵母×1+水×2 |
| foraging_ext2_19 蟠桃 | 蟠桃酒 | brewing | 63 | 蟠桃×3+酵母×1+水×2 |
| foraging_ext2_20 蜜柑 | 蜜柑酒 | brewing | 67 | 蜜柑×3+酵母×1+水×2 |
| foraging_ext2_21 金桔 | 金桔酒 | brewing | 70 | 金桔×3+酵母×1+水×2 |
| foraging_ext2_22 佛手柑 | 佛手柑酒 | brewing | 73 | 佛手柑×3+酵母×1+水×2 |
| foraging_ext2_23 番荔枝 | 番荔枝酒 | brewing | 77 | 番荔枝×3+酵母×1+水×2 |
| foraging_ext2_24 释迦 | 释迦酒 | brewing | 80 | 释迦×3+酵母×1+水×2 |
| foraging_ext2_25 菠萝蜜 | 菠萝蜜酒 | brewing | 84 | 菠萝蜜×3+酵母×1+水×2 |
| foraging_ext2_26 人参果 | 人参果酒 | brewing | 87 | 人参果×3+酵母×1+水×2 |
| foraging_ext2_27 雪莲果 | 雪莲果酒 | brewing | 90 | 雪莲果×3+酵母×1+水×2 |
| foraging_ext2_28 沙棘 | 沙棘酒 | brewing | 94 | 沙棘×3+酵母×1+水×2 |
| foraging_ext2_29 橄榄 | 橄榄酒 | brewing | 97 | 橄榄×3+酵母×1+水×2 |
| foraging_ext2_30 酸枣 | 酸枣酒 | brewing | 99 | 酸枣×3+酵母×1+水×2 |
| foraging_ext_18 板栗 | 糖炒板栗 | preserving | 60 | 板栗×3+盐矿×2 |
| foraging_ext_19 核桃 | 琥珀核桃 | preserving | 63 | 核桃×3+盐矿×1 |
| foraging_ext_20 杏仁 | 盐焗杏仁 | preserving | 67 | 杏仁×3+盐矿×1 |

### 第 11 批：矿石 → 锻造装备/饰品（craftsmithing），清空 mineral
- 新增物品（items.js）：amethystRing / turquoiseRing / rubyRing / emeraldRing / diamondRing / tinAmulet / leadAmulet / zincAmulet / nickelAmulet / cobaltAmulet / tungstenAmulet / titaniumAmulet / manganeseAmulet / vanadiumAmulet / graphiteAmulet / fluoriteRing / gypsumAmulet / saltpeterAmulet / sulfurAmulet / alumAmulet / micaAmulet / quartzAmulet / jadeRing / agateRing / sapphireRing（equipment，ring/amulet，含 quality/stats）。
- 新增配方（CraftsmithingSkill.js SMITHING_RECIPES 末尾 25 条，主材矿×2+盐矿×1）。

| 采集材料 | 新增成品 | slot | reqLevel | 配方材料 |
|---|---|---|---|---|
| excavation_ext2_13 紫石英 | 紫水晶戒指 | ring | 43 | 紫石英×2+盐矿×1 |
| excavation_ext2_14 绿松石 | 绿松石戒指 | ring | 46 | 绿松石×2+盐矿×1 |
| excavation_ext2_15 红宝石 | 红宝石戒指 | ring | 50 | 红宝石×2+盐矿×1 |
| excavation_ext2_16 祖母绿 | 祖母绿戒指 | ring | 53 | 祖母绿×2+盐矿×1 |
| excavation_ext2_17 钻石 | 钻石戒指 | ring | 57 | 钻石×2+盐矿×1 |
| excavation_ext2_20 锡矿 | 锡护符 | amulet | 67 | 锡矿×2+盐矿×1 |
| excavation_ext2_21 铅矿 | 铅护符 | amulet | 70 | 铅矿×2+盐矿×1 |
| excavation_ext2_22 锌矿 | 锌护符 | amulet | 73 | 锌矿×2+盐矿×1 |
| excavation_ext2_23 镍矿 | 镍护符 | amulet | 77 | 镍矿×2+盐矿×1 |
| excavation_ext2_24 钴矿 | 钴护符 | amulet | 80 | 钴矿×2+盐矿×1 |
| excavation_ext2_25 钨矿 | 钨护符 | amulet | 84 | 钨矿×2+盐矿×1 |
| excavation_ext2_26 钛矿 | 钛护符 | amulet | 87 | 钛矿×2+盐矿×1 |
| excavation_ext2_27 锰矿 | 锰护符 | amulet | 90 | 锰矿×2+盐矿×1 |
| excavation_ext2_28 钒矿 | 钒护符 | amulet | 94 | 钒矿×2+盐矿×1 |
| excavation_ext2_29 石墨 | 石墨护符 | amulet | 97 | 石墨×2+盐矿×1 |
| excavation_ext2_30 萤石 | 萤石戒指 | ring | 99 | 萤石×2+盐矿×1 |
| excavation_ext_22 石膏 | 石膏护符 | amulet | 73 | 石膏×2+盐矿×1 |
| excavation_ext_23 硝石 | 硝石护符 | amulet | 77 | 硝石×2+盐矿×1 |
| excavation_ext_24 硫磺 | 硫磺护符 | amulet | 80 | 硫磺×2+盐矿×1 |
| excavation_ext_25 明矾 | 明矾护符 | amulet | 84 | 明矾×2+盐矿×1 |
| excavation_ext_26 云母 | 云母护符 | amulet | 87 | 云母×2+盐矿×1 |
| excavation_ext_27 石英 | 石英护符 | amulet | 90 | 石英×2+盐矿×1 |
| excavation_ext_28 翡翠矿 | 翡翠戒指 | ring | 94 | 翡翠×2+盐矿×1 |
| excavation_ext_29 玛瑙矿 | 玛瑙戒指 | ring | 97 | 玛瑙×2+盐矿×1 |
| excavation_ext_30 蓝晶矿 | 蓝晶戒指 | ring | 99 | 蓝晶×2+盐矿×1 |

### 补齐基础材料（最后 2 项）
| 采集材料 | 新增成品 | 归属技能 | reqLevel | 配方材料 |
|---|---|---|---|---|
| durian 榴莲 | 榴莲酥 | baking | 62 | 榴莲×2+面粉×1 |
| bisonMeat 野牛肉 | 香煎野牛排 | cooking | 47 | 野牛肉×2+盐矿×1+酱油×1 |

## 校验闭环结果（最终）
- **未用采集材料 = 0**，配方引用无无效材料。
- 配方总数 723，被配方使用的材料 455，全部材料消耗出口已打通。

## 第二轮：逻辑相关性校验（维度1 逻辑匹配修复）
> 发现 expansion1/expansion2 中 cooking 扩展配方存在系统性主材错位：菜名与主材不符（如"东坡肉"用麻雀+沙丁鱼、"宫保鸡丁"用麻雀、"水煮牛肉"用斑鸠），且大量菜品被硬塞 芜菁/菱角/柴胡/女贞子 作万能辅料。baking 扩展存在同类错位。

### cooking 扩展 60 条主材对齐（expansion1.js + expansion2.js）
- 策略：保持成品名，重写配方 ingredients 为与菜名题材相符的现有食材，去掉芜菁/菱角/柴胡/女贞子等荒谬万能辅料，并修正若干错误类别。
- 主材对应示例：宫保鸡丁→野鸡肉+辣椒+花生；东坡肉/回锅肉/蚂蚁上树等→野猪肉；水煮牛肉/夫妻肺片→野牛肉；香醋鸭/烧鹅→野鸭；清蒸鲈鱼→鲈鱼、红烧鲫鱼→鲫鱼、糖醋鱼→鲤鱼；清炒时蔬/干煸豆角→白菜；鱼香茄子/地三鲜→茄子+白菜；拔丝苹果→苹果+面粉；冰糖雪梨→梨；杨枝甘露→芒果+柚子；八宝饭→稻米+板栗/核桃/红枣；油焖大虾/白灼虾/天妇罗→对虾。
- 被配方使用的材料集合下降 455→350（移除万能辅料），未用采集材料仍为 0，无无效引用。
- `vite build` 通过；回归测试 9/9 通过。
- 本轮已完成 cooking 扩展；baking 扩展（59 条）同类错位待下一轮修复。

### baking 扩展 60 条主材对齐（expansion1.js + expansion2.js）
- 面包/糕点主材统一改为 面粉 + (野鸡蛋/对应果酱/小麦/大蒜/稻米 等)，去掉动物肉/芜菁/菱角/柴胡/女贞子。
- 例：牛角包→面粉×3+盐矿；吐司→面粉+野鸡蛋；贝果→面粉+蓝莓酱；菠萝包→面粉+菠萝；杏仁酥→面粉+杏仁；桃酥→面粉+蟠桃；萝卜糕→稻米+白萝卜；枣泥糕→稻米+红枣。
- 校验结果同前（无无效引用、未用=0、build 通过、回归 9/9）。

### brewing EXT1 30 条主材对齐 + 新增 10 种基础原料（expansion1.js）
- 用户确认"新增缺失原材料（自洽）"：为缺失基础原料新增 items 条目 + 采集目标，使配方与成品名完全对应。
- 新增基础原料（items.js，ingredient）：watermelon 西瓜 / hamimelon 哈密瓜 / chrysanthemum 菊花 / rose 玫瑰 / mint 薄荷 / barley 大麦 / teaLeaf 茶叶 / milk 牛奶 / osmanthus 桂花 / sodaWater 苏打水。
- 接入采集（ForagingSkill.js FORAGING_TARGETS 末尾新增 10 个采摘目标，reqLevel 8~34）。
- 重写 brewing_rec_01~30 材料为对应果汁/茶饮/酒类原料（例：西瓜汁→西瓜×3+清水；奶茶→牛奶×2+茶叶；桂花酒→桂花×3+酵母+水；朗姆酒→甘蔗×3+酵母+水）。
- 校验：无无效引用、未用采集材料=0、build 通过、回归 9/9。
- 剩余同类错位待后续：brewing EXT2 前30、preserving 60、spiceMixing 60（craftsmithing 装备铁基可接受；preservation 保鲜剂/增益剂材料合理）。

### brewing EXT2 前30 条主材对齐 + 新增 6 种基础原料（expansion2.js）
- 新增基础原料（items.js，ingredient）：ume 乌梅 / winterMelon 冬瓜 / rosella 洛神花 / jasmine 茉莉花 / bayberry 杨梅 / banana 香蕉。
- 接入采集（ForagingSkill.js FORAGING_TARGETS 末尾新增 6 个采摘目标，reqLevel 24~38）。
- 重写 brewing_rec2_01~27、29、30（青柠汁 rec2_28 保持正确不动）为对应原料：酸梅汤→乌梅+清水；冬瓜茶→冬瓜；洛神花茶→洛神花；茉莉花茶→茉莉花；乌龙/铁观音/普洱/龙井/碧螺春→茶叶+清水；杨梅酒→杨梅；荔枝酒→荔枝；龙眼酒→龙眼；桃酒→蟠桃；西瓜酒→西瓜；香蕉酒→香蕉；百香果汁→百香果；山竹汁→山竹。
- 校验：无无效引用、未用采集材料=0、build 通过、回归 9/9。
- brewing 全部扩展已修复；剩余同类错位：preserving 60、spiceMixing 60。

### preserving EXT1 前29 条主材对齐 + 新增 7 种基础原料（expansion1.js）
- 新增基础原料（items.js，ingredient）：soybean 大豆 / sesame 芝麻 / mustard 芥末 / pepper 胡椒 / mushroom 蘑菇 / greenBeans 豆角 / cucumber 黄瓜。
- 接入采集（ForagingSkill.js FORAGING_TARGETS 新增 7 个采摘目标，reqLevel 12~30）。
- 重写 preserving_rec_01~29（rec_30 咸柠檬保持正确不动）：腐乳/豆豉→大豆；花生酱→花生；芝麻酱→芝麻；蛋黄酱→野鸡蛋；芥末酱→芥末；黑胡椒酱→胡椒；蘑菇酱→蘑菇；藤椒油→花椒；香醋/陈醋→稻米+酵母；泡椒→辣椒；酸豆角→豆角；梅干菜/榨菜/雪菜→白菜；萝卜干→白萝卜；咸鱼→鲫鱼；鱼干→鲤鱼；虾酱→对虾；蟹酱→蟹；蚝油→牡蛎；橄榄菜→橄榄+白菜；酸梅→乌梅；酱黄瓜→黄瓜；卤蛋→野鸡蛋。
- 校验：无无效引用、未用采集材料=0、build 通过、回归 9/9。
- 剩余同类错位：preserving EXT2 30、spiceMixing 60。

### preserving EXT2 30 条主材对齐 + 新增 2 种基础原料（expansion2.js）
- 新增基础原料（items.js，ingredient）：redBean 红豆 / lotusSeed 莲子。
- 接入采集（ForagingSkill.js FORAGING_TARGETS 新增 2 个采摘目标，reqLevel 22 / 34）。
- 重写 preserving_rec2_01~30：酱油膏/老抽/生抽→大豆；梅子酱→乌梅；菠萝酱→菠萝；草莓酱→草莓；蓝莓酱→蓝莓；苹果酱→苹果；橙子酱→橙；桃子酱→蟠桃；杏子酱→杏；柚子酱→柚；樱桃酱→樱桃；葡萄酱→葡萄；芒果酱→芒果；猕猴桃酱→猕猴桃；山楂酱→山楂；枣泥→红枣；豆沙→红豆；莲蓉→莲子；椰蓉→椰子；芝麻馅→芝麻；五仁馅→核桃+杏仁+花生+松子；腊肠/腊肉/酱肘子→野猪肉；酱鸭→野鸭；酱牛肉→野牛肉；咸鸭蛋/皮蛋→野鸡蛋。
- 校验：无无效引用、未用采集材料=0、build 通过、回归 9/9。
- preserving 全部扩展已修复；剩余同类错位：spiceMixing 60。

### spiceMixing EXT1+EXT2 60 条主材对齐 + 新增 19 种香辛料/草本（expansion1.js + expansion2.js）
- 新增基础原料（items.js，ingredient）：cumin 孜然 / fennel 茴香 / bayLeaf 香叶 / clove 丁香 / cardamom 豆蔻 / tsaoKo 草果 / amomum 砂仁 / licorice 甘草 / chenpi 陈皮 / turmeric 姜黄 / greenPeppercorn 藤椒 / sansho 山椒 / seaweed 海苔 / celery 芹菜 / thyme 百里香 / oregano 牛至 / sage 鼠尾草 / parsley 欧芹 / dill 莳萝。
- 接入采集（ForagingSkill.js FORAGING_TARGETS 新增 19 个采摘目标，reqLevel 18~64）。
- 重写 spiceMixing_rec_01~30 与 spiceMixing_rec2_01~30：各调料粉主材改为对应香辛料（例：孜然粉→孜然+盐；十三香/五香粉→花椒+八角+桂皮+丁香+茴香；油辣酱→辣椒；照烧汁→酱油+姜+蒜；柠檬胡椒盐→柠檬+胡椒+盐；咖喱膏→姜黄+咖喱粉+辣椒；沙姜粉→生姜）。
- 校验：无无效引用、build 通过、回归 9/9。

### 修复错位后清出 66 个未用材料 → 补消耗出口（最终闭环）
> 修正 cooking/baking/brewing/preserving/spiceMixing 错位配方后，原被硬塞的野味肉/芜菁/菱角/柴胡/女贞子/沙丁鱼等失去配方用途（未用=66）。
- 野味肉（hunting_ext 01~28 / hunting_ext2 01~28，共 55 种）→ 新增烹饪菜品 `wildDish_1~55`（红烧/香煎/干煸/碳烤/椒盐…+肉名，材料=肉×2+盐矿+酱油）。
- 水果（桃子/李子/杨桃）→ 酿造果汁 `brewFix_1~3`（材料×3+清水）。
- 鱼（沙丁鱼/鲱鱼/鲷鱼/河豚）+ 根茎（芜菁/菱角）→ 烹饪 `wildDish_55x` 清炒菜（材料×2+盐矿+生姜/大蒜）。
- 药材（柴胡/女贞子）→ spiceMixing 药膳粉 `spiceFix_1~2`（材料×2+盐）。
- 最终：**未用采集材料 = 0**，无无效引用，配方总数 789，使用材料 388，build 通过，回归 9/9。
- **第二轮逻辑校验全部完成**。

## 第三轮：全面复查（audit_full.mjs）
- 重复 recipe id：0。
- **配方 output 物品不存在：初查 66（新增野味菜/果汁/药膳粉的 recipe 引用了未写入 items.js 的 item id，因生成脚本锚点缩进不匹配静默失败）→ 已修复（补插 66 个 item 定义），复核 0**。
- 采集目标产出物品不存在：0。
- 重复采集/双校验：未用采集材料=0，无无效引用。
- 等级覆盖：各技能存在稀疏缺级（如 cooking 缺18、baking 缺60、preservation 缺78），属正常放置游戏稀疏等级设计；成品 reqLevel 均 ≥ 其材料采集等级，不造成"做不起"。
- 结论：双向完整性 + 逻辑相关性均通过；`vite build` 通过，回归 9/9 通过。

## 第四轮：加工品「产出→再消耗」下游打通（68 个 ingredient 型加工品）
> 对只被产出、未被更高阶配方耗费的 ingredient 型加工品（咸蛋/各果酱/果脯/酱油膏/甜面酱/腊味等）补齐下游，形成完整制作链条。
- 果酱/果脯/蜜饯/炒货/馅料（26 个）→ 新增烘焙糕点 `bakeDown_1~26`（主材=加工品×2+面粉/稻米，产出 food 甜点）。
- 调味酱/油/醋（21 个）→ 新增 `cookDown_*` 拌面类主菜（主材=加工品×2+面粉+盐矿）。
- 咸腌/腊味/蛋/鱼/酱货（20 个）→ 新增 `cookDown_*` 煲仔饭类主菜（主材=加工品×2+稻米+盐矿）。
- 化石食材 fossilIngredient → 新增 `fossilSpice` 化石秘香粉（spiceMixing，主材=化石×2+盐）。
- 校验：未用作原料的 ingredient 从 68 → **0**；无无效引用、未用采集材料=0、output 物品=0 缺失、重复 id=0；配方总数 789→857，使用材料 388→456；`vite build` 通过，回归 9/9。
- **全部制作链条（基础原料→加工品→菜品/糕点）已闭环**。

## 第五轮：UI 显示修复（材料名 / 图鉴分类英文 / 相关页面同步）
> 用户反馈：制作界面部分材料只显示 0/1 不显示材料名；图鉴部分分类名是英文。
### 问题1：制作界面材料名缺失
- 根因：6 个配方（wildDish_551~556）的 ingredients 里把 `生姜`/`大蒜` 写成了中文 id（gen_rest 脚本 aux 参数笔误），`getItem('生姜')` 返回 null → 材料名为空 → 只显示数量 0/1。
- 修复：CookingSkill.js 中 `生姜→ginger`、`大蒜→garlic`（共 6 处）。
- 校验：配方引用中文 id 材料数 0；缺 name / 不存在材料 0。
### 问题2：图鉴分类名英文
- 根因：新增原料使用了 6 个未映射的英文 category（flower/herb/dairy/drinkBase/legume/spicePlant），`CATEGORY_LABEL` 未覆盖→ 二级筛选/物品网格直接显示英文。
- 修复：itemDetail.js `CATEGORY_LABEL` 补 `flower→花卉 / herb→香草 / dairy→乳品 / drinkBase→饮品基底 / legume→豆类 / spicePlant→香料植物`。
- 另修复 SearchModal.vue 物品行直接显示 `it.category` → 用 `CATEGORY_LABEL[it.category] ?? it.category`（引入 CATEGORY_LABEL）。
### 问题3：相关页面同步
- 复核 InventoryModal / ItemDetailModal / AlchemyView / ShopView / ZhenXiuView / GatheringView 等，分类/类型均已走 CATEGORY_LABEL/TYPE_LABEL 映射；配方分类 35 个未映射项均为中文（原样显示无误）。
- 校验：item type 未映射 0、英文 category 未映射 0；新增 66+ 个成品（wildDish/bakeDown/cookDown/brewFix/spiceFix/fossilSpice）均正常渲染名称/分类。
- `vite build` 通过，回归 9/9 通过。

## 第六轮：炼金页面同步
> 用户反馈"炼金页面没同步"。
- 问题1（name 英文）：alchemy.js 中 173 个炼金配方 `name` 为英文 id（`fishing_ext_03→fishing_ext_04`）→ 全部中文化为 `鳕鱼→比目鱼` 风格。
- 问题2（重复 id）：alchemy.js 存在重复配方 id `al36`、`al37` 各出现 2 次（保鲜剂链 与 fishing_ext 链冲突）→ 已重编为唯一 id。
- 问题3（分类排序失效）：AlchemyView `CAT_ORDER` 用英文 category，但分段 label 是中文 → `indexOf` 恒 -1 排序失效；改为按 out 物品的英文 category 排序。
- 校验：炼金重复 id=0；in/out 引用材料/产物不存在=0；中文 id 材料=0；name 全中文。`vite build` 通过，回归 9/9。

## 第七轮：炼金覆盖全类别
> 用户反馈炼金未覆盖到所有 海鲜/肉类/水果/蔬菜/根茎/矿物/菌类/腌制品/复合调料/茶饮/烘焙品/加成/酒类 等类别。
- 方案：为 ITEMS 中每个 ≥2 个物品的类别，按 tier/value 升序建立「相邻融炼链」（a→b，in {a:2}，out b），跳过已存在的链，补齐缺失覆盖。
- 自动生成 1554 条炼金链，覆盖 35 个类别。各类别覆盖达成：海鲜73、肉类70、水果62、蔬菜21、根茎41、矿物30、菌类7、腌制品150、复合调料46、茶饮46、烘焙品69、加成29→30、酒类44、果汁37 等（单物品类别如蛋/乳品/化石无法成链）。
- 校验：炼金重复 id=0、in/out 引用不存在=0、全类别无缺漏；`vite build` 通过，回归 9/9。

## 第八轮：炼金平衡性调整
> 用户反馈需调整炼金的转换数量与额外需求物品。
- 原状：1749/1762 条炼金配方统一「单材料×2」，导致相邻档 value 相近时投入≈2×产出（明显失衡）、54 条"白嫖"。
- 调整：按 `round(产出价值/投入价值)` 重算主材料数量（保证不白嫖、clamp 1~50），使投入≈产出（换省采集时间的效率）。
- 额外需求：对产出价值 ≥180 的高端配方添加 `saltOre` 催化辅料（`floor(价值/160)`，≥1），体现高端融炼需催化。
- 结果：主材料数量分布 1~8（苹果→胡萝卜 2、铁矿→灵果 14、桂皮→藏红花 3 等）；1036 条高价值链含盐矿催化（松茸→松露 需盐矿×1、人参→龙根 需盐矿×1）；"白嫖"(投入<产出) 从 54 → 0；单材料数 726、多材料(含催化) 1036。
- 校验：炼金重复 id=0、in/out 引用不存在=0；`vite build` 通过，回归 9/9。

## 第九轮：提高装备转换成本（炼金）
> 用户反馈需提高装备（equipment）在炼金中的转换成本。
- 规则：对 out 为装备（equipment 类型）的炼金链，主材料数量在原平衡基础上**额外 ×1.4（向上取整）**，且盐矿催化需求**额外 +1**，使装备融炼明显更贵。
- 结果：484 条装备链全部达到"投入>产出×1.35"（昂贵），无低性价比白嫖链。例：铜刀×2→×3、寒铁刀×8→×12、精金刀×2→×3、龙鳞刀盐矿+1 等。
- 校验：装备链无白嫖、成本显著提升；`vite build` 通过，回归 9/9。

## 第十轮：移除炼金中的装备类
> 用户反馈要直接把炼金中装备的去掉。
- 删除 alchemy.js 中所有 **out 为装备 或 in 含装备** 的炼金配方（共移除 484 条，这些均为「装备→装备」相邻链）。
- 结果：炼金配方 1762 → **1278**，out 为装备 0、in 含装备 0（装备已完全退出炼金，炼金只保留食材/材料/加工品的融炼链）。
- 校验：重复 id=0、in/out 引用不存在=0；`vite build` 通过，回归 9/9。

## 第十一轮：赛季页面文案同步
> 用户反馈赛季页面出现"制作 鹌鹑"，应为不对（鹌鹑是采集材料，不是制作物）。
- 全量检查季节任务 kind 与 param 的类型匹配，发现两类错配：
  ① 采集材料被标成 craft/harvest（"制作 X"/"收获 X"）：17 季共 34 个任务（蜜香/柑橘/板栗/雾凇/翠竹/碧波/松涛/踏雪/紫茄/羊汤/银杏/芋泥/芝麻/红椒/琼浆/浴火凤鸣/龙腾）→ 改 kind='gather'，name 前缀"制作/收获"→"采集"。
  ② 制作品被标成 gather/harvest（"采集 X"/"收获 X"）：blossom/mooncake2/grape 3 季共 9 个任务（龙息烤全龙/南瓜汁/生姜茶/菠萝汁/山药汁/米醋/白胡椒粉/姜粉/万能高汤粉）→ 改 kind='craft'，name 前缀"采集/收获"→"制作"。
- 保留：galaxy s20m3"采集 金龙鱼"（金龙鱼为钓鱼稀有掉落，算采集）。
- 校验：craft 任务引用非制作物=0、harvest 非农耕=0、gather 非采集物仅剩金龙鱼（合理）；`vite build` 通过，回归 9/9。

## 第十二轮：每季任务覆盖 5 类（采集/制作/对决/首领/餐厅收入）
> 用户要求每个赛季任务都应覆盖 采集/制作/对决/首领/餐厅收入 5 类。
- 检查发现 34 个赛季存在类型缺漏（缺 restaurant 10 季、缺 craft 17 季、缺 gather 7 季、缺 boss 2 季等）。
- 在 seasons.js 运行时补齐逻辑（覆盖全部 40 季，含 expansion2 合并的新季）：遍历每季，缺失的 gather/craft/combatWin/boss/restaurant 类型自动补入一个任务（gather→采集物、craft→可制作物、boss→真实首领、restaurant/combatWin→'any'）；任务 id 唯一、points/qty 由既有校准循环重算。
- 结果：**缺覆盖季节 = 0**（每季均含 5 类）；总任务 356；校验问题数 0（craft 非可制作物 0、gather param 不存在 0、boss 首领不存在 0）、重复 id 0。
- `vite build` 通过（1.63s），回归 9/9。

### 修复：补齐任务显示 +0 赛季点
- 根因：补齐逻辑原插在「任务点数校准循环」之前并被 push 到 missions 末尾，导致 `seasons.js` 的"最后任务校准"（`missions[last].points += 1115 - sum`）把补齐任务当作最后一个任务过度削减为其 points 变 0。
- 修复：把补齐逻辑移到校准循环之后，points/qty 固定（points 用该 kind 标准值 130/150/170；gather/craft qty 5000、boss 1、combatWin 20、restaurant 5000），不再参与 1115 校准。
- 结果："+0 点"补齐任务 = 0；每季仍覆盖 5 类（缺覆盖季节 = 0）。`vite build` 通过（1.68s），回归 9/9。

## 第十三轮：赛季任务「前往对应界面」跳转按钮
> 用户要求给赛季任务增加跳转到对应界面的按钮。
- SeasonView 任务行新增「前往」按钮，按任务 kind 跳转：
  - gather → 技能页并设对应采集技能（seafood→垂钓、meat→狩猎、root/mineral/fungus→挖掘、crop→农耕、其余→采摘）。
  - craft → 技能页并设对应制作技能（spice→调料调配、drink→调酒、pickled/sauce→腌制、甜点/baking→烘焙、equipment→厨具锻造、其余→烹饪）。
  - combatWin/boss → 对决技能界面（CombatView，含对决区域与首领列表）。
  - restaurant → 餐厅界面。
  - explore → 美食探索；harvest → 农耕。
- 按钮标签按类型：去采集/去制作/去对决/去打首领/去餐厅/去探索/去收获。
- `vite build` 通过（1.65s），回归 9/9。

## 第十四轮：图鉴物品「获取来源」点击跳转
> 用户要求图鉴中物品的获取来源也加上点击可跳转。
- ItemDetailModal 的「获取来源」列表：每条来源若可识别为某界面，渲染为可点击链接（带 ↗），点击跳转并关闭弹窗。
- 来源关键词识别 → 跳转：采摘/垂钓/狩猎/挖掘/农耕→对应采集技能页；烹饪/烘焙/腌制/调酒/调料/锻造/保鲜→对应制作技能页；商店/购买→商店；赛季→赛季页；BOSS/首领/击败→对决技能页(CombatView)；炼金→炼金页；成就→图鉴；契约/食灵→食灵召唤；探索→美食探索。
- 样式：`.src-link`（主色下划线可点击）。`vite build` 通过（1.72s），回归 9/9。

## 第十五轮：框背景改为毛玻璃质感
> 用户要求游戏界面所有涉及"框"的背景改为毛玻璃（glassmorphism）。
- 将通用"框"类背景从 `var(--card)`（不透明 #fffdf9）改为毛玻璃：`background: rgba(255,251,244,0.72) + backdrop-filter: blur(18px)`，覆盖：
  - `.card`（主要卡片容器）
  - `.slot-card`（装备槽位卡）
  - `.item-card`（物品卡）
  - `.plot-select`（农耕地块）
  - （`.modal` 弹窗此前已是毛玻璃）
- 保留 `.btn` / `.top-nav`（按钮/导航非"框"，不改为避免影响可读性）。
- 子元素框（gather-card/opp-row 等）为透明背景叠在 `.card` 上，随父容器呈现毛玻璃。
- 校验：`var(--card)` 仍存在于 `.btn`/`.top-nav`；`vite build` 通过（1.65s），回归 9/9。

### 修正：毛玻璃应为「按钮」质感（参考开始游戏按钮）—— 所有框统一
> 用户澄清"我是要求开始游戏按钮那种毛玻璃质感"，且"**所有框都要**"。
- 毛玻璃采用与开始游戏按钮一致的质感：半透明玻璃底 + `backdrop-filter: blur` + 半透明白描边。
- 应用到全部"框"：`.card` / `.slot-card` / `.item-card` / `.plot-select` / `.gather-card` / `.opp-row`（统一 `background: rgba(255,251,244,0.55)` + `blur(14px)` + `border: 1px solid rgba(255,255,255,0.45)`）。
- 按钮 `.btn`/`.btn-primary`/`.btn-danger` 上一轮已改毛玻璃（白 0.55 / 主色 / 红 0.78 + blur10 + 白描边）。
- `vite build` 通过（1.68s），回归 9/9。

## 第十六轮：主内容区背景用启动页背景
> 用户要求中间区域（主内容区）背景也用启动页背景（`/images/bg-start.jpg`）。
- 给 `.app-main`（主内容容器）设置 `background-image: url('/images/bg-start.jpg'); background-size: cover; background-position: center; background-attachment: fixed;`，与启动页 `.splash-bg` 一致。
- 毛玻璃框（card/gather-card/opp-row 等）叠在此背景上，透出磨砂效果。
- `vite build` 通过（1.72s），回归 9/9。

## 第十七轮：中间区域问题修复（对照截图）
> 用户截图显示炼金视图中间区域有问题。
- **问题1：炼金卡片无图时空白**——材料/产物图缺失时 `itemImage()` 为空、`img` 不渲染且无占位，卡片显得空、内容稀疏。→ 炼金卡片材料图与产物图改复用 `ItemImg` 组件，无图时显示**物品名首字占位**（`.item-img-placeholder`），卡片内容饱满。
- **问题2：毛玻璃卡片太透、文字在复杂背景图上难读**——框背景 `rgba(255,251,244,0.55)` 在启动页背景（bg-start.jpg）上文字对比度不足。→ 全部框（`.card`/`.gather-card`/`.opp-row`/`.slot-card`/`.item-card`/`.plot-select`）背景不透明度 0.55→0.80，保留 `blur(14px)` 毛玻璃质感，文字清晰可读。
- `vite build` 通过（2.99s），回归 9/9。

### 中间区顶部文字看不清
- 根因：顶部「快速筛选：海鲜/肉类/水果…」等是 `.btn`，其毛玻璃背景 `rgba(255,252,246,0.55)` 在背景图上偏透，文字对比不足。
- 修复：`.btn` 背景不透明度 0.55→0.85（保留 blur(10px)），按钮文字在背景图上清晰。`vite build` 通过（1.72s），回归 9/9。

### 中间区顶部文字看不清（再修）
- 仍不行 → 根因：中间内容区整体叠在复杂背景图上，框内外的裸标题/说明/筛选标签文字对比度均不足。
- 修复：给内容滚动容器 `.main-scroll` 加**磨砂底** `background: rgba(255,251,244,0.78) + blur(10px)`。中间所有内容（框内外文字、按钮、标题）都叠在稳定浅色磨砂层上，文字清晰，背景图透出氛围。`vite build` 通过（1.69s），回归 9/9。

## 第十八轮：框未选中也要有细边框线
> 用户要求所有"框"未被选中时也有细细的边框线。
- 根因：改毛玻璃时把框边框换成了半透明白 `rgba(255,255,255,0.45)`，在浅色磨砂底上几乎看不见（白上加白）。
- 修复：`.card`/`.slot-card`/`.item-card`/`.plot-select`/`.gather-card`/`.opp-row` 边框改回 `1px solid var(--border)`（#e6d4c3 浅棕细线），未选中状态即有清晰细边框，选中/悬停时再加深。`vite build` 通过（1.73s），回归 9/9。

## 第十九轮：弹窗背景改为开始按钮那种毛玻璃
> 用户要求所有弹窗背景也应是"开始游戏按钮那种毛玻璃质感"。
- 根因：通用弹窗类 `.modal` 背景原为不透明 `var(--card)`，非毛玻璃。
- 修复：`.modal` 背景改为毛玻璃：`background: rgba(255,252,246,0.55)` + `backdrop-filter: blur(20px)` + 半透明白描边 `rgba(255,255,255,0.5)` + 柔和阴影（圆角/尺寸不变）。所有弹窗（背包/物品详情/数量/存档/搜索/签到/选档/装备/弹药告警/统计等）均继承 `.modal`，统一呈现毛玻璃质感。
- `vite build` 通过（1.62s），回归 9/9。

## 第二十轮：左/中/右导航栏背景也做毛玻璃
> 用户要求左边导航栏、中间导航栏（顶部）、右边导航栏背景也设置成毛玻璃质感。
- 顶部导航 `.top-nav`：背景 `var(--card)` → `rgba(255,252,246,0.7)` + `blur(10px)`。
- 左侧边栏 `.app-sidebar`、右侧状态面板 `.app-status`：背景 `var(--sidebar-bg)` → `rgba(255,252,246,0.7)` + `blur(10px)`。
- 三处均为浅色毛玻璃，保持深色文字可读；与主内容区 `.main-scroll` 磨砂底统一质感。`vite build` 通过（1.62s），回归 9/9。

### 调整：左右导航栏背景用启动页背景+同中间区模糊
> 用户要求左右导航栏背景用启动页背景（bg-start.jpg），与中间区域相同的模糊处理。
- `.app-sidebar` / `.app-status` 背景改为 `url('/images/bg-start.jpg') cover/center`，并加 `position: relative`。
- 追加 `.app-sidebar::before / .app-status::before` 白磨砂层（`rgba(255,252,246,0.7)` + `blur(15px)` + `pointer-events:none`），模糊启动页背景图，效果与中间区 `.main-scroll` 磨砂一致。
- 内容绘制在磨砂层之上，文字保持可读；导航/面板点击不受影响。`vite build` 通过（1.72s），回归 9/9。

### 修复：左侧导航栏文字不显示
- 问题：`.app-sidebar::before` 白磨砂层可能盖住导航文字。
- 修复：追加 `.app-sidebar > *, .app-status > * { position: relative; z-index: 1; }`，把内容（导航项/文字）置于白磨砂层之上。`vite build` 通过（1.66s），回归 9/9。

### 左侧导航栏背景替换为用户提供的壁炉厨房图
- 用户提供图片（壁炉厨房场景），复制到 `public/images/bg-sidebar.png`。
- 将 `.app-sidebar` 的 `background-image` 由 `/images/bg-start.jpg` 改为 `/images/bg-sidebar.png`（保留 cover/center + `::before` 白磨砂层 + 内容 z-index:1）。`vite build` 通过（1.76s），回归 9/9。

### 左侧导航项未选中也有白色毛玻璃背景
- 修复：`.skill-item`（侧栏导航项）默认背景由 `transparent` 改为白色毛玻璃 `rgba(255,252,246,0.55)` + `blur(10px)` + 细边框 `1px solid var(--border)`；未选中即显示白色毛玻璃底，hover 浅主色、选中主色实底白字。`vite build` 通过（1.65s），回归 9/9。

### 左侧导航项：未选中/选中均毛玻璃更透明 + 虚线分隔
- 未选中 `.skill-item`：`rgba(255,252,246,0.30)` 更透明 + `blur(12px)` + 虚线边框 `1px dashed rgba(74,47,38,0.28)`。
- 选中 `.skill-item.active`：半透明主色毛玻璃 `rgba(217,90,56,0.25)` + `blur(12px)` + 主色虚线边框 + 主色文字（不再白字实底）。
- hover：半透明毛玻璃 `0.5` + 主色虚线边。
- `vite build` 通过（1.66s），回归 9/9。

### 顶部导航栏用相同方法（毛玻璃透明 + 虚线分隔）
- `.top-nav-btn` 与 `.skill-item` 一致：未选中 `rgba(255,252,246,0.30)` + `blur(12px)` + 虚线边框 `1px dashed rgba(74,47,38,0.28)`；hover 半透明 0.5 + 主色虚线；选中半透明主色毛玻璃 `rgba(217,90,56,0.25)` + 主色虚线 + 主色文字。`vite build` 通过（1.81s），回归 9/9。
- fruit（23）→ 果酱/果干/果脯/果酒。
- root（剩余）→ 煲汤/炖品/腌制。
- vegetable（西兰花/生菜/苤蓝）、seafood（56）、meat（4）、mineral（25）→ 对应技能成品。

## 炼金页面进页卡顿优化（2026-08-27）
> 用户反馈炼金页面每次进入卡顿约 1 秒。
- 根因：炼金配方 1278 条，`AlchemyView` 默认展开所有分类，一次性渲染上千张卡片（每张含材料/产物图 + 文字 + 按钮），DOM 节点巨大。
- 优化：默认只展开第一个分类——`collapsed` 初始化时把其余分类加入折叠；模板 `gather-grid` 用 `v-if`，折叠分组不创建任何卡片。进页首屏只渲染单分类约 1/10 的卡片量，大幅降低卡顿。
- `vite build` 通过（1.72s），回归 9/9。若仍偏卡可再按分类分页/懒渲染。
