"""Build site/products.html from gen/catalog.json, reusing the shared chrome of site/index.html.

Re-run after changing the catalog or the homepage nav/footer:  python -I gen/build_products.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
UP = 'https://neowave.tech/wp-content/uploads/'
CAT_URL = 'https://neowave.tech/p-catigory/{}/'

catalog = json.loads((ROOT / 'gen' / 'catalog.json').read_text(encoding='utf-8'))
index = (SITE / 'index.html').read_text(encoding='utf-8')
esc = html.escape

FAMILIES = [
    ('io', 'I/O &amp; Data Transmission', 'I/O &amp; Data',
     'Rugged managed switches and I/O modules that keep data moving across plant floors and building networks.',
     'assets/img/industrial-cabinet.webp', 'center 40%',
     ['industrial-switches', 'i-o-modules']),
    ('sensors', 'Sensors &amp; Switches', 'Sensors',
     'Precision sensing for temperature, humidity, air quality, pressure, level and flow, with field-proven accuracy.',
     'assets/img/banner-sensors.webp', 'center 50%',
     ['temperature-and-humidity', 'air-quality', 'pressure-air-liquid', 'level-measuring', 'flow-sensors-air-liquid']),
    ('hvac', 'HVAC Control', 'HVAC',
     'Smart thermostats and damper actuators for efficient, comfortable heating, ventilation and air conditioning.',
     'assets/img/smart-living.webp', 'center 35%',
     ['smart-thermostat', 'damper-actuators']),
    ('power', 'Power &amp; Energy', 'Power &amp; Energy',
     'Ultrasonic BTU and water meters plus electromagnetic flowmeters for accurate billing and energy optimization.',
     'assets/img/banner-power.webp', 'center 50%',
     ['btu-meters', 'water-meters']),
    ('safety', 'Life Safety', 'Life Safety',
     'Fire alarm systems and LPG / natural gas detection that protect people, property and peace of mind.',
     'assets/img/banner-safety.webp', 'center 50%',
     ['fire-alarm-systems', 'lpg-natural-gas-detectors']),
]

CATS = {
    'industrial-switches': ('Industrial switches', 'Managed and unmanaged Ethernet switches with fanless cooling, wide temperature ranges and ring redundancy.'),
    'i-o-modules': ('I/O modules', 'The interface between sensors, actuators and your control system, with flexible configuration and robust protocols.'),
    'temperature-and-humidity': ('Temperature &amp; humidity', 'Room, duct, outdoor and industrial sensors and controllers for precise climate monitoring.'),
    'air-quality': ('Air quality', 'CO₂, CO, PM2.5/PM10, VOC and multi-gas sensing for healthier indoor and industrial air.'),
    'pressure-air-liquid': ('Pressure (air &amp; liquid)', 'Differential pressure sensors and switches for HVAC, process and liquid applications.'),
    'level-measuring': ('Level measuring', 'Radar, tuning-fork and submersible level measurement for tanks, reservoirs and bulk materials.'),
    'flow-sensors-air-liquid': ('Flow sensors (air &amp; liquid)', 'Flow and float switches for reliable control of liquid flow and levels.'),
    'smart-thermostat': ('Smart thermostats', 'Precise room temperature control with elegant designs for homes and commercial spaces.'),
    'damper-actuators': ('Damper actuators', 'Precision motorized actuators from 5 to 40 Nm, including fail-safe models.'),
    'btu-meters': ('BTU meters', 'Ultrasonic thermal energy meters for heating and cooling systems.'),
    'water-meters': ('Water meters', 'Ultrasonic water meters and electromagnetic flowmeters with IoT connectivity.'),
    'fire-alarm-systems': ('Fire alarm systems', 'Conventional, addressable and wireless fire alarm systems and accessories.'),
    'lpg-natural-gas-detectors': ('LPG &amp; gas detectors', 'Standalone gas detectors and emergency shut-off valves for round-the-clock protection.'),
}

# name on the live site -> (model chip, clean title)
NAMES = {
    '24 port L2+ Managed Industrial Ethernet Switches – NW-ISM-4GX24GT-C': ('NW-ISM-4GX24GT-C', '24-port L2+ managed industrial Ethernet switch'),
    '16 port L2+ Managed Industrial Ethernet Switches – NW-ISM-16TX-C': ('NW-ISM-16TX-C', '16-port L2+ managed industrial Ethernet switch'),
    '5 Ports L2 Managed Industrial Ethernet Switches – NW-ISM-05GT-C': ('NW-ISM-05GT-C', '5-port L2 managed industrial Ethernet switch'),
    '8 Ports L2 Managed Industrial Ethernet Switches – NW-ISM-08GT-C': ('NW-ISM-08GT-C', '8-port L2 managed industrial Ethernet switch'),
    'Industrial 20 Port Gigabit Ethernet Managed Switch – NW-ISM-20G-4F-X4': ('NW-ISM-20G-4F-X4', '20-port Gigabit managed industrial switch'),
    'Industrial 18 Ports Giga Managed Switch – NW-ISM-18G-2F-X4': ('NW-ISM-18G-2F-X4', '18-port Gigabit managed industrial switch'),
    'Industrial 8 Port L2 Gigabit Managed Switch – NW-ISM-08G-X4': ('NW-ISM-08G-X4', '8-port L2 Gigabit managed industrial switch'),
    'Industrial 16 Port Gigabit Managed Switch – NW-ISM-16G-X4': ('NW-ISM-16G-X4', '16-port Gigabit managed industrial switch'),
    'Industrial Ethernet Switches 24 Ports NW-IS- 4GX24TX': ('NW-IS-4GX24TX', '24-port industrial Ethernet switch'),
    'Industrial Ethernet Switches 16 Ports NW-IS- 16TX': ('NW-IS-16TX', '16-port unmanaged industrial Ethernet switch'),
    'Premium Room Humidity and Temperature and Air Quality Sensor/Conrtoller-TC/AQC100-XP': ('TC/AQC100-XP', 'Premium room temperature, humidity &amp; air quality controller'),
    'High-temperature Temperature& Humidity Sensor-TxTHH99': ('TxTHH99', 'High-temperature temperature &amp; humidity sensor'),
    'High Accuracy Temperature & Humidity Sensor-TxTHAC95': ('TxTHAC95', 'High-accuracy temperature &amp; humidity sensor'),
    'Armored Temperature Sensor- TxTA03': ('TxTA03', 'Armored temperature sensor'),
    'Integrated Temperature Sensor-TxTI04': ('TxTI04', 'Integrated temperature sensor'),
    'Magnetic Temperature & Humidity Sensor-TxTHM98': ('TxTHM98', 'Magnetic temperature &amp; humidity sensor'),
    'Indoor Temperature Humidity Controller -CTH27': ('CTH27', 'Indoor temperature &amp; humidity controller'),
    'Outdoor Temperature And Humidity Sensor- TxTHO23': ('TxTHO23', 'Outdoor temperature &amp; humidity sensor'),
    'Temperature & Humidity Sensor – TxTH29': ('TxTH29', 'Industrial temperature &amp; humidity sensor'),
    'Room Humidity and Temperature Sensor-TxTH91-XP': ('TxTH91-XP', 'Room temperature &amp; humidity sensor'),
    'Fixed Gas Concentration Detector-FGD-112': ('FGD-112', 'Fixed gas concentration detector'),
    'Smart Air Quality Controller-AQS117': ('AQS117', 'Smart air quality controller'),
    'Room Dust PM2.5&PM10 Sensor/Controller-TxDI36': ('TxDI36', 'Room PM2.5 &amp; PM10 dust sensor / controller'),
    'Multi-in-one Air Quality Sensor-AQS820': ('AQS820', 'Multi-in-one air quality sensor'),
    'Room Carbon Monoxide Sensor-TxCOI32': ('TxCOI32', 'Room carbon monoxide sensor'),
    'All-In-One Air Quality Sensor – TxAQ37': ('TxAQ37', 'All-in-one air quality sensor'),
    'Carbon Dioxide (CO2) & Temperature (Wall and Duct) Sensor- TxCDT380': ('TxCDT380', 'CO₂ &amp; temperature sensor, wall / duct'),
    'Wall-Mounted Carbon Monoxide (CO) Sensor-TxCOW31': ('TxCOW31', 'Wall-mounted carbon monoxide sensor'),
    'Room Carbon Dioxide Sensor-TxCDI35': ('TxCDI35', 'Room CO₂ sensor'),
    'Duct Carbon Dioxide Sensor-TxCDD34': ('TxCDD34', 'Duct CO₂ sensor'),
    'General Type Pressure Sensor-TxDP-401': ('TxDP-401', 'General-purpose pressure sensor'),
    'FLOAT SWITCH-FS03': ('FS03', 'Float switch'),
    'HVAC Pressure Switch-PS050': ('PS050', 'HVAC pressure switch'),
    'Air Differential Pressure Sensor – TXADP12': ('TxADP12', 'Air differential pressure sensor'),
    'Differential Pressure Switch – DPS52A': ('DPS52A', 'Adjustable differential pressure switch'),
    'Differential Pressure Switch – DPS18': ('DPS18', 'Differential pressure switch'),
    'Differential Pressure Sensor- TxDP405': ('TxDP405', 'Differential pressure sensor'),
    'Low Differental Pressure TxLDP16': ('TxLDP16', 'Low differential pressure sensor'),
    'Tuning fork level switch-TxVF79': ('TxVF79', 'Tuning fork level switch'),
    'Radar Level Sensor – Premium (80GHz)': ('80 GHz', 'Premium radar level sensor'),
    'Standard Radar Level Sensor (26GHz)- TxRLs Series': ('TxRLs', 'Standard radar level sensor'),
    'Submersible Liquid Level Transducer – TxSL20': ('TxSL20', 'Submersible liquid level transducer'),
    'Liquid Temperature and Level 2 in 1 Sensor – TxTL93': ('TxTL93', 'Liquid temperature &amp; level 2-in-1 sensor'),
    'Liquid Flow Switch – LFS22': ('LFS22', 'Liquid flow switch'),
    'VAV (Variable Air Volume) Thermostat-VTRM20-XP': ('VTRM20-XP', 'VAV (variable air volume) thermostat'),
    'Smart Thermostat – TRM Series': ('TRM Series', 'Smart thermostat'),
    'Fail Safe Damper Actuator': ('Fail-safe', 'Fail-safe damper actuator'),
    'Damper Actuator 5Nm – DAM05': ('DAM05', 'Damper actuator · 5 Nm'),
    'Damper Actuator 10Nm-DAM10': ('DAM10', 'Damper actuator · 10 Nm'),
    'Damper Actuator 20Nm-DAM20': ('DAM20', 'Damper actuator · 20 Nm'),
    'Damper Actuator 40Nm-DAM40': ('DAM40', 'Damper actuator · 40 Nm'),
    'BTU Meter DN50-400 – UTM22': ('UTM22 DN50–400', 'Ultrasonic BTU meter'),
    'BTU Meter DN15-40 – UTM22': ('UTM22 DN15–40', 'Ultrasonic BTU meter'),
    'Electromagnetic Flow Meter – EMF 5X Series': ('EMF 5X', 'Electromagnetic flow meter'),
    'Ultrasonic Water Meter – UTW19-DN50-900': ('UTW19 DN50–900', 'Ultrasonic water meter'),
    'Electromagnetic Flow Meter – EMFM3': ('EMFM3', 'Electromagnetic flow meter'),
    'Ultrasonic Water Meter – UTW19-DN15-40': ('UTW19 DN15–40', 'Ultrasonic water meter'),
    'Fire Alarm Systems – Catalog': ('FA2 catalog', 'Fire alarm systems'),
    'GEV 500': ('GEV500', 'Gas emergency shut-off valve'),
    'Natural LPG Gas Detector NGD500': ('NGD500', 'Natural gas &amp; LPG detector'),
    'Natural LPG Gas Detector NGD300': ('NGD300', 'Natural gas &amp; LPG detector'),
}
DESC_FALLBACK = {'VTRM20-XP': 'Room thermostat for variable air volume (VAV) systems, for precise zone temperature control.'}
WIDE = {'FA2 catalog'}
RIGHT = {'io', 'hvac', 'power'}  # banners whose subject sits on the left, so text goes right  # catalog-style products rendered as wide cards

ICON_DL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10"/></svg>'
ICON_ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h12M9 3l5 5-5 5"/></svg>'


def clean_desc(desc, model):
    d = re.sub(r'\s+', ' ', desc).strip()
    # several descriptions on the live site start by repeating the model code
    for lead in (model, model.replace('-', ''), 'FS03 Float Switch', 'NeoWave TxDI36 PM2.5/PM10 Indoor Dust Sensor'):
        if lead and d.lower().startswith(lead.lower() + ' '):
            d = d[len(lead):].strip()
    return d[:1].upper() + d[1:] if d else DESC_FALLBACK.get(model, '')


def doc_links(docs, primary_label='Datasheet'):
    out = []
    for i, d in enumerate(docs):
        label = 'Catalog' if d['label'] in ('Download PDF',) else d['label']
        if label == 'Datasheet' and primary_label != 'Datasheet':
            label = primary_label
        cls = 'doc doc-primary' if i == 0 else 'doc'
        out.append(f'<a class="{cls}" href="{esc(d["url"])}" target="_blank" rel="noopener">{ICON_DL}{esc(label)}</a>')
    return ''.join(out)


def card(item, cat_slug, family):
    model, title = NAMES.get(item['name'], ('', esc(item['name'])))
    desc = clean_desc(item['desc'], model)
    wide = model in WIDE
    search = ' '.join([item['name'], model, html.unescape(title), html.unescape(CATS[cat_slug][0]), desc]).lower()
    img_cls = ' p-img--photo' if wide else ''
    return f'''          <article class="p-card reveal{' p-card--wide' if wide else ''}" data-family="{family}" data-search="{esc(search)}">
            <div class="p-img{img_cls}"><img src="{esc(item['img'])}" alt="{esc(html.unescape(title))} {esc(model)}" loading="lazy"></div>
            <div class="p-body">
              <span class="p-model">{esc(model)}</span>
              <h4>{title}</h4>
              <p>{esc(desc)}</p>
              <div class="p-docs">{doc_links(item['docs'], 'Catalog' if wide else 'Datasheet')}</div>
            </div>
          </article>'''


def io_catalog_card(pdf):
    search = 'i/o modules io module n-series catalog modbus bc220 data acquisition'
    return f'''          <article class="p-card reveal p-card--wide" data-family="io" data-search="{search}">
            <div class="p-img"><img src="assets/img/io-module.png" alt="NeoWave N-Series I/O module" loading="lazy"></div>
            <div class="p-body">
              <span class="p-model">N-Series</span>
              <h4>I/O modules catalog</h4>
              <p>Versatile I/O modules that connect sensors, actuators and the central control system, with flexible configuration options and robust communication protocols for efficient data acquisition and precise control.</p>
              <div class="p-docs"><a class="doc doc-primary" href="{esc(pdf)}" target="_blank" rel="noopener">{ICON_DL}Catalog PDF</a></div>
            </div>
          </article>'''


# ---------- build sections ----------
counts, total = {}, 0
fam_html, index_cards = [], []
n_docs = 0
ci = 0
for fi, (fid, fname, fshort, fdesc, fimg, fpos, cats) in enumerate(FAMILIES, 1):
    groups, fcount = [], 0
    for slug in cats:
        cname, cdesc = CATS[slug]
        data = catalog[slug]
        if data['items']:
            cards = [card(it, slug, fid) for it in data['items']]
            n = len(data['items'])
            n_docs += sum(len(it['docs']) for it in data['items'])
            thumb = data['items'][0]['img']
        else:
            cards = [io_catalog_card(data['pdfs'][0])]
            n = 1
            n_docs += 1
            thumb = 'assets/img/io-module.png'
        fcount += n
        ci += 1
        unit = 'model' if n == 1 else 'models'
        if slug in ('i-o-modules', 'fire-alarm-systems'):
            unit_label = 'Catalog'
        else:
            unit_label = f'{n} {unit}'
        index_cards.append(f'''    <a class="ci-card" href="#cat-{slug}" data-family="{fid}">
      <div class="ci-img"><img src="{esc(thumb)}" alt="" loading="lazy"></div>
      <small>{ci:02d} · {fshort}</small><b>{cname}</b><span>{unit_label}</span>
    </a>''')
        groups.append(f'''      <div class="cat-group" id="cat-{slug}" data-family="{fid}">
        <div class="cat-head reveal">
          <div><h3>{cname}</h3><span class="cat-count">{unit_label.upper()}</span></div>
          <p>{cdesc}</p>
          <a class="link" href="{CAT_URL.format(slug)}">Category page {ICON_ARROW}</a>
        </div>
        <div class="p-grid">
{chr(10).join(cards)}
        </div>
      </div>''')
    counts[fid] = fcount
    total += fcount
    chips = ''.join(f'<a href="#cat-{s}">{CATS[s][0]}</a>' for s in cats)
    fam_html.append(f'''    <section class="fam" id="fam-{fid}" data-family="{fid}">
      <div class="fam-banner{' fam-banner--right' if fid in RIGHT else ''}">
        <img src="{fimg}" alt="" style="object-position:{fpos}" loading="lazy">
        <div class="fam-txt">
          <span class="fam-num">{fi:02d} / {fshort.upper()} · {fcount} PRODUCTS</span>
          <h2 class="h2" data-split>{fname}</h2>
          <p>{fdesc}</p>
          <div class="fam-chips">{chips}</div>
        </div>
      </div>
{chr(10).join(groups)}
    </section>''')

devices = len({NAMES[i['name']][0] for v in catalog.values() for i in v['items']} - WIDE)

pills = [f'<button class="pill active" data-filter="all" data-magnetic>All <i>{total}</i></button>']
for fid, fname, fshort, *_ in FAMILIES:
    pills.append(f'<button class="pill" data-filter="{fid}" data-magnetic>{fshort} <i>{counts[fid]}</i></button>')

main = f'''<main>
<!-- ============ PAGE HERO ============ -->
<section class="page-hero">
  <div class="page-hero-media"><img src="assets/img/catalog-hero.webp" alt="NeoWave device lineup: industrial switch, smart thermostat, room sensor, flow meter, damper actuator and air quality controller"></div>
  <div class="wrap page-hero-content">
    <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><b>Products</b></nav>
    <span class="eyebrow reveal">Product catalog</span>
    <h1 data-split>Every device.<br>One <em>ecosystem.</em></h1>
    <p class="lede reveal">From a single room sensor to plant-wide networks: {devices} field-proven devices across five product families, each with its datasheet one click away.</p>
    <div class="ph-stats reveal">
      <div><b><span data-count="{devices}">{devices}</span></b><span>Devices</span></div>
      <div><b><span data-count="13">13</span></b><span>Categories</span></div>
      <div><b><span data-count="5">5</span></b><span>Product families</span></div>
      <div><b><span data-count="{n_docs}">{n_docs}</span></b><span>Datasheets &amp; manuals</span></div>
    </div>
  </div>
</section>

<!-- ============ CATEGORY INDEX ============ -->
<section class="cat-index" aria-label="Browse by category">
  <div class="wrap ci-head">
    <span class="eyebrow">Browse by category</span>
    <span class="ci-hint">Drag or scroll <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h12M9 3l5 5-5 5"/></svg></span>
  </div>
  <div class="ci-track" id="ciTrack">
{chr(10).join(index_cards)}
  </div>
</section>

<!-- ============ CATALOG ============ -->
<section class="catalog light" id="catalog">
  <div class="toolbar-wrap">
    <div class="wrap toolbar">
      <div class="pills" role="tablist" aria-label="Filter by product family">
        <span class="pill-ind" aria-hidden="true"></span>
        {''.join(pills)}
      </div>
      <label class="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="q" placeholder="Search model or name, e.g. TxTH91" autocomplete="off" aria-label="Search products">
        <kbd>/</kbd>
      </label>
    </div>
  </div>
  <div class="wrap catalog-body" id="catalogBody">
    <p class="result-line"><span id="resultCount">{total}</span> <span id="resultLabel">results</span></p>
{chr(10).join(fam_html)}
    <div class="empty" id="empty">
      <b>No products match “<span id="emptyQ"></span>”</b>
      <p>Try a model code like <em>DAM20</em> or a word like <em>pressure</em>.</p>
      <button class="btn btn-dark" id="clearSearch" type="button">Clear search</button>
    </div>
  </div>
</section>

<!-- ============ HELP ============ -->
<section class="help">
  <div class="grid-bg"></div>
  <div class="wrap help-grid">
    <div>
      <span class="eyebrow reveal">Need a hand?</span>
      <h2 class="h2" data-split>Can't find the<br>right model?</h2>
      <p class="lede reveal">Tell us about your application and our engineers will help you select, size and integrate the right devices.</p>
    </div>
    <div class="help-cards">
      <a class="help-card reveal" href="generator.html">
        <span class="hc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h7"/><circle cx="18" cy="16" r="3"/></svg></span>
        <span class="hc-txt"><b>Product code generator</b><span>Build the exact ordering code for your configuration.</span></span>
        <span class="tile-arrow">{ICON_ARROW}</span>
      </a>
      <a class="help-card reveal" href="https://neowave.tech/contact-us/">
        <span class="hc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        <span class="hc-txt"><b>Talk to an engineer</b><span>Selection, sizing and BMS integration support.</span></span>
        <span class="tile-arrow">{ICON_ARROW}</span>
      </a>
      <a class="help-card reveal" href="#catalog">
        <span class="hc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg></span>
        <span class="hc-txt"><b>{n_docs} datasheets &amp; manuals</b><span>Every product links straight to its PDF.</span></span>
        <span class="tile-arrow">{ICON_ARROW}</span>
      </a>
    </div>
  </div>
</section>
'''

# ---------- assemble from the homepage chrome ----------
head_end = index.index('</head>')
head = index[:head_end]
head = re.sub(r'<title>.*?</title>', '<title>Products — NeoWave Smart Building &amp; Industrial Automation Catalog</title>', head)
head = re.sub(r'<meta name="description" content="[^"]*">',
              f'<meta name="description" content="Browse {devices} NeoWave devices: industrial switches, I/O modules, temperature, humidity, air quality, pressure, level and flow sensors, thermostats, damper actuators, BTU and water meters, fire alarm and gas detection. Datasheets for every model.">', head)
head = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="NeoWave Product Catalog">', head)
head = re.sub(r'<meta property="og:image" content="[^"]*">', '<meta property="og:image" content="assets/img/catalog-hero.webp">', head)
head, n_css = re.subn(r'(<link rel="stylesheet" href="assets/css/main\.css[^"]*">)',
                     lambda m: m.group(1) + '\n<link rel="stylesheet" href="assets/css/products.css">', head)

body_start = index[head_end:index.index('<main>')]
body_start = re.sub(r'<a href="(index\.html|/)" class="active">Home</a>', r'<a href="\1">Home</a>', body_start)
body_start = re.sub(r'<a href="((?:/)?products(?:\.html)?)">Products', r'<a href="\1" class="active">Products', body_start, count=1)

cta = index[index.index('<!-- ============ CTA ============ -->'):index.index('</main>')]
tail = index[index.index('</main>'):]
tail, n_js = re.subn(r'(<script defer src="assets/js/main\.js[^"]*"></script>)',
                     lambda m: m.group(1) + '\n<script defer src="assets/js/products.js"></script>', tail)
# fail loudly instead of silently shipping a page without its own styles/scripts
assert n_css == 1 and n_js == 1, f'could not attach products.css/js (css={n_css}, js={n_js})'

out = head + body_start + main + cta + tail
(SITE / 'products.html').write_text(out, encoding='utf-8')
print('products.html written:', devices, 'devices,', total, 'products,', n_docs, 'docs,', counts)
