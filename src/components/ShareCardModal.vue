<script setup>
// 战报分享卡 — 生成一张 PNG 战报（2026-09-06）
import { computed, ref, nextTick, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { COLLECTABLE_SETS } from '../game/data/setBonuses.js'
import { ALL_ACHIEVEMENTS } from '../game/data/achievements.js'

const player = usePlayerStore()
const ui = useUiStore()
const canvasRef = ref(null)
const generated = ref(false)

const stats = computed(() => [
  ['对决等级', String(player.combatLevel)],
  ['图鉴完成度', `${player.collectionPct}%`],
  ['成就解锁', `${player.achievements.length} / ${ALL_ACHIEVEMENTS.length}`],
  ['总等级', String(player.totalLevels)],
  ['转生次数', String(player.stats?.prestiges ?? 0)],
  ['挑战塔最高层', String(player.tower?.best ?? 0)],
  ['秘境最高层', String(player.realm?.best ?? 0)],
  ['厨艺大赛月分', String(player.fest?.score ?? 0)],
  ['锻造套装集齐', `${player.setBonuses?.length ?? 0} / ${COLLECTABLE_SETS.length}`],
  ['餐厅收入总额', (player.stats?.restaurantTotal ?? 0).toLocaleString()],
  ['累计金币', (player.stats?.totalGoldEarned ?? 0).toLocaleString()],
])

function roundRectPath(ctx, x, y, w, h, r) {
  // 兼容实现（roundRect 在部分 Chromium 内核不存在 → 曾整卡空白）
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function draw() {
  const c = canvasRef.value
  if (!c) return
  try {
    const ctx = c.getContext('2d')
    const W = 640, H = 900
    c.width = W
    c.height = H
    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#4a2f26')
    grad.addColorStop(0.5, '#6b3f2c')
    grad.addColorStop(1, '#8a5a2b')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    // 顶部标题
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f5e6c8'
    ctx.font = 'bold 30px "Microsoft YaHei", "Noto Sans SC", sans-serif'
    ctx.fillText('美食放置：食之契约', W / 2, 66)
    ctx.font = '15px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = 'rgba(245, 230, 200, 0.75)'
    ctx.fillText('Culinary Idle: Taste Covenant · 战报', W / 2, 96)
    // 玩家名
    ctx.font = 'bold 26px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = '#fff'
    const title = player.title ? `${player.name}「${player.title}」` : player.name
    ctx.fillText(title, W / 2, 160)
    // 卡片行
    const rows = stats.value
    const cardY = 200
    const cardH = 524
    ctx.fillStyle = 'rgba(255, 251, 244, 0.97)'
    roundRectPath(ctx, 40, cardY, W - 80, cardH, 16)
    ctx.fill()
    ctx.fillStyle = '#4a2f26'
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif'
    rows.forEach(([k, v], i) => {
      const y = cardY + 36 + i * 44
      ctx.fillStyle = '#8a6b55'
      ctx.textAlign = 'left'
      ctx.font = '15px "Microsoft YaHei", sans-serif'
      ctx.fillText(k, 70, y)
      ctx.fillStyle = '#4a2f26'
      ctx.textAlign = 'right'
      ctx.font = 'bold 16px "Microsoft YaHei", sans-serif'
      ctx.fillText(v, W - 70, y)
      if (i < rows.length - 1) {
        ctx.strokeStyle = 'rgba(217, 90, 56, 0.18)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(70, y + 12)
        ctx.lineTo(W - 70, y + 12)
        ctx.stroke()
        ctx.setLineDash([])
      }
    })
    // 底部
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f5e6c8'
    ctx.font = '14px "Microsoft YaHei", sans-serif'
    ctx.fillText('加入我的美食之旅，一起成为食神！', W / 2, H - 66)
    ctx.font = '12px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = 'rgba(245, 230, 200, 0.6)'
    ctx.fillText('xinysi.github.io/culinary-idle · ' + new Date().toLocaleDateString(), W / 2, H - 36)
  } catch (e) {
    console.warn('[ShareCard] draw failed', e)
  }
  generated.value = true
}

// 弹窗打开（canvas 已挂载）后再绘制——曾因 setup 时绘制（canvas 未挂载）导致空白
watch(
  () => ui.showShareCard,
  (v) => {
    if (v) {
      nextTick(() => requestAnimationFrame(draw))
    }
  },
)

function download() {
  const a = document.createElement('a')
  a.href = canvasRef.value.toDataURL('image/png')
  a.download = `食之契约战报-${Date.now()}.png`
  a.click()
}
function close() {
  ui.closeShareCard()
}
</script>

<template>
  <div v-if="ui.showShareCard" class="modal-backdrop" @click.self="close">
    <div class="modal share-modal">
      <header class="modal-head">
        <h3>📸 战报分享卡</h3>
        <button class="btn btn-sm" @click="close">✕</button>
      </header>
      <canvas ref="canvasRef" class="share-canvas"></canvas>
      <div class="share-actions">
        <a class="btn btn-sm btn-primary" @click="download">⬇ 下载 PNG</a>
        <span class="dim">生成后可分享到社交平台/群聊</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-modal { max-width: 680px; }
.share-canvas { width: 100%; max-width: 480px; margin: 10px auto; display: block; border-radius: 12px; }
.share-actions { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 6px; }
</style>
