# -*- coding: utf-8 -*-
"""像素美食 UI · 第 2 步：按规范 JSON 里的提示词出图（AI 出图）。

输入：`docs/ui-pixel/像素美食UI_出图提示词_v1.json`
      —— 每件的 `prompt_en`（正向，可直接粘）与 `neg_en`（负向），尺寸从 `export` 读，不手抄。
输出：`docs/ui-pixel/raw/<ID>.png`（浅色）· `docs/ui-pixel/raw/<ID>_dark.png`（深色套）
      交给第 3 步 `pixelize_ui.py` 做像素化（降采样 → 量化 → 最近邻放大 → alpha 二值化）。

用法：
  python scripts/dev/gen_pixel_food_assets.py --sample        # §0 的三张样张（5 个 ID，深浅各一）
  python scripts/dev/gen_pixel_food_assets.py --ids FRAME_CARD,FRAME_BTN
  python scripts/dev/gen_pixel_food_assets.py --slots         # 全部 42 件通用件
  python scripts/dev/gen_pixel_food_assets.py --ids FRAME_CARD --no-dark
  python scripts/dev/gen_pixel_food_assets.py --list

环境变量：`AIDJ_API_KEY` —— 只进请求头，不进 argv、不落盘。
已经是「填缝」语义：raw/ 里已存在的文件默认跳过（重跑很便宜），`--force` 才重出。

🔴 尺寸说明：本服务画布只有 1:1 / 1.5:1 / 2:3 三档，给不了 480×160 (3:1) 这种比例，所以
   提示词里的导出尺寸只是**构图**提示 —— 驱动按导出比例挑最接近的一档画布，再追加一段
   「构图锚」把横条/竖条写死（见 `aspect_anchor()`）。真正的尺寸由 pixelize_ui.py 从内容外框
   裁切后降到规范 JSON 的 `export`。因此**不要**指望出图直接就是 480×160。
"""

import argparse
import base64
import ipaddress
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

SPEC_PATH = Path(r"D:\plays\lmew\docs\ui-pixel\像素美食UI_出图提示词_v1.json")
RAW_DIR = Path(r"D:\plays\lmew\docs\ui-pixel\raw")
ICON_MANIFEST = Path(r"D:\plays\lmew\docs\ui-pixel\icons.json")

API_URL = "https://www.aidjapi.top/v1/images/generations"
ALLOWED_HOSTS = ("www.aidjapi.top",)
MODEL = "gpt-image-2"
# 实测可用：1:1 / 1.5:1 / 2:3 三档（横竖都行）。给每件挑**最接近它导出比例**的那一档，
# 剩下的比例差由「构图锚」+ pixelize_ui.py 的降到逻辑尺寸来补。
SIZES = ((1536, 1024), (1024, 1024), (1024, 1536))
WORKERS = 3                         # 5 会把上游打满、开始 503
RETRIES = 4
ASPECT_HINT_MAX = 4.0               # 比例超过 4:1 就不写数字（模型在画布里也画不出来）

# ── 出图模型的两个顽固毛病（都是这一批实测出来的，必须在提示词里堵住）────────────
# ① 只说「深色版」，它会画成**浅色 + 深色上下对照图**，一张画布里两个物件 ——
#    降采样后上半张被拉伸进控件，整批深色套作废（FRAME_TAB_ON_dark 还顺手画了个
#    假的「透明棋盘格」当背景）。所以必须写死「只有一个物件、不要对照、不要第二份」。
# ② 九宫格件会在**中心**画装饰（主按钮正中一枚煎蛋、卡片角上小红花），
#    `fill` 中心区被整片拉伸 ⇒ 实机控件正中一大坨黄，直接违反 §2 规则 4。
SINGLE_OBJECT_EN = (
    "exactly one single object, centred on the canvas, nothing else in the image; "
    "the background is fully transparent (alpha 0) - not white, not a checkerboard, not any "
    "colour; no flowers, no leaves, no ornaments, no motifs, no decoration of any kind, "
    "no second copy of the object, no side-by-side light-and-dark comparison"
)
FLAT_CENTRE_EN = (
    "nine-patch safe: the middle of the object is one single flat uniform colour across the "
    "entire centre area - absolutely no pattern, motif, speckle, stamp, highlight blob or egg "
    "in the centre"
)

# 🔴 小件（短边 ≤ TINY_MAX 逻辑像素）必须**极简**，否则必糊：
# 实测 8×8 的徽章/锁/叉，模型画成一张 1024² 的细描插画，降到 8 逻辑像素只剩一团杂色方块
# （同批 24×24 的勋章、8×8 的游戏币却是清楚的 —— 差别就在模型有没有按像素数收敛细节）。
# 这一步不是改规范，是把「§2 规则 6：小件不许撕边」翻译成模型听得懂的写法。
TINY_MAX = 9
# 纹理/线条件（§5 里「形式 = 整条拉伸」的那些）：它们是一条被拉伸/平铺的纹样，没有「剪影」，
# 套极简锚只会把它说糊涂。🔴 与 `pixelize_ui.py` 的 `STRETCH_IDS` 是同一组，改一处要改两处。
TEXTURE_IDS = {
    "TEX_BAR_FILL", "TEX_SHINE", "BG_TILE", "STEAM_CURVE",
    "LINE_ROW", "LINE_STROKE_RED", "LINE_STROKE_AMBER", "LINE_STROKE_TOAST",
}
# BG_TILE 要**几乎全平**（规范原文：「底色 = 奶油，碎屑 = 烤饼棕/蛋黄黄，每 64px 只有 4~6 个
# 1 像素点」），但模型会把它画成一整块食物花纹砖（番茄、青菜、奶酪铺满）—— 那样既不是底色，
# 又会和 15 套皮肤的 CSS 变量打架。同时「轮廓不规则 / 剪影」那套话对一个底色砖根本不适用。
BG_TILE_EN = (
    "this is a page-background grain tile, NOT a picture: the whole canvas is ONE almost-flat "
    "butter tone, and the only content is 4 to 6 single isolated pixels of toast brown or egg-yolk "
    "yellow scattered far apart. Absolutely no shapes, no clusters, no vegetables, no food "
    "objects, no illustration, no pattern, no border, no silhouette - a flat tile with a few specks"
)

# TEX_BAR_FILL 要当**叠加纹理**用（`url(...) repeat` 压在 CSS 给的进度色上），所以它必须是
# **半透明**的：只画几行横纹，其余像素全透明。重出前那版是**全不透明**的棕白条纹，压上去
# 把血条红 / 经验绿 / 精通紫全盖成同一种浅棕 —— 2026-09-23 验收抓出。
TEX_BAR_FILL_EN = (
    "this is a SEAMLESS SEMI-TRANSPARENT OVERLAY texture, NOT a picture and NOT a tile with a "
    "background: the canvas itself stays fully transparent (alpha 0) except for a few horizontal "
    "stripes - two rows of 50%-opacity white stripes and one row of 25%-opacity black stripe. "
    "Every other pixel is fully transparent. No opaque background, no filled colour block, no "
    "border, no outline, no motif, no emblem in the middle; the stripes run edge to edge so the "
    "texture tiles seamlessly"
)
TINY_EN = (
    "THIS IS A TINY SPRITE: the whole element is only about {n} logical pixels across. Draw it as "
    "a MINIMALIST flat silhouette, not an illustration: at most 3 flat colours, at most one small "
    "interior feature, no texture, no facets, no shading, no highlight, no inner outline, no fine "
    "detail. Every single pixel matters at this size; keep the shape readable in silhouette alone"
)

# §6「深色第二套」：只追加这一句，其余段一字不改。
# 🔴 不能写成 "the same shape, DARK theme variant" —— 那样模型会画成浅深对照图（见上）。
DARK_APPEND_EN = (
    "dark theme: draw this one object with a very dark roasted-brown face (#3A2C1E, shaded "
    "#2A2018, darkest #1C1410) and a bright warm-gold outline (#E8D0A0); keep tomato red and "
    "egg-yolk yellow exactly as they are. Do not draw a pale version and a dark version "
    "together, no comparison sheet, no second object."
)

# 强调色件（§11.4 的「语义色」）：深色下**整块面仍然是番茄红**，只有描边换暖金。
# 🔴 不能沿用 DARK_APPEND_EN 的「面换成深烤棕」—— 实测那样出来的是棕底金边，
#    选中页签与主按钮在深色下**认不出来**（光占比从 98% 掉到 11%），违反 §3.2。
ACCENT_DARK_EN = (
    "dark theme, ACCENT-COLOURED piece: the face stays TOMATO RED (#D82818 with #A81808 "
    "shading and an egg-yolk #E8B838 highlight) exactly as in the light version - the dark "
    "theme only changes the outline to a bright warm gold #E8D0A0. Do not turn the face dark "
    "brown, do not desaturate it, keep it clearly red. No comparison sheet, no second object."
)
ACCENT_IDS = ("FRAME_BTN_PRIMARY", "FRAME_TAB_ON")   # §11.4 里的强调色件（后续进度填充/徽章同列）


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Refuse redirects: the endpoint is fixed, so a redirect is never legitimate."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("refusing redirect to %s" % newurl)


def _checked_endpoint():
    """Validate scheme, host and resolved address before any request goes out."""
    parsed = urllib.parse.urlsplit(API_URL)
    if parsed.scheme != "https":
        raise RuntimeError("endpoint must be https, got %r" % parsed.scheme)
    if parsed.hostname not in ALLOWED_HOSTS:
        raise RuntimeError("host %r is not in ALLOWED_HOSTS" % parsed.hostname)
    for info in socket.getaddrinfo(parsed.hostname, parsed.port or 443, proto=socket.IPPROTO_TCP):
        address = ipaddress.ip_address(info[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise RuntimeError("endpoint resolves to a non-public address: %s" % address)
    return API_URL


def _ssl_context():
    """Trust store for the endpoint.

    This machine's default OpenSSL store rejects the endpoint's Let's Encrypt chain
    ("certificate has expired" - a stale root in the local store), while the certifi
    bundle validates it, so prefer certifi when it is importable.
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def call_api(prompt, size="1024x1024", timeout=300):
    """POST one generation request. The key travels only in the request header."""
    key = os.environ.get("AIDJ_API_KEY")
    if not key:
        raise RuntimeError("AIDJ_API_KEY is not set")
    endpoint = _checked_endpoint()
    payload = json.dumps(
        {
            "model": MODEL,
            "prompt": prompt,
            "n": 1,
            "size": size,
            "background": "transparent",
            "output_format": "png",
        },
        ensure_ascii=True,
    ).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        method="POST",
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=_ssl_context()), _NoRedirect()
    )
    try:
        with opener.open(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        raise RuntimeError("HTTP %s: %s" % (exc.code, detail))
    except urllib.error.URLError as exc:
        raise RuntimeError("network error: %s" % exc.reason)
    if not isinstance(body, dict) or not body.get("data"):
        raise RuntimeError("unexpected response: %s" % str(body)[:200])
    return base64.b64decode(body["data"][0]["b64_json"])


def load_slots():
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    return {slot["id"]: slot for slot in spec["slots"]}


def load_spec():
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


# ── 图标集（§7，共 158 个）────────────────────────────────────────────────────
# 导出尺寸按 §7.1 的四档表；🔴 `功能分组头` 在规范里**没有给尺寸**（§7.1 表里没这一档），
# 这里按「和技能页顶部同档」取 36×36 —— 它是左栏分组标题旁的小图标位，比磁贴小一级。
# 这一档是**我补的默认值**，不是规范写死的，接入时若不合适改这里一处即可。
ICON_SIZES = {"功能磁贴": 108, "技能": 36, "小游戏": 48, "功能分组头": 36}
ICON_PREFIX = {"功能磁贴": "TILE", "技能": "SKILL", "小游戏": "GAME", "功能分组头": "GROUP"}
ACTION_SIZE = 32            # §7.1 通用动作 16×16 css → 32×32 导出

ICON_FOOD_EN = (
    "one single pixel-art icon meaning \"{name}\": draw it as a food-or-kitchen-tool metaphor - "
    "{metaphor}. material: cream body, dark-roast-brown outline, at most one tomato-red or "
    "egg-yolk-yellow accent. only 1-pixel-level asymmetry (one corner cut one step deeper)."
)
# §7.6 明说动作图标**不做食物隐喻**（「它们是符号不是物件，硬拗成食物反而认不出来」），
# 所以另起一套：平描边 + 阶梯画，只有勾 / 警告 / 太阳月亮用语义色。
ICON_SYMBOL_EN = (
    "one single pixel-art symbol icon for \"{name}\": {glyph}. This is a plain symbolic glyph, "
    "NOT a food object - do not use a food metaphor, do not draw food. material: a flat "
    "dark-roast-brown stroke with hard stair-stepped pixel edges and nothing else; only a tick, "
    "a warning sign or a sun/moon may use the semantic accent colour (tomato red / egg-yolk "
    "yellow)."
)
ICON_TAIL_EN = (
    "single flat light from the top-left with only a 2-step shade; centred with 2 logical pixels "
    "of transparent margin all around; the icon is a CUT-OUT: every pixel outside its silhouette "
    "is fully transparent (alpha 0) - there must be no white, pale or filled square behind it; "
    "PNG-24 with alpha; no text, no letters, no numbers, no watermark"
)
# 🔴 最细那一档（9 逻辑像素）还要再砍一刀：规范给的隐喻常是**两个物件**（「一条鱼 + 一枚水滴」、
# 「一支箭 + 一块肉排」），9 个像素里放两样东西必然糊成一团。实测同尺寸的「通用动作」
# （§7.6，本来就只有一个符号）是清楚的 —— 所以这里把隐喻降级为「只画主物件」。
ICON_ONE_EN = (
    "the metaphor above is only a hint: draw ONE single object - its main element - and omit any "
    "second object or accessory entirely, so that the icon is still readable at {n} pixels"
)


def icon_jobs(spec):
    """→ [(输出文件名, 提示词, (导出宽, 导出高), manifest 条目)]。

    ID 只用 ASCII：磁贴/技能有惟一的 `view` 就用它，小游戏 27 个共用 `view: minigames`
    且分组头 `view` 为空，所以这两种走序号。`name` / `view` / `emoji` 全部写进
    `icons.json`，接入时按 ID 对得上就行。
    """
    meta = spec["meta"]
    jobs, used_views, counters = [], set(), {}
    for entry in spec["icons"]:
        kind = entry["kind"]
        counters[kind] = counters.get(kind, 0) + 1
        view = (entry.get("view") or "").strip()
        suffix = ""
        if view and view not in used_views:
            suffix = "_" + view
            used_views.add(view)
        icon_id = "ICON_%s_%02d%s" % (ICON_PREFIX[kind], counters[kind], suffix)
        size = ICON_SIZES[kind]
        tiny = size // 4 <= TINY_MAX
        extra = ""
        if tiny:
            extra = " " + TINY_EN.format(n=size // 4) + " " + ICON_ONE_EN.format(n=size // 4)
        prompt = "%s %s %s %s%s %s Negative prompt: %s" % (
            meta["style_en"],
            ICON_FOOD_EN.format(name=entry["name"], metaphor=entry["metaphor"]),
            "canvas is %dx%d logical pixels, drawn at 4x nearest-neighbour integer scale "
            "(%dx%d export pixels)" % (size // 4, size // 4, size, size),
            ICON_TAIL_EN, extra, SINGLE_OBJECT_EN, meta["neg_en"],
        )
        jobs.append((icon_id + ".png", prompt, (size, size),
                     {"id": icon_id, "kind": kind, "name": entry["name"],
                      "view": view, "emoji": entry.get("emoji", ""),
                      "metaphor": entry["metaphor"], "export": [size, size],
                      "css": [size // 2, size // 2]}))
    for n, action in enumerate(spec["actions"], start=1):
        icon_id = "ICON_ACT_%02d" % n
        prompt = "%s %s %s %s %s Negative prompt: %s" % (
            meta["style_en"],
            ICON_SYMBOL_EN.format(name=action["name"], glyph=action["glyph"]),
            "canvas is %dx%d logical pixels, drawn at 4x nearest-neighbour integer scale "
            "(%dx%d export pixels)" % (ACTION_SIZE // 4, ACTION_SIZE // 4,
                                       ACTION_SIZE, ACTION_SIZE),
            ICON_TAIL_EN, SINGLE_OBJECT_EN, meta["neg_en"],
        )
        jobs.append((icon_id + ".png", prompt, (ACTION_SIZE, ACTION_SIZE),
                     {"id": icon_id, "kind": "通用动作", "name": action["name"],
                      "view": "", "emoji": "", "metaphor": action["glyph"],
                      "export": [ACTION_SIZE, ACTION_SIZE],
                      "css": [ACTION_SIZE // 2, ACTION_SIZE // 2]}))
    return jobs


def request_size(export):
    """挑最接近该件导出比例的那一档画布（对数距离，等比更合理）。"""
    import math
    ratio = export[0] / export[1]
    return min(SIZES, key=lambda s: abs(math.log((s[0] / s[1]) / ratio)))


def aspect_anchor(export):
    """构图锚：出图模型只给固定几档画布，很容易把 3:1 的横条画成方块。

    九宫格的四个角料是 16×16，一旦形状被压成方块，裁到导出比例时**上下两条边会被裁掉** ——
    所以这里必须把「它是一条横条、画布上下留空」写死。这不是改规范，是补模型的构图能力。
    """
    w, h = export
    ratio = w / h
    horizontal = w >= h
    if abs(ratio - 1.0) < 0.08:
        return ("composition: the element is a single square tile, centred, occupying about 90%% "
                "of the canvas, the rest fully transparent.")
    shape = ("a wide horizontal strip" if horizontal else "a tall vertical strip")
    if ratio <= ASPECT_HINT_MAX:
        dims = ("about %.1f times wider than it is tall" % ratio if horizontal
                else "about %.1f times taller than it is wide" % (1 / ratio))
    else:
        dims = "extremely elongated, far longer than it is thick"
    empty = "above and below" if horizontal else "left and right"
    return ("composition: the element is %s, %s; it runs across the whole canvas, and the empty "
            "space %s stays completely transparent - do not inflate the shape into a square or "
            "fill the canvas." % (shape, dims, empty))


# 小九宫格件（短边 ≤ EDGE_MAX 逻辑像素）的**四边必须连着**：
# 24px 高的页签、slice 8 = 只为 2 个逻辑像素高的边料，若那 2 行被 §4 的「压扁偏移 / 边长不等」
# 削成一条细斜条，拉伸后控件顶边就是断的（实测 FRAME_TAB_ON 顶边只有 17% 有墨）。
# 所以小件的规则要反过来写死：外圈 2 逻辑像素是**平直贯通**的边，不规则只留在四角。
EDGE_MAX = 16
EDGE_FULL_EN = (
    "the outer rim must actually carry ink across the FULL width and height of the canvas: the "
    "topmost rows and the bottommost rows are not empty and are not inked only near the corners - "
    "each of the four edges runs continuously from corner to corner. Keep irregularity in the "
    "corner cuts and in the band just inside the rim, do not thin out, taper or skew an edge and "
    "do not leave an outer row blank"
)


def full_prompt(slot, dark):
    """正向提示词 + 构图锚 + 极简锚 + 单物件锚 + 平中心锚 + 负向锚。

    本接口没有独立的 negative 字段，负向锚按惯例并进 prompt。
    """
    export = slot["export"]
    prompt = slot["prompt_en"].strip()
    prompt = "%s %s" % (prompt, aspect_anchor(export))
    prompt = "%s %s" % (prompt, SINGLE_OBJECT_EN)
    stretch = bool(slot.get("pull")) and (slot.get("slice") or 0) > 0
    if stretch:
        prompt = "%s %s" % (prompt, FLAT_CENTRE_EN)
        prompt = "%s %s" % (prompt, EDGE_FULL_EN)
    elif min(export) // 4 <= TINY_MAX and slot["id"] not in TEXTURE_IDS:
        prompt = "%s %s" % (prompt, TINY_EN.format(n=min(export) // 4))
    if dark:
        prompt = "%s %s" % (prompt, ACCENT_DARK_EN if slot["id"] in ACCENT_IDS else DARK_APPEND_EN)
    # 🔴 BG_TILE 那句必须放在**最后**：深色锚里有「keep tomato red and egg-yolk yellow」，
    # 放在它前面等于让模型画番茄和蛋黄（实测深色版又画回了一颗煎蛋 + 番茄）。
    if slot["id"] == "BG_TILE":
        prompt = "%s %s" % (prompt, BG_TILE_EN)
    if slot["id"] == "TEX_BAR_FILL":
        prompt = "%s %s" % (prompt, TEX_BAR_FILL_EN)
    if dark:
        prompt = "%s %s" % (prompt, ACCENT_DARK_EN if slot["id"] in ACCENT_IDS else DARK_APPEND_EN)
    negative = (slot.get("neg_en") or "").strip()
    if negative and "Negative prompt:" not in prompt:
        prompt = "%s Negative prompt: %s" % (prompt, negative)
    return prompt


def slot_jobs(slots, ids, dark, only_dark=False):
    """→ [(输出文件名, 提示词, 导出尺寸, 是否深色)]。深色只给 dark_variant 为真的件（§6 共 14 件）。"""
    jobs = []
    for slot_id in ids:
        slot = slots[slot_id]
        if not only_dark:
            jobs.append(("%s.png" % slot_id, full_prompt(slot, False),
                         tuple(slot["export"]), False))
        if dark:
            if not slot.get("dark_variant"):
                print("  · %s 不在 §6 的深色 14 件里，跳过深色版" % slot_id)
                continue
            jobs.append(("%s_dark.png" % slot_id, full_prompt(slot, True),
                         tuple(slot["export"]), True))
    return jobs


def one(job, force):
    name, prompt, export, dark = job
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / name
    if path.exists() and not force:
        return name, "skip（已存在）"
    width, height = request_size(export)
    last = None
    for attempt in range(RETRIES):
        try:
            path.write_bytes(call_api(prompt, size="%dx%d" % (width, height)))
            return name, "ok  %dx%d  %.0fKB" % (width, height, path.stat().st_size / 1024)
        except Exception as exc:  # noqa: BLE001  —— 上游会 503，逐次退避重试
            last = exc
            if attempt < RETRIES - 1:
                time.sleep(8 * (attempt + 1))
    return name, "FAILED: %s" % last


def write_icon_manifest(entries):
    """图标清单：ID → 名称/视图/emoji/尺寸。接入时按 ID 对 `.icon-*` 的 CSS 类即可。

    🔴 在**出图之前**就写：`pixelize_ui.py` 靠这份清单拿图标的导出尺寸（图标不在
    spec 的 `slots[]` 里），先写才能让「出图 → 像素化」两件事分开跑、互不等待。
    """
    path = ICON_MANIFEST
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print("图标清单：%s（%d 个）" % (path, len(entries)))


def main():
    parser = argparse.ArgumentParser(description="像素美食 UI 出图（第 2 步）")
    parser.add_argument("--ids", help="逗号分隔的 ID，例如 FRAME_CARD,FRAME_TAB")
    parser.add_argument("--sample", action="store_true", help="§0 的三张样张")
    parser.add_argument("--slots", action="store_true", help="全部 42 件通用件")
    parser.add_argument("--icons", action="store_true", help="全部 158 个图标（§7，无深色套）")
    parser.add_argument("--icon-kinds", help="只出某几类图标，逗号分隔（如 技能,功能分组头）")
    parser.add_argument("--icon-ids", help="只出某几个图标，逗号分隔（如 ICON_GROUP_01）")
    parser.add_argument("--no-dark", action="store_true", help="只出浅色")
    parser.add_argument("--only-dark", action="store_true", help="只出深色套（重出深色时用）")
    parser.add_argument("--force", action="store_true", help="已存在的也重出")
    parser.add_argument("--list", action="store_true", help="列出所有 ID 与尺寸")
    parser.add_argument("--prompt", help="只打印某个 ID 的提示词，不出图")
    parser.add_argument("--dry-run", action="store_true", help="打印将要出的清单，不发请求")
    args = parser.parse_args()

    spec = load_spec()
    slots = {slot["id"]: slot for slot in spec["slots"]}

    if args.list:
        for slot_id, slot in slots.items():
            print("%-18s %-14s 导出 %-9s slice %-3s %s%s"
                  % (slot_id, slot["cn"], "x".join(map(str, slot["export"])), slot["slice"],
                     slot["usage"], "  [深色]" if slot.get("dark_variant") else ""))
        print("\n共 %d 件通用件" % len(slots))
        icons = icon_jobs(spec)
        print("共 %d 个图标（§7）" % len(icons))
        return 0
    if args.prompt:
        print(full_prompt(slots[args.prompt], False))
        return 0

    icon_entries = []
    if args.icons or args.icon_kinds or args.icon_ids:
        # 🔴 清单**永远写全量 158 条**，哪怕这次只出其中几类 —— 否则一次「只重出技能」
        #    会把 icons.json 覆盖成 46 条，pixelize 认不出其余图标，接入时也对不上号。
        all_icons = icon_jobs(spec)
        icon_entries = [entry for *_, entry in all_icons]
        icon_list = all_icons
        if args.icon_kinds:
            want = {k.strip() for k in args.icon_kinds.split(",") if k.strip()}
            unknown_kinds = want - {e["kind"] for _, _, _, e in all_icons}
            if unknown_kinds:
                sys.exit("没有这些图标类别：%s（可选：%s）"
                         % ("、".join(unknown_kinds),
                            "、".join(sorted({e["kind"] for _, _, _, e in all_icons}))))
            icon_list = [j for j in icon_list if j[3]["kind"] in want]
        if args.icon_ids:
            want_ids = {s.strip() for s in args.icon_ids.split(",") if s.strip()}
            unknown_ids = want_ids - {e["id"] for _, _, _, e in all_icons}
            if unknown_ids:
                sys.exit("没有这些图标 ID：%s" % "、".join(unknown_ids))
            icon_list = [j for j in icon_list if j[3]["id"] in want_ids]
        jobs = [(name, prompt, export, False) for name, prompt, export, _ in icon_list]
        which = args.icon_ids or args.icon_kinds
        label = "%d 个图标%s" % (len(jobs), "（%s）" % which if which else "")
    else:
        # §0 的三张样张：卡片 / 按钮（常态+主按钮）/ 页签（常态+选中）
        if args.sample:
            ids = ["FRAME_CARD", "FRAME_BTN", "FRAME_BTN_PRIMARY", "FRAME_TAB", "FRAME_TAB_ON"]
        elif args.slots:
            ids = list(slots)
        elif args.ids:
            ids = [s.strip() for s in args.ids.split(",") if s.strip()]
        else:
            parser.error("要给出 --sample / --slots / --ids / --icons 之一（--list 可看全部 ID）")
        unknown = [i for i in ids if i not in slots]
        if unknown:
            sys.exit("规范 JSON 里没有这些 ID：%s" % "、".join(unknown))
        jobs = slot_jobs(slots, ids, not args.no_dark, args.only_dark)
        label = "%d 件" % len(ids)

    print("将要出图 %d 张（%s）→ %s" % (len(jobs), label, RAW_DIR))
    if args.dry_run:
        for name, _, export, dark in jobs:
            print("  %s  导出 %dx%d%s" % (name, *export, "  [深色套]" if dark else ""))
        return 0

    if icon_entries:
        write_icon_manifest(icon_entries)

    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(one, job, args.force) for job in jobs]
        for done, future in enumerate(as_completed(futures), start=1):
            name, status = future.result()
            results.append((name, status))
            print("[%3d/%d] %-30s %s" % (done, len(jobs), name, status), flush=True)

    if icon_entries:
        write_icon_manifest(icon_entries)
    failed = [n for n, s in results if s.startswith("FAILED")]
    print("\n完成 %d/%d，失败：%s" % (len(jobs) - len(failed), len(jobs), "、".join(failed) or "无"))
    print("下一步：python scripts/dev/pixelize_ui.py")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
