<script setup>
// 开发者入口（2026-09-18 立）——登录挡板 + 面板挂载点。**只在含开发者模式的构建里存在。**
//
// 三个入口都汇到 `ui.devGate`：
//   · 启动页标题连点 5 下（SplashScreen）
//   · 任意阶段 Ctrl + Shift + D（App.vue 的全局热键）
//   · URL 带 `?dev=1`（App.vue 启动时读取）
// 已登录（本次会话）就直接开面板，不再问口令。
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { DEV_PANEL_ENABLED, devLogout } from '../game/dev/devFlag.js'
import { DEV_DEFAULT_PASSWORD_HINT, devLogin } from '../game/dev/devAuth.js'
import DevPanel from './DevPanel.vue'

const ui = useUiStore()
const pw = ref('')
const msg = ref('')
const pwInput = ref(null)

const open = computed(() => ui.devGate || ui.showDevPanel)

async function submit() {
  const r = devLogin(pw.value)
  msg.value = r.msg
  if (r.ok) {
    pw.value = ''
    ui.devGate = false
    ui.showDevPanel = true
  }
}
function cancel() {
  pw.value = ''
  msg.value = ''
  ui.devGate = false
}
function onKey(e) {
  // Esc 关掉挡板；面板打开时 Esc 也收起（不影响游戏内其它 Esc 逻辑：面板在最上层）
  if (e.key === 'Escape') {
    if (ui.showDevPanel) ui.showDevPanel = false
    else if (ui.devGate) cancel()
  }
}
onMounted(() => {
  // 只挂 Esc 监听；**不自动开面板**（刷新页面不该被面板糊脸）——
  // 「已登录就直接开面板」的逻辑放在 requestDevEntry 里，由热键/连点/URL 触发。
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
function lock() {
  devLogout()
  ui.showDevPanel = false
  ui.devGate = false
}
defineExpose({ lock })
</script>

<template>
  <template v-if="DEV_PANEL_ENABLED">
    <!-- 口令挡板 -->
    <Teleport to="body">
      <div v-if="ui.devGate && !ui.showDevPanel" class="dev-backdrop" @click.self="cancel">
        <div class="dev-gate">
          <h3>🛠 开发者入口</h3>
          <p class="dim">这是本机开发者面板（管理存档与调试参数）。口令只是挡板——真正的保护是它不进生产构建。</p>
          <input
            ref="pwInput"
            v-model="pw"
            type="password"
            class="dev-pw"
            placeholder="开发者口令"
            autocomplete="off"
            @keyup.enter="submit()"
          />
          <p v-if="msg" class="dev-msg">{{ msg }}</p>
          <div class="dev-gate-actions">
            <button class="btn btn-sm btn-primary" @click="submit()">登录</button>
            <button class="btn btn-sm" @click="cancel()">取消</button>
          </div>
          <p class="dim dev-hint">{{ DEV_DEFAULT_PASSWORD_HINT }}</p>
        </div>
      </div>
    </Teleport>

    <!-- 面板本体 -->
    <DevPanel v-if="ui.showDevPanel" />
  </template>
</template>

<style scoped>
.dev-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(var(--scrim-rgb), 0.6); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dev-gate { width: min(420px, 94vw); border-radius: 14px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.97); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 12px 40px rgba(var(--ink-rgb), 0.35); padding: 16px; }
.dev-gate h3 { margin: 0 0 6px; font-size: 15px; }
.dev-gate p { margin: 0 0 10px; font-size: 12px; line-height: 1.6; }
.dev-pw { width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); background: rgba(var(--panel-soft-rgb), 0.7); color: var(--text); font-size: 13px; }
.dev-msg { color: var(--bad); font-size: 12px; margin: 6px 0 0; }
.dev-gate-actions { display: flex; gap: 8px; margin-top: 10px; }
.dev-hint { margin: 10px 0 0; font-size: 11px; }
</style>
