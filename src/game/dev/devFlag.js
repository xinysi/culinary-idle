// 内部入口（开发者 / 运营调参员）的「小开关」——**唯一允许被入口（App.vue / SplashScreen.vue）引用的模块**。
//
// 为什么不和口令放一起（2026-09-18 实测）：入口引用了 `devAuth.js` 的 `DEV_PANEL_ENABLED` 之后，
// 打包器把**同模块的口令哈希与 `devLogin()` 一起保留**进了入口 chunk（实测产物里能搜到
// 「当前构建未包含开发者面板」这句提示与盐值）。拆开之后入口只带这十几行无秘密的代码，
// 口令哈希与登录逻辑全部随面板 chunk 一起被 `vite.config.js` 的 `strip-dev-panel-chunks` 删掉。
import { ref } from 'vue'

// ⚠️ 必须写成 `import.meta.env.DEV` 这种**精确成员表达式**：Vite 只对精确形式做静态替换。
//    写成 `import.meta.env?.DEV` 时可选链会让替换**静默失效** ⇒ 开关恒 falsy、面板加载不出来（踩过）。
/** 开发构建恒开；生产构建默认关闭（**代码不进产物**）；要留给打包版就 VITE_DEV_PANEL=1 构建 */
export const DEV_PANEL_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEV_PANEL === '1'

const SESSION_KEY = 'culinary-idle.dev.session'
const SESSION_ROLE_KEY = 'culinary-idle.dev.role'

/** 本次会话是否已通过口令（放 sessionStorage：关掉浏览器就失效，不写进存档） */
export const devAuthed = ref(readSession())
/** 本次会话的登录角色（2026-09-25 新增第四角色）：'dev' | 'tuner' | null —— 决定开哪个页面 */
export const devRole = ref(readRole())

function readSession() {
  if (!DEV_PANEL_ENABLED) return false
  try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
}
function readRole() {
  if (!DEV_PANEL_ENABLED) return null
  try { return sessionStorage.getItem(SESSION_ROLE_KEY) === 'tuner' ? 'tuner' : 'dev' } catch { return null }
}

/** 由口令校验通过后调用（见 devAuth.js 的 devLogin）：role = 'dev' | 'tuner' */
export function markAuthed(role = 'dev') {
  devAuthed.value = true
  devRole.value = role === 'tuner' ? 'tuner' : 'dev'
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
    sessionStorage.setItem(SESSION_ROLE_KEY, devRole.value)
  } catch { /* 隐私模式下忽略 */ }
}

export function devLogout() {
  devAuthed.value = false
  devRole.value = null
  try {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_ROLE_KEY)
  } catch { /* 忽略 */ }
}

/**
 * 统一入口（热键 Ctrl+Shift+D / 启动页连点标题 / `?dev=1` 三处共用）：
 * 页面开着 → 收起；本次会话已登录 → **按角色开对应页面**（dev=开发者面板 / tuner=运营调参）；
 * 未登录 → 弹口令挡板。
 * ⚠️ 别在各处自己判断「有没有登录」，否则会出现「已登录还被再问一次口令」。
 */
export function requestDevEntry(ui) {
  if (!DEV_PANEL_ENABLED) return
  // 游客 / 试玩会话没有开发者权限（2026-09-24 权限角色划分：游客 < 玩家 < 开发者）。
  // 想进面板就刷新页面回普通会话 —— 游客态只存在内存里，刷新即消失。
  if (ui.guest) { ui.pushLog('试玩模式下不能打开内部入口（开发者 / 运营调参，刷新页面后可用）', 'warn'); return }
  if (ui.showDevPanel || ui.showTunerPanel) {
    ui.showDevPanel = false
    ui.showTunerPanel = false
    return
  }
  if (devAuthed.value) {
    if (devRole.value === 'tuner') ui.showTunerPanel = true
    else ui.showDevPanel = true
  } else {
    ui.openDevGate()
  }
}
