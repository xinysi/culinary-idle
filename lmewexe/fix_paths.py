# -*- coding: utf-8 -*-
# 修正 lmewexe/dist/index.html 的资源路径为相对路径（Electron file:// 必需）
# 以脚本自身所在目录为基准（不依赖调用方 cwd —— CI 在 working-directory=lmewexe 下调用过，
# 原先硬编码 'lmewexe\dist\index.html' 会解析成 lmewexe/lmewexe/dist/... 而报 FileNotFoundError），
# 读写目标是包内**固定字面量** `dist/index.html`，不接受任何外部参数；文件不存在时直接退出、不落盘。
from pathlib import Path

PKG = Path(__file__).resolve().parent
DIST = PKG / 'dist'
TARGET = DIST / 'index.html'
if not TARGET.is_file() or TARGET.parent.resolve() != DIST.resolve():
    print('错误：未找到', TARGET, '（请先执行 vite build 并复制产物到 lmewexe/dist）')
    raise SystemExit(1)
text = TARGET.read_text(encoding='utf-8')
fixed = (
    text.replace('src="/assets/', 'src="./assets/')
        .replace('href="/assets/', 'href="./assets/')
        .replace('href="/favicon.svg"', 'href="./favicon.svg"')
)
if fixed != text:
    TARGET.write_text(fixed, encoding='utf-8')
print('路径修正:', '完成' if fixed != text else '无需修改（已是相对路径）')
