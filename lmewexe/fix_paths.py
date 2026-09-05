# -*- coding: utf-8 -*-
# 修正 lmewexe/dist/index.html 的资源路径为相对路径（Electron file:// 必需）
import io, sys

p = r'lmewexe\dist\index.html'
t = open(p, encoding='utf-8').read()
o = t
t = t.replace('src="/assets/', 'src="./assets/')
t = t.replace('href="/assets/', 'href="./assets/')
t = t.replace('href="/favicon.svg"', 'href="./favicon.svg"')
open(p, 'w', encoding='utf-8').write(t)
print('路径修正:', '完成' if t != o else '无需修改（已是相对路径）')
