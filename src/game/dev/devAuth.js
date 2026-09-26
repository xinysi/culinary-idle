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
/** sha256(`${DEV_SALT}:${口令}`)；2026-09-25 用户设置：口令 msfzslsh（开发者名 ShiShen） */
export const DEV_PASS_HASH = '15f7cafcdde427fc35fceb49ddc334da89c3e7e4c0eba73d354082b311d09abf'

/** 开发者名（2026-09-25 用户设置：ShiShen）。只是挡板的一部分，同样不进生产构建。 */
export const DEV_USER_NAME = 'ShiShen'

/**
 * 身份表（2026-09-25 新增第四角色「运营调参员」）：同名 + 对口令 → 对应角色。
 *   dev   = 开发者（开发者页面全部 5 分区）
 *   tuner = 运营调参员（只进「🎛 运营调参」页：改运行时系数，无任何存档/破坏性操作）
 * 权限矩阵：试玩 < 玩家 < 运营调参员 < 开发者。改 dev 口令用 scripts/dev/set_dev_password.mjs。
 */
export const TUNER_PASS_HASH = '8505bf4d9518d7a5b32757801ac3089c131a551684c4d2c33d0794aab9804f69'
export const TUNER_NAME = 'YunYing'
export const IDENTITIES = [
  { name: DEV_USER_NAME, hash: DEV_PASS_HASH, role: 'dev' },
  { name: TUNER_NAME, hash: TUNER_PASS_HASH, role: 'tuner' },
]

/** 兜底提示：方便本人/答辩时快速核对（可用性提示，不是安全机制） */
export const DEV_DEFAULT_PASSWORD_HINT = 'ShiShen=开发者 · YunYing=运营调参（口令用 scripts/dev/set_dev_password.mjs 配置）'

export function hashPassword(password) {
  return sha256Hex(`${DEV_SALT}:${password ?? ''}`)
}

/**
 * 登录 = 开发者名 + 口令 双校验（2026-09-25 用户要求加用户名）。
 * 名字比较大小写不敏感（挡板易用性优先）；真正的保护仍是构建期隔离。
 * @returns {{ok:boolean, role?:'dev'|'tuner', msg:string}}
 */
export function devLogin(userName, password) {
  const name = String(userName ?? '').trim()
  const id = IDENTITIES.find((i) => i.name.toUpperCase() === name.toUpperCase())
  if (!id) return { ok: false, msg: '开发者名不正确' }
  if (hashPassword(password) !== id.hash) return { ok: false, msg: '口令不正确' }
  markAuthed(id.role)
  return { ok: true, role: id.role, msg: id.role === 'dev' ? '已进入开发者模式' : '已进入运营调参模式' }
}
