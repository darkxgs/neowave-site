"""Scrape the 3 news articles from neowave.tech into gen/news.json.  Run:  python -I gen/scrape_news.py"""
import html
import json
import re
import urllib.request
from pathlib import Path

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9'}
SLUGS = [
    'harnessing-innovation-exploring-emerging-trends-in-industrial-automation-for-efficiency-and-sustainability',
    'safeguarding-health-and-productivity-the-vital-role-of-environmental-monitoring-in-workplace-safety',
    'streamlining-industrial-processes-the-crucial-role-of-industrial-switches-and-i-o-modules',
]


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode('utf-8')


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s))).strip()


posts = []
for slug in SLUGS:
    page = get(f'https://neowave.tech/{slug}/')
    title = text(re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S).group(1))
    date = re.search(r'<time[^>]*datetime="([^"]+)"', page)
    # the article body is the post-content widget (falls back to entry-content)
    m = re.search(r'theme-post-content\.default"(.*?)</div>\s*</div>\s*</div>', page, re.S) or \
        re.search(r'class="entry-content[^"]*">(.*?)</div>', page, re.S)
    body = m.group(1) if m else ''
    blocks = []
    for tag, inner in re.findall(r'<(h[2-4]|p|li)[^>]*>(.*?)</\1>', body, re.S):
        t = text(inner)
        if t:
            blocks.append({'t': 'h' if tag.startswith('h') else tag, 'text': t})
    posts.append({'slug': slug, 'title': title, 'date': date.group(1) if date else '2024-02-20', 'blocks': blocks})
    print(slug[:40], len(blocks), 'blocks', sum(len(b['text'].split()) for b in blocks), 'words')

Path(__file__).with_name('news.json').write_text(json.dumps(posts, ensure_ascii=False, indent=1), encoding='utf-8')
