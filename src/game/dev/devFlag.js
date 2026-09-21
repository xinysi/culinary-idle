// 开发者面板的「小开关」——**唯一允许被入口（App.vue / SplashScreen.vue）引用的模块**。
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

/** 本次会话是否已通过口令（放 sessionStorage：关掉浏览器就失效，不写进存档） */
export const devAuthed = ref(readSession())

function readSession() {
  if (!DEV_PANEL_ENABLED) return false
  try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
}

/** 由口令校验通过后调用（见 devAuth.js 的 devLogin） */
export function markAuthed() {
  devAuthed.value = true
  try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* 隐私模式下忽略 */ }
}

export function devLogout() {
  devAuthed.value = false
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* 忽略 */ }
}

/**
 * 统一入口（热键 Ctrl+Shift+D / 启动页连点标题 / `?dev=1` 三处共用）：
 * 面板开着 → 收起；本次会话已登录 → 直接开面板；否则弹口令挡板。
 * ⚠️ 别在各处自己判断「有没有登录」，否则会出现「已登录还被再问一次口令」。
 */
export function requestDevEntry(ui) {
  if (!DEV_PANEL_ENABLED) return
  if (ui.showDevPanel) { ui.toggleDevPanel(false); return }
  if (devAuthed.value) ui.toggleDevPanel(true)
  else ui.openDevGate()
}
