// 慢节拍（1Hz 级）的公共节拍源 —— 2026-09-28 立。
//
// 为什么需要它：全站此前统一用 `ui.loopTick` 驱动「倒计时/进度实时刷新」，而那是**引擎节拍 10Hz**
// （`GameEngine.js` 的 `TICK_INTERVAL_MS = 100`）。绝大多数页面只需要「秒级」刷新 —— 文案粒度是秒
// （`12 分 30 秒`），10Hz 是需求的 10 倍。
//
// ⚠️ **但先量再改**（2026-09-28 实测，别凭感觉搬）：把这些页面各自的「每 tick 重算」单独计时后，
//    除了效果总览（`collectEffects` = **2037 µs/次**，105 行 × 逐条 `row.read(player)`）以外，
//    其余全部在 **1~14 µs** 量级（cellarState 4.3 · mushroomState 5.0 · caravanState 3.6 · ranchState 3.6 ·
//    realmState 3.7 · expeditionState 7.8 · getRunningIdleSkills 14.1）⇒ 10Hz 下只有 **0.04~0.14 ms/秒**。
//    ⇒ **只收了效果总览那一处**；其余页面留在 `loopTick` 上（改它们等于白改，而且会把各自的
//    `ProgressBar`（数值模式）从 10Hz 降到 1Hz，进度条肉眼可见地一格一格跳）。
//    想要进度条既省又丝滑，正确做法是让 `ProgressBar` 走**绝对时间戳模式**（`start-at`/`duration-ms`，
//    它自己用 rAF 写 transform，不经过 Vue）—— 那是另一个改动，不在本轮范围。
//
// 用法（必须在 setup 里同步调用，内部用 onMounted/onBeforeUnmount）：
//   const tick = useIntervalTick(1000)
//   const x = computed(() => { tick.value /* 只作依赖触发器 */; ... })
//
// 🔴 用例与守卫：`scripts/ci/ui_tick_audit.mjs` 钉住「谁能用 `ui.loopTick`」（显式名单 + 实测依据），
//    并断言这里的间隔不得小于 500ms —— 否则等于把刚省下来的又装回去。
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** @param {number} ms 刷新间隔（默认 1000 = 1Hz）。守卫要求 ≥ 500。 */
export function useIntervalTick(ms = 1000) {
  const tick = ref(0)
  let timer = null
  onMounted(() => {
    timer = setInterval(() => { tick.value++ }, ms)
  })
  onBeforeUnmount(() => {
    if (timer) { clearInterval(timer); timer = null }
  })
  return tick
}