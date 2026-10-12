"""Product Code Generator database (schema `pcg` in the Neon Postgres DB).

  python -I gen/pcg_db.py seed     create/refresh the pcg schema from gen/pcg_dataset.json (one transaction)
  python -I gen/pcg_db.py export   read the DB and write site/assets/data/generator.json for the website

The connection string is read from gen/.env (DATABASE_URL) and never ends up in the site.
The old app's tables in `public` are not touched.
"""
import json
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

GEN = Path(__file__).resolve().parent
SITE = GEN.parent / 'site'
URL = next(l.split('=', 1)[1].strip() for l in (GEN / '.env').read_text().splitlines() if l.startswith('DATABASE_URL='))

DDL = """
create schema if not exists pcg;

create table if not exists pcg.family (
  id    text primary key,
  name  text not null,
  sort  int  not null default 0
);
create table if not exists pcg.product_type (
  id        text primary key,
  family_id text not null references pcg.family(id) on update cascade,
  name      text not null,
  sort      int  not null default 0
);
create table if not exists pcg.feature (            -- filter chips, per product type
  id      text primary key,
  type_id text not null references pcg.product_type(id) on update cascade,
  name    text not null,
  sort    int  not null default 0
);
create table if not exists pcg.model (
  id            serial primary key,
  base_code     text not null unique,                -- e.g. TxTH29, VTRM20-XP
  type_id       text not null references pcg.product_type(id) on update cascade,
  name          text not null,
  description   text not null default '',
  datasheet_url text,
  manual_url    text,
  image_path    text,
  active        boolean not null default true,
  superseded_by text,                                -- base_code of the replacement for legacy models
  source        text not null default 'manual',
  sort          int not null default 0,
  updated_at    timestamptz not null default now()
);
create table if not exists pcg.spec (                -- one code segment, in order
  id        serial primary key,
  model_id  int  not null references pcg.model(id) on delete cascade,
  position  int  not null,
  name      text not null,
  unique (model_id, position)
);
create table if not exists pcg.spec_option (
  id        serial primary key,
  spec_id   int  not null references pcg.spec(id) on delete cascade,
  position  int  not null,
  code      text not null,                           -- the characters that go into the product code
  label     text not null,
  unique (spec_id, code)
);
create table if not exists pcg.model_feature (
  model_id   int  not null references pcg.model(id) on delete cascade,
  feature_id text not null references pcg.feature(id) on delete cascade,
  primary key (model_id, feature_id)
);
"""


def seed():
    data = json.loads((GEN / 'pcg_dataset.json').read_text(encoding='utf-8'))
    with psycopg.connect(URL) as conn, conn.transaction():
        cur = conn.cursor()
        cur.execute(DDL)
        # full refresh of the pcg schema only
        cur.execute('truncate pcg.model_feature, pcg.spec_option, pcg.spec, pcg.model, pcg.feature, pcg.product_type, pcg.family restart identity cascade')
        for f in data['families']:
            cur.execute('insert into pcg.family (id, name, sort) values (%s, %s, %s)', (f['id'], f['name'], f['sort']))
        for t in data['types']:
            cur.execute('insert into pcg.product_type (id, family_id, name, sort) values (%s, %s, %s, %s)',
                        (t['id'], t['family'], t['name'], t['sort']))
        for f in data['features']:
            cur.execute('insert into pcg.feature (id, type_id, name, sort) values (%s, %s, %s, %s)',
                        (f['id'], f['type'], f['name'], f['sort']))
        for i, m in enumerate(data['models']):
            cur.execute("""insert into pcg.model (base_code, type_id, name, description, datasheet_url, manual_url, image_path,
                                                  active, superseded_by, source, sort)
                           values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) returning id""",
                        (m['base'], m['type'], m['name'], m['description'], m['datasheet'], m['manual'], m['image'],
                         m['active'], m.get('superseded_by'), m['source'], i))
            mid = cur.fetchone()[0]
            for si, s in enumerate(m['specs']):
                cur.execute('insert into pcg.spec (model_id, position, name) values (%s, %s, %s) returning id', (mid, si, s['name']))
                sid = cur.fetchone()[0]
                for oi, o in enumerate(s['options']):
                    cur.execute('insert into pcg.spec_option (spec_id, position, code, label) values (%s, %s, %s, %s)',
                                (sid, oi, o['code'], o['label']))
            for fid in m['features']:
                cur.execute('insert into pcg.model_feature (model_id, feature_id) values (%s, %s)', (mid, fid))
        cur.execute('select (select count(*) from pcg.model), (select count(*) from pcg.spec), (select count(*) from pcg.spec_option), (select count(*) from pcg.model_feature)')
        print('seeded  models=%s specs=%s options=%s model_features=%s' % cur.fetchone())


def export():
    with psycopg.connect(URL, options='-c default_transaction_read_only=on', row_factory=dict_row) as conn:
        q = lambda sql: conn.execute(sql).fetchall()
        families = q('select id, name from pcg.family order by sort')
        types = q('select t.id, t.family_id as family, t.name from pcg.product_type t join pcg.family f on f.id = t.family_id order by f.sort, t.sort')
        features = q('select id, type_id as type, name from pcg.feature order by sort')
        models = q("""select m.id, m.base_code as code, m.type_id as type, m.name, m.description, m.datasheet_url as datasheet,
                             m.manual_url as manual, m.image_path as image
                      from pcg.model m where m.active order by m.sort""")
        specs = q('select s.id, s.model_id, s.name from pcg.spec s join pcg.model m on m.id = s.model_id where m.active order by s.model_id, s.position')
        opts = q('select o.spec_id, o.code, o.label from pcg.spec_option o order by o.spec_id, o.position')
        mf = q('select model_id, feature_id from pcg.model_feature')
    by_spec = {}
    for o in opts:
        by_spec.setdefault(o['spec_id'], []).append([o['code'], o['label']])
    by_model = {}
    for s in specs:
        by_model.setdefault(s['model_id'], []).append({'name': s['name'], 'options': by_spec.get(s['id'], [])})
    feats = {}
    for r in mf:
        feats.setdefault(r['model_id'], []).append(r['feature_id'])
    used_types = {m['type'] for m in models}
    out = {
        'families': [f for f in families if any(t['family'] == f['id'] and t['id'] in used_types for t in types)],
        'types': [t for t in types if t['id'] in used_types],
        'features': [f for f in features if any(f['id'] in v for v in feats.values())],
        'models': [{**{k: v for k, v in m.items() if k != 'id' and v not in (None, '')},
                    'specs': by_model.get(m['id'], []), 'features': sorted(feats.get(m['id'], []))} for m in models],
    }
    dest = SITE / 'assets' / 'data' / 'generator.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'exported {len(out["models"])} models -> {dest.relative_to(GEN.parent)} ({dest.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    {'seed': seed, 'export': export}[sys.argv[1]]()
