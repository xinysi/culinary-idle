// 存档管理 — 需求文档 §8.2 / §10.4
// 当前实现：LocalStorage + 3 存档位 + 存档文件 导入导出。
// §10.1 主存储指定 IndexedDB，后续迭代可在保留本类接口的前提下切换实现。
// 存档结构含 schemaVersion，旧版本存档走 migrate 迁移。

export const SAVE_PREFIX = 'culinary-idle'
export const SAVE_VERSION = 1
export const SLOT_COUNT = 3

export class SaveManager {
  constructor({ slot = 0 } = {}) {
    this._slot = slot
  }

  get slot() {
    return this._slot
  }

  set slot(n) {
    this._slot = n
  }

  keyFor(slot) {
    return `${SAVE_PREFIX}.save.${slot}`
  }

  // ── 当前位操作 ──
  load() {
    return this.loadSlot(this._slot)
  }

  save(data) {
    this.saveSlot(this._slot, data)
  }

  clear() {
    this.clearSlot(this._slot)
  }

  // ── 指定槽位操作 ──
  loadSlot(slot) {
    try {
      const raw = localStorage.getItem(this.keyFor(slot))
      if (!raw) return null
      return this.migrate(JSON.parse(raw))
    } catch (err) {
      console.error(`[SaveManager] load slot ${slot} failed`, err)
      return null
    }
  }

  saveSlot(slot, data) {
    try {
      localStorage.setItem(this.keyFor(slot), JSON.stringify(data))
    } catch (err) {
      console.error(`[SaveManager] save slot ${slot} failed`, err)
      throw err
    }
  }

  clearSlot(slot) {
    localStorage.removeItem(this.keyFor(slot))
  }

  /** 三个存档位概览（存档面板用） */
  listSlots() {
    return [0, 1, 2].map((slot) => {
      const data = this.loadSlot(slot)
      return { slot, exists: !!data, data }
    })
  }

  /** 导出存档为 存档文件 文件下载 */
  exportToFile(data, filename = `culinary-idle-slot${this._slot}-${Date.now()}.json`) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /** 从 存档文件 文件导入存档（浏览器 File 对象） */
  async importFromFile(file) {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!this.isValid(data)) throw new Error('无效的存档文件')
    return this.migrate(data)
  }

  isValid(data) {
    return Boolean(
      data &&
      typeof data === 'object' &&
      typeof data.schemaVersion === 'number' &&
      data.player &&
      typeof data.player === 'object'
    )
  }

  /** 版本迁移：目前仅 v1，预留钩子 */
  migrate(data) {
    if (!data) return null
    if (data.schemaVersion === SAVE_VERSION) return data
    console.warn(`[SaveManager] unsupported schemaVersion ${data.schemaVersion}, latest ${SAVE_VERSION}`)
    return data
  }
}
