<script setup>
// 启动界面 — 需求 §9.0：打开游戏先进入启动界面，点「开始游戏」选择存档后进入游戏主界面
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { saveManager, startGame } from '../game/bootstrap.js'
import { DEV_PANEL_ENABLED, requestDevEntry } from '../game/dev/devFlag.js'

const ui = useUiStore()
const player = usePlayerStore()

const slots = computed(() => saveManager.listSlots())

function totalLevelsOf(data) {
  if (!data?.player?.skills) return 0
  return Object.values(data.player.skills).reduce((a, s) => a + (s.level ?? 1), 0)
}

function pickSlot(slot, exists) {
  if (exists) startGame({ slot })
  else startGame({ slot, newGame: true })
  ui.toggleStartSlotModal(false)
}

function startNew() {
  startGame({ newGame: true, slot: 0 })
  ui.toggleStartSlotModal(false)
}

// 「试玩」两个字的说明改挂悬浮提示（按钮太窄放不下，游戏内另有顶栏徽章与存档面板横幅在讲）
const GUEST_TIP = '免建档试玩：不占存档位、不写入任何本地数据，刷新页面即清空'

/** 游客 / 试玩（2026-09-24）：免建档进游戏，**不占存档位、不写任何存档**，刷新即清空。
 *  给「想先看看再决定」的人和答辩/演示场景用——他们不该覆盖已有进度。 */
function startGuest() {
  startGame({ guest: true })
  ui.toggleStartSlotModal(false)
}

// ── 内部入口（隐蔽：开发者 / 运营调参员共用）───────────────────────────────────────────────
// 标题连点 5 下（2 秒内）→ 打开开发者登录挡板。**只在含开发者模式的构建里生效**：
// 生产构建下 `DEV_PANEL_ENABLED` 是静态 false，这段判断会被整块消掉、点了也没反应。
// 工具提示同样只在开发构建里出现（用「不在构建里」而不是「藏起来」来实现不可见）。
const devHint = DEV_PANEL_ENABLED ? '内部入口（开发者 / 运营调参）：连点 5 下（或 Ctrl+Shift+D）' : undefined
let taps = 0
let lastTap = 0
function tapTitle() {
  if (!DEV_PANEL_ENABLED) return
  const now = Date.now()
  taps = now - lastTap > 2000 ? 1 : taps + 1
  lastTap = now
  if (taps >= 5) {
    taps = 0
    requestDevEntry(ui) // 已登录就直接开面板（不会重复问口令）
  }
}
</script>

<template>
  <div class="splash">
    <div class="splash-bg"></div>
    <!-- 柔和渐变遮罩：让标题自然浮现（无边框、无毛玻璃） -->
    <div class="splash-overlay"></div>
    <div class="splash-content">
      <!-- 内部入口（隐蔽）：标题连点 5 下。不放可见按钮——演示时不会被随手点开，
           也避免老师/玩家把它当成游戏功能。热键 Ctrl+Shift+D 与 `?dev=1` 是另外两个入口。 -->
      <h1 class="splash-title" :title="devHint" @click="tapTitle()">美食放置：食灵山海</h1>
      <p class="splash-sub">— 挂机美食主题放置游戏 —</p>
      <button class="splash-start-btn" @click="ui.toggleStartSlotModal(true)">开始游戏</button>
      <!-- 游客入口（2026-09-24）：与「开始游戏」并列，但走的是**只读会话**——不建档、不写档。
           放在这里而不是藏起来：答辩评委 / 在线访客点开就能玩，不会动到任何存档位。
           （2026-09-25 用户：「只要试玩两个字」——原先的「🧪 免建档试玩 + 不存档·刷新即清空」说明行去掉，
             改成两字药丸；说明改挂 `title` 悬浮提示，游戏内还有顶栏「试玩中」徽章 + 存档面板横幅两处在讲。） -->
      <button class="splash-guest-btn" :title="GUEST_TIP" @click="startGuest()">试玩</button>
    </div>

    <!-- 选择存档弹窗 -->
    <div v-if="ui.showStartSlotModal" class="modal-backdrop" @click.self="ui.toggleStartSlotModal(false)">
      <div class="modal start-slot-modal">
        <header class="modal-head">
          <h3>选择存档</h3>
          <button class="btn btn-sm" @click="ui.toggleStartSlotModal(false)">✕</button>
        </header>

        <div class="slot-grid">
          <div v-for="s in slots" :key="s.slot" class="slot-card" :class="{ 'slot-empty': !s.exists }">
            <div class="slot-title">
              存档位 {{ s.slot + 1 }}
              <span v-if="s.exists" class="badge badge-on">已有存档</span>
              <span v-else class="dim">（空）</span>
            </div>
            <template v-if="s.exists">
              <div class="slot-info">
                <div><strong>{{ s.data.player?.name ?? '美食学徒' }}</strong></div>
                <div class="dim">金币 {{ s.data.player?.gold?.toLocaleString() ?? 0 }} · 总等级 {{ totalLevelsOf(s.data) }}</div>
                <div class="dim mono">存档时间 {{ new Date(s.data.savedAt).toLocaleString() }}</div>
              </div>
            </template>
            <div class="slot-actions">
              <button class="btn btn-sm btn-primary" @click="pickSlot(s.slot, s.exists)">
                {{ s.exists ? '读取存档' : '新游戏' }}
              </button>
            </div>
          </div>
        </div>

        <p class="dim">选择已有存档继续，或在新存档位开始新游戏。硬核模式请在游戏内「存档」面板开启。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.splash-bg {
  position: absolute;
  inset: 0;
  background-image: url('../../public/images/bg-start.jpg');
  background-size: cover;
  background-position: center;
}

/* 米白柔光（仅托住文字块）+ 底部暖暗收边：壁纸是白天版（亮蓝天白云），
   文字改用深墨色，与游戏主色板（米白 rgba(255,252,246) + 陶土红 var(--primary)）一致 */
.splash-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 44% 30% at 50% 46%,
      rgba(var(--panel-rgb), 0.46) 0%,
      rgba(var(--panel-rgb), 0.30) 52%,
      rgba(var(--panel-rgb), 0.10) 78%,
      rgba(var(--panel-rgb), 0) 92%),
    linear-gradient(180deg,
      rgba(93, 42, 16, 0.10) 82%,
      rgba(93, 42, 16, 0.20) 100%);
}

.splash-content {
  position: relative;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 24px;
  user-select: none;
  transform: translateY(-6%);
}

.splash-title {
  font-size: 60px;
  font-weight: 900;
  color: #40211a; /* 深墨：白天版壁纸上的主标题色 */
  text-shadow:
    0 2px 12px rgba(255, 255, 255, 0.95),
    0 0 34px rgba(255, 255, 255, 0.7);
  letter-spacing: 6px;
  line-height: 1.15;
}

.splash-sub {
  color: #8a4626;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
  text-shadow:
    0 1px 3px rgba(255, 255, 255, 1),
    0 0 16px rgba(255, 255, 255, 0.95);
}

/* ── 磨砂玻璃按钮（2026-09-25 用户：「开始游戏按钮改成磨砂透明背景，试玩按钮样式同步、大小调小」）──
   改前是**不透明主色渐变**（橘红实心）。底色透明之后，字色不能再靠实心底兜底 ⇒ 必须跟主题走：
   浅色壁纸（白天蓝天 + 米白柔光）用深墨字；夜景壁纸（压暗层）翻白字 —— 深色那套按本项目约定写在
   main.css 的 `html[data-theme='dark'] .splash-*` 一组里，与 .splash-bg/.splash-title 放在一起。
   ⚠️ 玻璃配方**只写这一处**（两枚按钮共用同一段选择器列表）：改一处两枚一起变，不会出现主/次按钮材质漂移。
   ⚠️ backdrop-filter 在本项目被大面积清过（面板压在滚动内容上会「整块面板晃」）；启动页**不滚动**，
   是少数可以安全用模糊的地方（原实心按钮本来就带 blur(8px)）。别把这段配方抄到游戏内的面板/卡片上。 */
.splash-start-btn,
.splash-guest-btn {
  cursor: pointer;
  background: linear-gradient(180deg, rgba(var(--glass-rgb), 0.30), rgba(var(--glass-rgb), 0.13));
  border: 1px solid rgba(var(--glass-rgb), 0.6);
  backdrop-filter: blur(16px) saturate(1.35);
  -webkit-backdrop-filter: blur(16px) saturate(1.35);
  box-shadow: 0 10px 26px rgba(93, 42, 16, 0.2), inset 0 1px 0 rgba(var(--glass-rgb), 0.55);
  color: #40211a; /* 与 .splash-title 同一支深墨，浅色下玻璃是亮的 */
  text-shadow: 0 1px 0 rgba(var(--glass-rgb), 0.45);
  transition: transform 0.15s, background 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.splash-start-btn:hover,
.splash-guest-btn:hover {
  transform: translateY(-2px);
  background: linear-gradient(180deg, rgba(var(--glass-rgb), 0.44), rgba(var(--glass-rgb), 0.22));
  border-color: rgba(var(--glass-rgb), 0.78);
  box-shadow: 0 14px 32px rgba(93, 42, 16, 0.28), inset 0 1px 0 rgba(var(--glass-rgb), 0.68);
}

/* 主按钮的**尺寸**只在这一段（别把 padding/字号并进上面的共用配方，否则试玩按钮会跟着变大） */
.splash-start-btn {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 4px;
  padding: 14px 48px;
  border-radius: 16px;
  margin-top: 10px;
}

.start-slot-modal {
  width: min(520px, 94vw);
}

/* 试玩入口：**同一块玻璃、降一档尺寸**（2026-09-25 用户「只要试玩两个字」）。
   两字药丸：字号比主按钮小一档、字距同步收窄，内外边距按「两字」定，视觉重量明确低于主按钮。
   ⚠️ 别再加说明行/图标——上一版就是被「🧪 + 免建档试玩 + 不存档·刷新即清空」撑成和主按钮同宽的。 */
.splash-guest-btn {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  padding: 7px 22px;
  border-radius: 999px;
  margin-top: 2px;
  text-indent: 4px; /* letter-spacing 会在末字后留一格，这里补回来让「试玩」视觉居中 */
}

.start-slot-modal .slot-info {
  margin: 6px 0 4px;
}
</style>
