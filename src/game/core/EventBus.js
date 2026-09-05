// 极简事件总线：技能动作、升级、日志等跨模块通信用

const listeners = new Map()

export const EventBus = {
  /** @param {string} event @param {Function} fn */
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    const hs = listeners.get(event)
    // 去重：同事件已注册相同函数体（dev HMR 重载后源码相同但引用不同）→ 跳过，防止监听堆叠
    for (const h of hs) {
      if (h.toString() === fn.toString()) return () => this.off(event, fn)
    }
    hs.add(fn)
    return () => this.off(event, fn)
  },

  off(event, fn) {
    listeners.get(event)?.delete(fn)
  },

  emit(event, payload) {
    const hs = listeners.get(event)
    if (!hs) return
    for (const fn of [...hs]) {
      try {
        fn(payload)
      } catch (err) {
        console.error(`[EventBus] handler error on "${event}"`, err)
      }
    }
  },
}
