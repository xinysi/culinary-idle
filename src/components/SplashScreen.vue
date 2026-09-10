<script setup>
// 启动界面 — 需求 §9.0：打开游戏先进入启动界面，点「开始游戏」选择存档后进入游戏主界面
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { usePlayerStore } from '../stores/player.js'
import { saveManager, startGame } from '../game/bootstrap.js'

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
</script>

<template>
  <div class="splash">
    <div class="splash-bg"></div>
    <!-- 柔和渐变遮罩：让标题自然浮现（无边框、无毛玻璃） -->
    <div class="splash-overlay"></div>
    <div class="splash-content">
      <h1 class="splash-title">美食放置：食灵山海</h1>
      <p class="splash-sub">— 挂机美食主题放置游戏 —</p>
      <button class="splash-start-btn" @click="ui.toggleStartSlotModal(true)">开始游戏</button>
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
   文字改用深墨色，与游戏主色板（米白 rgba(255,252,246) + 陶土红 #D95A38）一致 */
.splash-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 44% 30% at 50% 46%,
      rgba(255, 252, 246, 0.46) 0%,
      rgba(255, 252, 246, 0.30) 52%,
      rgba(255, 252, 246, 0.10) 78%,
      rgba(255, 252, 246, 0) 92%),
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

.splash-start-btn {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 4px;
  padding: 14px 48px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  cursor: pointer;
  color: #fff;
  background: linear-gradient(180deg, rgba(217, 90, 56, 0.96), rgba(160, 52, 24, 0.96));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 6px 20px rgba(120, 55, 25, 0.35);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  transition: transform 0.15s, background 0.15s, box-shadow 0.15s;
  margin-top: 10px;
}

.splash-start-btn:hover {
  transform: translateY(-2px);
  background: linear-gradient(180deg, rgba(232, 105, 68, 0.98), rgba(178, 62, 30, 0.98));
  box-shadow: 0 10px 30px rgba(120, 55, 25, 0.45);
}

.start-slot-modal {
  width: min(520px, 94vw);
}

.start-slot-modal .slot-info {
  margin: 6px 0 4px;
}
</style>
