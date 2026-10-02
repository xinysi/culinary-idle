// 运营驾驶舱 —— 报表导出（2026-10-02 新角色 ops）
//
// 驾驶舱的价值一半在"看到"，一半在"带走"：这些表直接能粘进论文/周报。
// 🔒 只读：本文件只把传入的 dashboard 拼成字符串，不碰 player。
import { OPS_CALIBRATION, hoursText } from './opsBenchmarks.js'

const fmt = (v) => Number(v ?? 0).toLocaleString()

/** 驾驶舱 → Markdown 报表 */
export function buildMarkdown(dashboard, { at = new Date() } = {}) {
  const { overview: o, funnel, funnelProgress: fp, economy, topItems: items } = dashboard
  const L = []
  L.push('# 运营数据快照')
  L.push('')
  L.push(`> 导出时间：${at.toLocaleString()} · 口径：本机存档 + 本机埋点`)
  L.push('')
  L.push('## 进度概览')
  L.push('')
  L.push('| 指标 | 值 |')
  L.push('| --- | --- |')
  L.push(`| 金币 | ${fmt(o.gold)} |`)
  L.push(`| 最高技能等级 | Lv${o.maxLevel} |`)
  L.push(`| 采集/制作/辅助总等级 | ${o.gatherLevels} / ${o.craftLevels} / ${o.supportLevels} |`)
  L.push(`| 转生次数 | ${o.prestiges} |`)
  L.push(`| 挑战塔 | 当前 F${o.towerFloor} · 最高 F${o.towerBest} |`)
  L.push(`| 米其林 | ${o.michelinStars}★（${fmt(o.michelinScore)} 分） |`)
  L.push(`| 成就 | ${o.achievements.count} / ${o.achievements.total} |`)
  L.push(`| 图鉴 | ${o.collected.count} / ${o.collected.total} |`)
  L.push(`| 离线上限 | ${o.offlineHours}h |`)
  L.push('')
  L.push('## 新手漏斗')
  L.push('')
  L.push(`达成 ${fp.done} / ${fp.total}（${(fp.pct * 100).toFixed(1)}%）`)
  L.push('')
  L.push('| 里程碑 | 状态 | 开局后 |')
  L.push('| --- | --- | --- |')
  for (const r of funnel) L.push(`| ${r.label} | ${r.done ? '✅' : '—'} | ${r.seconds != null ? r.seconds + 's' : ''} |`)
  L.push('')
  L.push('## 经济水位（按小时的可见部分）')
  L.push('')
  L.push('| 来源 | 金币/时 | 占比 |')
  L.push('| --- | --- | --- |')
  for (const r of economy.rows) L.push(`| ${r.label} | ${fmt(r.goldPerHour)} | ${(r.pct * 100).toFixed(1)}% |`)
  L.push(`| **合计** | **${fmt(economy.total)}** | 100% |`)
  L.push('')
  L.push(`金币获取加成：+${economy.goldGainPct}%（钱庄，夹 ≤15%）`)
  L.push('')
  L.push('## 道具 TopN（背包持有量）')
  L.push('')
  L.push('| 物品 | 数量 | 单价 | 合计价值 |')
  L.push('| --- | --- | --- | --- |')
  for (const r of items) L.push(`| ${r.name} | ${fmt(r.qty)} | ${fmt(r.value)} | ${fmt(r.total)} |`)
  L.push('')
  L.push('## 内容节奏（每 10 级段新增内容条目）')
  L.push('')
  L.push('| 段位 | 采集 | 制作 | 农耕 | 探索 | 合计 |')
  L.push('| --- | --- | --- | --- | --- | --- |')
  for (const r of (dashboard.cadence ?? [])) L.push(`| ${r.label} | ${r.gather} | ${r.craft} | ${r.farm} | ${r.explore} | ${r.total} |`)
  L.push('')
  if (dashboard.cadenceGaps?.thinnest?.length) {
    L.push(`最薄的三段：${dashboard.cadenceGaps.thinnest.map((r) => `${r.label}（${r.total}）`).join(' · ')}；均值 ${dashboard.cadenceGaps.mean.toFixed(1)}`)
    L.push('')
  }
  L.push('## 标定对照（成长时长 · 2026-09-28 实测）')
  L.push('')
  L.push(`> ${OPS_CALIBRATION.note}`)
  L.push('')
  L.push('| 线路 | 零加成基准 |')
  L.push('| --- | --- |')
  L.push(`| 采摘 | ${hoursText(OPS_CALIBRATION.gatherHours)} |`)
  L.push(`| 垂钓 | ${OPS_CALIBRATION.fishingDays} 天 |`)
  L.push(`| 狩猎 | ${hoursText(OPS_CALIBRATION.huntingHours)} |`)
  L.push(`| 挖掘 | ${hoursText(OPS_CALIBRATION.excavationHours)} |`)
  L.push(`| 农耕 | ${OPS_CALIBRATION.farmingDays} 天 |`)
  L.push(`| 保鲜 | ${hoursText(OPS_CALIBRATION.preserveHours)} |`)
  L.push(`| 食灵召唤 | ${hoursText(OPS_CALIBRATION.spiritHours)} |`)
  L.push(`| 美食探索 | ${OPS_CALIBRATION.exploreDays} 天 |`)
  L.push(`| 战斗三技能 | ${OPS_CALIBRATION.combatDays} 天 |`)
  L.push(`| 单场时长（中位） | ${OPS_CALIBRATION.ttkMedianSec}s |`)
  L.push(`| 满配时收 | ${fmt(OPS_CALIBRATION.endgameGoldPerHour)} 金/时 |`)
  L.push('')
  return L.join('\n')
}

/** 简版 CSV（进度概览 + 漏斗，方便直接进表格） */
export function buildCsv(dashboard) {
  const { overview: o, funnel } = dashboard
  const rows = [['区块', '指标', '值']]
  rows.push(['概览', '金币', o.gold])
  rows.push(['概览', '最高技能等级', o.maxLevel])
  rows.push(['概览', '转生次数', o.prestiges])
  rows.push(['概览', '挑战塔最佳', o.towerBest])
  rows.push(['概览', '米其林星', o.michelinStars])
  rows.push(['概览', '成就', `${o.achievements.count}/${o.achievements.total}`])
  rows.push(['概览', '图鉴', `${o.collected.count}/${o.collected.total}`])
  for (const r of funnel) rows.push(['漏斗', r.label, r.done ? `${r.seconds}s` : '未达成'])
  return rows.map((r) => r.join(',')).join('\n')
}

/** 浏览器下载（Blob + a[download]）。非浏览器环境（CI）不会调用它，调用也安全返回 false */
export function downloadText(filename, text, mime = 'text/plain') {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
