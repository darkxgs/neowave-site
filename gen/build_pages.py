"""Build news.html, the article pages and contact.html.  Run:  python -I gen/build_pages.py"""
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chrome import build_page  # noqa: E402

GEN = Path(__file__).resolve().parent
esc = html.escape
ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h12M9 3l5 5-5 5"/></svg>'

posts = json.loads((GEN / 'news.json').read_text(encoding='utf-8'))
META = {  # per-article presentation (keyed by live-site slug)
    'harnessing-innovation-exploring-emerging-trends-in-industrial-automation-for-efficiency-and-sustainability': dict(
        file='news-industrial-automation-trends.html', tag='Automation', img='assets/img/news-manufacturing.jpg', pos='center 40%',
        short='Emerging trends in industrial automation',
        related=('products.html', 'Explore the full catalog', 'Sensors, controllers, meters and networking built for automated, sustainable operations.')),
    'safeguarding-health-and-productivity-the-vital-role-of-environmental-monitoring-in-workplace-safety': dict(
        file='news-environmental-monitoring.html', tag='Monitoring', img='assets/img/banner-sensors.webp', pos='center 50%',
        short='Environmental monitoring in workplace safety',
        related=('products.html#fam-sensors', 'Sensors &amp; Switches', 'Temperature, humidity, air quality, pressure, level and flow sensing for safer workplaces.')),
    'streamlining-industrial-processes-the-crucial-role-of-industrial-switches-and-i-o-modules': dict(
        file='news-switches-io-modules.html', tag='Networking', img='assets/img/industrial-cabinet.webp', pos='center 45%',
        short='Industrial switches and I/O modules',
        related=('products.html#fam-io', 'I/O &amp; Data Transmission', 'Managed industrial Ethernet switches and I/O modules for reliable plant-floor connectivity.')),
}


def fmt_date(iso):
    d = date.fromisoformat(iso[:10])
    return d.strftime('%b %d, %Y').replace(' 0', ' ')


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


for p in posts:
    p.update(META[p['slug']])
    p['blocks'] = [b for b in p['blocks'] if not (b['t'] == 'li' and b['text'] == 'Uncategorized')]
    words = sum(len(b['text'].split()) for b in p['blocks'])
    p['mins'] = max(1, round(words / 220))
    p['excerpt'] = p['blocks'][0]['text']
    p['nice_date'] = fmt_date(p['date'])


def render_body(blocks):
    out, in_list, n = [], False, 0
    for b in blocks:
        if b['t'] == 'li':
            if not in_list:
                out.append('<ol class="a-list">'); in_list, n = True, 0
            n += 1
            term, _, rest = b['text'].partition(':')
            if rest and len(term) < 60:
                out.append(f'<li class="reveal"><span class="al-n">{n:02d}</span><div><b>{esc(term)}</b><p>{esc(rest.strip())}</p></div></li>')
            else:
                out.append(f'<li class="reveal"><span class="al-n">{n:02d}</span><div><p>{esc(b["text"])}</p></div></li>')
            continue
        if in_list:
            out.append('</ol>'); in_list = False
        if b['t'] == 'h':
            out.append(f'<h2 id="{slugify(b["text"])}" class="reveal">{esc(b["text"])}</h2>')
        else:
            out.append(f'<p class="reveal">{esc(b["text"])}</p>')
    if in_list:
        out.append('</ol>')
    return '\n        '.join(out)


def post_card(p, cls='post'):
    return f'''      <a class="{cls} reveal" href="{p['file']}">
        <div class="post-img"><img src="{p['img']}" alt="" loading="lazy" style="object-position:{p['pos']}"></div>
        <div class="post-body">
          <div class="post-meta"><b>{p['tag']}</b><span>{p['nice_date']}</span><span>{p['mins']} min read</span></div>
          <h3>{esc(p['title'])}</h3>
          <p>{esc(p['excerpt'][:170].rsplit(' ', 1)[0])}…</p>
          <span class="link">Read article {ARROW}</span>
        </div>
      </a>'''


# ================= NEWS LISTING =================
feat, rest = posts[0], posts[1:]
news_main = f'''<main>
<section class="page-hero news-hero">
  <div class="wrap page-hero-content">
    <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><b>News &amp; Events</b></nav>
    <span class="eyebrow reveal">News &amp; events</span>
    <h1 data-split>Insights from <em>the field.</em></h1>
    <p class="lede reveal">Perspectives on building automation, industrial networking and environmental monitoring from the NeoWave team.</p>
  </div>
</section>

<section class="news-feature">
  <div class="wrap">
    <a class="feature-card reveal" href="{feat['file']}">
      <div class="fc-img"><img src="{feat['img']}" alt="" style="object-position:{feat['pos']}"></div>
      <div class="fc-body">
        <span class="fc-badge">Featured</span>
        <div class="post-meta"><b>{feat['tag']}</b><span>{feat['nice_date']}</span><span>{feat['mins']} min read</span></div>
        <h2>{esc(feat['title'])}</h2>
        <p>{esc(feat['excerpt'])}</p>
        <span class="btn btn-primary">Read the article {ARROW}</span>
      </div>
    </a>
  </div>
</section>

<section class="section light news-list">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow reveal">Latest articles</span>
        <h2 class="h2" data-split>More from<br>the journal.</h2>
      </div>
      <p class="lede reveal">Deep dives on the technology behind safer, smarter and more efficient spaces.</p>
    </div>
    <div class="news-grid news-grid--2">
{chr(10).join(post_card(p) for p in rest)}
    </div>

    <div class="events reveal">
      <div class="ev-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>
      <div class="ev-txt">
        <span class="eyebrow">Events</span>
        <h3>Upcoming events will be announced here.</h3>
        <p>Want to meet the team at a trade show, or invite NeoWave to your event? We'd love to hear from you.</p>
      </div>
      <a class="btn btn-dark" href="contact.html?subject=event">Get in touch {ARROW}</a>
    </div>
  </div>
</section>
'''
build_page('news.html', news_main,
           title='News &amp; Events — NeoWave',
           description='News, insights and events from NeoWave: building automation, industrial networking and environmental monitoring.',
           og_title='NeoWave News &amp; Events', og_image=feat['img'], active='news.html',
           css=['assets/css/news.css'])
print('news.html')

# ================= ARTICLES =================
for p in posts:
    heads = [b['text'] for b in p['blocks'] if b['t'] == 'h']
    toc = '\n'.join(f'          <li><a href="#{slugify(h)}">{esc(h)}</a></li>' for h in heads)
    others = [o for o in posts if o is not p]
    rel_href, rel_title, rel_desc = p['related']
    body = render_body(p['blocks'])
    lead, _, body_rest = body.partition('\n        ')
    lead = lead.replace('<p class="reveal">', '<p class="a-lead reveal">', 1)
    main = f'''<main>
<article>
<section class="page-hero article-hero">
  <div class="wrap page-hero-content">
    <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="news.html">News</a><span>/</span><b>{esc(p['short'])}</b></nav>
    <div class="post-meta a-meta reveal"><b>{p['tag']}</b><span>{p['nice_date']}</span><span>{p['mins']} min read</span><span>By NeoWave</span></div>
    <h1 data-split>{esc(p['title'])}</h1>
  </div>
  <div class="wrap"><div class="a-cover"><img src="{p['img']}" alt="" style="object-position:{p['pos']}"></div></div>
</section>

<section class="a-wrap light">
  <div class="wrap a-grid">
    <aside class="a-side">
      <div class="a-toc">
        <span class="eyebrow">On this page</span>
        <ol>
{toc}
        </ol>
        <div class="a-progress"><i></i></div>
      </div>
      <div class="a-share">
        <span class="eyebrow">Share</span>
        <div>
          <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fneowave.tech%2F{p['slug']}%2F" target="_blank" rel="noopener" aria-label="Share on LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/></svg></a>
          <a class="share-btn" href="mailto:?subject={esc(p['title'])}&amp;body=https%3A%2F%2Fneowave.tech%2F{p['slug']}%2F" aria-label="Share by email"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg></a>
          <button class="share-btn" type="button" data-copy aria-label="Copy link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg><span class="copied">Copied</span></button>
        </div>
      </div>
    </aside>
    <div class="a-body">
        {lead}
        {body_rest}
      <a class="a-related reveal" href="{rel_href}">
        <span class="eyebrow">Related products</span>
        <b>{rel_title}</b>
        <span>{rel_desc}</span>
        <span class="tile-arrow">{ARROW}</span>
      </a>
    </div>
  </div>
</section>
</article>

<section class="section a-more">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow reveal">Keep reading</span>
        <h2 class="h2" data-split>More insights.</h2>
      </div>
      <a class="btn btn-ghost reveal" href="news.html">All articles {ARROW}</a>
    </div>
    <div class="news-grid news-grid--2">
{chr(10).join(post_card(o) for o in others)}
    </div>
  </div>
</section>
'''
    build_page(p['file'], main,
               title=f"{esc(p['title'])} — NeoWave",
               description=esc(p['excerpt'][:155]),
               og_title=esc(p['title']), og_image=p['img'], active='news.html',
               css=['assets/css/news.css'], js=['assets/js/article.js'])
    print(p['file'])

# ================= CONTACT =================
SUBJECTS = [('general', 'General inquiry'), ('quote', 'Request a quote'), ('support', 'Technical support'),
            ('partner', 'Partnership'), ('event', 'Events &amp; media'), ('careers', 'Careers')]
chips = '\n'.join(f'            <label><input type="radio" name="topic" value="{v}"{" checked" if i == 0 else ""}><span>{t}</span></label>'
                  for i, (v, t) in enumerate(SUBJECTS))
ADDR = '8 The Green A, Dover, DE 19901, United States'
MAPQ = '8+The+Green+A,+Dover,+DE+19901'
contact_main = f'''<main>
<section class="page-hero contact-hero">
  <svg class="c-waves" id="cWaves" viewBox="0 0 1440 600" preserveAspectRatio="none" aria-hidden="true"></svg>
  <div class="wrap page-hero-content">
    <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><b>Contact</b></nav>
    <span class="eyebrow reveal">Contact us</span>
    <h1 data-split>Let's <em>talk.</em></h1>
    <p class="lede reveal">Thank you for your interest in NeoWave. Tell us what you need, and one of our representatives will contact you shortly to discuss smarter, safer living and working spaces.</p>
    <div class="c-cards">
      <a class="c-card reveal" href="tel:+13025251275">
        <span class="ci"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg></span>
        <small>Talk with us</small><b>+1 (302) 525-1275</b><span class="tile-arrow">{ARROW}</span>
      </a>
      <a class="c-card reveal" href="mailto:info@neowave.tech">
        <span class="ci"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg></span>
        <small>Email us</small><b>info@neowave.tech</b><span class="tile-arrow">{ARROW}</span>
      </a>
      <a class="c-card reveal" href="https://www.google.com/maps/search/?api=1&amp;query={MAPQ}" target="_blank" rel="noopener">
        <span class="ci"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
        <small>Location</small><b>8 The Green A, Dover, DE</b><span class="tile-arrow">{ARROW}</span>
      </a>
    </div>
  </div>
</section>

<section class="section light c-form-sec" id="message">
  <div class="wrap c-grid">
    <div class="c-intro">
      <span class="eyebrow reveal">Send a message</span>
      <h2 class="h2" data-split>How can we<br>help you?</h2>
      <p class="lede reveal">Questions, quotes or a project to scope: pick a topic and tell us a little about it. We look forward to connecting with you.</p>
      <ul class="c-points">
        <li class="reveal"><span>01</span><div><b>Product selection</b><p>Not sure which model fits? Share your application and we'll recommend one.</p></div></li>
        <li class="reveal"><span>02</span><div><b>Quotes &amp; ordering</b><p>Include model codes and quantities for the fastest quote. The <a href="generator.html">product code generator</a> helps.</p></div></li>
        <li class="reveal"><span>03</span><div><b>Technical support</b><p>Mention the model and what you're seeing. Datasheets for every product are on the <a href="products.html">products page</a>.</p></div></li>
      </ul>
    </div>
    <form class="c-form reveal" id="contactForm" novalidate>
      <fieldset class="topics">
        <legend>Topic</legend>
{chips}
      </fieldset>
      <div class="field-row">
        <div class="field"><input id="c-name" name="name" required autocomplete="name" placeholder=" "><label for="c-name">Your name</label></div>
        <div class="field"><input id="c-email" name="email" type="email" required autocomplete="email" placeholder=" "><label for="c-email">Your email</label></div>
      </div>
      <div class="field"><input id="c-company" name="company" autocomplete="organization" placeholder=" "><label for="c-company">Company (optional)</label></div>
      <div class="field"><input id="c-subject" name="subject" placeholder=" "><label for="c-subject">Subject</label></div>
      <div class="field"><textarea id="c-msg" name="message" rows="5" required placeholder=" "></textarea><label for="c-msg">Your message</label></div>
      <button class="btn btn-primary btn-submit" type="submit">Prepare my message {ARROW}</button>
      <p class="form-note" id="contactNote">Opens your email app addressed to info@neowave.tech. Nothing is sent until you hit send.</p>
    </form>
  </div>
</section>

<section class="c-map-sec">
  <div class="wrap">
    <div class="c-map reveal">
      <iframe title="Map of 8 The Green A, Dover, DE" src="https://maps.google.com/maps?q={MAPQ}&amp;z=15&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      <div class="c-map-card">
        <span class="eyebrow">Find us</span>
        <b>NeoWave</b>
        <span>{ADDR}</span>
        <a class="btn btn-primary" href="https://www.google.com/maps/dir/?api=1&amp;destination={MAPQ}" target="_blank" rel="noopener">Get directions {ARROW}</a>
      </div>
    </div>
  </div>
</section>
'''
build_page('contact.html', contact_main,
           title='Contact — NeoWave',
           description='Contact NeoWave: +1 (302) 525-1275, info@neowave.tech, 8 The Green A, Dover, DE 19901. Questions, quotes and technical support.',
           og_title='Contact NeoWave', og_image='assets/img/hero-house.webp', active='contact.html',
           css=['assets/css/contact.css'], js=['assets/js/contact.js'], cta=False)
print('contact.html')
