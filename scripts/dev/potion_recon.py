# -*- coding: utf-8 -*-
"""Potion Craft 资源侦察：列出 Unity 资源里的 UI 贴图/字体，并把候选导出成 PNG 供取色参考。

⚠️ 用途边界：**只做风格参考**（取色板、材质配方、比例、字感），导出的图放在 `docs/potion-ref/`（本地、已 gitignore），
   **不得**把这些素材拷进游戏仓库——那是别人的美术资产。我们只按它的风格另做一套。
用法：python scripts/dev/potion_recon.py [list|dump|font]
"""
import sys
import pathlib

import UnityPy

ROOT = pathlib.Path(r"D:\plays\steamapps\common\Potion Craft")
# 实际路径要按本机的 steamapps 位置来
ROOT = pathlib.Path(r"D:\plays\steams\steamapps\common\Potion Craft")
DATA = ROOT / "Potion Craft_Data"
OUT = pathlib.Path(r"D:\plays\lmew\docs\potion-ref")

# Potion Craft 的命名法（实测）：`Icon <形状> Color N` / `Icon <形状> Scratches`（手绘+草稿两种）、
# `MainMenu HoverSlot/Variant N`（**成套手绘框**，不是九宫格）、`TutorialTip RestartButton Size N`、
# `Background Seamless`、`WoodenShelf N Size N`。所以关键词按它的命名来。
KEYS = ("hoverslot", "substrate", "restartbutton", "seamless", "panel", "frame", "border",
        "parchment", "paper", "slot", "shelf", "scratches", "inventoryicon", "background",
        "ribbon", "seal", "wax", "sign", "logo", "font texture")

FILES = ["resources.assets"] + [f"level{i}" for i in range(20)]


def iter_envs():
    for name in FILES:
        p = DATA / name
        if p.is_file():
            yield name, UnityPy.load(str(p))
    # ⚠️ Addressables 在 **StreamingAssets/aa/**（不是 _Data/aa —— 第一版记错了路径，扫了个空）
    aa = DATA / "StreamingAssets" / "aa"
    if aa.is_dir():
        bundles = sorted(aa.rglob("*.bundle"))
        print("Addressables 包数:", len(bundles))
        for bundle in bundles:
            try:
                yield bundle.name, UnityPy.load(str(bundle))
            except Exception as exc:  # 坏包跳过，别中断
                print("  跳过", bundle.name, exc)


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "list"
    OUT.mkdir(parents=True, exist_ok=True)
    hits, fonts, total = [], [], 0
    for fname, env in iter_envs():
        for obj in env.objects:
            t = obj.type.name
            total += 1
            if t in ("Texture2D", "Sprite", "Font", "MonoBehaviour"):
                try:
                    data = obj.read()
                except Exception:
                    continue
                name = getattr(data, "m_Name", "") or getattr(data, "name", "")
                low = str(name).lower()
                if t == "Font":
                    fonts.append((fname, name))
                    continue
                # 排除人物部件（Hair/Body/Face/Hat/Breast/SkullShape…）：那是角色拼装件，不是 UI
                if any(x in low for x in ("hair", "body", "face", "hat", "breast", "skullshape", "beard", "eye ")):
                    continue
                if t == "Texture2D" and any(k in low for k in KEYS):
                    hits.append((fname, obj.path_id, name, data))
    print("扫描对象数:", total)
    print("字体数:", len(fonts))
    for f, n in fonts[:20]:
        print("   FONT", f, "|", n)
    print("UI 贴图候选数:", len(hits))
    for i, (f, pid, n, d) in enumerate(hits[:70]):
        try:
            w, h = int(d.m_Width), int(d.m_Height)
        except Exception:
            w = h = 0
        print("   %-3d %4dx%-4d %s" % (i, w, h, str(n)[:52]))
    if mode == "dump":
        for i, (f, pid, n, data) in enumerate(hits[:120]):
            try:
                img = data.image
                safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in str(n))[:60]
                img.save(OUT / f"{i:03d}_{safe}.png")
            except Exception as exc:
                print("  导出失败", n, exc)
        print("已导出 →", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
