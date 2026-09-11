<script setup>
// 信箱（2026-09-11 新增）— 平台级投递通道的 UI：溢出转存待领、离线结算回执、通知。
// 纯读取 + 调用既有 player.mail* 接口；不改变任何既有奖励的发放路径（见 game/data/mail.js）。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { MAIL_CAP, MAIL_FROM, mailKindLabel } from '../game/data/mail.js'
import { getItem } from '../game/data/items.js'
import RelatedPages from '../components/RelatedPages.vue'

const player = usePlayerStore()
const ui = useUiStore()

const RELATED = [
  { view: 'log', label: '📖 图鉴' },
  { view: 'quests', label: '📋 任务中心' },
  { view: 'achievements', label: '🏅 成就与称号' },
  { view: 'stats', label: '📊 统计' },
]

const TABS = [
  { id: 'all', name: '全部' },
  { id: 'unclaimed', name: '待领' },
  { id: 'overflow', name: '📦 溢出转存' },
  { id: 'offline', name: '🌙 离线回执' },
  { id: 'welcome', name: '🎉 欢迎信' },
  { id: 'system', name: '🏔 系统' },
]
const tab = ref('all')
const expanded = ref(new Set())

const mails = computed(() => [...(player.mail?.list ?? [])].reverse()) // 新的在上面
const filtered = computed(() => {
  if (tab.value === 'all') return mails.value
  if (tab.value === 'unclaimed') return mails.value.filter((m) => m.reward && !m.claimed)
  return mails.value.filter((m) => m.kind === tab.value)
})
const tabCount = (id) => {
  if (id === 'all') return mails.value.length
  if (id === 'unclaimed') return player.mailUnclaimedCount()
  return mails.value.filter((m) => m.kind === id).length
}
const unclaimed = computed(() => player.mailUnclaimedCount())
const unread = computed(() => player.mailUnreadCount())

function fromOf(m) {
  return MAIL_FROM[m.from] ?? MAIL_FROM.system
}
function kindOf(m) {
  return mailKindLabel(m.kind)
}
function rewardText(m) {
  if (!m.reward) return ''
  const parts = []
  if (m.reward.gold > 0) parts.push(`金币 ×${m.reward.gold.toLocaleString()}`)
  for (const [id, qty] of Object.entries(m.reward.items ?? {})) parts.push(`${getItem(id)?.name ?? id} ×${qty}`)
  return parts.join('、')
}
function timeText(ts) {
  const d = Date.now() - (ts ?? 0)
  if (d < 60_000) return '刚刚'
  if (d < 3600_000) return `${Math.floor(d / 60_000)} 分钟前`
  if (d < 86400_000) return `${Math.floor(d / 3600_000)} 小时前`
  if (d < 7 * 86400_000) return `${Math.floor(d / 86400_000)} 天前`
  return new Date(ts).toLocaleDateString()
}

function toggle(m) {
  const s = new Set(expanded.value)
  if (s.has(m.id)) s.delete(m.id)
  else { s.add(m.id); player.markMailRead(m.id) }
  expanded.value = s
}
function claim(m) {
  const r = player.claimMail(m.id)
  if (!r.ok) { ui.pushLog(r.msg, 'warn'); return }
  ui.pushLog(`📬 领取「${m.subject}」：${rewardText(m) || '已领取'}`, 'gain')
}
function claimAll() {
  const r = player.claimAllMail()
  if (!r.ok) {
    ui.pushLog(r.blocked ? '背包空间不足，请先清理后再领取' : '没有待领的附件', 'warn')
    return
  }
  ui.pushLog(`📬 一键领取 ${r.count} 封${r.gold ? `，共 ${r.gold.toLocaleString()} 金币` : ''}${r.blocked ? `（${r.blocked} 封因背包不足未领）` : ''}`, 'gain')
}
function del(m) {
  if (!player.deleteMail(m.id)) { ui.pushLog('有未领附件的邮件不能删除', 'warn'); return }
  ui.pushLog('📬 已删除邮件', 'info')
}
function markAllRead() {
  player.markAllMailRead()
  ui.pushLog('📬 已全部标记为已读', 'info')
}
function clearSettled() {
  const n = player.clearSettledMail()
  ui.pushLog(n > 0 ? `📬 清理了 ${n} 封已结算邮件` : '没有可清理的邮件', n > 0 ? 'info' : 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📬 信箱</h2>
        <p class="dim">
          这里收三类东西：<b>溢出转存</b>（背包满或堆叠到顶时没放进去的部分，替你收着，随时可领）、
          <b>离线结算回执</b>（产出已在结算时发放，此处仅留明细）、以及系统通知。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ unclaimed }} 封待领</div>
        <p class="dim mono">{{ mails.length }}/{{ MAIL_CAP }} 封 · 未读 {{ unread }}</p>
      </div>
    </header>

    <!-- 概览 + 批量操作 -->
    <div class="card mv-hero">
      <div class="mv-stat"><span class="dim">待领附件</span><b class="mono" :class="{ 'mv-hot': unclaimed > 0 }">{{ unclaimed }}</b></div>
      <div class="mv-stat"><span class="dim">未读</span><b class="mono">{{ unread }}</b></div>
      <div class="mv-stat"><span class="dim">信箱容量</span><b class="mono">{{ mails.length }}/{{ MAIL_CAP }}</b></div>
      <div class="mv-actions">
        <button class="btn btn-sm btn-primary" :disabled="!unclaimed" @click="claimAll">一键领取（{{ unclaimed }}）</button>
        <button class="btn btn-sm" :disabled="!unread" @click="markAllRead">全部已读</button>
        <button class="btn btn-sm" @click="clearSettled">清理已结算</button>
      </div>
    </div>

    <!-- 分类 -->
    <div class="card mv-card">
      <div class="mv-tabs">
        <button
          v-for="t in TABS"
          :key="t.id"
          class="btn btn-sm"
          :class="{ 'btn-primary': tab === t.id }"
          @click="tab = t.id"
        >{{ t.name }}（{{ tabCount(t.id) }}）</button>
      </div>

      <div v-if="filtered.length" class="mv-list">
        <div
          v-for="m in filtered"
          :key="m.id"
          class="mv-item"
          :class="{ unread: !m.read, claimable: m.reward && !m.claimed }"
        >
          <div class="mv-head" @click="toggle(m)">
            <span class="mv-dot" :class="{ on: !m.read }"></span>
            <span class="mv-icon">{{ kindOf(m).icon }}</span>
            <span class="mv-subject">
              {{ m.subject }}
              <span v-if="m.reward && !m.claimed" class="badge badge-on">待领</span>
              <span v-else-if="m.reward && m.claimed" class="badge">已领</span>
            </span>
            <span class="dim mv-from">{{ fromOf(m).icon }} {{ fromOf(m).name }}</span>
            <span class="dim mono mv-time">{{ timeText(m.ts) }}</span>
            <span class="mv-caret">{{ expanded.has(m.id) ? '▾' : '▸' }}</span>
          </div>

          <div v-if="expanded.has(m.id)" class="mv-body">
            <p class="mv-text">{{ m.body }}</p>
            <div v-if="m.reward" class="mv-reward">
              <span class="dim">附件：{{ rewardText(m) }}</span>
              <button class="btn btn-sm btn-primary" :disabled="m.claimed" @click="claim(m)">
                {{ m.claimed ? '已领取' : '领取' }}
              </button>
            </div>
            <div class="mv-foot">
              <span class="dim">{{ kindOf(m).label }}</span>
              <button class="btn btn-sm" :disabled="!!(m.reward && !m.claimed)" :title="m.reward && !m.claimed ? '有未领附件，不能删除' : '删除这封邮件'" @click="del(m)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="dim mv-empty">
        {{ tab === 'all' ? '信箱是空的。挂机产出的溢出品与离线回执都会送到这里。' : '这个分类下没有邮件。' }}
      </p>
    </div>

    <!-- 说明 -->
    <div class="card mv-card">
      <div class="mv-h">📖 说明</div>
      <ul class="mv-rules">
        <li><b>背包满不再丢东西</b>：新物品种类放不下、或已有物品到了堆叠上限时，没发出去的部分会自动转存到「溢出转存」邮件里，腾出空间后领取即可（不会过期）。</li>
        <li><b>领取需要空间</b>：背包装不下时领取会被拒绝（邮件保持未领），避免「领出来又立刻转存成一封新邮件」的循环。</li>
        <li><b>信箱有上限 {{ MAIL_CAP }} 封</b>：满了会先淘汰最旧的「已领或无附件」邮件；如果 60 封全是未领附件，新邮件会被拒收——所以该扩容背包时还是要扩容。</li>
        <li><b>离线回执只是明细</b>：产出在离线结算时就已直接发放，邮件里不会再发一次。</li>
      </ul>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.mv-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}
.mv-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.mv-stat b {
  font-size: 16px;
}
.mv-hot {
  color: var(--accent, #d95a38);
}
.mv-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mv-card {
  margin-top: 12px;
}
.mv-h {
  font-weight: 600;
}
.mv-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.mv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mv-item {
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  overflow: hidden;
}
.mv-item.claimable {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.mv-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 13px;
  cursor: pointer;
  flex-wrap: wrap;
}
.mv-head:hover {
  background: rgba(217, 90, 56, 0.06);
}
.mv-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  flex: none;
}
.mv-dot.on {
  background: var(--primary, #d95a38);
}
.mv-icon {
  flex: none;
}
.mv-subject {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  min-width: 140px;
  flex: 1;
}
.mv-item.unread .mv-subject {
  color: var(--text);
}
.mv-from,
.mv-time {
  font-size: 12px;
  white-space: nowrap;
}
.mv-caret {
  color: var(--muted);
  font-size: 12px;
  flex: none;
}
.mv-body {
  padding: 0 10px 9px 24px;
  border-top: 1px dashed var(--border);
}
.mv-text {
  font-size: 12px;
  line-height: 1.75;
  color: var(--muted);
  white-space: pre-wrap;
  margin: 8px 0;
}
.mv-reward {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  padding: 7px 9px;
  border-radius: 6px;
  background: var(--warn-soft, rgba(200, 150, 20, 0.14));
}
.mv-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
}
.mv-empty {
  font-size: 12px;
  padding: 6px 0;
}
.mv-rules {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.85;
}
</style>
