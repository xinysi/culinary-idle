<script setup>
// 每日签到弹窗：连续签到 7 天循环奖励；漏签重置为第 1 天
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SIGN_IN_REWARDS } from '../stores/player.js'
import { getItem } from '../game/data/items.js'

const player = usePlayerStore()
const ui = useUiStore()

const todayDay = computed(() => {
  if (!player.canSignInToday()) return player.signIn?.day ?? 0 // 已签 → 今日天数
  // 未签：昨天签过显示下一天，否则第 1 天（用 setDate 精确减 1 天，避免跨日/DST 隐患）
  const d = new Date(); d.setDate(d.getDate() - 1)
  const yesterday = d.toLocaleDateString('en-CA')
  return player.signIn?.lastDate === yesterday ? ((player.signIn?.day ?? 0) % 7) + 1 : 1
})
function rewardText(r) {
  const parts = []
  if (r.gold) parts.push(`${r.gold} 金币`)
  for (const [itemId, qty] of Object.entries(r.items ?? {})) {
    const name = getItem(itemId)?.name // 无效 id 兜底用 id，避免显示 undefined
    parts.push(`${name ?? itemId} ×${qty}`)
  }
  return parts.join('、')
}
function doSign() {
  const r = player.signInToday()
  if (r.ok) ui.pushLog(`🎁 第 ${r.day} 天签到：${rewardText(r.reward)}`, 'gain')
}
</script>

<template>
  <div class="modal-backdrop" @click.self="ui.toggleSignIn(false)">
    <div class="modal signin-modal">
      <header class="modal-head">
        <h3>🎁 每日签到</h3>
        <button class="btn btn-sm" @click="ui.toggleSignIn(false)">✕</button>
      </header>
      <div class="item-detail-body">
        <p class="dim">连续签到 7 天循环领奖；漏签一天重置为第 1 天</p>
        <div class="signin-grid">
          <div
            v-for="(def, i) in SIGN_IN_REWARDS"
            :key="i"
            class="signin-day"
            :class="{ today: i + 1 === todayDay, done: player.canSignInToday() ? false : i + 1 <= (player.signIn?.day ?? 0) }"
          >
            <div class="dim">第 {{ i + 1 }} 天</div>
            <div class="signin-reward">{{ rewardText(player.signInRewardFor(i + 1)) }}</div>
          </div>
        </div>
        <div style="margin-top: 12px; text-align: right">
          <button
            v-if="player.canSignInToday()"
            class="btn btn-primary"
            @click="doSign"
          >
            签到（第 {{ todayDay }} 天）
          </button>
          <span v-else class="dim">今日已签到 ✔（明天再来）</span>
        </div>
      </div>
    </div>
  </div>
</template>
