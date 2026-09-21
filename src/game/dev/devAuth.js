// 开发者口令校验（**只有开发者面板会 import 这个文件**）
//
// 🔒 请先读懂这三层，别把它当成权限系统：
//   ① **构建期隔离（唯一真正的保护）**：入口只引用 `devFlag.js` 的开关；本文件（含盐与口令哈希）
//      只被 `DevEntry.vue` 引用 ⇒ 生产构建里那个异步 chunk 会被 `vite.config.js` 的
//      `strip-dev-panel-chunks` 整块删掉。守卫：`scripts/ci/dev_panel_audit.mjs`（构建后断言产物里搜不到盐值/口令逻辑）。
//   ② **口令只是挡板**：防的是「演示时被同学/老师随手点开改乱数据」。哈希写在前端，谁都能读；
//      纯前端不可能有真正的权限控制。
//   ③ **真正管「用户数据」需要服务端**：本游戏存档就在本机 `localStorage`，没有后端。
//
// 改口令：`node scripts/dev/set_dev_password.mjs <新口令>`（自动算哈希并改写下面两行）。
import { markAuthed } from './devFlag.js'
import { sha256Hex } from './hash.js'

/** 口令加盐（改口令请用 scripts/dev/set_dev_password.mjs，别手改下面两行） */
export const DEV_SALT = 'culinary-idle-dev-2026'
/** sha256(`${DEV_SALT}:${口令}`)；默认口令 `dev123456` —— **请务必先改掉** */
export const DEV_PASS_HASH = 'c608e63e662163631d83f4fbb1f6a408d27c82aa280706e3f85371772dcbe430'

/** 兜底提示：把默认口令写在这里，方便本人/答辩时快速核对（可用性提示，不是安全机制） */
export const DEV_DEFAULT_PASSWORD_HINT = '默认口令 dev123456 —— 请用 scripts/dev/set_dev_password.mjs 改掉'

export function hashPassword(password) {
  return sha256Hex(`${DEV_SALT}:${password ?? ''}`)
}

/** @returns {{ok:boolean,msg:string}} */
export function devLogin(password) {
  if (hashPassword(password) !== DEV_PASS_HASH) return { ok: false, msg: '口令不正确' }
  markAuthed()
  return { ok: true, msg: '已进入开发者模式' }
}
