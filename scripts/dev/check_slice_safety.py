# -*- coding: utf-8 -*-
"""九宫格切片安全检查：**装饰物不许落在 fill（中心）区**。

为什么需要这一条：`border-image-slice: N fill` 会把**中心区**整片当作背景铺满控件，
于是画在中心区的装饰（朱印方块、筷子水印、枝干）会被拉伸/重复到控件中部 ——
实机效果就是「弹窗正中突然一大块红」。这类缺陷静态看不出、切图参数「看着对」也看不出，
只有在真实尺寸里拼一次才露馅（2026-09-23 弹窗素材就是这么翻的车）。

判据（不靠肉眼）：
  1. 背景色 = 整图量化后的众数色（纸/木/朱红底板都自适应）；
  2. 「装饰 = 离背景色足够远且不透明」的像素；
  3. 取装饰的连通包围盒，看它是否压到中心区 x∈[L, W-R) × y∈[T, B)；
  4. 压到就给出**能把它排除掉的最小四边 slice**；若该 slice 超过边长的 45%，判「不适合九宫格」。

用法：python scripts/dev/check_slice_safety.py            # 报告
      python scripts/dev/check_slice_safety.py --strict   # 有违规即 exit 1（当守卫用）
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\plays\lmew")
UI = ROOT / "docs" / "ui-assets" / "ui2"
MAX_EDGE_FRACTION = 0.45      # slice 超过这个比例就不叫「边」了
BG_TOLERANCE = 42             # 与背景色的曼哈顿距离阈值（纸纹/颗粒都在此内）
LINE_TOLERANCE = 18           # 弱对比：只用来认「整条贯通」的线性纹样
LINE_COVER = 0.8              # 一行/一列里有多大比例是纹样才算「贯通」
MIN_BLOB_AREA = 0.0015        # 小于整图 0.15% 的按噪点忽略


def safe_join(root: Path, *segments: str) -> Path:
    out = root
    for seg in segments:
        out = out / seg
    resolved = out.resolve()
    if not str(resolved).startswith(str(root.resolve())):
        raise ValueError("path escapes root: " + str(resolved))
    return resolved


def accent_grid(im: Image.Image, rect, bg, tol: int):
    """矩形区内「装饰掩码」：1 = 与背景色差 > tol 且不透明。"""
    x0, y0, x1, y1 = rect
    W, H = x1 - x0, y1 - y0
    px = im.load()
    grid = bytearray(W * H)
    for y in range(H):
        row = y * W
        for x in range(W):
            r, g, b, a = px[x0 + x, y0 + y]
            if a >= 128 and abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
                grid[row + x] = 1
    return grid, W, H


def mask_out_bands(grid: bytearray, W: int, H: int, im: Image.Image, rect, bg):
    """抹掉「整条贯通」的线性纹样所占的行/列 —— 它们不是装饰。

    🔴 不做这一步会**误判木牌**：木牌中间那两道槽线沿宽度贯通，九宫格把中心区拉长/压扁后
    仍是同样的直线（只是粗细按轴缩放），根本不该算「装饰进中心」。
    判据：某一行里 ≥80% 的列都有**弱对比**（tol 18）纹样 ⇒ 该行是贯通线，整行不计。
    """
    weak, _W, _H = accent_grid(im, rect, bg, LINE_TOLERANCE)
    for y in range(H):
        if sum(1 for x in range(W) if weak[y * W + x]) >= W * LINE_COVER:
            for x in range(W):
                grid[y * W + x] = 0
    for x in range(W):
        if sum(1 for y in range(H) if weak[y * W + x]) >= H * LINE_COVER:
            for y in range(H):
                grid[y * W + x] = 0


def load_rgba(path: Path) -> Image.Image:
    import io
    return Image.open(io.BytesIO(path.read_bytes())).convert("RGBA")


def dominant_bg(im: Image.Image):
    """背景色 = **不透明像素**的量化众数。

    ⚠️ 必须排除近乎全透明的像素：把 RGBA 直接 convert('RGB') 会让透明处变黑，
    于是「大片透明的按钮/输入框/进度条」会被判成「黑底」，整张素材都成了『装饰』（第一版 7/9 假违规就是这么来的）。
    """
    rgba = im.convert("RGBA").resize((96, 96))
    counts = {}
    total = 0
    for r, g, b, a in rgba.getdata():
        if a < 200:
            continue
        total += 1
        key = (r // 12, g // 12, b // 12)
        counts[key] = counts.get(key, 0) + 1
    if total == 0:
        return None
    key = max(counts, key=counts.get)
    return (key[0] * 12 + 6, key[1] * 12 + 6, key[2] * 12 + 6)


def accent_mask(im: Image.Image, bg: tuple, tol: int) -> Image.Image:
    """装饰掩码：与背景色差距 > tol 且不透明。返回 1bit 图（255 = 装饰）。"""
    px = im.load()
    w, h = im.size
    out = Image.new("L", (w, h), 0)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
                op[x, y] = 255
    return out


def blobs(mask: Image.Image, min_area: int):
    """粗糙连通域（8 邻域、迭代栈）。返回 [(x0,y0,x1,y1,area)]。"""
    w, h = mask.size
    m = mask.load()
    seen = [[False] * w for _ in range(h)]
    out = []
    for sy in range(h):
        for sx in range(w):
            if m[sx, sy] == 0 or seen[sy][sx]:
                continue
            stack = [(sx, sy)]
            seen[sy][sx] = True
            x0 = x1 = sx
            y0 = y1 = sy
            area = 0
            while stack:
                cx, cy = stack.pop()
                area += 1
                x0 = min(x0, cx); x1 = max(x1, cx)
                y0 = min(y0, cy); y1 = max(y1, cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and m[nx, ny]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            if area >= min_area:
                out.append((x0, y0, x1 + 1, y1 + 1, area))
    return out


def analyse(entry: dict):
    path = safe_join(ROOT / "docs" / "ui-assets", *entry["colour"].replace("images/ui2/", "ui2/").split("/"))
    im = load_rgba(path)
    w, h = im.size
    bg = dominant_bg(im)
    if bg is None:
        return None
    # 现 manifest 里的 slice（单值四边相同）；中心区 = 会被拉伸/铺满的那一片
    s = entry.get("slice_px") or 0
    L = T = R = B = s
    inner = (L, T, w - R, h - B)
    if inner[0] >= inner[2] or inner[1] >= inner[3]:
        return None
    mask = accent_mask(im, bg, BG_TOLERANCE)
    # 🔴 只在**中心区内部**找装饰：撕边/描边本身贴在图像边上，属边料、不是中心装饰。
    #    （第一版没做这一步，于是每张素材的撕边整圈都被判成「装饰进中心」⇒ 7/9 假违规）
    ip = mask.load()
    cropped = mask.crop(inner)
    grid, gw, gh = accent_grid(im, inner, bg, BG_TOLERANCE)
    mask_out_bands(grid, gw, gh, im, inner, bg)
    grid_img = Image.new("L", (gw, gh), 0)
    grid_img.putdata(list(grid))
    min_area = max(40, int((inner[2] - inner[0]) * (inner[3] - inner[1]) * MIN_BLOB_AREA))
    found = blobs(grid_img, min_area)
    if not found:
        return None
    big = sorted(found, key=lambda b: -b[4])[:6]
    # 换算回原图坐标，并给出「要把它排除掉」所需的最小四边 slice
    hits = [(x0 + L, y0 + T, x1 + L, y1 + T, a) for (x0, y0, x1, y1, a) in big]
    # 「排除掉全部装饰」需要的最小四边 slice = 装饰到四边的最远距离
    need = max([b[3] for b in hits] + [h - b[1] for b in hits]
               + [b[2] for b in hits] + [w - b[0] for b in hits])
    ok_uniform = need <= min(w, h) * MAX_EDGE_FRACTION
    return {"id": entry["id"], "size": [w, h], "bg": bg, "slice": s,
            "inner": inner, "hits": hits, "need_uniform": need, "uniform_ok": ok_uniform,
            "blobs": big}


def main() -> int:
    strict = "--strict" in sys.argv
    manifest = json.loads(safe_join(UI, "manifest.json").read_text(encoding="utf-8"))
    frames = [m for m in manifest if m.get("pull") and (m.get("slice_px") or 0) > 0]
    bad = []
    for m in frames:
        r = analyse(m)
        if r:
            bad.append(r)
    print("受检九宫格控件：%d 个" % len(frames))
    if not bad:
        print("✅ 全部合格：没有任何装饰物落在 fill（中心）区")
        return 0
    for r in bad:
        print("\n❌ %s  %dx%d  bg=%s  现 slice=%d" % (r["id"], r["size"][0], r["size"][1], r["bg"], r["slice"]))
        print("   中心区 x∈[%d,%d) y∈[%d,%d)" % (r["inner"][0], r["inner"][2], r["inner"][1], r["inner"][3]))
        for b in r["hits"][:3]:
            print("   装饰被拉进中心：bbox=(%d,%d)-(%d,%d) 面积 %d px" % (b[0], b[1], b[2], b[3], b[4]))
        print("   排除它需要四边 slice ≈ %d（边长 45%% 上限 = %d）⇒ %s"
              % (r["need_uniform"], int(min(r["size"]) * MAX_EDGE_FRACTION),
                 "可改用该 slice" if r["uniform_ok"] else "**不适合九宫格**，应裁掉装饰或改固定尺寸"))
    print("\n违规 %d / %d" % (len(bad), len(frames)))
    return 1 if strict else 0


if __name__ == "__main__":
    sys.exit(main())
