"""请求「去背挖空」修复批的源图 URL（Qwen 文生图）—— 5 件 + 1 件存疑。

背景与检测口径见 docs/物品图片提示词-图片修复-2026-09-30.md：
这 5 件不是画错，而是**被去背挖空**（源图 64×64 + 管线默认 5×5 闭运算把 1~2px 描边焊穿 ⇒
主体浅色内部与外部白底连通被填掉）；现有 PNG 的透明区 RGB 已被写成 0 ⇒ **只能重出**。
⚠️ 重出的图**必须用 `--bg white --closing 0` 重新过一遍管线**，别把源图直接丢进 items/food/。

本脚本**不写任何文件**：只发请求并把 `名称<TAB>目录<TAB>request_id<TAB>URL` 打到 stdout。
两处既有口径：① 结尾写「纯白背景」而不是「透明背景」；② `prompt_extend: False`（否则会往图里加字）。

用法：
    python scripts/dev/gen_broken_redraws.py                 # 全部 6 件
    python scripts/dev/gen_broken_redraws.py --only 宣纸      # 单件重出
    python scripts/dev/gen_broken_redraws.py --variant retry  # 只重出 RETRY 里有变体的件
"""

import argparse
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

ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
ALLOWED_SUFFIXES = (".aliyuncs.com",)
MODEL = "qwen-image-3.0-pro"
SIZE = "1328*1328"

TAIL = ("卡通手绘风格，厚实深棕描边，表面一两个白色高光点，颜色饱和明快，居中单体构图，"
        "纯白背景，无投影无阴影无文字无边框，主体占画面约 80%，正方形构图")

# (名称, 落盘子目录, 组, 正文)　—— 组：A 五件确认 / B 一件存疑
ITEMS = [
    ("宣纸", "food", "A",
     "游戏物品图标：一叠宣纸——三张米白色的宣纸整齐叠放，最上面那张的右上角微微翘起、露出下面两张的边缘；"
     "纸面是均匀的米白实心纸面，只带极浅的纤维感与一道很淡的横向折痕；纸堆左下角压着一枚很小的朱红印章，"
     "印章只占一角。整叠纸要能被一眼看出是「一叠纸」——是一个有厚度、有影线的实心纸堆，"
     "绝不要画成一个空心的方框、也不要只剩下轮廓线。"),
    ("棉麻叠布", "food", "A",
     "游戏物品图标：一叠折好的棉麻布——三折叠放的浅米色棉麻布，最上层露出一道折边；布面是实心的米白色布面，"
     "用大块的斜向经纬纹理表现编织感（只画十来条清楚的粗斜纹，不要细密的网格线、不要镂空、不要只剩一圈描边）；"
     "布的右下角露出一小截浅灰绿色的布边，布堆上压着一小段卷起的麻绳。整体要读成「一块厚实的布」，"
     "不要画成薄纱、不要半透明。"),
    ("贝壳扣", "food", "A",
     "游戏物品图标：一枚贝壳扣——一枚扇贝形的白色贝扣，正面朝外；壳面有放射状的十几道浅棱"
     "（棱要画粗、画清楚，不要细密）；壳缘一圈淡金色的小贝齿（七八枚）；扣背从下方露出一小块，"
     "能看到一个圆穿孔与一枚金色的小扣环。整个贝壳必须是一枚实心的白色贝体——壳面是白色实体，"
     "只有棱与贝齿是纹理，绝不要画成「一圈白色轮廓、中间是空的」那种空心样子。"),
    ("珍珠皂", "food", "A",
     "游戏物品图标：一块珍珠皂——长方圆角的皂块，皂体是实心的珍珠白（不透明、不镂空），"
     "表面泛一层很淡的珍珠光泽（用两三条淡蓝紫色的柔光带表现）；顶面压着一枚扇贝形的浅浮雕，"
     "浮雕中央嵌一颗小小的圆珍珠；皂块底下垫着一小块淡蓝色的皂垫。皂体轮廓要饱满、四个角圆润，"
     "不要画成透明水晶、也不要画成空心的盒子。"),
    ("天香净皂", "food", "A",
     "游戏物品图标：一块天香净皂——长方圆角的皂块，皂体是实心的奶白偏米色（不透明、不镂空），"
     "皂面有一道很浅的斜向皂纹；顶面压着一朵简洁的六瓣花形凹印，凹印底部透出一点淡金色；"
     "皂块旁边斜靠一枝很小的干花（两三朵小小的米色花）。整体要读成「一块实心的皂」，"
     "不要画成透明的皂块、也不要空心。"),
    ("玉髓根", "food", "B",
     "游戏物品图标：一支玉髓根——一支实心的浅青白色根茎（像玉雕成的根）：主根短粗、"
     "表面有三四道纵向浅棱，两侧垂下五六条短须根，根顶有一小截淡金色的芽。"
     "整体是半透的玉白色，但必须是实心的形体（要有明确的明暗面与描边），不要画成只剩一圈轮廓、也不要中间镂空。"),
]

# ── 重出变体（照既有 RETRY 的做法）：第一轮若某件 24px 下仍读不出形体，只在这里加变体描述 ──
RETRY = {}


def check_url(url, what):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https":
        raise RuntimeError("%s 必须是 https，实际 %r" % (what, parsed.scheme))
    host = parsed.hostname or ""
    if not any(host == s.lstrip(".") or host.endswith(s) for s in ALLOWED_SUFFIXES):
        raise RuntimeError("%s 的 host %r 不在白名单" % (what, host))
    for info in socket.getaddrinfo(host, parsed.port or 443, proto=socket.IPPROTO_TCP):
        addr = ipaddress.ip_address(info[4][0])
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            raise RuntimeError("%s 解析到非公网地址：%s" % (what, addr))
    return url


def ssl_ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def generate(prompt, timeout=600):
    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        raise RuntimeError("DASHSCOPE_API_KEY 未设置")
    payload = json.dumps({
        "model": MODEL,
        "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
        "parameters": {"size": SIZE, "n": 1, "prompt_extend": False, "watermark": False},
    }, ensure_ascii=True).encode("utf-8")
    req = urllib.request.Request(
        check_url(ENDPOINT, "endpoint"), data=payload, method="POST",
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    body = None
    for attempt in range(3):
        try:
            body = json.loads(urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx()).read())
            break
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            if exc.code in (429, 503) and attempt < 2:
                time.sleep(20 * (attempt + 1))
                continue
            raise RuntimeError("HTTP %s: %s" % (exc.code, detail))
    if body is None:
        raise RuntimeError("三次尝试均未取得响应")
    if body.get("code"):
        raise RuntimeError("%s: %s" % (body["code"], body.get("message")))
    for choice in (body.get("output") or {}).get("choices") or []:
        for part in ((choice.get("message") or {}).get("content") or []):
            if part.get("image"):
                return part["image"], body.get("request_id")
    raise RuntimeError("响应里没有图片：%s" % json.dumps(body, ensure_ascii=False)[:300])


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="只出某一件（按名字精确匹配）")
    ap.add_argument("--group", default=None, choices=["A", "B"], help="A 五件确认 / B 一件存疑")
    ap.add_argument("--variant", choices=["retry"], default=None, help="retry：改用 RETRY 里的修正描述")
    args = ap.parse_args(argv)

    items = [it for it in ITEMS if (not args.only or it[0] == args.only) and (not args.group or it[2] == args.group)]
    if not items:
        print("❌ --only %r / --group %r 没匹配到任何一件" % (args.only, args.group), file=sys.stderr)
        return 1
    if args.variant == "retry":
        picked = [it for it in items if it[0] in RETRY]
        if not picked:
            print("⚠ --variant retry：选中的件里没有可重出的变体（有变体的是 %s）" % ("、".join(RETRY) or "（暂无）"),
                  file=sys.stderr)
            return 1
        items = picked

    failed = False
    for name, subdir, _group, desc in items:
        if args.variant == "retry" and name in RETRY:
            desc = RETRY[name]
        try:
            url, rid = generate(desc + TAIL)
            check_url(url, "image url")
            print("%s\t%s\t%s\t%s" % (name, subdir, rid, url))
        except Exception as exc:                 # noqa: BLE001
            failed = True
            print("❌ %-10s %s" % (name, exc), file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
