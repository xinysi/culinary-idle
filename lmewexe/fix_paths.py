# -*- coding: utf-8 -*-
# 修正 lmewexe/dist/index.html 的资源路径为相对路径（Electron file:// 必需）
# 路径以脚本自身位置为基准，不依赖调用方 cwd（CI 在 working-directory=lmewexe 下调用过，
# 原先硬编码 'lmewexe\dist\index.html' 会解析成 lmewexe/lmewexe/dist/... 而报 FileNotFoundError）
import os

here = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(here, 'dist', 'index.html')
if not os.path.exists(p):
    print('错误：未找到', p, '（请先执行 vite build 并复制产物到 lmewexe/dist）')
    raise SystemExit(1)
t = open(p, encoding='utf-8').read()
o = t
t = t.replace('src="/assets/', 'src="./assets/')
t = t.replace('href="/assets/', 'href="./assets/')
t = t.replace('href="/favicon.svg"', 'href="./favicon.svg"')
if t != o:
    open(p, 'w', encoding='utf-8').write(t)
print('路径修正:', '完成' if t != o else '无需修改（已是相对路径）')
