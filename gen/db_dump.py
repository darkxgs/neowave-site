import os, json, psycopg
from psycopg.rows import dict_row
url = next(l.split('=',1)[1].strip() for l in open(os.path.join(os.path.dirname(__file__), '.env')) if l.startswith('DATABASE_URL='))
with psycopg.connect(url, options='-c default_transaction_read_only=on', row_factory=dict_row) as c:
    cats = c.execute("select category_id, name, types from categories order by category_id").fetchall()
    prods = c.execute("select id, code, type, category, name, description, specifications, photo_url from products order by category, type, code").fetchall()
out = {'categories': cats, 'products': prods}
json.dump(out, open('generator_db.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=str)
print(json.dumps(cats, ensure_ascii=False, indent=1)[:4000])
for p in prods[:3]: print(json.dumps(p, ensure_ascii=False, default=str)[:1500])
print('...', len(prods))
