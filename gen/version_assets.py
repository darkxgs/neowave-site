"""Cache-bust local CSS/JS/JSON references in every site/*.html with a short content hash (?v=xxxxxxxx).

Run after any build:  python -I gen/version_assets.py
"""
import hashlib
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / 'site'
_cache = {}


def ver(rel):
    if rel not in _cache:
        p = SITE / rel
        _cache[rel] = hashlib.sha1(p.read_bytes()).hexdigest()[:8] if p.exists() else None
    return _cache[rel]


def bust(m):
    attr, path = m.group(1), m.group(2)
    v = ver(path)
    return f'{attr}="{path}?v={v}"' if v else m.group(0)


pattern = re.compile(r'(href|src)="(assets/(?:css|js)/[^"?#]+\.(?:css|js))(?:\?v=[0-9a-f]*)?"')
for page in sorted(SITE.glob('*.html')):
    s = page.read_text(encoding='utf-8')
    out = pattern.sub(bust, s)
    if out != s:
        page.write_text(out, encoding='utf-8')
    print(f'{page.name:<45} {len(pattern.findall(out))} assets versioned')

# clean URLs: href="products.html#x" -> href="/products#x", href="index.html" -> href="/"
PAGES = {p.stem for p in SITE.glob('*.html')}
link_re = re.compile(r'(href)="(' + '|'.join(sorted(map(re.escape, PAGES), key=len, reverse=True)) + r')\.html([#?][^"]*)?"')
def clean(m):
    name, rest = m.group(2), m.group(3) or ''
    return f'{m.group(1)}="{"/" if name == "index" else "/" + name}{rest}"'
for page in sorted(SITE.glob('*.html')):
    s = page.read_text(encoding='utf-8')
    out = link_re.sub(clean, s)
    if out != s:
        page.write_text(out, encoding='utf-8')
leftover = [p.name for p in SITE.glob('*.html') if link_re.search(p.read_text(encoding='utf-8'))]
assert not leftover, f'.html links left in {leftover}'
print('clean URLs applied')

# admin photo library manifest (site product images)
import json
imgs = sorted(p.relative_to(SITE).as_posix() for p in (SITE / 'assets' / 'img' / 'products').rglob('*')
              if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'))
(SITE / 'assets' / 'data' / 'images.json').write_text(json.dumps(imgs), encoding='utf-8')

# the generator data is fetched from JS: version it the same way
js = SITE / 'assets' / 'js' / 'generator.js'
s = js.read_text(encoding='utf-8')
out = re.sub(r"fetch\('assets/data/generator\.json(?:\?v=[0-9a-f]*)?'\)", f"fetch('assets/data/generator.json?v={ver('assets/data/generator.json')}')", s)
if out != s:
    js.write_text(out, encoding='utf-8')
    _cache.pop('assets/js/generator.js', None)
    # generator.js itself changed, so re-version the pages that load it
    for page in SITE.glob('*.html'):
        t = page.read_text(encoding='utf-8')
        t2 = pattern.sub(bust, t)
        if t2 != t:
            page.write_text(t2, encoding='utf-8')

# 404.html is served at any path (/a/b/c), so its asset references must be root-relative
p404 = SITE / '404.html'
if p404.exists():
    t = p404.read_text(encoding='utf-8')
    t2 = re.sub(r'(href|src|poster|content)="assets/', r'\1="/assets/', t)
    if t2 != t:
        p404.write_text(t2, encoding='utf-8')
    print('404.html: asset paths made root-relative')
