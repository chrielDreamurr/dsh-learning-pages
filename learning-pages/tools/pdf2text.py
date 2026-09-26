#!/usr/bin/env python
"""
pdf2text.py —— 把 PDF 提取成可读的纯文本，供学习页面取材。

为什么要自己写：直接用 pypdf 之类的库提取中文 PDF 时，
行内公式、编号、标注会被甩到页尾，读起来完全对不上。
这里改用「按坐标重建阅读顺序」的办法（先按 y 分行，行内按 x 排序），
公式和数字会落回它原本所在的那一行附近，能看懂。

用法（一般不用直接调它，用同目录的 pdf2text.ps1）：
    python pdf2text.py <输入.pdf> [输出.txt]

输出：每页之间用 "===== PAGE n =====" 分隔。
"""
import sys
import os

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    src = os.path.abspath(sys.argv[1])
    if not os.path.isfile(src):
        print(f"找不到文件：{src}")
        return 1
    out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.splitext(src)[0] + ".txt"

    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf          # 旧版包名
        except ImportError:
            print("缺少依赖。请用 tools/pdf2text.ps1 运行，它会自动装 pymupdf。")
            return 1

    doc = pymupdf.open(src)
    parts = []
    empty_pages = []
    for pno in range(len(doc)):
        page = doc[pno]
        words = page.get_text("words")      # (x0, y0, x1, y1, 词, 块号, 行号, 词号)
        # 按「行」聚类：y 相近的算同一行，行内按 x 从左到右
        words.sort(key=lambda w: (round(w[1] / 4.0), w[0]))
        lines, cur, cur_y = [], [], None
        for w in words:
            y = round(w[1] / 4.0)
            if cur_y is None or y == cur_y:
                cur.append(w)
            else:
                lines.append(cur); cur = [w]
            cur_y = y
        if cur:
            lines.append(cur)
        text = "\n".join(" ".join(w[4] for w in ln) for ln in lines)
        if not text.strip():
            empty_pages.append(pno + 1)
        parts.append(f"\n\n=================== PAGE {pno + 1} ===================\n{text}")

    txt = "".join(parts)
    with open(out, "w", encoding="utf-8") as f:
        f.write(txt)

    print(f"页数        : {len(doc)}")
    print(f"提取字符数  : {len(txt)}")
    print(f"输出        : {out}")
    if empty_pages:
        print(f"⚠ 有 {len(empty_pages)} 页没有文字层（很可能是扫描件，需要 OCR）：{empty_pages[:20]}")
    else:
        print("✅ 每一页都有文字层")
    return 0

if __name__ == "__main__":
    sys.exit(main())
