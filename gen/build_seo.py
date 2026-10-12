"""Build site/404.html, site/robots.txt and site/sitemap.xml.  Run:  python -I gen/build_seo.py

SITE_URL is the public address search engines should index. Change it when the site moves to its own domain.
"""
import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chrome import SITE, build_page  # noqa: E402

SITE_URL = 'https://neowave-site.vercel.app'

ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h12M9 3l5 5-5 5"/></svg>'

# ---------- 404 ----------
main = f'''<main>
<section class="page-hero page-hero--404">
  <div class="wrap page-hero-content">
    <span class="eyebrow reveal">Error 404</span>
    <h1 data-split>This page is <em>off the grid.</em></h1>
    <p class="lede reveal">The link may be old or mistyped. Everything NeoWave makes is still one click away.</p>
    <div class="hero-actions reveal">
      <a class="btn btn-primary" href="index.html">Back to home {ARROW}</a>
      <a class="btn btn-ghost" href="products.html">Browse products</a>
      <a class="btn btn-ghost" href="generator.html">Code generator</a>
    </div>
  </div>
</section>
'''
build_page(
    '404.html', main,
    title='Page not found — NeoWave',
    description='This page could not be found. Browse NeoWave products, build an ordering code or contact our team.',
    og_title='Page not found — NeoWave',
    og_image='assets/img/hero-house.webp',
    active='404',
    cta=True,
)
# root-relative asset paths are applied by version_assets.py (it must see the relative paths to cache-bust them)
p = SITE / '404.html'
p.write_text(p.read_text(encoding='utf-8').replace('<head>', '<head>\n<meta name="robots" content="noindex">', 1),
             encoding='utf-8')

# ---------- robots + sitemap ----------
(SITE / 'robots.txt').write_text(
    f'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: {SITE_URL}/sitemap.xml\n', encoding='utf-8')

PRIORITY = {'index': '1.0', 'products': '0.9', 'generator': '0.9', 'contact': '0.8', 'career': '0.6', 'news': '0.6'}
pages = sorted(x.stem for x in SITE.glob('*.html') if x.stem != '404')
today = datetime.date.today().isoformat()
urls = ''.join(
    f'  <url><loc>{SITE_URL}/{"" if s == "index" else s}</loc><lastmod>{today}</lastmod>'
    f'<priority>{PRIORITY.get(s, "0.5")}</priority></url>\n' for s in pages)
(SITE / 'sitemap.xml').write_text(
    f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n',
    encoding='utf-8')
print(f'404.html, robots.txt, sitemap.xml ({len(pages)} pages) written')
