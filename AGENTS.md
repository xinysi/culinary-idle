# AGENTS.md — 项目约定与须知

## 🚨 最高级别铁律（2026-09-08 用户重申，优先于本文其余全部条款）

### 0. 备份绝不能失控：禁止无限备份、禁止无限套娃文件夹
- **备份目录 `D:\plays\lmew_beifen` 总容量上限 10 GB**；一旦超过，**直接删除最旧的备份**（`rm -rf`，**绝不允许放回收站**）。
- **绝不允许产生无限套娃的文件夹**：`wuguan/node_modules/culinary-idle` 是指向 `D:\plays\lmew` 的**自引用 junction**，任何递归复制必须加 `/XJ` 排除 junction/符号链接；**禁止**用 `/MIR` 清理含 junction 的目录。
- 备份前先看目标目录文件数（正常约 2 万；出现几十万即已套娃）与磁盘剩余空间，发现异常立即停止并删除。
- 备份只覆盖源码与资源（`src`/`public`/`scripts`/根目录文件/`dist`），排除 `node_modules` 与 `wuguan` 构建产物。

## ⚠️ 强制规则（违反会造成不可逆数据损坏）

### 1. 每次修改文件前，必须先备份整个项目
- 任何批量修改、重写、重构、编码转换前，**第一步**必须把项目完整备份到项目目录之外，**固定目标目录：`D:\plays\lmew_beifen`**（可用时间戳子目录），确认备份成功后再操作。
- 涉及 11+ 个文件的批量改动，尤其必须在改动前做全量备份。
- **必须排除 junction / 符号链接**：`wuguan/node_modules/culinary-idle` 是指向 `D:\plays\lmew` 的**自引用 junction**，普通递归复制会无限套娃（曾把备份撑到 67 万文件 / 数十 GB）。
  - 正确命令（Git Bash 下需禁用参数转换）：`MSYS2_ARG_CONV_EXCL="*" robocopy "D:\plays\lmew" "D:\plays\lmew_beifen\<时间戳>" /E /XJ /MT:16 /NFL /NDL /NJH /NJS /R:1 /W:1`
  - `/XJ` = 排除 junction/符号链接；**不要**用 `/MIR` 对含 junction 的目录做清理。
- **备份目录总容量上限 10 GB**（用户 2026-09-08 明确要求）：超过就直接删除最旧的备份（`rm -rf`，**不要**放回收站）；备份前先确认剩余空间。
- 备份只需覆盖源码与资源（`src`/`public`/`scripts`/根目录文件/`dist` 等），`node_modules`、`wuguan` 里的构建产物可排除；确认 `src` 与 `public` 文件数与源一致即可。

### 2. 文件编码：此项目源文件全部为 UTF-8
- **严禁**使用 Windows PowerShell 的 `Get-Content` / `Set-Content` / `Out-File` 默认编码（系统 ANSI/GBK）读写这些文件，否则中文会损坏为乱码且**不可逆**。
- 仅使用以下安全方式之一读写/替换文本：
  - 文件工具（`read_file` / `write_file` / `edit_file`），它们按 UTF-8 处理；
  - Python 脚本时显式 `open(..., encoding='utf-8')`；
  - 需要转换编码时用 `[System.IO.File]::WriteAllText($path, $s, [System.Text.Encoding]::UTF8)`，读取时一律用 `UTF8` 编码，**不要用 `Encoding.Default`**。
- 修改后务必立即验证：文件仍可被 `utf-8` 无错解码，且无 `\uFFFD`（替换符）残留。

### 3. 编码事故教训（2025 年事故复盘）
- 事件：用 PowerShell 默认 GBK 批量替换颜色，导致 `main.css` + 10 个 `.vue` 文件的中文损坏。
- 根因：PowerShell 5.1 默认用 ANSI/GBK 读 UTF-8 文件；两次"反向转码"进一步破坏字节，最终文件变为非法 UTF-8，必须逐文件重建。
- 正确的恢复手段：`dist/`（构建产物）保留完整干净字符串，可作对照；但源码 `.vue` 结构只能靠"结构完好 + 上下文补字"逐文件重建，代价极高。
- **避免一切可能导致编码混乱的操作**；不确定编码时先在小样本上验证，绝不批量套用。

### 4. 🔒 数据铁律（最高优先级，勿再违反）
- **采集、制作的材料等级、物品等级、物品的配方（reqLevel/材料）、物品的效果数值，一律视为「已固定」**，任何功能都**不得**去改动它们。**「食材保鲜」同样纳入本铁律**：保鲜材料等级、保鲜配方（reqLevel/材料）、保鲜物品等级、保鲜效果数值也一律固定、不可改。
- **「料理对决」全部敌人数据同样纳入本铁律**：对决页面（`src/game/data/combat.js`，含普通区域敌人与首领 BOSS）的**敌人等级、各项属性（hp/atk/acc/def/eva/crit/speed）、掉落物（drops 的 itemId/chance/qty）、机制（mechanic）**，经本轮按采集/制作曲线定级平衡后，一律视为「已固定」，任何功能都**不得**再去改动它们；新增/修改功能对对决数据的引用只能「向上兼容」。
- **「食灵召唤」全部数据同样纳入本铁律**：食灵本体（`src/game/data/spiritTiers.js` 的 `SPIRITS`/`SPIRIT_TIER`/`ITEMS_SUPPLEMENT`、`spirits.js`）的**reqLevel、契约材料（contract 的 itemId/数量）、效果（effect）**，以及食灵契约配方（`SpiritSummoningSkill.js` 的 `SPIRIT_RECIPES`：reqLevel/ingredients/xp/successChance），经本轮契约材料按全物品等级多样化平衡后，一律视为「已固定」，任何功能都**不得**改动它们；新增/修改功能对食灵数据的引用只能「向上兼容」。
- **「美食知识」（美食奥义）全部数据同样纳入本铁律**：`src/game/data/aojis.js` 的 `AOJIS`（32 种奥义）的 **id、name、category、desc、costPerSec、effect（dmgPct/styleDmgPct/defensePct/speedPct/maxHpBonus/yieldPct/xpPct/healPct）**，一律视为「已固定」，任何功能都**不得**改动它们；新增/修改功能对美食奥义数据的引用只能「向上兼容」。
- **「美食探索」全部数据同样纳入本铁律**：`src/game/data/explorationTargets.js` 的 `EXPLORATION_TARGETS_ALL`（200 个探索目标，生成器 `gen_exploration_targets.mjs` 产出，勿手改）的 **id、name、reqLevel（卡片等级）、intervalSec/xp/baseSuccess/failGold、loot（战利品 itemId/min/max/chance）**，经「战利品按等级带匹配全物品库」（200 目标/500 条件品掉落，已审计无超纲）后，一律视为「已固定」，任何功能都**不得**改动它们；新增/修改功能对美食探索数据的引用只能「向上兼容」。
- **「赛季」全部数据同样纳入本铁律**（含赛季装备与赛季玩法规格，`src/game/data/seasons.js` + 动态内容 `seasonContent.js`）：
  - **赛季限定装备**（`seasons.js` 的 `SEASONS`，每季 `limitedItem` 单件 + `limitedItems` 8 件 gear 套，共 40 季 360 件；`expansion_gear.js` 的 `SEASONS_GEAR`、`expansion2.js` 的 `SEASONS_EXT2`）的**装备 id、名称、槽位、品质、数值（`items.js` 的 stats，经 `itemBalance.js` 的 `SEASON_LEVEL`/`SEASON_ACCENT` 按全装备 Lv75×1.25 曲线与赛季特性差分平衡）**——已固定，不得改动；图鉴「赛季」页仅展示/回用，不得改写数值。
  - **赛季奖励档位结构**：每季固定 10 档，每档点数 = 20/40/60/…/200（累计总和 1100，`seasons.js` tiers）。**档位点数与档位数不可改**。
  - **赛季任务构成**：`seasonContent.js` 的 `seasonMissions` 生成**恒 10 个任务**（采集×4 + 制作×2 + 美食探索 + 击败首领 + 对决胜利 + 餐厅累计），任务 id 固定为 `${seasonId}_m1~m10`，`kind`/`param` 需保证 `bumpSeason`/`syncSeasonProgress` 能正确累计进度（gather/craft 的 param 必须是存在物品，boss/combatWin/explore/restaurant 的 param='any'）。
  - **赛季点数平衡规则**：领取采用「积分兑换扣费」语义（`player.seasonClaimTier` 领档扣点），因此**任务总点数必须 ≥ 十档点数总和 1100**（当前 `TARGET=1120`，含冗余），按任务价值权重分配，保证玩家能买满全部 10 档。**任务总点数不得低于 1100**，否则档位无法领满。
  - **赛季主题映射**：`SEASON_THEME_ITEMS`（40 季 id → 契合主题的 gather/craft 物资池）决定任务目标与奖励主题食材，属设计基准；引用只能向上兼容，不得为迁就其它系统改动物资池或赛季结构。
  - 注：**任务的具体数量(qty)/单任务点数**属于可调的平衡量（可按需调整），但**不得**破坏上述结构、档位点数与「总点数≥1100」的铁律约束。
- 任何**新增/修改的功能**（如探索、图鉴、平衡、掉落、商店、存档、故事/任务/成就等）对上述固定数据的引用，**只能「向上兼容」**：即新功能去适配、读取、围绕这层固定数据做匹配，而**绝不能反过来修改这层数据本身**。
- 典型反面教训（2026-09）：为迁就「美食探索」重新生成探索掉落，曾改动物品等级口径/连锁改变配方等级与效果曲线，导致材料-产物失衡、效果倒挂。正确做法是**探索等新数据去匹配采集/制作/食材保鲜的真实等级**，而不是动它们。
- 判断标准：改动前先问「我改的是『固定数据』还是『引用它的功能』？」——需改功能，不改固定数据。拿不准时，先向用户确认，不许擅自改固定层。
- 🔒 **「竞技场」玩法铁律（2026-09 新增，`src/views/ArenaView.vue` + `src/game/data/arena.js`）**：竞技场是「其他玩家镜像」本地竞技，其**镜像对手**（`arena.js` 动态生成，非 `combat.js` 的 COMBAT_REGIONS/COMBAT_BOSSES 铁律敌人）与以下**玩法规格**经本轮逐一确定后一律固定，任何功能不得改动、不得回退（只可向上兼容）：
  - **刷新周期 = `5 分钟`**（`REFRESH_MS = 5 * 60 * 1000`），刷新机制（`localStorage['culinary-idle.arena.state']` 持久化 `{ until, opponents, challenged }`；到期才刷新、切页/页面刷新都不重置倒计时）不可回退。
  - **对手强度 ≤ 玩家对决等级**：`generateArenaOpponents` 生成对手等级必须封顶 `Math.min(base, ...)`（`base = player.combatLevel`），**绝不允许**生成超过玩家对决等级的对手；`getOpponents` 复用缓存前必须校验「对手等级 ≤ base」，超限(旧规则残留)即强制重新生成封顶榜单。
  - **同一对手打过一次后不可重复挑战**（`challenged` 集合 + `arena.state` 持久化，刷新才恢复可打）；**每场战斗只结算一次**（`arenaSettled` 标记，防止 `combat:end` 重复消费导致「一次胜利连胜 +2 / 跳 5」）。
  - **每 5 连胜开宝箱**：`player.onArenaEnd` 连胜 `%5 === 0` 触发宝箱（金币 `100×连胜档位` + 神秘调料，10 连胜起 + 能量饼干）；**破纪录奖励不得覆盖连胜宝箱提示**（用 `reward.record` 分离两段，且 `onArenaEnd` 幂等去重）。
  - 改动竞技场任何玩法前，先问「是否触碰上述已固定规格」；拿不准先向用户确认。
- 🔒 **物品「图鉴三查」铁律（2026-09 新增）**：**任何涉及物品获取来源、掉落、产出的改动**（新增/修改采集目标、配方、农耕、商店、探索掉落、赛季/成就/任务奖励、首领/竞技场掉落、炼金、食灵契约材料等），**必须同步全面排查图鉴**（`itemDetailLines` 详细作用 + `itemSources` 获取来源 + 「可用于制作」引用），确保该物品在图鉴里的**详细作用、可用于制作、获取来源**三者都完整、准确、无遗漏。排查不得只改掉落/获取而漏掉图鉴展示；图鉴索引是与掉落/获取同级的必查项（如：竞技场对手掉落的物品，必须在 `itemSources` 里补对应来源，且不改竞技场 `arena.js` 掉落数据本身）。
- 🔒 **「内容同步审计」前置流程（2026-09-10 用户新增，图鉴三查之前必须跑）**：**任何新增功能或调整完成后，必须先运行 `node scripts/content_sync_audit.mjs`（CI 亦执行）**，逐项确认 **任务 / 成就 / 故事 / 称号 / 统计 / 游玩攻略** 六项同步到位：
  - **任务**：全部目标 kind 有处理（`bumpQuest/bumpDaily/bumpSeason/bumpGuild` 事件或 `case` 开关），引用物品/BOSS 存在；
  - **成就**：id 唯一、奖励物品存在、**每个 check 都能在新档上执行且返回布尔**；
  - **故事**：每章需求 kind 有 storyCur 分支、每段标题/正文非空；
  - **称号**：名称全局唯一（成就称号 + 商店称号，防重名误判佩戴）；
  - **统计**：StatsView 引用的每个 `player.stats.*` 字段都有来源（defaultState 或运行期赋值）；
  - **攻略**：总览覆盖全部功能关键词（49 个）、总览条目字段完整、六阶段结构完整、**导航入口均已注册视图**（新增页面漏注册会 FAIL）。
  通过后再跑「图鉴三查」，顺序不可颠倒。
- 🔒 **「图鉴三查」必检流程（2026-09-06 用户重申，升级为每次改动强制项）**：**任何新增功能或调整（含 UI 改动）完成后，必须运行 `wuguan/.toolchain/node/node.exe scripts/item_triple_audit.mjs`（CI 亦执行）**，检查并确保全部物品的 **①详细作用（itemDetailLines）②可用于制作（itemUses，无幽灵产物引用）③获取来源（含跳转缺口）** 无缺失/错误/跳转缺失，另含重名与全系统交叉引用校验。已知炼金幽灵配方基线（62 条，已从 UI/图鉴过滤）只允许为零：**新增引用不存在物品的炼金配方将 FAIL**。新增/修改炼金/图鉴/任务/成就/赛季/掉落等数据时同样先跑此脚本（参考 §「校验习惯」）。

## 项目技术要点
- Vue 3 + Pinia + Vite；源文件在 `src/`；`main.css` 的 `:root` 用 CSS 变量定义主题色板。
- 本机系统 PATH 无 node；使用 `.toolchain/node/node.exe`，运行前先把 `.toolchain/node` 加入 `$env:PATH`。
- `vite build` 输出正常；`player` chunk 超 500kB 的警告为既有现象，非错误。
- 无 `git`、无 `.git` 仓库、无自动备份——**原始源码没有版本控制保护，务必依赖手工备份**。

## 存档机制注意点（重要，勿破坏）
- 存档保存在 localStorage，键形如 `culinary-idle.save.{slot}`（3 存档位 + `schemaVersion`/`player`）。
- **启动界面阶段绝对不能写档**：`saveNow()` 仅在 `gameRunning === true`（已进入游戏）时才写入，否则会把默认空状态覆盖到当前存档位，导致玩家存档被清空（曾实际发生的事故）。
- `registerGameEvents()`（含 `visibilitychange → saveNow()` 自动存档监听）**只在 `startGame` 进入游戏后注册**，`main.js` 挂载时不得注册；否则页面刷新时的 `visibilitychange` 会在启动界面阶段触发 `saveNow()` 覆盖存档。
- 启动流程：`main.js` 只 mount；`startGame`（选存档后）设置 `gameRunning`、注册监听、`ui.phase='game'`。
- 新增游戏相关代码时，务必先运行 `npx playwright test e2e-test.spec.mjs`（覆盖启动界面、选档、弹窗、存档持久化、存档不被覆盖等 9 项）确认无回归。
- 测试环境：`@playwright/test`（chromium 已装），dev server 在 `http://localhost:5173/` 或 `5174/`（可能有两个实例），测试脚本 `e2e-test.spec.mjs`。

## 视觉 UI 规范（毛玻璃 / 背景）
- **全局毛玻璃质感**：框（`.card`/`.gather-card`/`.opp-row`/`.slot-card`/`.item-card`/`.plot-select`）、弹窗（`.modal`）、按钮（`.btn`/`.btn-primary`/`.btn-danger`）、左/中/右导航栏均采用「半透明玻璃底 + `backdrop-filter: blur` + 半透明白描边」。
- **背景图资源**：中间主内容区 `.app-main` 与左右导航栏 `.app-sidebar`/`.app-status` 使用 `public/images/` 下背景图；启动页共用 `/images/bg-start.jpg`，左侧导航栏已替换为 `/images/bg-sidebar.png`（用户提供）。左/右导航栏背景用 `background-image` + `::before` 白磨砂层（`rgba(255,252,246,0.7)` + `blur(15px)` + `pointer-events:none`），并把内容 `z-index:1` 提升到磨砂层之上，避免文字被盖。
- **导航项（侧栏 `.skill-item` / 顶部 `.top-nav-btn`）**：未选中/选中均为透明毛玻璃（`rgba(255,252,246,0.30)` + `blur(12px)`）并用**虚线**边框分隔；选中用半透明主色（`rgba(217,90,56,0.25)`）+ 主色虚线 + 主色文字。
- **文字可读性**：毛玻璃不透明度在复杂背景图上需保证文字对比（内容区 `.main-scroll` 加 `rgba(255,251,244,0.78)` 磨砂底，框背景 0.80、按钮 0.85）。
- 新增物品/配方数据后，运行 `vite build` + `npx playwright test e2e-test.spec.mjs`（9/9）验证；UI 改动同样用回归脚本确认无未捕获控制台错误。

## 数值/配方平衡决策（2026-08 历次调整，务必记住，勿回退）

### 材料等级平衡（`src/game/skills/recipeBalance.js`，严格标准：材料获取等级 ≤ 物品等级 + 5）
- **材料锚** = 直接采集/农垦/探索掉落等级 ∪ **其它配方产物等级**（进阶加工品按产出它的配方最低 reqLevel 计）∪ **嫩替代食材等级**。
- **食谱类**（烹饪/烘焙/腌制/调酒/调料）：`raiseRecipeLevels`——把配方 `reqLevel` 抬到「最高材料锚 − 5」，**不删主料**（保留菜名/风味）。
- **保鲜/锻造/食灵**：`balanceRecipeLevels`——移除「材料锚 > 配方 + 5」的超纲高阶材料；若**全部材料都超纲**则改为**抬升配方等级**（兜底，避免保留超纲、避免清空配方）。
- **食灵契约**（`SpiritSummoningSkill`）应用 `balanceRecipeLevels`。
- **高频通用食材→嫩替代**（`src/game/data/freshMats.js` + recipeBalance 的 `replaceFresh`）：当低等级配方用了超纲的通用蔬果/香料（生姜/大蒜/辣椒/花椒/大豆/白菜/番茄/乌梅/香草/迷迭香/桂皮/八角/花生/蟠桃/草莓/葡萄/南瓜/茄子/西瓜/哈密瓜/猕猴桃/冬瓜/洛神花/龙眼/茉莉花/枸杞 等 27 种），自动替换为低阶可采集的"嫩X"（如嫩生姜），使菜等级保持低；**加工品/高级材料**（腊味/酱料/高级鱼/灵果/龙根/松露/灵芝等）不嫩化，改为抬配方等级。
- **高阶材料不用于低段**：灵果(~90)/松露(~60)/龙根/灵芝等**只用于 ≥ 其等级的高段配方**；**允许高段用低阶材料**（盐矿等）。
- **忽略矿物**：铜矿/铁矿/盐矿/各 `ext` 矿/黄金矿/白银矿等（`category==='mineral'` 或名字含"矿"/`Ore`/`fossil`）**一律不参与判定、不改动**。

### 装备数值平衡（`src/game/data/itemBalance.js`，启动时 `applyItemBalance()` 就地改写 ITEMS）
- **装备**：主属性（attack/defense 等）按**槽位 center(该套等级)** 直接赋值——保证随段单调递增、等级差异明确、无平台、无倒挂。
- **食物/饮品/增益剂**：走平衡组，**同级保留 ±30% 梯度**（名菜略高、简单菜略低），跨段严格单调（整组平移保证不越级）。
- 另给装备补 hpBonus/accuracy/evasion/critChance/speedBonus 的等级递增辅助值。

### 材料/产物价值平衡（`src/game/data/valueBalance.js`，启动时 `applyValueBalance()`）
- 对所有**可采集材料 + 配方产物**（非矿物）的 `value` 夹到「获取等级 × 曲线(2+2.5×级)」的 **±30% 带**，温和随等级递增、保留差异、不对经济造成爆炸。
- 每件物品取"最低获取等级"（采集/农耕/探索 ∪ 配方产物）。

### 经验平衡（`src/game/skills/xpBalance.js`，在技能构造时校准）
- 采集经验基准 `10 + 等级×5`（`applyGatherXp` 作用于采集目标 `xpPerAction`）、制作经验基准 `25 + 等级×13`（`applyCraftXp` 作用于配方 `xp`）。
- 只把低于基准的抬到基准（不降低，不破坏升级节奏），消除"高等级给低经验"的倒挂。

### 农耕种子扩充（`src/game/data/farmSeeds.js`，生成器 `scripts/gen_farm_seeds.mjs`，勿手改产物）
- **覆盖**：所有可采集（采摘 foraging）/可挖掘（挖掘 excavation）的**非矿物**食材（含 expansion1/2 与 27 种嫩食材），共 **184 种**各生成一个种子物品 + 农耕作物条目（可种）。矿物（盐矿/石硝/硫磺/紫石英/各 ext 矿等）一律不加种子。
- **种子物件**（`FARM_SEEDS`）：id=`{食材id}Seed`、name=`{食材名}种子`、type=`seed`、category=`种植产物`；**不配图片**（前端 `itemImage()` 返回空 URL 由 `@error` 隐藏），现有 15 种手写种子已配图的保留不动。
- **作物条目**（`FARM_CROPS`，`FarmingSkill.CROPS = [...15 基线, ...FARM_CROPS]` 按 reqLevel 升序）：`reqLevel` = 对应食材采集等级；`growSec = 90+级×10`；`xp = 25+级×7.5`。
- **value/价格**：种子 `value ≈ 食材 value×0.6`；商店售价 `≈ 种子 value×0.5`（与既有 wheatSeed value10/price5 量级一致）；种子 value 不受 `valueBalance` 平衡（seedId 不在 level 表）。
- **种子来源**：采摘/挖掘本次动作 **10% 概率掉落对应种子**（`ForagingSkill/ExcavationSkill.performAction`，矿物目标自动跳过；`computeOffline` 按期望产出）；采集卡 UI 显示「种子掉落 10% 掉 X」。
- **购买**：`shop.js` 合并 `SHOP_SEED_ENTRIES`（杂货铺 207 条）；珍馐阁遍历 `ITEMS`(type=seed) 自动同步；`ShopView.vue` 复刻珍馐阁式 type tab 分类（全部/弹药原料/肥料/种子/容量扩展）+ 搜索框。
- **映射**：`SEED_MAP`（食材id→种子id）供掉落与卡片提示使用。
- 改动 `farmSeeds.js` 需重跑 `node scripts/gen_farm_seeds.mjs`（勿手改）；生成器用固定基线 15 作物，不读取合并后的 CROPS（避免重跑清空）。

### 厨具锻造"同名矿 == 套品质"（生成器 `scripts/gen_smith_sets.mjs` + `gen_smith_ores.mjs`，勿手改产物 `smithSetExt.js`/`smithOres.js`）
- **20 品质套**（铜1-5…鎏金76-80、钨81-85、锰86-90、钒91-95、萤96-100），每套 8 槽（刀/锅/砧板/围裙/厨师帽/调味瓶/腿甲/靴子/戒指）。
- **材料与套名对应**：钢→鎏金（段4-16）用各自**同名矿**（钢矿 steelOre…鎏金矿 giltOre，由 `gen_smith_ores.mjs` 生成、挖掘可得，等级=套段首级 ≤ 装备+5）；钨/锰/钒/萤用**命名匹配高端矿**（ext2_25/27/28/30）；铜/铁/青铜沿用铜矿/铁矿（本就同名）。
- **21 种独立矿**（紫石英/绿松石/红宝石/祖母绿/钻石/锡/铅/锌/镍/钴/钛/石墨/石膏/硝石/硫磺/明矾/云母/石英/翡翠/玛瑙/蓝晶）各成**完整 8 槽套**（9 件，含手写的戒指/护符那件），命名沿用宝石名/矿名，等级=原配方 reqLevel。
- 命名不加后缀；生成件与既有名牌重名由生成器去重；数值统一由 `itemBalance` 平衡（生成时给占位 1）。
- **注意（重要）**：`gen_smith_sets.mjs` 会 `import ITEMS`，而 `items.js` 已合并上次生成的 `SMITHING_SET_ITEMS`，会造成**自引用污染**（新件因"已存在/重名"被跳过）。**重跑该生成器前必须先清空 `smithSetExt.js`（两个 export 置 `[]`）**，再运行，才能从干净基线重新生成。

### 校验习惯
- **小游戏 UI 改动后必须跑 `node scripts/minigame_ui_audit.mjs`**（24 款 × 11 项静态合规，0 失败为准）；标准见《小游戏UI标准.md》（页面骨架/顶栏胶囊/主区域/按钮/弹窗/配色/深色/交互/文案 + 例外清单）。新增或修改小游戏时先读该标准。
- 改动/平衡后按需重跑生成器：`node scripts/gen_smith_ores.mjs`（同名矿）→ **先清空 `smithSetExt.js` 再** `node scripts/gen_smith_sets.mjs` → `node scripts/gen_farm_seeds.mjs`（农耕）→ `vite build` → `e2e 9/9` → 检查无 `\uFFFD`。
- 审查超纲可临时写审计脚本：材料锚 vs 产物 reqLevel（忽略矿物），三轮（原貌→平衡后→抬升范围/断供）。
- 生成器产物文件（`smithSetExt.js`/`smithOres.js`/`farmSeeds.js` 等）**勿手改**，改后重跑对应生成器。
- **改了生成器/扩充了数据规模后，务必同步维护 `README.md` 与《美食放置：食之契约》设计文档（当前版本）.md 里的对应数字/描述**（物品/装备/食谱/采集目标/作物/矿/种子等），避免文档与实现脱节。
