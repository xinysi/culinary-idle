# -*- coding: utf-8 -*-
"""从 Potion Craft 的 Unity 资源里导出它用的字体（TTF）——**仅供本地对照**。

为什么要提：它的「古书感」很大一部分来自字体（拉丁 Vollkorn 衬线 + Caveat 手写，中文 Noto Serif SC 思源宋体）。
   这几个字体的作者许可都是 **SIL OFL（可自由使用/再分发）**，所以字体本身可以放心用；
   但**别从游戏包里拷**——OFL 要求带许可文件，正路是从上游拿（Google Fonts / 各作者仓库）。
   这里导出只是为了「本地样张里能逐字对上」。

用法：python scripts/dev/potion_fonts.py
产出：docs/potion-ref/fonts/*.ttf（docs/ 已 gitignore）
"""
import pathlib
import sys

import UnityPy

DATA = pathlib.Path(r"D:\plays\steams\steamapps\common\Potion Craft\Potion Craft_Data")
OUT = pathlib.Path(r"D:\plays\lmew\docs\potion-ref\fonts")
WANT = ("vollkorn", "notoserifsc", "caveat")     # 主衬线 / 中文衬线 / 手写


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    src = DATA / "resources.assets"
    if not src.is_file():
        print("找不到 resources.assets:", src)
        return 1
    env = UnityPy.load(str(src))
    got = 0
    for obj in env.objects:
        if obj.type.name != "Font":
            continue
        try:
            data = obj.read()
        except Exception:
            continue
        name = str(getattr(data, "m_Name", ""))
        low = name.lower()
        if not any(k in low for k in WANT):
            continue
        raw = getattr(data, "m_FontData", None)
        if not raw:
            print("  （无内嵌数据，可能引用系统字体）", name)
            continue
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
        target = OUT / f"{safe}.ttf"
        target.write_bytes(bytes(raw))
        print("  导出 %-28s %6.0fKB → %s" % (name, len(raw) / 1024, target.name))
        got += 1
    print("共导出", got, "个 →", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
