import fs from 'node:fs'
const p = 'src/views/MijianView.vue'
let s = fs.readFileSync(p, 'utf8')
const old = `/* 模拟预览行 */
.gacha-sim {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; margin-top: 10px; font-size: 12px; flex-wrap: wrap;
}`
if (!s.includes(old)) { console.log('marker missing'); process.exit(1) }
s = s.replace(old, `/* 模拟预览行（浅绿渐变，居中，按钮间距拉开） */
.gacha-sim {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-top: 12px; font-size: 12px; flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #e9f7e0, #d3eec4);
  border: 1px solid rgba(122, 199, 96, 0.45);
}
.gacha-sim .btn-sm { flex: 0 0 auto; padding: 4px 16px; font-weight: 600; }
:global([data-theme='dark']) .gacha-sim {
  background: linear-gradient(135deg, #24331c, #1d2b16);
  border-color: rgba(150, 220, 120, 0.3);
}
:global([data-theme='dark']) .gacha-sim .dim { color: #b8d6a4; }`)
fs.writeFileSync(p, s, 'utf8')
console.log('sim styled:', s.includes('d3eec4'))
