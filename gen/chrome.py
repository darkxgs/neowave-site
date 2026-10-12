"""Shared page chrome: wraps a page's <main> content with the homepage's head, nav, CTA and footer."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'


def build_page(filename, main, *, title, description, og_title, og_image, active, css=(), js=(), cta=True):
    index = (SITE / 'index.html').read_text(encoding='utf-8')

    head_end = index.index('</head>')
    head = index[:head_end]
    head = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', head)
    head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{description}">', head)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{og_title}">', head)
    head = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{og_image}">', head)
    links = ''.join(f'\n<link rel="stylesheet" href="{c}">' for c in css)
    head, n_css = re.subn(r'(<link rel="stylesheet" href="assets/css/main\.css[^"]*">)', lambda m: m.group(1) + links, head)

    body_start = index[head_end:index.index('<main>')]
    body_start = re.sub(r'<a href="(index\.html|/)" class="active">Home</a>', r'<a href="\1">Home</a>', body_start)
    name = active.removesuffix('.html')
    body_start = re.sub(rf'<a href="((?:/)?{re.escape(name)}(?:\.html)?)">', r'<a href="\1" class="active">', body_start, count=1)

    cta_html = index[index.index('<!-- ============ CTA ============ -->'):index.index('</main>')] if cta else ''
    tail = index[index.index('</main>'):]
    scripts = ''.join(f'\n<script defer src="{j}"></script>' for j in js)
    tail, n_js = re.subn(r'(<script defer src="assets/js/main\.js[^"]*"></script>)', lambda m: m.group(1) + scripts, tail)
    assert n_css == 1 and n_js == 1, f'{filename}: could not attach page css/js (css={n_css}, js={n_js})'

    (SITE / filename).write_text(head + body_start + main + cta_html + tail, encoding='utf-8')
