# 小游戏 UI 标准（2026-09-09 定稿）

> 适用范围：`MinigamesView.GAMES` 注册的 27 款小游戏 + 游戏商店 `GameShopView`。
> 每款游戏的样式写在各自 `<style scoped>` 里，类名统一用「前缀 + 元素名」（如 `.sk-mode`），深色规则集中在 `src/styles/main.css` 末尾。
> 改完用 §11 的自检跑一遍。

## 1. 页面骨架

```html
<div class="xx-page">
  <div class="xx-topbar">模式胶囊行 + 状态胶囊 + 📖 模式说明</div>
  <div class="xx-stage | xx-board | xx-canvas">主区域</div>
  <div class="xx-keys">操作行（开始 / 重置 / 道具 / 方向键）</div>
  <div v-if="结束条件" class="xx-mask">结算弹窗</div>
  <div v-if="showInfo" class="xx-info-mask">模式说明弹窗</div>
</div>
```

- 顶栏容器固定 `.<前缀>-topbar`；主区域 `-stage` / `-board` / `-canvas`。
- **元素顺序**：模式胶囊（最左）→ 状态胶囊（首个 `margin-left: auto` 靠右）→ 📖 模式说明（顶栏**最后一个**元素，也是全顶栏唯一的按钮类）。
- 游戏窗口内**不出现任何说明文字**：没有 `.xx-hint` 提示行、画布也不绘制操作说明（如「点击下方「开始游戏」」）。所有说明只放「📖 模式说明」弹窗。

## 2. 顶栏

| 元素 | 规格 |
|---|---|
| 模式胶囊 `.xx-mode` | `padding: 5px 12px; font-size: 12px; font-weight: 700; border-radius: 999px; border: 1px dashed rgba(150,110,70,0.4); background: rgba(255,252,246,0.8); color: var(--muted); cursor: pointer` |
| 选中态 `.xx-mode.on` | `border-style: solid; border-color: var(--primary-strong); background: rgba(217,90,56,0.14); color: var(--primary-strong)` |
| 状态胶囊 `.xx-chip` | 同胶囊尺寸 + `font-weight: 700`，`border: 1px solid var(--border)` |
| 说明按钮 `.xx-info-btn` | `padding: 5px 12px; font-size: 12px; font-weight: 700; border-radius: 999px; color: #fff; border: none; background: linear-gradient(135deg, #72b864, #589c4b)` |

- 模式按钮文案固定「模式1 … 模式10」（共 10 个，不具名）。
- 状态胶囊放实时数据（⏱ 时间 / 🎯 目标 / 💰 币 / 🏆 最佳 …），emoji + `<b class="mono">` 数字。

## 3. 主区域

- 面板/棋盘/画布统一**棕灰玻璃**：`background: rgba(150,110,70,0.16)`（或 `rgba(120,84,50,0.16)`）、`border: 1px solid rgba(150,110,70,0.35)`、`border-radius: 16px`（棋盘 18px）、`box-shadow: 0 10px 28px rgba(93,64,55,0.18)`。
- 格子/棋子：`border-radius: 8~12px` + 近白底 `rgba(255,252,246,0.92)` + 棕边 `rgba(150,110,70,0.3)`。
- 画布游戏：`<canvas class="xx-canvas">` 用同款圆角/描边/阴影；画布内配色按 `document.documentElement.getAttribute('data-theme') === 'dark'` 分支。

## 4. 操作行与按钮

| 按钮 | 规格 |
|---|---|
| 开始 `.xx-start` | `padding: 12px 34px; border-radius: 12px; font-size: 15px; font-weight: 800; color: #fff; border: none; background: linear-gradient(135deg, #e8703f, #c9542e); box-shadow: 0 6px 18px rgba(184,68,42,0.35)`，文案「▶ 开始游戏」 |
| 重置 `.xx-reset` | `padding: 10px 24px; border-radius: 12px; font-weight: 700` + 同橙渐变，文案「🔄 重置本局」 |
| 道具（提示 / 洗牌 …） | 与重置等高、`border-radius: 12px`、琥珀渐变 `linear-gradient(135deg, #eab04a, #d98a2b)` |
| 方向键 `.xx-key` | `border-radius: 12px; font-weight: 800; font-size: 17~18px` |

- 同一操作行内按钮**等高**；操作行 `.xx-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap }`。

## 5. 弹窗

### 5.1 模式说明 `.xx-info-mask` / `.xx-info-box`

- 遮罩 `position: fixed; inset: 0; z-index: 300; background: rgba(30,20,12,0.45); backdrop-filter: blur(3px)`，点遮罩关闭（`@click.self`）。
- 弹窗 `width: min(620px, 92vw); max-height: 76vh; background: rgba(255,252,246,0.94); border: 1px solid rgba(150,110,70,0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50,30,20,0.35)`。
- 结构：`.xx-info-head`（标题 + `.xx-info-close` 30×30 圆形关闭）→ `.xx-info-list` → **第一条** `.xx-info-row .xx-info-rule`（通用规则，绿底）→ 10 条 `.xx-info-row`（`.xx-info-name` 82px 模式名 + `.xx-info-desc` 说明）。
- `.xx-info-rule`：`display: block; border-color: rgba(88,156,75,0.35); background: rgba(114,184,100,0.1); color: var(--text); font-size: 12.5px; line-height: 1.7`。

### 5.2 结算 `.xx-mask` / `.xx-result`

- 遮罩 `position: fixed; inset: 0; z-index: 320; background: rgba(20,30,40,0.5); backdrop-filter: blur(4px)`。
- 卡片 `width: min(460px, 92vw); max-height: 80vh; background: rgba(255,252,246,0.96); border: 1px solid rgba(150,110,70,0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30,20,12,0.4); display: flex; flex-direction: column; gap: 10px`。
- 内容：`.xx-result-head`（18px 标题，达标/失败）→ `.xx-result-score`（成绩行）→ `.xx-gold`（`var(--good-strong)` 金币）→ `.xx-again`（「🔄 再来一局」，橙渐变胶囊）。
- 礼花 `.xx-fire` / `.xx-spark`：**仅达标/通关时**渲染，20 颗 ✦，`@keyframes xxSpark` 1.1s。
- 发币只在达标时（`player.gainGameCoins`），超出目标最多 +50%。

## 6. 配色

- 强调色 = **橙色系**：`#e8703f → #c9542e`（按钮 / 选中 / 进度条）、`#eab04a → #d98a2b`（道具 / 琥珀）。
- **绿色只用于**说明按钮（`#72b864 → #589c4b`）与达标点缀（`var(--good-strong)`）。
- 文字 / 底色一律走 CSS 变量：`var(--text)`、`var(--muted)`、`var(--border)`、`var(--primary-strong)`、`var(--good-strong)`、`var(--gold)`。
- 面板一律半透明棕灰玻璃，禁止不透明纯色大块。

## 7. 深色模式

`src/styles/main.css` 末尾按「一款一段」追加 `html[data-theme='dark'] .mg-shell .xx-*` 规则，必须覆盖：

| 类 | 深色值 |
|---|---|
| `.xx-mode` `.xx-chip` | `background: rgba(52,40,31,0.85); border-color: rgba(210,170,120,0.35); color: #d9c9b4` |
| `.xx-mode.on` | `background: rgba(224,112,74,0.3); border-color: rgba(224,112,74,0.8); color: #ffb98e` |
| 面板 / 棋盘 / 画布 | `background: rgba(38,29,22,0.88); border-color: rgba(210,170,120,0.35)`（画布只改 border） |
| 格子 / 棋子 | `background: rgba(64,50,38,0.92); border-color: rgba(210,170,120,0.25); color: #f2e6d7` |
| `.xx-info-box` | `background: rgba(44,35,28,0.96); border-color: rgba(210,170,120,0.4); color: #f2e6d7` |
| `.xx-info-row` | `background: rgba(66,52,40,0.9); border-color: rgba(210,170,120,0.28)` |
| `.xx-info-rule` | `background: rgba(114,184,100,0.12); border-color: rgba(114,184,100,0.35); color: #cfe6c2` |
| `.xx-info-close` | `background: rgba(210,170,120,0.18); color: #f2e6d7` |
| `.xx-result` | `background: rgba(44,35,28,0.97); border-color: rgba(210,170,120,0.4); color: #f2e6d7` |

## 8. 交互

- **开始门控**：每款必须「点 ▶ 开始游戏之前不接受任何操作」；限时模式的计时器在点开始后才启动；重置 / 切模式回到待开始态。
- 结算后「🔄 再来一局」必须能重开。
- 最佳成绩按模式独立记录在 `player.minigames.<id>`。
- **每款游戏必须在小游戏大厅「🏆 记录墙」里有数据**（2026-09-12 补）：在**回合结束函数里**调用一次
  `player.recordMinigame('<gameId>', <本局成绩>, { lower, unit })`——
  · 插入位置要在「已结束就 return」的防重入守卫**之后**（否则一局被计多次）；
  · 步数 / 用时类玩法传 `lower: true`（记录最小值）；`unit` 用「分 / 步 / 秒 / 碗 / 题 / 管道 / 食物」等短单位；
  · 只有金币、没有分数概念的玩法传 `null`（只计结算次数，不写最佳分）。
  新字段是 `minigames.<id>.records = { best, plays, coins, lower, unit, lastAt }`，**首次记录时懒建**：
  旧档无需迁移、各游戏原有字段（best / bestStreak / correct …）一律不动。

## 9. 文案

- 模式名短名「模式1…10」；说明进弹窗；**游戏窗口内无说明文字**。
- 不设「🚪 退出」按钮（靠大厅入口切换）。
- 按钮文案：开始「▶ 开始游戏」、重置「🔄 重置本局」、结算「🔄 再来一局」。

## 10. 例外（已确认，勿「顺手统一」）

| 游戏 | 例外 | 原因 |
|---|---|---|
| 火候炉 | 无开始门控、无结算弹窗；局内「开始」按钮 | 玩法是「一锅一判」，没有整局概念 |
| 大胃王 | 操作行按钮统一 56px 高，开始按钮类名 `.fs-btn` | 用户 2026-09-07 明确要求该行 56px |
| 滑冰 | 方向键为冰蓝渐变 | 题材色（冰面），其余按钮仍橙色 |
| 讲堂 | 重置按钮文案「🔄 重新开始本周」 | 动作是重置整周进度，不是重置一局 |

## 11. 自检

```bash
node scripts/ci/minigame_ui_audit.mjs      # 静态合规：27 款 × 11 项（本标准的机器检查）
node scripts/ci/item_triple_audit.mjs      # 图鉴三查（物品作用/制作/来源）
node scripts/ci/system_test.mjs            # 241 项系统测试
npx playwright test e2e-test.spec.mjs   # 9 项 e2e（含无未捕获控制台错误）
```

改完 UI 的流程：`vite build` → 上面四条全绿 → 浏览器里在**浅色 / 深色**两套主题下各扫一遍（`getComputedStyle` 逐项比对胶囊尺寸/边框/文字/选中态、说明按钮、说明弹窗、棋盘底色）。
