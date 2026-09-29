"""请求「美食探索·专属装备」四件图标的源图 URL（Qwen 文生图）。

本脚本**不写任何文件**：只发出生成请求并把 `名称<TAB>URL` 打印到 stdout，
下载由调用方按字面量路径执行（见 scripts/dev/gen_exploration_gear.md 的说明）。

提示词来自 docs/探索专属装备图片提示词.md，只改了一处：
原文档结尾写「透明背景」，但 Qwen 文生图**没有 alpha 通道**，写「透明背景」常被画成
黑白棋盘格。本脚本改成「纯白背景 + 无投影无阴影无文字」，去背交给
scripts/gen/process_item_images.py（它本就是按近白背景 + 色度去背设计的）。

用法：
    python scripts/dev/gen_exploration_gear.py                 # 四件全出
    python scripts/dev/gen_exploration_gear.py --only 寻味罗盘
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

# 结尾统一改成纯白背景（见模块 docstring 的说明）
TAIL = ("卡通手绘风格，厚实深棕描边，表面一两个白色高光点，颜色饱和明快，居中单体构图，"
        "纯白背景，无投影无阴影无文字无边框，主体占画面约 80%，正方形构图")

GEAR = [
    ("寻味罗盘", "游戏物品图标：一件旅行者的寻味罗盘：圆形黄铜罗盘，开盖的玻璃面下是一枚橙红色指针与四向刻度，"
                 "下方垂一小截棕色挂绳。铜面暖金有做旧痕，指针橙红醒目。"),
    ("寻味旅披", "游戏物品图标：一件旅行者的寻味旅披：橄榄绿厚布斗篷，前襟敞开呈 V 形，领口一枚黄铜圆扣，"
                 "下摆内侧加一圈暖棕色滚边，布料有两条自然褶皱。"),
    ("遗珍风灯", "游戏物品图标：一盏遗迹猎人的遗珍风灯：青铜色方形提灯，顶部拱形金属提梁，"
                 "四面玻璃罩透出青蓝色火焰，灯身下方一圈回形云雷纹铜饰，底座微鼓。青铜有铜绿，火焰青蓝发亮。"),
    ("遗珍踏屐", "游戏物品图标：一双遗迹猎人的遗珍踏屐：深褐色木质厚底鞋，鞋头微翘，鞋面横跨两道深棕皮革绑带、"
                 "各带一枚青铜方扣，鞋侧嵌一颗青蓝色小宝石。木纹清晰，铜扣与宝石点缀。"),
]


def check_url(url, what):
    """发出请求前校验协议、host 后缀与解析地址。"""
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
    """POST 一次同步生成，返回 (图片 URL, request_id)。"""
    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        raise RuntimeError("DASHSCOPE_API_KEY 未设置")
    payload = json.dumps({
        "model": MODEL,
        "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
        # prompt_extend 关掉：它会给画面加实体与图上文字（实测写过 "OMAKASE SUSHI" 木牌）
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


# 遗珍行装要求「冷色」，但 ④ 原提示词把鞋定为「深褐色木质」，实测出来整体偏暖，
# 和寻味行装（黄铜金 + 橄榄绿）的暖色系分不开。此变体**只改色调不改结构**：
# 木色推向灰青梅青、绑带改青铜绿、放大青蓝宝石与青蓝描线，让它在 24px 下也读作冷色。
COOL_RETRY = {
    "遗珍踏屐": "游戏物品图标：一双遗迹猎人的遗珍踏屐，是**并排摆放的两只鞋**（左鞋与右鞋，共两只，"
                 "不是单只）：灰青梅青色调的木质厚底鞋，鞋头微翘，每只鞋面各横跨两道青铜绿皮革绑带、"
                 "各带一枚青铜方扣，鞋侧嵌一颗青蓝色发光小宝石，鞋底边缘一圈青蓝描线。"
                 "整体是偏冷的青绿调，木纹清晰，铜扣与宝石点缀醒目。",
}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="只出某一件（按名字精确匹配）")
    ap.add_argument("--variant", choices=["cool"], default=None,
                    help="cool：对有 COOL_RETRY 的件改用冷色调变体")
    args = ap.parse_args(argv)

    items = [g for g in GEAR if not args.only or g[0] == args.only]
    if not items:
        print("❌ --only %r 没匹配到任何一件" % args.only, file=sys.stderr)
        return 1

    failed = False
    for name, desc in items:
        if args.variant == "cool" and name in COOL_RETRY:
            desc = COOL_RETRY[name]
        try:
            url, rid = generate(desc + TAIL)
            check_url(url, "image url")          # 下载前先把结果地址也校验一遍
            print("%s\t%s\t%s" % (name, rid, url))
        except Exception as exc:                 # noqa: BLE001 - 逐件报告，不中断余下
            failed = True
            print("❌ %-8s %s" % (name, exc), file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())