"""Merge the old generator's data sources into one clean dataset: gen/pcg_dataset.json

Sources
  - gen/live_api/*.json        live generator API (KV store): newest models, ordered specs   <- primary
  - hard-coded models below    transcribed from neowave-main/lib/data.ts (pressure, level, flow, thermostat)
  - gen/catalog.json           website catalog: datasheets + product photos

Run:  python -I gen/pcg_build_dataset.py
"""
import json
import re
from pathlib import Path

GEN = Path(__file__).resolve().parent
live_products = json.loads((GEN / 'live_api' / 'products.json').read_text(encoding='utf-8'))
live_cats = json.loads((GEN / 'live_api' / 'categories.json').read_text(encoding='utf-8'))
catalog = json.loads((GEN / 'catalog.json').read_text(encoding='utf-8'))

# ---------------------------------------------------------------- taxonomy
FAMILY_NAMES = {
    'io-modules': 'I/O & Data Transmission', 'sensors-switches': 'Sensors & Switches',
    'hvac-control': 'HVAC Control', 'power-energy': 'Power & Energy', 'life-safety': 'Life Safety',
}
FAMILY_ORDER = ['sensors-switches', 'hvac-control', 'io-modules', 'power-energy', 'life-safety']
TYPE_NAMES = {'temp-humid': 'Temperature & humidity', 'air-quality': 'Air quality', 'pressure': 'Pressure (air & liquid)',
              'level': 'Level measuring', 'flow': 'Flow (air & liquid)', 'smart-thermostat': 'Smart thermostats'}

FEATURES = {  # id: (type, name)   -- cleaned replacement for the old KV + hard-coded filters
    'th-indoor': ('temp-humid', 'Indoor'), 'th-outdoor': ('temp-humid', 'Outdoor'),
    'th-wall': ('temp-humid', 'Wall-mounted'), 'th-duct': ('temp-humid', 'Duct-mounted'),
    'th-water': ('temp-humid', 'Water / liquid'), 'th-temp-rh': ('temp-humid', 'Temperature & humidity'),
    'th-temp-only': ('temp-humid', 'Temperature only'),
    'aq-indoor': ('air-quality', 'Indoor'), 'aq-wall': ('air-quality', 'Wall-mounted'),
    'aq-duct': ('air-quality', 'Duct-mounted'), 'aq-co2': ('air-quality', 'CO₂'), 'aq-co': ('air-quality', 'CO'),
    'aq-dust': ('air-quality', 'Dust (PM2.5 / PM10)'), 'aq-multi': ('air-quality', 'Multi-parameter'),
    'pr-switch': ('pressure', 'Switches'), 'pr-sensor': ('pressure', 'Sensors / transmitters'),
    'pr-air': ('pressure', 'Air'), 'pr-liquid': ('pressure', 'Liquid'),
}
OLD_FILTER_TO_FEATURE = {  # old ids (several duplicates/stale ones) -> new feature id
    'temp-humid-indoor': 'th-indoor', 'temp-humid-outdoor': 'th-outdoor', 'temp-humid-duct': 'th-duct',
    'temp-humid-wall-mounted-1754035693612': 'th-wall', 'temp-humid-water': 'th-water',
    'temp-humid-temperature-&-humidity': 'th-temp-rh', 'temp-humid-temperature-only': 'th-temp-only',
    'air-quality-indoor': 'aq-indoor', 'air-quality-wall-mounted': 'aq-wall', 'air-quality-wall': 'aq-wall',
    'air-quality-duct-mounted': 'aq-duct', 'air-quality-duct': 'aq-duct', 'air-quality-co2': 'aq-co2',
    'air-quality-co': 'aq-co', 'air-quality-dust-1754225814812': 'aq-dust',
    'air-quality-all-quality-sensor-1754238848177': 'aq-multi',
}

# ---------------------------------------------------------------- text cleanup
FIXES = [(r'Dispaly', 'Display'), (r'customerized', 'customized'), (r'\(\s+', '('), (r'\s+\)', ')'),
         (r'RS485Modbus', 'RS485/Modbus'), (r'0~~', '0~'), (r'，', ', '), (r'\s{2,}', ' '), (r'Tranducer', 'Transducer')]


def clean(s):
    s = (s or '').strip()
    for a, b in FIXES:
        s = re.sub(a, b, s)
    s = s.strip()
    if s.count('(') > s.count(')'):
        s += ')'
    return s


def opt(code, label):
    label = clean(label)
    # drop redundant "X = " / "X=" prefixes that repeat the code inside the label
    label = re.sub(rf'^{re.escape(code)}\s*=\s*', '', label)
    return {'code': code, 'label': label}


# ---------------------------------------------------------------- hard-coded models (from lib/data.ts)
P_OUT = {'AV': '4-20mA / 0-10VDC (simultaneous output)', 'A': '4-20mA (two-wire)', 'V10': '0-10VDC (three-wire)',
         'V5': '0-5VDC (three-wire)', 'RS': 'RS-485 communication', 'RSW': 'RS-485 communication (isolated)',
         'RsV10': 'RS485 + 0-10VDC', 'RsV5': 'RS485 + 0-5VDC', 'RsA': 'RS485 + 4-20mA'}
CABLE = [('1', '1 m'), ('2', '2 m'), ('3', '3 m')]
HARD = [
    dict(base='TXADP12', type='pressure', name='Air Differential Pressure Sensor', features=['pr-sensor', 'pr-air'], specs=[
        ('Pressure range', [('2', '-100 ~ 100 Pa'), ('4', '-1000 ~ 1000 Pa'), ('6', '-10000 ~ 10000 Pa')]),
        ('Display', [('1', 'Without display'), ('2', 'With display')]),
        ('Output', [(c, P_OUT[c]) for c in ['AV', 'A', 'V10', 'V5', 'RS', 'RSW']])]),
    dict(base='DPS52', type='pressure', name='Adjustable Differential Pressure Switch', features=['pr-switch', 'pr-liquid', 'pr-air'], specs=[
        ('Connector material', [('1', 'Brass'), ('2', 'SS 316L')]),
        ('Connector thread', [('1', '7/16" UNF female'), ('2', '7/16" UNF male'), ('3', 'R1/4" male'), ('4', 'G1/4" male'),
                              ('5', '1/4" NPT male'), ('6', 'Connects φ8 soft tube'), ('7', 'Connects φ6 steel pipe')]),
        ('Wiring', [('1', 'Plastic gland PG16'), ('2', 'Brass nickel-plated gland PG16')])]),
    dict(base='DPS18', type='pressure', name='Differential Pressure Switch', features=['pr-switch', 'pr-air'], specs=[
        ('Pressure range', [('01', '20-200 Pa'), ('02', '30-300 Pa'), ('03', '40-400 Pa'), ('04', '50-500 Pa'),
                            ('05', '200-1000 Pa'), ('06', '100-1000 Pa'), ('07', '500-2500 Pa'), ('08', '1000-5000 Pa')])]),
    dict(base='TxDP35', type='pressure', name='Differential Pressure Transmitter', features=['pr-sensor', 'pr-air'], specs=[
        ('Output', [('A', '4-20mA'), ('V10', '0-10VDC'), ('RS', 'RS485')]),
        ('Unit', [('K', 'kPa'), ('P', 'psi'), ('B', 'bar'), ('M', 'MPa')]),
        ('Accuracy', [('0.25', '0.25% F.S.'), ('0.5', '0.5% F.S.')]),
        ('Electrical connection', [('D', 'DIN43650A (big Hirschmann)'), ('M', 'M12 waterproof outlet'),
                                   ('C3', 'GX12 three-core aviation connector'), ('C4', 'GX12 four-core aviation connector'),
                                   ('H', 'M12 four-core aviation connector')]),
        ('Pressure connection', [('G', 'G1/4'), ('N', 'NPT1/4'), ('G2', 'G1/2'), ('M20', 'M20×1.5'), ('M14', 'M14×1.5'),
                                 ('M10', 'M10×1'), ('U', '7/16-20UNF external thread'), ('R', 'R1/4')]),
        ('Cable length', CABLE)]),
    dict(base='TxLDP16', type='pressure', name='Low Differential Pressure Sensor', features=['pr-sensor', 'pr-air'], specs=[
        ('Pressure range', [('101D', '0 ±100 Pa (two-way)'), ('101G', '0-100 Pa (one-way)'), ('102D', '0 ±1000 Pa'),
                            ('102G', '0-1000 Pa'), ('251D', '0 ±250 Pa'), ('251G', '0-250 Pa'), ('252D', '0 ±2500 Pa'),
                            ('252G', '0-2500 Pa'), ('051D', '0 ±50 Pa'), ('051G', '0-50 Pa'), ('501D', '0 ±500 Pa'),
                            ('501G', '0-500 Pa'), ('502D', '0 ±5000 Pa'), ('502G', '0-5000 Pa'), ('103D', '0 ±10000 Pa')]),
        ('Output', [(c, P_OUT[c]) for c in ['A', 'V10', 'V5', 'RS', 'RsV10', 'RsV5', 'RsA']])]),
    dict(base='TxSL20', type='level', name='Submersible Liquid Level Transducer', features=[], specs=[
        ('Output', [('A', '4-20mA (two-wire)'), ('V0', '0.5-4.5V (three-wire)'), ('V5', '0-5V (three-wire)'),
                    ('V10', '0-10V (three-wire)'), ('RS', 'RS485')]),
        ('Unit', [('M', 'Meter'), ('CM', 'Centimeter')]),
        ('Accuracy', [('0.5', '0.5% F.S.')]),
        ('Electrical connection', [('M', 'Direct outlet')]),
        ('Display', [('1', 'Without display'), ('2', 'Explosion-proof digital display')]),
        ('Cable length', CABLE[:2])]),
    dict(base='LFS22', type='flow', name='Liquid Flow Switch', features=[], specs=[
        ('Connection size', [('1', '1" NPT'), ('2', '1/2" NPT'), ('3', '3/4" NPT')]),
        ('Material', [('1', 'Brass (water and liquids suitable for brass)'),
                      ('2', 'Stainless steel (ammonia and liquids suitable for stainless steel)')])]),
    dict(base='VTRM20-XP', type='smart-thermostat', name='VAV (Variable Air Volume) Thermostat', features=[], specs=[
        ('Communication', [('1', 'Modbus RS485'), ('2', 'BACnet MS/TP')]),
        ('Interface', [('1', 'No interface'), ('2', 'Colour capacitive touchscreen'), ('3', 'Bluetooth app interface'),
                       ('4', 'Touchscreen and Bluetooth'), ('5', 'LoRaWAN wireless, EU868 MHz'),
                       ('6', 'LoRaWAN wireless EU868 MHz with touchscreen')]),
        ('Measurement', [('1', 'No extra measurements'), ('2', 'Relative humidity'), ('3', 'VOC and humidity'),
                         ('4', 'PIR movement'), ('5', 'Relative humidity and PIR movement'),
                         ('6', 'VOC, relative humidity and PIR movement')]),
        ('Output', [('1', 'No output'), ('2', '24V relay output')]),
        ('Colour', [('B', 'Black'), ('W', 'White')])]),
]
# old hard-coded models superseded by newer ones in the live data: kept in the DB, inactive
LEGACY = {'TxTH52': 'TxTHO23', 'TxTH28N': 'TxTH29', 'TxTHP': 'TxTHP96', 'TxTH28': 'TxTHI28', 'TxSL22': 'TxTL93'}
# AQS820 has no specs in the live data; the hard-coded output options are the only ones we have
AQS820_SPECS = [('Output', [('V5', '0-5V'), ('V10', '0-10V'), ('A', '4-20mA'), ('RS', 'RS485/Modbus')])]

# legacy datasheet links from the old app, used only when the website catalog has none
OLD_DATASHEETS = {
    'TxT02': 'https://neowave.tech/wp-content/uploads/2024/02/TxT02.pdf',
    'TxCDW33': 'https://neowave.tech/wp-content/uploads/2024/02/Wall-Mounted-CO2-Monitor-Transmitter.pdf',
    'TxDP35': 'https://neowave.tech/wp-content/uploads/2024/02/TxDP35.pdf',
}

# ---------------------------------------------------------------- catalog lookup (datasheet + photo)
cat_items = []
for slug, v in catalog.items():
    for it in v['items']:
        cat_items.append(it)


def catalog_match(base):
    key = re.sub(r'[^a-z0-9]', '', base.lower())
    for it in cat_items:
        name = re.sub(r'[^a-z0-9]', '', it['name'].lower())
        if key in name or (key.rstrip('xp') and key.rstrip('xp') + 'xp' in name):
            return it
    # DPS52 is listed on the website as DPS52A
    for it in cat_items:
        name = re.sub(r'[^a-z0-9]', '', it['name'].lower())
        if re.search(rf'{key}[a-z](?![a-z0-9])', name) or name.endswith(key + 'a'):
            return it
    return None


# ---------------------------------------------------------------- build
models, problems = [], []

for p in live_products:
    specs_in = p.get('specifications') or []
    code = p['code'].strip()
    segs = code.split('-')
    n = len(specs_in)
    base = '-'.join(segs[:len(segs) - n]) if n else re.sub(r'[-.]+$', '', code)
    if base == 'AQS820':
        specs = [{'name': nm, 'options': [opt(c, l) for c, l in os_]} for nm, os_ in AQS820_SPECS]
    else:
        specs = [{'name': clean(s['name']), 'options': [opt(str(o['code']).strip(), o.get('label', '')) for o in s['options']]}
                 for s in specs_in]
    # sanity check: the stored example code should be built from valid option codes
    example = segs[len(segs) - n:] if n else []
    for s, seg in zip(specs, example):
        if seg not in [o['code'] for o in s['options']]:
            problems.append(f'{base}: example segment {seg!r} not an option of {s["name"]!r}')
    name = clean(re.sub(rf'^{re.escape(base)}\s*[-–]?\s*', '', p.get('name') or '')) or base
    feats = sorted({OLD_FILTER_TO_FEATURE[f] for f in (p.get('filters') or []) if f in OLD_FILTER_TO_FEATURE})
    if base == 'TxAQ37':
        feats = sorted(set(feats) | {'aq-multi'})
    models.append(dict(base=base, type=p['type'], name=name, description=clean(p.get('description') or ''),
                       features=feats, specs=specs, active=True, source='live-api'))

for h in HARD:
    models.append(dict(base=h['base'], type=h['type'], name=h['name'], description='', features=h['features'],
                       specs=[{'name': nm, 'options': [opt(c, l) for c, l in os_]} for nm, os_ in h['specs']],
                       active=True, source='hard-coded'))

for old, new in LEGACY.items():
    models.append(dict(base=old, type='level' if old == 'TxSL22' else 'temp-humid', name=f'Legacy model (superseded by {new})',
                       description='', features=[], specs=[], active=False, source='legacy', superseded_by=new))

# datasheets + photos
for m in models:
    it = catalog_match(m['base']) if m['active'] else None
    m['datasheet'] = next((d['url'] for d in it['docs'] if d['label'] == 'Datasheet'), None) if it else None
    m['manual'] = next((d['url'] for d in it['docs'] if d['label'] == 'Manual'), None) if it else None
    m['image'] = it['img'] if it else None
    m['catalog_desc'] = it['desc'] if it else ''
    if not m['datasheet'] and m['base'] in OLD_DATASHEETS:
        m['datasheet'] = OLD_DATASHEETS[m['base']]
    if not m['description'] and m['catalog_desc']:
        m['description'] = m['catalog_desc']
    del m['catalog_desc']

# taxonomy actually used
type_family = {t['id']: c['id'] for c in live_cats for t in c['types']}
families = [{'id': f, 'name': FAMILY_NAMES[f], 'sort': i} for i, f in enumerate(FAMILY_ORDER)]
types = []
for c in live_cats:
    for i, t in enumerate(c['types']):
        types.append({'id': t['id'], 'family': c['id'], 'name': TYPE_NAMES.get(t['id'], clean(t['name'])), 'sort': i})
features = [{'id': k, 'type': v[0], 'name': v[1], 'sort': i} for i, (k, v) in enumerate(FEATURES.items())]

bases = [m['base'] for m in models]
dupes = {b for b in bases if bases.count(b) > 1}
assert not dupes, f'duplicate base codes: {dupes}'
assert all(m['type'] in type_family for m in models), 'unknown type'

out = {'families': families, 'types': types, 'features': features, 'models': models}
(GEN / 'pcg_dataset.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')

act = [m for m in models if m['active']]
print(f'{len(act)} active models, {len(models) - len(act)} legacy, {sum(len(m["specs"]) for m in act)} spec groups, '
      f'{sum(len(s["options"]) for m in act for s in m["specs"])} options')
print('no datasheet:', [m['base'] for m in act if not m['datasheet']])
print('no photo:', [m['base'] for m in act if not m['image']])
print('no specs (fixed code):', [m['base'] for m in act if not m['specs']])
print('problems:', problems or 'none')
for m in act:
    print(f"  {m['type']:<17}{m['base']:<12}{len(m['specs'])} specs  {m['name'][:52]}")
