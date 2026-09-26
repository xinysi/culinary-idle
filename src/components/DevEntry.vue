<script setup>
// 内部入口（2026-09-18 立，2026-09-25 改名）——**开发者 / 运营调参员共用**的登录挡板 + 页面挂载点。
// **只在含开发者模式的构建里存在。** 挡板上有角色选择（点一下自动填身份名），提交后按身份分流到
// DevPanel（开发者）或 TunerPanel（运营调参员）——身份名相同但不是同一角色时由 devAuth 的 IDENTITIES 判定。
//
// 三个入口都汇到 `ui.devGate`：
//   · 启动页标题连点 5 下（SplashScreen）
//   · 任意阶段 Ctrl + Shift + D（App.vue 的全局热键）
//   · URL 带 `?dev=1`（App.vue 启动时读取）
// 已登录（本次会话）就直接开面板，不再问口令。
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { DEV_PANEL_ENABLED, devLogout } from '../game/dev/devFlag.js'
import { DEV_DEFAULT_PASSWORD_HINT, devLogin, IDENTITIES } from '../game/dev/devAuth.js'
import DevPanel from './DevPanel.vue'
import TunerPanel from './TunerPanel.vue'

const ui = useUiStore()
const devName = ref('')
const pw = ref('')
const msg = ref('')
const pwInput = ref(null)

/** 两个内部角色：点一下自动填身份名（名字不是秘密，口令才是挡板；IDENTITIES 是判定唯一出口） */
const ROLES = [
  { role: 'dev', label: '🛠 开发者', name: IDENTITIES.find((i) => i.role === 'dev')?.name ?? '', desc: '开发者页面：运行时/存档/埋点/体检/监控 全部权限' },
  { role: 'tuner', label: '🎛 运营调参员', name: IDENTITIES.find((i) => i.role === 'tuner')?.name ?? '', desc: '只有「运营调参」页：改运行时系数，无任何存档与破坏性操作' },
]
const pickedRole = ref(null)
const pickedDesc = computed(() => ROLES.find((r) => r.role === pickedRole.value)?.desc ?? '')
function pickRole(r) {
  pickedRole.value = r.role
  devName.value = r.name
  msg.value = ''
  pwInput.value?.focus()
}

const open = computed(() => ui.devGate || ui.showDevPanel)

async function submit() {
  const r = devLogin(devName.value, pw.value)
  msg.value = r.msg
  if (r.ok) {
    devName.value = ''
    pw.value = ''
    ui.devGate = false
    // 页面是**整页接管**（游戏内与启动页同一形态，覆盖在游戏/启动页之上）；按登录角色分流
    if (r.role === 'tuner') ui.showTunerPanel = true
    else ui.showDevPanel = true
  }
}
function cancel() {
  pw.value = ''
  msg.value = ''
  ui.devGate = false
}
function onKey(e) {
  // Esc 关掉挡板；页面开着时 Esc 也收起（不影响游戏内其它 Esc 逻辑：页面在最上层）
  if (e.key === 'Escape') {
    if (ui.showDevPanel || ui.showTunerPanel) {
      ui.showDevPanel = false
      ui.showTunerPanel = false
    } else if (ui.devGate) cancel()
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
          <h3>🛠 内部入口</h3>
          <p class="dim">开发者 / 运营调参员共用入口——按<b>身份名</b>自动分流到对应页面。口令只是挡板，真正的保护是本页不进生产构建。</p>
          <div class="dev-role-tabs">
            <button v-for="r in ROLES" :key="r.role" class="btn btn-sm" :class="{ 'btn-primary': pickedRole === r.role }" @click="pickRole(r)">{{ r.label }}</button>
          </div>
          <p v-if="pickedDesc" class="dim dev-role-desc">{{ pickedDesc }}</p>
          <input
            v-model="devName"
            type="text"
            class="dev-name"
            placeholder="身份名"
            autocomplete="off"
            @keyup.enter="pwInput?.focus()"
          />
          <input
            ref="pwInput"
            v-model="pw"
            type="password"
            class="dev-pw"
            placeholder="口令"
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

    <!-- 页面本体：整页接管（游戏内与启动页同一形态） -->
    <DevPanel v-if="ui.showDevPanel" />
    <TunerPanel v-if="ui.showTunerPanel" />
  </template>
</template>

<style scoped>
.dev-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(var(--scrim-rgb), 0.6); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dev-gate { width: min(420px, 94vw); border-radius: 14px; border: 1px solid var(--border); background: rgba(var(--panel-rgb), 0.97); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 12px 40px rgba(var(--ink-rgb), 0.35); padding: 16px; }
.dev-gate h3 { margin: 0 0 6px; font-size: 15px; }
.dev-gate p { margin: 0 0 10px; font-size: 12px; line-height: 1.6; }
.dev-name, .dev-pw { width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); background: rgba(var(--panel-soft-rgb), 0.7); color: var(--text); font-size: 13px; }
.dev-name { margin-bottom: 8px; }
.dev-role-tabs { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.dev-role-desc { font-size: 11.5px; margin: 0 0 8px; }
.dev-msg { color: var(--bad); font-size: 12px; margin: 6px 0 0; }
.dev-gate-actions { display: flex; gap: 8px; margin-top: 10px; }
.dev-hint { margin: 10px 0 0; font-size: 11px; }
</style>
