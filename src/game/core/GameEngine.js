// 游戏主循环 — 需求文档 §10.2.1
// 用 setInterval 驱动（100ms），不依赖 requestAnimationFrame：
// 浏览器对 rAF 在后台/失焦时会暂停或节流，而 setInterval 后台仍运行（Chrome 节流至 ~1s），
// 保证挂机在切页、切标签页、失焦时都不中断。
// 引擎 tick 只负责“游戏语义”更新（产出/回合/倒计时），不必太高频——高频 tick 会让 ui.loopTick
// 每秒触发 80+ 次全量响应式刷新，把主线程拖到 ~18fps；进度条的丝滑已交由独立的 rAF(60fps)
// 绝对时间戳推进（见 ProgressBar.vue），所以引擎用 10fps 就足够，主线程得以回到 ~60fps。
// 100ms ≈ 10fps 引擎刷新；单帧 delta 上限 60s（防止长时间挂起后一次补算过多）；更久的离线由 OfflineProgress 在启动时结算（§10.2.2）。

const TICK_INTERVAL_MS = 100
const MAX_DELTA_MS = 60_000

export class GameEngine {
  /**
   * @param {object} options
   * @param {(deltaMs: number) => void} [options.onTick]    每次 tick 回调
   * @param {() => void} [options.onAutosave]                自动存档回调（默认 60s 一次，§8.2）
   * @param {number} [options.autosaveIntervalMs]
   */
  constructor({ onTick, onAutosave, autosaveIntervalMs = 60_000 } = {}) {
    this.onTick = onTick
    this.onAutosave = onAutosave
    this.autosaveIntervalMs = autosaveIntervalMs

    this.running = false
    this._timerId = null
    this._lastUpdate = 0
    this._lastSave = 0
    this.tickCount = 0
  }

  start() {
    if (this.running) return
    this.running = true
    this._lastUpdate = performance.now()
    this._lastSave = this._lastUpdate
    this._timerId = setInterval(() => this._tick(), TICK_INTERVAL_MS)
  }

  pause() {
    this.running = false
    if (this._timerId !== null) {
      clearInterval(this._timerId)
      this._timerId = null
    }
  }

  _tick() {
    if (!this.running) return

    const now = performance.now()
    const delta = Math.min(now - this._lastUpdate, MAX_DELTA_MS)
    this._lastUpdate = now
    this.tickCount++

    try {
      this.onTick?.(delta)
    } catch (err) {
      console.error('[GameEngine] tick error', err)
    }

    if (now - this._lastSave >= this.autosaveIntervalMs) {
      this._lastSave = now
      try {
        this.onAutosave?.()
      } catch (err) {
        console.error('[GameEngine] autosave error', err)
      }
    }
  }
}
