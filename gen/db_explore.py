import os, sys, psycopg
url = next(l.split('=',1)[1].strip() for l in open(os.path.join(os.path.dirname(__file__), '.env')) if l.startswith('DATABASE_URL='))
with psycopg.connect(url, options='-c default_transaction_read_only=on') as c:
    cur = c.cursor()
    cur.execute("""select table_schema, table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int
                   from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema') order by 1,2""")
    for r in cur.fetchall(): print('TABLE', r)
    cur.execute("""select table_schema, table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
                   where table_schema not in ('pg_catalog','information_schema') order by table_schema, table_name, ordinal_position""")
    for r in cur.fetchall(): print('  COL', r)
    cur.execute("""select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where contype in ('f','p','u') and connamespace not in ('pg_catalog'::regnamespace,'information_schema'::regnamespace)""")
    for r in cur.fetchall(): print('  CON', r)
