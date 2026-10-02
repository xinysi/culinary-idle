// 全量排查「开发者腔泄漏到玩家可见文本」——**剥注释**（上一版被注释骗出 624 个假阳性）
//   · .vue ：只扫 <template> 段 → 去掉 HTML 注释 → 取**文本节点**与**会展示的属性**（title/placeholder/aria-label）
//           并把 {{ }} 插值与 :bind 表达式剔掉（那是代码不是文案）
//   · .js  ：用项目共用的三态 stripComments 剥注释后，只取**字符串字面量/模板串**
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { stripComments } = await import('file://' + path.join(ROOT, 'scripts/ci/lib/comments.mjs').replace(/\\/g, '/'))

// 内部记账 / 开发措辞（面向玩家的正文里不该出现）
const WORDS = ['按批次', '扩展[12]批', '副业线', '门槛表', '注册表', '唯一出口', '实测', '口径', '乘区',
  '独占品', '杠杆', '量级', '守卫', '断言', '审计', '占位', 'TODO', 'FIXME', '待实现', '未接线',
  '数据层', '读取点', '消费方', '上层', '本轮', '本版', '第[一二三四]批', '系数', '批次', '§']

const hits = []
const push = (file, line, text, why) => hits.push({ file, line, text: text.trim().slice(0, 90), why })

function scanVue(file) {
  const src = fs.readFileSync(file, 'utf8')
  const m = src.match(/<template>([\s\S]*)<\/template>/)
  if (!m) return
  let tpl = m[1].replace(/<!--[\s\S]*?-->/g, '')          // HTML 注释
  tpl = tpl.replace(/\{\{[\s\S]*?\}\}/g, ' ')            // 插值
  tpl = tpl.replace(/:[a-zA-Z-]+="[^"]*"/g, ' ')         // :bind="…"
  tpl = tpl.replace(/@[a-zA-Z-]+="[^"]*"/g, ' ')         // @click="…"
  tpl = tpl.replace(/v-[a-zA-Z-]+="[^"]*"/g, ' ')        // v-if="…"
  // 逐行取「标签外文本」与 title/placeholder/aria-label 的字面量
  for (const [i, raw] of tpl.split('\n').entries()) {
    const textOnly = raw.replace(/<[^>]*>/g, ' ')
    for (const w of WORDS) if (new RegExp(w).test(textOnly)) { push(file, i + 1, textOnly, '文本:' + w); break }
    for (const attr of raw.matchAll(/(?:title|placeholder|aria-label)="([^"]*)"/g)) {
      const v = attr[1]
      if (v.includes('{{') || /^[a-zA-Z_$]/.test(v.trim())) continue
      for (const w of WORDS) if (new RegExp(w).test(v)) { push(file, i + 1, v, '属性:' + w); break }
    }
  }
}

function scanJs(file) {
  const src = stripComments(fs.readFileSync(file, 'utf8'))   // 三态剥注释（字符串不会被误剥）
  const lines = src.split('\n')
  for (const [i, raw] of lines.entries()) {
    // 只取字符串字面量 / 模板串里的内容
    const lit = raw.match(/'([^']{6,})'|"([^"]{6,})"|`([^`]{6,})`/g) || []
    for (const l of lit) {
      if (!/[\u4e00-\u9fa5]/.test(l)) continue
      for (const w of WORDS) if (new RegExp(w).test(l)) { push(file, i + 1, l.slice(1, -1), '字面量:' + w); break }
    }
  }
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) { if (!/node_modules|\.git|dist/.test(p)) walk(p) }
    else if (f.endsWith('.vue')) scanVue(p)
    else if (f.endsWith('.js')) scanJs(p)
  }
}
walk(path.join(ROOT, 'src'))
walk(path.join(ROOT, 'src/views'))

// 汇总
const byFile = {}
for (const h of hits) (byFile[path.relative(ROOT, h.file)] ??= []).push(h)
const files = Object.keys(byFile).sort((a, b) => byFile[b].length - byFile[a].length)
console.log('══ 面向玩家的开发者腔：' + hits.length + ' 处 / ' + files.length + ' 个文件 ══')
for (const f of files.slice(0, 14)) {
  console.log('\n▍' + f + '（' + byFile[f].length + '）')
  for (const h of byFile[f].slice(0, 4)) console.log('  L' + h.line + ' [' + h.why + '] ' + h.text)
}
