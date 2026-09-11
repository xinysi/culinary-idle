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
- 🔒 **「内容同步审计」前置流程（2026-09-10 用户新增，图鉴三查之前必须跑）**：**任何新增功能或调整完成后，必须先运行 `node scripts/ci/content_sync_audit.mjs`（CI 亦执行）**，逐项确认 **任务 / 成就 / 故事 / 称号 / 统计 / 游玩攻略** 六项同步到位：
  - **任务**：全部目标 kind 有处理（`bumpQuest/bumpDaily/bumpSeason/bumpGuild` 事件或 `case` 开关），引用物品/BOSS 存在；
  - **成就**：id 唯一、奖励物品存在、**每个 check 都能在新档上执行且返回布尔**；
  - **故事**：每章需求 kind 有 storyCur 分支、每段标题/正文非空；
  - **称号**：名称全局唯一（成就称号 + 商店称号，防重名误判佩戴）；
  - **统计**：StatsView 引用的每个 `player.stats.*` 字段都有来源（defaultState 或运行期赋值）；
  - **攻略**：总览覆盖全部功能关键词（79 个）、总览条目字段完整、六阶段结构完整、**导航入口均已注册视图**（新增页面漏注册会 FAIL）、**左栏每个功能页都要有攻略关键词**（派生检查，见下）。
  通过后再跑「图鉴三查」，顺序不可颠倒。
  - ⚠️ **这条「六项同步」不是「跑一遍脚本看到 PASS」就算完**（2026-09-11 踩过，见设计文档 §11.15）：本项检查原先是**手抄白名单**（`content_sync_audit.mjs` 里那份 `required` 数组），**新系统忘了往里加时该检查恒真、等于不设防**——v1.8.0 加了信箱/厨友就因此整批漏掉（攻略/统计/故事/成就全是 0）。现已叠加**从 `Sidebar.vue` 的 `FEATURE_GROUPS` 派生**的检查：左栏每个功能页都必须在攻略总览里找到对应关键词（叫法不同的在 `VIEW_GUIDE_KEYWORD` 里显式映射）。**新增任何功能页/系统时，除了跑脚本，还要自己确认它在 成就 / 统计 / 故事 / 攻略 里真的有内容**——脚本只能证伪，证不了「你忘了加」。
  - 六项里**任务不需要为新系统补内容**：`quests_extra.js` 是生成器产物（冻结数据，不许手改），且历史先例中所有新系统在 `quests.js`/`quests_extra.js` 里的出现次数都是 0；该项只做「kind 有处理 + 引用有效」的一致性校验。
  - 六项里**成就/称号是联动的**：称号来自「带 `title` 的成就」+ 商店 + 图鉴兑换，所以给新成就配 `title` 就自动进称号页与荣誉殿堂被动，但要注意**称号名全局唯一**（脚本会查）。
- 🔒 **「图鉴三查」必检流程（2026-09-06 用户重申，升级为每次改动强制项）**：**任何新增功能或调整（含 UI 改动）完成后，必须运行 `wuguan/.toolchain/node/node.exe scripts/ci/item_triple_audit.mjs`（CI 亦执行）**，检查并确保全部物品的 **①详细作用（itemDetailLines）②可用于制作（itemUses，无幽灵产物引用）③获取来源（含跳转缺口）** 无缺失/错误/跳转缺失，另含重名与全系统交叉引用校验。已知炼金幽灵配方基线（62 条，已从 UI/图鉴过滤）只允许为零：**新增引用不存在物品的炼金配方将 FAIL**。新增/修改炼金/图鉴/任务/成就/赛季/掉落等数据时同样先跑此脚本（参考 §「校验习惯」）。

## 项目技术要点
- Vue 3 + Pinia + Vite；源文件在 `src/`；`main.css` 的 `:root` 用 CSS 变量定义主题色板。
- 本机系统 PATH 无 node；使用 `.toolchain/node/node.exe`，运行前先把 `.toolchain/node` 加入 `$env:PATH`。
- `vite build` 输出正常；`player` chunk 超 500kB 的警告为既有现象，非错误。
- 无 `git`、无 `.git` 仓库、无自动备份——**原始源码没有版本控制保护，务必依赖手工备份**。

## 存档机制注意点（重要，勿破坏）
- 存档保存在 localStorage，键形如 `culinary-idle.save.{slot}`（3 存档位 + `schemaVersion`/`player`）。
- **主题偏好另存一个全局键 `culinary-idle.theme`（2026-09-10 新增，不是存档位）**：启动界面阶段尚未读档、`player.settings` 还是默认值（`theme:'light'`），
  深色玩家否则会在启动页看到亮色壁纸。故 `App.vue` 在 `ui.phase !== 'game'` 时优先读该键、进游戏后以存档内 `settings.theme` 为准；
  该键只在主题变化时（即进入游戏之后）写入，**启动界面阶段仍然零写入**，不违反下面两条铁律。
- **启动界面阶段绝对不能写档**：`saveNow()` 仅在 `gameRunning === true`（已进入游戏）时才写入，否则会把默认空状态覆盖到当前存档位，导致玩家存档被清空（曾实际发生的事故）。
- `registerGameEvents()`（含 `visibilitychange → saveNow()` 自动存档监听）**只在 `startGame` 进入游戏后注册**，`main.js` 挂载时不得注册；否则页面刷新时的 `visibilitychange` 会在启动界面阶段触发 `saveNow()` 覆盖存档。
- 启动流程：`main.js` 只 mount；`startGame`（选存档后）设置 `gameRunning`、注册监听、`ui.phase='game'`。
- 新增游戏相关代码时，务必先运行 `npx playwright test e2e-test.spec.mjs`（覆盖启动界面、选档、弹窗、存档持久化、存档不被覆盖等 9 项）确认无回归。
- 测试环境：`@playwright/test`（chromium 已装），dev server 在 `http://localhost:5173/` 或 `5174/`（可能有两个实例），测试脚本 `e2e-test.spec.mjs`。

## 视觉 UI 规范（毛玻璃 / 背景）

- **布局骨架：三栏 = 三块独立圆角面板（2026-09-11 重构，取代此前"逐段羽化"的一整套做法）**
  之前的思路是"壁纸整幅一层 + 三栏各自做色纱 + 逐段羽化把接缝抹平"，结果是**一列里叠了四种材质**（顶栏毛玻璃条 / 中区奶油 / 底栏毛玻璃条 / 侧栏色纱），怎么调都"割裂"。现改为：
  | 结构 | 做法 |
  | --- | --- |
  | 壁纸 | 只铺 **`.app-layout`** 一层（亮 `bg-start.jpg` / 深 `bg-start-night.jpg`） |
  | `.app-body` | `padding: 0; gap: 10px` —— 三块面板**贴顶贴底贴左右**（直角矩形，2026-09-11 起不再用圆角），**壁纸只出现在面板之间的 10px 竖缝里** |
  | 三块面板 | 侧栏 `.app-sidebar` / 中区 `.app-main` / 右栏 `.app-status`：统一**直角**（`border-radius: 0`，勿加回圆角）+ 半透明底（侧栏/右栏 `rgba(255,252,246,0.82)`、中区 `0.88`；深色 `rgba(30,21,15,0.82/0.88)`）+ **金色流光描边环**（见下），**都不再有自己的 background-image / 羽化渐变** |
  | 顶栏 / 底栏 | **不再是独立浮块**，而是中区面板内部的上/下分区：`background: none` + 只在靠内容一侧加 `1px` 细分隔线（`.top-nav` → `border-bottom`、`.bottom-nav` → `border-top`）；`.app-main` 的 `overflow: hidden` 让它们被面板圆角裁切 |

  **金色描边环（2026-09-11，静止版）**：用 `::after` + `mask`（`content-box` xor `border-box`）**只画那 2px 的一圈**，
  渐变方向按栏位渐隐——左栏向右渐隐（`90deg`）、右栏向左渐隐（`270deg`）、中区两端渐隐（10%~90% 实）。
  亮色金 `rgba(214,170,84,·)`；深色暗金 `rgba(186,142,62,·)`。

  实测：亮色文字对比 **5.65~11.34:1**、深色 **8.15~11.76:1**；深色体检 22,537 元素全过；滚动帧时长 **16.7ms（60fps）**。
  ⚠️ **环上不要加任何动画（2026-09-11 实测结论）**：`background-position` 流光或 `opacity` 脉动都会让**滚动帧时长从 16.6ms 掉到 44~56ms（~18-23fps）**，
  `will-change: opacity` / `transform: translateZ(0)` 提升**都无效**（mask 层交不给合成器）；关掉动画立刻回到 60fps。要真流光，需改用**真实元素**承载环（模板改造），另行评估。
  ⚠️ 金边实现的四个坑（全部踩过）：
  · **不要用"分层背景 + `background-clip: border-box/padding-box`"画环**：金边层会被裁到整块面板，而半透明面板底盖不住它 → **整块面板染金**；
  · **不要让环挂在滚动容器自己的 `::after` 上**：滚动容器里的绝对定位伪元素会**跟着内容滚走**。因此侧栏改为 `.app-sidebar { overflow: hidden }` + 滚动下沉到 `.app-sidebar > .skill-nav`（头部页签固定住，透明滚动条样式也一并挂到 `.skill-nav`），右栏内容多且自身滚动，环改挂在 `.app-body::after` 上覆盖右列（≤940px 时隐藏）；
  · **右栏金环（`.app-body::after`）用 `inset: 0 0 0 auto`**：贴右边 + 贴顶贴底，与直角面板同形（曾先后踩过：`border-radius: inherit` 让环变直角、`inset: 10px …` 让环上下留缝，两种都对不上面板）。
  深色若要加金色光晕，注意 `e2e-dark` 的"金色光晕过亮"判定：`rgba(232,180,95,·)` / `rgba(240,196,118,·)` 的 **alpha 必须 ≤ 0.35**（环的渐变不受此限，但 box-shadow/text-shadow 受）。
  ⚠️ **深色主题下三块面板的底色必须逐块确认（2026-09-11 事故）**：某次补丁把 `html[data-theme='dark'] .app-status { background-color: … }` 一并删掉了，
  结果**深色下右栏变白底**（左/中栏正常），而当时的深色体检只扫 `.app-* *` 的**后代**、扫不到面板本身，所以没报警。现已把 `.app-main/.app-status/.app-sidebar/.top-nav/.bottom-nav` **本身**也纳入 `e2e-dark.spec.mjs` 的扫描范围（并用"临时放回该 bug"反例验证：逐页报 `light-bg aside.status-panel.app-status`）。
  改深浅色任何一条规则后，**至少确认这三块面板在两套主题下的 computed background 都正确**（一条命令即可：`getComputedStyle` 取 `.app-sidebar/.app-main/.app-status` 的 `backgroundColor`）。
  ⚠️ 关键约束：
  ① **中区面板不要用 `backdrop-filter`**：它是内容（含每帧动画的进度条）的祖先层，祖先上的 blur 会持续重采样背景，实测把主线程压到 ~20fps（`.main-scroll` 早就因此去掉了 blur，别再往 `.app-main` 上加）；
  ② **三块面板共用一套参数**（同圆角/同描边/同透明度量级）——这正是"不割裂"的来源，别单独给某一块换材质；
  ③ 面板透明度别低于 **0.82**（更低时画面透得太实，行与行浓淡不一、整栏"发花"；0.62 时踩过）；
  ④ **`button:focus:not(:focus-visible) { outline: none }`** 是必需项：Chromium 默认的粗黑焦点环会出现在点击后的导航按钮上（用户放大截图里一眼可见）。`:focus-visible` 仍保留淡主色描边给键盘导航。
- **滚动条：透明材质（2026-09-11）**：`.app-sidebar` / `.main-scroll` / `.app-status` 的 `::-webkit-scrollbar` 轨道全透明、滑块半透明（亮色深棕 `rgba(110,88,74,0.26)`、深色米白 `rgba(255,246,236,0.22)`，`:hover` 加深），滑块用 `border: 2px solid transparent` + `background-clip: padding-box` 收细。**只留 webkit 伪元素样式**，且注意这三条（2026-09-11 实测踩过）：
  · ⚠️ **绝不能在任何地方写 scrollbar-width / scrollbar-color**：Chromium 121+ 一旦看到这两个标准属性，就**完全忽略全部 ::-webkit-scrollbar-* 样式**。
    项目全局那条 `* { scrollbar-width: thin; scrollbar-color: var(--scrollbar) }` 让三块面板的「玻璃滚动条」**一直没被绘制**——肉眼看到的始终是 `--scrollbar`(#d2b294) 那层米色实心滑块（已删除该全局声明；
    顶栏/分页器等需要**隐藏**滚动条的地方单独写 `scrollbar-width: none` 是允许的，不冲突）。
  · ⚠️ **排查滚动条别只信 `getComputedStyle(el, ::-webkit-scrollbar-thumb)`**：伪元素计算值仍会返回你写的值，但浏览器可能根本不用它绘制（上面那个坑就这样骗过我两轮）。
    判定真实观感要用**像素采样**：在滚动容器右边缘取一条竖带，看颜色是不是目标色（参考：全局米色 #d2b294 / 面板奶油 ≈ rgb(250,248,244)）。
  · ⚠️ **headless Chromium 根本不绘制滚动条**（覆盖式，offsetWidth − clientWidth = 0）；要看滚动条必须用**真实窗口**渲染（Playwright `headless:false`）。
  · 面板滚动条当前形态：滑块**本体全透明**（只留 1px 细棱勾形状——**亮色暖灰棱 rgba(118,94,76,.38)，深色黑棱 rgba(0,0,0,.70)**，深色下用户明确要求黑棱）+ 全圆头 + 四周留白收细；悬停时才给一点极淡体感（深色悬停棱更黑 .85）。
- **响应式断点里的 `display` 规则必须带 `.app-layout` 前缀提权（2026-09-11 已修，勿改回裸选择器）**：
  基础规则 `.sidebar{display:flex}`、`.status-panel{display:flex}`、`.mobile-nav{display:none}` 都声明在 `@media` 块**之后**，与裸选择器同为 (0,1,0) 特指度时由「后声明者」胜出 → 媒体查询里的 `display:none/flex` **全部失效**。
  实测后果（改前）：平板 900px 下右栏**照旧显示**（200×457）且中区被压成半高（900→433）；手机 390px 下右栏**占满屏**（390×396）、左栏 `display` 仍是 `flex`（只靠 grid 高度 0 才没露出来）、**底部导航在任何宽度都不显示**。
  现写法：媒体查询里写 `.app-layout .app-status` / `.app-layout .app-sidebar` / `.app-layout .mobile-nav`（(0,2,0) 稳压基础规则）。**注意 `.app-sidebar` 是网格里那一栏，抽屉里的 `<Sidebar />` 只有 `.sidebar` 类，所以前缀不会误伤抽屉**。
  守卫：`e2e-test.spec.mjs` 的「响应式：平板收起右栏、手机单栏 + 底部导航可用」逐条断言 computed display 与中区高度，并实点底部导航验证抽屉开合。
  ⚠️ 另注：手机上右侧状态栏（挂机/事件日志/快捷状态）**没有任何入口**——媒体查询的设计意图就是单栏隐藏它，底部导航 5 个按钮里也没有它。若以后要让手机能看状态栏，那是**新增功能**（需要给它一个抽屉入口），别靠放开这条 `display:none` 来解决。
- **启动页 / 主内容区 / 左右导航栏 三处壁纸都按主题切换（2026-09-10）**：
  | 位置 | 亮色 | 深色 |
  | --- | --- | --- |
  | 启动页 `.splash-bg` | `bg-start.jpg`（1920×1080） | `bg-start-night.jpg` |
  | 桌面三栏（`.app-body` 单层） | 同上 `bg-start.jpg` | 同上 `bg-start-night.jpg` |
  | 手机端技能抽屉 `.mobile-skills` | `bg-sidebar.jpg`（1080×1920） | `bg-sidebar-night.jpg` |

  规则都写在 `main.css` 的 `html[data-theme='dark']` 权威块里。**都靠「半透明色彩层压在图上」控制可读性**：启动页亮色＝米白柔光 `0.46`+深墨字、深色＝深色渐暗+白字；
  手机抽屉＝米白/暖黑磨砂 `0.50`（`background-position: 22% center` 取景左移）。
  ⚠️ 换壁纸必须重新对一次亮度/取景：标题带平均亮度 < 0.45 才稳（量法见 README「质量保障」的教训段）。

- **压在壁纸上的文字必须实测对比度（2026-09-11）**：导航栏/右栏壁纸透出后，背景亮度会随画面明暗波动（实测 0.51~0.81），小字号文字很容易掉到 4.5:1 以下。
  - **红线：主色橙 `--primary #d95a38` 不可当作「同色相底色上的文字」**——侧栏选中行原本「橙字压橙底」实测仅 **2.05:1**。该场景用新语义色 **`--primary-deep #7a2f16`**（5.0:1）。
  - 已定点加深（勿回退）：`.skill-item.active .dim/.skill-level` → `--primary-deep`；`.skill-cat` → `--text`；`.app-status .dim` → `#5f5148`。深色模式对应规则用浅橙 `#ffb08a`，本就 6.2:1，不需改。
  - **量法（别再靠肉眼或"取最暗 10% 像素"——那对小字严重低估）**：用 Playwright 把 `*{color:transparent}` 后截图，量元素框内的背景中位亮度，再配 `getComputedStyle` 的真实文字色算 WCAG 对比。全套对照见提交说明。
  - 副作用记录：降磨砂（0.80→0.50）会让这类对比整体下滑（如橙色 3.3→2.05），**改磨砂/取景后必须复测**。
- **全局毛玻璃质感**：框（`.card`/`.gather-card`/`.opp-row`/`.slot-card`/`.item-card`/`.plot-select`）、弹窗（`.modal`）、按钮（`.btn`/`.btn-primary`/`.btn-danger`）、左/中/右导航栏均采用「半透明玻璃底 + `backdrop-filter: blur` + 半透明白描边」。
- **背景图资源**：中间主内容区 `.app-main` 与左右导航栏 `.app-sidebar`/`.app-status` 使用 `public/images/` 下背景图（**亮/暗各一张，见上一条主题切换表**）；启动页共用 `/images/bg-start.jpg`。左/右导航栏背景用 `background-image` + 半透明磨砂层，文字在磨砂层之上。
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

### 农耕种子扩充（`src/game/data/farmSeeds.js`，生成器 `scripts/gen/gen_farm_seeds.mjs`，勿手改产物）
- **覆盖**：所有可采集（采摘 foraging）/可挖掘（挖掘 excavation）的**非矿物**食材（含 expansion1/2 与 27 种嫩食材），共 **184 种**各生成一个种子物品 + 农耕作物条目（可种）。矿物（盐矿/石硝/硫磺/紫石英/各 ext 矿等）一律不加种子。
- **种子物件**（`FARM_SEEDS`）：id=`{食材id}Seed`、name=`{食材名}种子`、type=`seed`、category=`种植产物`；**不配图片**（前端 `itemImage()` 返回空 URL 由 `@error` 隐藏），现有 15 种手写种子已配图的保留不动。
- **作物条目**（`FARM_CROPS`，`FarmingSkill.CROPS = [...15 基线, ...FARM_CROPS]` 按 reqLevel 升序）：`reqLevel` = 对应食材采集等级；`growSec = 90+级×10`；`xp = 25+级×7.5`。
- **value/价格**：种子 `value ≈ 食材 value×0.6`；商店售价 `≈ 种子 value×0.5`（与既有 wheatSeed value10/price5 量级一致）；种子 value 不受 `valueBalance` 平衡（seedId 不在 level 表）。
- **种子来源**：采摘/挖掘本次动作 **10% 概率掉落对应种子**（`ForagingSkill/ExcavationSkill.performAction`，矿物目标自动跳过；`computeOffline` 按期望产出）；采集卡 UI 显示「种子掉落 10% 掉 X」。
- **购买**：`shop.js` 合并 `SHOP_SEED_ENTRIES`（杂货铺 207 条）；珍馐阁遍历 `ITEMS`(type=seed) 自动同步；`ShopView.vue` 复刻珍馐阁式 type tab 分类（全部/弹药原料/肥料/种子/容量扩展）+ 搜索框。
- **映射**：`SEED_MAP`（食材id→种子id）供掉落与卡片提示使用。
- 改动 `farmSeeds.js` 需重跑 `node scripts/gen/gen_farm_seeds.mjs`（勿手改）；生成器用固定基线 15 作物，不读取合并后的 CROPS（避免重跑清空）。

### 厨具锻造"同名矿 == 套品质"（生成器 `scripts/gen/gen_smith_sets.mjs` + `gen_smith_ores.mjs`，勿手改产物 `smithSetExt.js`/`smithOres.js`）
- **20 品质套**（铜1-5…鎏金76-80、钨81-85、锰86-90、钒91-95、萤96-100），每套 8 槽（刀/锅/砧板/围裙/厨师帽/调味瓶/腿甲/靴子/戒指）。
- **材料与套名对应**：钢→鎏金（段4-16）用各自**同名矿**（钢矿 steelOre…鎏金矿 giltOre，由 `gen_smith_ores.mjs` 生成、挖掘可得，等级=套段首级 ≤ 装备+5）；钨/锰/钒/萤用**命名匹配高端矿**（ext2_25/27/28/30）；铜/铁/青铜沿用铜矿/铁矿（本就同名）。
- **21 种独立矿**（紫石英/绿松石/红宝石/祖母绿/钻石/锡/铅/锌/镍/钴/钛/石墨/石膏/硝石/硫磺/明矾/云母/石英/翡翠/玛瑙/蓝晶）各成**完整 8 槽套**（9 件，含手写的戒指/护符那件），命名沿用宝石名/矿名，等级=原配方 reqLevel。
- 命名不加后缀；生成件与既有名牌重名由生成器去重；数值统一由 `itemBalance` 平衡（生成时给占位 1）。
- **🔴 自引用污染（2026-09-10 实测踩坑并加固，务必遵守）**：有 **2 个**生成器的产物会被 `items.js` 合并回去，
  于是「不清空就重跑」会让新条目因「已存在/重名」被**全部跳过**：
  1. `gen_smith_sets.mjs` → 产物 `smithSetExt.js`（`SMITHING_SET_RECIPES` / `SMITHING_SET_ITEMS`）
  2. `gen_farm_seeds.mjs` → 产物 `farmSeeds.js`（`FARM_SEEDS` / `FARM_CROPS`）

  **重跑前必须先把该产物的导出清空**（置 `{}` / `[]`），再运行，才能从干净基线重新生成。
  ⚠️ `gen_farm_seeds` 此前**没有任何记录**：直接重跑会**静默生成空文件，把 4057 行产物清空**（2026-09-10 实测已丢一次、已从备份/提交还原）。
  现已给两个生成器都加了**运行时防呆**：算出 0 条就报错中止、不写文件，并在报错里提示清空哪两个导出。
  其余生成器（`gen_expansion*` / `gen_spirit_tiers` / `gen_smith_ores` / `gen_preserve_tiers` / `gen_quests` / `gen_tales` / `gen_restaurant_decor` / `gen_season_gear`）无此陷阱，可直接重跑。
  ⚠️ 但下面「冻结数据生成器门禁」里的两个脚本**不在此列**，重跑有记录在案的风险，先读那一节。

- **🔒 冻结数据生成器门禁（2026-09-10 实测记录）**：有 2 个生成器的产物与**已定稿数据**脱钩，重跑会改写冻结层，因此
  **默认拒绝执行**；确需重跑（并已获用户批准）时才显式放行。
  1. **`gen_exploration_targets.mjs`（已加硬门禁）** — 产物 `explorationTargets.js` 的 `id/name/reqLevel/intervalSec/xp/baseSuccess/failGold/loot`
     全部在数据铁律冻结清单里。实测当前算法口径与定稿**不一致**：重跑会改 **79 个目标名称 + 32 个目标的战利品构成**
     （例：`explore_001` 名称「家常小馆」→「菜摊」、战利品 `chili_young` → `ginger_young`）。这不是修复，是静默改写已定稿内容。
     门禁实现：脚本开头检查 `ALLOW_FROZEN_REGEN`，未设为 `1` 就打印原因并 `exit(1)`（**不写文件**）。
     ```bash
     node scripts/gen/gen_exploration_targets.mjs                    # 被拒绝（预期行为）
     ALLOW_FROZEN_REGEN=1 node scripts/gen/gen_exploration_targets.mjs  # 确需重跑时才用
     ```
  2. **`gen_combat_loot.mjs`（只加警告注释，不锁）** — 产物被对决掉落链引用（`combat.js` 的 `rebalanceDrops`/`assignLegends`、
     `itemBalance.js` 的等级覆盖），但它由装备/物品数据**推导**而来，将来装备数据正当变更后重跑是合理的维护动作，故不设硬门禁。
     实测（2026-09-10）重跑**零玩法变化**：只从 `LEGENDARY` 移出 27 条本就不该在名单里的低阶锻造件（铜/铁/青铜/钢/银/秘银/金/精金/水晶 × 腿甲/靴子/戒指，528 → 501），
     `ITEM_LEVEL`（1439）与 `EQUIP_POOL`（365 件）完全不变，且全库仅 1 处掉落命中它们（BOSS 汤王 12 级 → `smith_铁_ring`），重跑前后落到同一件物品。
  3. **另 4 个产物实测同样会被重跑改写（2026-09-10 由 `gen_drift_audit.mjs` 检出，**已全部加硬门禁**，一律不得重跑）**：
     | 产物 | 重跑会改什么（按「行内容」实测） |
     | --- | --- |
     | `expansion1.js` | `PRESERVE_EXT` 会被从**空数组补回 10 条保鲜配方**；`PRODUCTION_EXT` 有 163 种行仅仓库有；`EXPANSION_ITEMS` 各有独有字段（共 171/150 种行不同） |
     | `expansion2.js` | `PRESERVE_EXT2` 同样被补回 10 条；**20 个赛季的 `missions` 全被改写**；`SMITHING_EXT2` 有 6 条配方的材料被换成 `ironOre`/`saltOre`（仓库用的是专用 ext2 矿）（504/309 种行不同） |
     | `quests_extra.js` | **452 个任务里 365 个的目标物品被换**（例 q136「踏青采小麦」→「踏青采苹果」）（767/423 种行不同） |
     | `expansion_gear.js` | 40 季 `tiers` 奖励里的一件物品被换（`yieldTonic3` → `pres_ext2_06`）+ 头部文案（2/2 种行不同） |

     规律：这些产物自 **2026-08-07** 起就再没重跑过，之后设计决策都**只落到产物里**（保鲜配方改用 `preserveTiers.js` 于是清空了 `PRESERVE_EXT`、锻造改用专用 ext2 矿、任务目标与赛季任务被手工校正），
     而生成器停留在旧口径。**生成器输出 ≠ 正确版本**，绝不能拿它去覆盖产物。
  - **⚠️ 比对必须按「行内容」而不是按行号**（2026-09-10 血泪）：产物与生成器输出行数常不同，按行号硬比会整段错位，
    得出「5700 行不同」「category 由 root 退化成 fruit」这类**假差异**——我据此写进文档的结论是错的，改用「行内容多重集」后真相完全不同（见上表）。审计已改为按内容比对。
  - **⚠️ 绝不要在未确认门禁在位的情况下直接跑生成器**（2026-09-10 实际发生）：我曾用「直接运行」的方式去验证门禁，而补丁当时因锚点不匹配**整体未写盘**，
     于是 4 个生成器真的把 `expansion1.js` / `expansion2.js` / `quests_extra.js` / `expansion_gear.js` **覆盖**了（已 `git checkout` 还原，并与备份逐字节核对：内容完全一致，仅行尾由 LF 变 CRLF，零丢失）。
     验证门禁的正确顺序：**先 `grep ALLOW_FROZEN_REGEN` 确认门禁在位**，再运行；或干脆用 `GEN_OUT_DIR=<临时目录>` 跑（不碰仓库）。
  - **`gen_tales.mjs` 曾因同一处路径 bug 崩溃，现已修复**（2026-09-10）：`base` 兼任「源码根（`load()` 动态 import 用）」与「产物目录」两职，
    脚本三分后它指向不存在的 `scripts/src`，导致 `load()` 全部失败、`ALL_ENEMIES` 为空，最终在 `:2521` 抛 `TypeError`。
     拆成 `__SRC`（源码根）/ `base`（产物目录）后，`tales_ext.js` 现已**逐字复现一致**（与 `preserveTiers` / `restaurantDecor` / `smithOres` / `smithSetExt` / `spiritTiers` 同列"一致"）。
     同一处 bug 也影响 `gen_quests`（`load()` 失败会让任务名退回原始 id），已一并修复。
  - **当前已上硬门禁的生成器（5 个）**：`gen_exploration_targets` / `gen_expansion` / `gen_expansion2` / `gen_quests` / `gen_season_gear`。
    门禁只拦「写进真实 `src/game/data`」的运行；`GEN_OUT_DIR` 指向别处时放行，因此审计仍能无损测量漂移。
  - **判断口径**：文件是**活数据**（游戏读的就是它），生成器输出只是「若今天重印会印成什么样」。所以「文件 ≠ 生成器输出」说明
    **重跑＝改内容**，不重跑＝内容不变；绝不能把重跑当成「把过期文件更新成正确内容」。这些文件都在启动链上
    （`player.js → data/combat.js → combatLoot.js`、`bootstrap.js → itemBalance/spoilBalance/ExplorationSkill → 上述文件`），**删除会让游戏白屏**，不是只坏一个页面。
  - **配套审计 `scripts/ci/gen_drift_audit.mjs`（已入 CI）**：逐个把生成器跑进**临时目录**（`GEN_OUT_DIR`），与仓库产物比对并打印「重跑会改什么」；
    仓库产物哈希前后校验，证明全程只读。已登记漂移 6 个（上面那些）、跳过 1（`farmSeeds.js` 自引用陷阱）、中止 1（`gen_tales` 报错），**FAIL 必须为 0**。

- **生成器输出路径统一（2026-09-10 收口）**：全部 **13 个**生成器一律用
  `const __OUT_DIR = process.env.GEN_OUT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../../src/game/data')`，
  不再依赖 cwd、也不再写死路径。此前有两类漏网：
  1. 6 个用 `writeFileSync('src/game/data/X.js')`（相对**运行目录**）→ 从别处运行会写错位置；
  2. 6 个（`gen_expansion` / `gen_expansion2` / `gen_season_gear` / `gen_quests` / `gen_restaurant_decor` / `gen_tales`）在 `scripts/` 三分出 `scripts/gen/` 后，
     相对路径 `../src/...` 实际指向了**不存在的 `scripts/src/...`** —— 跑一次会"看似成功"，实则真产物不更新（2026-09-10 已全部修正，`scripts/src` 当时并不存在，未造成污染）。
  验证方式：`node scripts/ci/gen_drift_audit.mjs`（临时目录复现 + 逐字比对）。

- **生成器头注释里的日期**：`gen_exploration_targets` / `gen_smith_ores` / `gen_farm_seeds` 等会把生成日期写进产物首行，
  所以重跑后 `git diff` 至少有 1 行日期变化——这是**预期内**的，不是数据漂移。

### 📬 信箱（2026-09-11，`src/game/data/mail.js` + `MailView.vue` + `player.js` 的 mail* 动作）
- **定位：兜底 + 留档 + 系统奖励到账**（2026-09-11 起放宽，见设计文档 §11.17）。四类来源：① `overflow` 溢出转存 ② `reward` **系统奖励到账**（目前用于赛季档位：**领档即记账**，`claimed` 立刻标记，所以赛季进度与成就阈值不受影响；奖励改为邮件到账）③ `offline` 离线回执（产出仍由 `settleOffline` 直接发放，邮件只是明细）④ `welcome` 新档欢迎信（不带附件）。
  **判断标准**：奖励**可以**走邮件，但必须「**先记账、后到账**」，且投递被拒时**回退直接发放**；而**结算类的既有产出**（离线、采集、制作等）仍走原来的 `gainGold`/`gainItem` 直接进包，不要改成邮件。
- **`gainItem` 的返回值语义没变**（背包满仍是 `false`、截断仍按 `add > 0`），只是**多了一条不丢东西的通道**：溢出部分进 `_fileOverflowMail`。
  ⚠️ **因此「靠 gainItem 的返回值判断背包满」的写法有重复风险**：物品会被转存进邮箱，而调用方以为没发出去。现存唯一一处（`unsocketGem`）已改为 `canGainItem()` 容量预检 + 必定成功两步；**以后新增类似「发不出去就回滚」的逻辑，必须用 `canGainItem` 预检，不要看返回值**。
- **领取必须过 `canGainItem` 预检**：否则「领出来 → 背包满 → 又转存成一封新邮件」会形成死循环。领取失败时邮件保持未领。
- **容量（2026-09-11 放宽，勿改回拒收）**：软上限 `MAIL_CAP=200` 只淘汰「已领或无附件」的旧邮件；**全是未领附件也照收**，到硬上限 `MAIL_HARD_CAP=500` 才拒收（`sendMail` 返回 `null`、`_fileOverflowMail` 返回 `false`，此时才回落 `inventory:full` 事件）。配合「溢出邮件**按物品**合并」，封数≈有溢出的物品种类数。
  ⚠️ 实测教训：改前「60 封全未领就拒收」会让物品**真的蒸发**（实测 21 次拒收），而那正是信箱本要修的毛病。**不要**用「封数没增长」判断是否被拒收——**淘汰**（清理已领/无附件旧邮件）同样不会让长度增长；要判就判「物品在不在背包或某封邮件里」（C11 的「溢出零丢失」断言就是这么写的）。
- **存档**：`mail` 已进 `defaultState`/`serialize`/`applySave`（旧档回退空信箱；缺 `nextId` 时按现有最大 id 推算，防 id 撞车）。`system_test.mjs` 的 **C11 信箱**一节共 31 项断言覆盖上述全部规则（含「拆卸宝石不重复」「旧档迁移」「往返无损」），改信箱务必先跑它。

### 🤝 厨友（2026-09-11，`src/game/data/friends.js` + `FriendsView.vue` + `player.js` 的 friend* 动作）
- **这是纯单机游戏、没有后端**，所以「社交」一律做成**本地生成的镜像 NPC**（与竞技场镜像对手、同业榜 NPC 同一思路）。**不要**写出「等待其他玩家响应」「联网同步」这类假装有服务端的设计。
- **奖励只放大本系统自身**：羁绊等级只提高该厨友的拜访礼物与委托赏金，**不叠加**到餐厅/采集/对决等既有乘区——那些节奏已经标定过，别去动。
- **赏金口径绑住既有物品价值**（`物品 value × 数量 × (1.4~2.0)`，对照「食客订单」的 ×(1.5~2.2) 略低一档），**不要另起一套经济尺度**；拜访礼物沿用吉祥物的 `base × (1+0.25×等级)` 公式。
- **委托池只能放现存物品**（`friends.js` 里每个厨友的 `pool`）。加了不存在的 id 会让页面显示 undefined、并可能被引用类审计判 FAIL；池子只放**早期也交得起**的低阶食材。
- 存档：`friends: { data, orders, orderDay }` 已进三个存档函数；旧档回退空对象，且 `friendState()` **懒初始化**，旧档也能直接用。`system_test.mjs` 的 **C12 厨友**一节覆盖上述规则（含跨天刷新、材料不足拒交、存档往返、旧档懒初始化）。
- 跨天判断统一用 `this.todayKey ?? _todayStr()`（与签到/每日任务同源），别自己 `new Date()` 取日期。

### 🚀 发布流程与「发布后核验」（2026-09-11 立）
1. 全量回归：`vite build` → 10 套 `scripts/ci/*.mjs` → `npx playwright test e2e-test.spec.mjs e2e-dark.spec.mjs`（12 项）。
2. 版本号三处同步：`package.json`、`lmewexe/package.json`、README 的「当前版本」行 + 版本历史行。
3. `git add -A` → commit（信息里写清「玩法零改动 / 新存档字段」之类的口径）→ `git push origin main` → `git tag vX.Y.Z && git push origin vX.Y.Z`。
4. 推 tag 会触发三条 workflow（`release.yml` 打桌面版 zip、`pages.yml` 部署在线版、`ci.yml`）：`gh run list` 轮询到三条都 `completed success`。
5. **发布后核验**：`gh release view vX.Y.Z --json name,isDraft,isPrerelease,assets` 看标题/是否草稿/附件与**中文 label**（附件名是 ASCII，中文名放在 label 里，见 release.yml 注释）。
   ⚠️ **核验线上是否真的更新了，必须用浏览器打开线上站点点进去看，不要比对 `dist/assets` 的哈希**：Pages 用 `npm ci`（自带 Node/npm 版本）构建，产物 chunk 哈希与本地 `.toolchain/node` 的构建**并不一致**（2026-09-11 实测：本地 `index-CdNvJ3du.js` vs 线上 `index-DGEUrWpc.js`，一度误判为「没部署」）。正确做法是 Playwright 打开 `https://xinysi.github.io/culinary-idle/`，进游戏后检查左栏是否出现本次新增的功能页磁贴、并真进一页确认渲染。

### 🎛 左栏功能页：图标与排序约定（2026-09-11 体检后立）
- **图标不得同形**。判「同形」要**去掉变体选择符 `U+FE0F` 再比**——`🍽️`(U+1F37D+FE0F) 与 `🍽`(U+1F37D) 是**同一个码位**，在代码里几乎看不出差别，却可能是两个完全不同的页面（本轮实际踩到：珍馐阁 vs 宴会）。跨栏同理：顶栏图标与左栏瓦片/组标签也不该同形（曾出现 `🗺` 四处、`⚔` 三处、`🤝/📖/🏮` 各三处）。
- **层级分工**：**顶栏图标不动**（高频、已形成肌肉记忆）；**瓦片保留辨识度**；**组标签用更通用的符号**，并且**不与组内瓦片重复**（同图标会让组内第一格看起来像「组的标题」）。
- **列数 = 4（2026-09-11 实测定的，勿随意改回 3）**：3 列时 45 片内容 1712px、可视 966px，**需滚 746px、后 3 组（16 片）全在折叠线下**；改 4 列后瓦片 74→54px、内容 1112px、**需滚仅 146px 且零名字换行/裁切**。实测 5 列虽能做到零滚动，但有 14 片名字换行并被裁切，故不可取；手机抽屉（239px）下 4 列瓦片约 51px，仍高于 44px 可点下限。
  ⚠️ 4 列下瓦片只有 54px，**磁贴名最多 4 个汉字**（5 字必换行）——新增页面起名时先数一下字数；确需 5 字全称就照「成就与称号 → 磁贴用「成就称号」」的做法，把全称留给页面标题与跳转文案。
- **带角标的入口必须落在折叠线以上**。角标的意义就是被发现，带角标的瓦片要排在**所在组的前两行**内（新增页面时不要习惯性追加到组尾）。
- **组内顺序按语义，不按「谁最后加」**：组内尽量把同类聚在一起（如「餐厅经营」= 经营实体 → 渠道与交易 → 人与关系 → 装潢），低频排查工具（系统日志）放组尾，别插进时间线叙事的中间。
- **同一件事只留一个操作入口**（2026-09-11）：称号的「佩戴/取消佩戴」原先在「成就与称号」和「荣誉殿堂」**两个页面都能做**（`player.title` 同一份状态，不会出错但用户不知道该去哪）。现由**荣誉殿堂独占**，成就页只做只读展示 + 一个「去荣誉殿堂佩戴 ↗」。新增/改页面时，凡是「改同一份玩家状态」的操作，都要先问一句**这个操作现在有几个入口**。
- **改完自检**（脚本可临时写）：① 45 个瓦片图标去掉 FE0F 后互不相同 ② 8 个组图标互不相同且不等同任何瓦片/顶栏图标 ③ 每个 `icon: '...'` 的引号成对闭合（**批量替换图标时务必用保留引号的写法**——本轮曾用 `$1<新图标>$2` 把 `icon: '🗓️',` 写成 `icon: '🗓️,`，语法直接坏掉，靠自检才发现）。

### 📐 顶栏（2026-09-11 修窄屏缺陷后立，勿回退）
- **结构必须是「主按钮区 + 右侧功能组」两个容器**：`.top-nav-main`（7 个高频入口，自己 `overflow-x:auto` 兜底）+ `.top-nav-right`（统计/图鉴/攻略/签到/搜索/厨藏/装备/设置/存档）。
  改前两者共用一个横滚容器，实测 **768px 被裁 6 个按钮、390px 被裁 7 个**，且滚动条被 `scrollbar-width:none` 隐藏 → 玩家不知道右边还有，「右侧组贴右」的设计意图也失效。
- **≤940px：右侧组收进「⋯」浮层**（`.top-nav-more` 按钮呼出，`.top-nav-right.open` 显示为竖排浮层）。收起时机有四个：点浮层内任一项（容器 `@click`）、点外部 backdrop、`ui.activeView` 变化、主区滚动。纯图标按钮在浮层里靠 `.nav-btn-text` 显示文字标签（宽屏隐藏）。
- ⚠️ **`.top-nav` 上绝不能留 `overflow`**：CSS 规范里一个轴非 `visible` 会把另一轴也算成 `auto`，于是**绝对定位到顶栏下方的「⋯」浮层会被顶栏自己的盒子裁掉**——而 `toBeVisible()` 仍返回 true。
  **教训**：判断「这个东西玩家真的看得见吗」不能只用 `toBeVisible()`（只看 CSS 可见性，不看裁切与遮挡）；要用 `document.elementFromPoint(元素中心)` 检查命中的是不是它自己（本轮的验收脚本就是这么写的）。
- 交付前实测三档宽度：**被裁按钮数必须为 0**，且 `nav.scrollWidth ≤ nav.clientWidth`（顶栏本身不许横向溢出）。
- **导航命名要能区分不同系统**：顶栏「试炼塔」（`tower`，无尽挑战塔）与左栏「厨神试炼」（`trials`，厨神试炼）是**两个系统**，名字近似过（原左栏叫「试炼」）已改名区分。新增命名时先在某处搜一遍有没有近义条目。
- **红点只给「稀缺的一次性待办」**：任务中心（可领取数）✓；**公会不加**——其实测是「任务完成即自动结算」（`guild.points += reward` 且进度归零），没有待领态；竞技场也不加（每 5 分钟刷新，红点会常亮成噪音）。

### 🎨 页面私有 CSS 类名（2026-09-11 踩过后立）
- 新页面一律用**本页专属前缀**（如 `td-*` / `mk-*` / `dv-*`），且**同前缀下不要把「元素类」和「语气/状态类」混用**。
  ⚠️ 实测事故：`TodayView` 里 `.td-claim` 同时被用作「英雄区按钮」与「行的语气类」，于是按钮上那条 `margin-left: auto` 也套到了每一行「可领取」的行上——在 flex 列容器里 `margin-left:auto` 会把该行**推向右并缩成内容宽**（实测行宽 385px，而卡片宽 1368px）。
- **验收方式**：布局类改动后不要只截图目视（缩进在深色/浅色下都不明显），用 Playwright 量几何——例如「每行的 `left/width` 必须等于其容器的 `left/width`」，断言不过就是布局错了。
- 同理：**加页/改页后立刻跑 `content_sync_audit.mjs`**，它会报出「这个新页面没有攻略关键词」并点名（派生检查）。

### 校验习惯
- 🧩 **新增功能页（view）必须在四处同时登记，缺一处就是缺陷**：
  1. `src/stores/ui.js` 的 `VIEW_KEYS`（白名单，开发期对未知 key 告警）；
  2. `src/App.vue` 的 `defineAsyncComponent` import + `v-else-if="ui.activeView === '...'"` 分派（末尾 `v-else` 兜底到 `SkillView`，**漏登记会静默显示技能页**）；
  3. `src/components/Sidebar.vue` 的 `FEATURE_GROUPS`（含 icon/name/view，自动进「功能」页签并计入 `FEATURE_VIEWS`）；
  4. `e2e-dark.spec.mjs` 的 `VIEWS`（否则该页不进深色体检）。
  页面若要接入跳转，用 `components/RelatedPages.vue`（`content_sync_audit.mjs` 会检查左栏功能页是否都有跳转条）；需要「切到某个技能」时 `RelatedPages` 不够用（它只能切 view），要直接调 `player.setActiveSkill(id)`。
  守卫：`e2e-test.spec.mjs` 的「全部 view key 均已注册」会逐 key 切换并断言无 `setView` 告警——漏登记会在这里 FAIL，而不是静默显示技能页。
  ⚠️ **排查「点了某入口却跳到技能页（默认采摘）」时先看这两处**（2026-09-11 用户报过这个现象）：① `activeView` 的实际值；② 右侧「事件日志」——`setView` 收到未知 key 时**开发模式**下会写一行「⚠️ 未知页面「x」，已回退到技能页」（线上不会发生这种兜底，线上行为是原样透传）。
  ⚠️ **新手引导横幅**（`components/NewbieGuide.vue`）在**每个页面**都渲染，且历史上一直高亮显示——它的定位文案（如「技能页 · 采摘」）容易被误读成「当前页面/跳到了采摘页」（2026-09-11 就这么被误报过一次）。
  现约定：**每个引导步骤必须声明它的目标页面 `view`**，当前页 ≠ 目标页时横幅自动淡化（`.newbie-dim`，去掉主色强调、退成普通提示，✕ 保持可见），只有真正该去的页面才醒目。**新增步骤时别忘了填 `view`**。
- **把某块 UI 从旧页面抽成独立页时，必须同时处理「旧页残留」与「跨页进行中的状态」**：
  - 旧页**不要留重复界面**，改成「状态 + 入口 ↗」卡片（如对决页的秘境条、餐厅页的装潢行）；若原页面还持有会推进状态的监听（如 `combat:end` 推进秘境层数），**监听要保留**——战斗跑在单例 `Combat` 上、玩家随时可能换页，两处都不监听会让进行中的一局卡死。视图由 `App.vue` 的 `v-if/v-else-if` 互斥挂载，同一时刻只有一个监听生效，不会重复推进。
  - 旧页若因此少了「唯一入口」，记得把**别处指向旧页的口子改指新页**（如 `StatusPanel` 的「去领取/查看」由 `openLogTab('quest')` 改为 `ui.setView('quests')`）。
  - 抽走后**立刻删掉旧页的死代码**（模板块 + 只服务于它的 computed/函数/分页常量），并用 `npm run build` 的产物体积变化核对（本次 LogView 64.3kB → 54.6kB）；改一个文件里的大段代码时**不要用「从 A 锚点到 B 锚点整段切掉」的批量脚本**——锚点之间可能夹着无关的 import，本次就这样误删过 `items.js`/`cardBattle.js` 的 4 组 import，靠 build + 逐行对照才发现。批量删改后必须 `git diff` 逐段复核，或改用精确的小段 `Edit`。
- **生成器相关改动后必须跑 `node scripts/ci/gen_drift_audit.mjs`**（已入 CI）：它把 13 个生成器逐个跑进**临时目录**、与仓库产物比对，并逐条打印「重跑会改什么」；FAIL 必须为 0。
  新增生成器/新产物时，记得把它登记进该脚本的 `GENS`（脚本会提示"未登记的产物"）。
- **生成器输出目录统一支持 `GEN_OUT_DIR`**：默认写仓库 `src/game/data`，设了就写指定目录——任何「只想比对、不想写仓库」的场景都用它（不要用重跑+还原的办法）。
- **小游戏 UI 改动后必须跑 `node scripts/ci/minigame_ui_audit.mjs`**（27 款 × 11 项静态合规，0 失败为准）；标准见《小游戏UI标准.md》（页面骨架/顶栏胶囊/主区域/按钮/弹窗/配色/深色/交互/文案 + 例外清单）。新增或修改小游戏时先读该标准。
- 改动/平衡后按需重跑生成器：`node scripts/gen/gen_smith_ores.mjs`（同名矿）→ **先清空 `smithSetExt.js` 再** `node scripts/gen/gen_smith_sets.mjs` → `node scripts/gen/gen_farm_seeds.mjs`（农耕）→ `vite build` → `e2e 9/9` → 检查无 `\uFFFD`。
- 审查超纲可临时写审计脚本：材料锚 vs 产物 reqLevel（忽略矿物），三轮（原貌→平衡后→抬升范围/断供）。
- 生成器产物文件（`smithSetExt.js`/`smithOres.js`/`farmSeeds.js`/`combatLoot.js`/`explorationTargets.js` 等）**勿手改**。
  ⚠️ 但**不是所有产物都能靠重跑更新**：5 个生成器已上硬门禁（见上文「冻结数据生成器门禁」），产物属冻结数据、重跑会改写内容；要改产物内容必须先问用户。
  可安全重跑的一类（如 `gen_smith_ores` / `gen_smith_sets` / `gen_farm_seeds`）仍须先清空对应导出再跑，并跑 `gen_drift_audit.mjs` 确认差异符合预期。
- **改了生成器/扩充了数据规模后，务必同步维护 `README.md` 与《美食放置：食灵山海》设计文档（当前版本）.md 里的对应数字/描述**（物品/装备/食谱/采集目标/作物/矿/种子等），避免文档与实现脱节。
