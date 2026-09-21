// 新手漏斗汇总（用户测试用）—— 把 N 位受试者的漏斗 CSV 合成一张论文表格
//
// 用法：
//   1) 每位受试者玩完 30 分钟后，在开发者面板「📊 埋点」页签点「⧉ 复制漏斗 CSV」，
//      粘贴成 `test-data/P01.csv`、`P02.csv` …（首行是表头，别删）
//   2) node scripts/dev/funnel_report.mjs test-data            # 汇总整个目录
//      node scripts/dev/funnel_report.mjs test-data P01.csv …  # 或指定文件
//
// 输出：终端表格 + `test-data/report.md`（可直接贴进论文/答辩）。
// 注意：**不做统计显著性**，只做描述统计（n 很小，写显著性是自欺）。
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const dir = args[0] ?? 'test-data'
let files
if (args.length > 1) {
  files = args.slice(1)
} else {
  try {
    fs.mkdirSync(dir, { recursive: true }) // 目录不存在就建一个空的，别抛栈
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).map((f) => path.join(dir, f))
  } catch {
    files = []
  }
}

if (!files.length) {
  console.error(`没找到漏斗 CSV。\n  用法：node scripts/dev/funnel_report.mjs ${dir}\n  把受试者的 CSV 放进 ${dir}/（文件名如 P01.csv），或直接传文件名。\n  怎么导出：游戏内 Ctrl+Shift+D → 口令 → 「📊 埋点」→ 「⧉ 复制漏斗 CSV」（详见 docs/新手引导用户测试执行手册.md）`)
  process.exit(1)
}

/** 最小 CSV 行解析：支持引号字段（名称里可能有逗号），返回字段数组 */
function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') inQ = false
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

/** 解析一份漏斗 CSV：表头 `步骤,名称,完成,开局后毫秒,本步耗时毫秒` */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  const rows = []
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line)
    if (f.length < 5) continue
    const no = Number(f[0])
    if (!Number.isFinite(no)) continue
    const num = (v) => (v === '' || v == null ? null : Number(v))
    rows.push({ no, label: f[1], done: f[2] === '1', at: num(f[3]), gap: num(f[4]) })
  }
  return rows
}

const subs = files.map((f) => {
  const rows = parseCsv(fs.readFileSync(f, 'utf8'))
  const done = rows.filter((r) => r.done)
  const first = done.find((r) => r.at != null)?.at ?? null
  const slowest = done.filter((r) => r.gap != null).sort((a, b) => b.gap - a.gap)[0] ?? null
  const pending = rows.find((r) => !r.done) ?? null
  const lastAt = done.length ? Math.max(...done.map((r) => r.at ?? 0)) : null
  return { name: path.basename(f, '.csv'), rows, doneCount: done.length, total: rows.length, first, slowest, pending, lastAt }
})

const sec = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(1) + 's')
const minsec = (ms) => (ms == null ? '—' : `${Math.floor(ms / 60000)}m${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s`)
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
const median = (arr) => {
  if (!arr.length) return null
  const v = [...arr].sort((a, b) => a - b)
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
}

// ── 逐人明细 ──
console.log(`\n══ 受试者明细（${subs.length} 人）══`)
console.log('受试者'.padEnd(10), '完成'.padStart(6), '首个正反馈'.padStart(12), '最后一步时刻'.padStart(14), '最慢一步')
for (const s of subs) {
  console.log(
    s.name.padEnd(10),
    `${s.doneCount}/${s.total}`.padStart(6),
    sec(s.first).padStart(12),
    minsec(s.lastAt).padStart(14),
    s.slowest ? `${s.slowest.label.slice(0, 16)}（${minsec(s.slowest.gap)}）` : '—'
  )
}

// ── 逐步汇总（论文主表）──
console.log(`\n══ 逐步完成率与耗时（n=${subs.length}）══`)
const total = subs[0].total
const head = ['步骤', '完成人数', '完成率', '首次达成(中位)', '该步耗时(中位)'].map((h, i) => (i === 0 ? h.padEnd(30) : h.padStart(14)))
console.log(head.join(''))
const stepRows = []
for (let i = 0; i < total; i++) {
  const cells = subs.map((s) => s.rows[i]).filter(Boolean)
  const doneN = cells.filter((c) => c.done).length
  const firsts = cells.filter((c) => c.done && c.at != null).map((c) => c.at)
  const gaps = cells.filter((c) => c.gap != null).map((c) => c.gap)
  const label = (cells[0]?.label ?? `#${i + 1}`).slice(0, 28)
  const row = [label.padEnd(30), String(doneN).padStart(14), `${Math.round((doneN / subs.length) * 100)}%`.padStart(14), minsec(median(firsts)).padStart(14), minsec(median(gaps)).padStart(14)]
  console.log(row.join(''))
  stepRows.push({ no: i + 1, label, doneN, pct: Math.round((doneN / subs.length) * 100), firstMed: median(firsts), gapMed: median(gaps) })
}

// ── 结论块（论文里可直接引用的三个数）──
const firsts = subs.map((s) => s.first).filter((v) => v != null)
const inFirst30 = subs.filter((s) => s.doneCount >= Math.ceil(total * 0.8)).length
console.log(`\n══ 可写进论文的三个数 ══`)
console.log(`· 首个正反馈时刻：中位 ${minsec(median(firsts))}（范围 ${minsec(Math.min(...firsts))} ~ ${minsec(Math.max(...firsts))}）`)
console.log(`· 引导完成度：${subs.map((s) => s.doneCount).join('/')}（满分 ${total}）；走完 ≥80% 的有 ${inFirst30}/${subs.length} 人`)
const stuck = stepRows.filter((r) => r.pct < 60).sort((a, b) => a.pct - b.pct).slice(0, 3)
console.log(`· 卡点（按完成率最低排序）：${stuck.length ? stuck.map((r) => `第${r.no}步 ${r.label}（${r.pct}%）`).join(' · ') : '无明显卡点'}`)

// ── 落一份 markdown ──
const md = []
md.push('# 新手引导漏斗 · 用户测试汇总', '')
md.push(`- 受试者：${subs.length} 人（每人首次进入游戏后连续玩 30 分钟）`)
md.push(`- 数据来源：游戏内「新手漏斗」（存档里的 guide.trace，由开发者面板导出 CSV）`)
md.push('')
md.push('## 总体规划', '')
md.push('| 受试者 | 完成步数 | 首个正反馈 | 最后一步时刻 | 最慢一步 |')
md.push('| --- | --- | --- | --- | --- |')
for (const s of subs) md.push(`| ${s.name} | ${s.doneCount}/${s.total} | ${sec(s.first)} | ${minsec(s.lastAt)} | ${s.slowest ? `${s.slowest.label}（${minsec(s.slowest.gap)}）` : '—'} |`)
md.push('')
md.push('## 逐步完成率与耗时（主表）', '')
md.push('| # | 目标 | 完成人数 | 完成率 | 首次达成(中位) | 该步耗时(中位) |')
md.push('| --- | --- | --- | --- | --- | --- |')
for (const r of stepRows) md.push(`| ${r.no} | ${r.label} | ${r.doneN}/${subs.length} | ${r.pct}% | ${minsec(r.firstMed)} | ${minsec(r.gapMed)} |`)
md.push('')
md.push('## 结论', '')
md.push(`- 首个正反馈时刻中位 **${minsec(median(firsts))}**（范围 ${minsec(Math.min(...firsts))} ~ ${minsec(Math.max(...firsts))}）`)
md.push(`- 30 分钟内走完 ≥80% 引导的有 **${inFirst30}/${subs.length}** 人`)
md.push(`- 卡点：${stuck.length ? stuck.map((r) => `第 ${r.no} 步「${r.label}」完成率仅 ${r.pct}%`).join('；') : '无明显卡点'}`)
md.push('')
md.push('> 说明：n 很小，只做描述统计，不做显著性检验。')
const out = path.join(dir, 'report.md')
fs.writeFileSync(out, md.join('\n'), 'utf8')
console.log(`\n已写出 ${out}`)
