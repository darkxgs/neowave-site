"""One-time setup for the hosted admin (safe to re-run).

  python -I gen/pcg_auth_setup.py --admin-email you@example.com

Creates in the Neon DB (schema pcg):
  admin_user, login_attempt, snapshot tables, audit_log.actor column
  role `pcg_app`: can only read/write schema pcg (used by the Vercel functions)
  the first admin user + an initial published snapshot
Writes the generated secrets to gen/.env (never to the site).
"""
import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg

GEN = Path(__file__).resolve().parent
ENV_PATH = GEN / '.env'
sys.path.insert(0, str(GEN))


def env():
    out = {}
    for line in ENV_PATH.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip()
    return out


def set_env(key, value):
    lines = [l for l in ENV_PATH.read_text().splitlines() if not l.startswith(key + '=')]
    lines.append(f'{key}={value}')
    ENV_PATH.write_text('\n'.join(lines) + '\n')


def scrypt_hash(pw):
    # must match lib/auth.js: scrypt$N$r$p$salt$hash (base64url)
    salt = os.urandom(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
    b = lambda x: base64.urlsafe_b64encode(x).decode().rstrip('=')
    return f'scrypt$16384$8$1${b(salt)}${b(h)}'


DDL = """
create table if not exists pcg.admin_user (
  id              serial primary key,
  email           text not null unique,
  name            text not null default '',
  password_hash   text not null,
  session_version int  not null default 1,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);
create table if not exists pcg.login_attempt (
  id    bigserial primary key,
  at    timestamptz not null default now(),
  ip    text,
  email text,
  ok    boolean not null
);
create index if not exists login_attempt_at on pcg.login_attempt (at);
create table if not exists pcg.snapshot (
  id         serial primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  created_by text
);
create table if not exists pcg.audit_log (
  id serial primary key, at timestamptz not null default now(),
  action text not null, base_code text, detail text not null default '');
alter table pcg.audit_log add column if not exists actor text;
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--admin-email', required=True)
    ap.add_argument('--admin-name', default='')
    a = ap.parse_args()
    e = env()
    owner_url = e['DATABASE_URL']

    with psycopg.connect(owner_url) as c, c.transaction():
        c.execute(DDL)

        # restricted application role
        app_pw = e.get('PCG_APP_PASSWORD') or secrets.token_urlsafe(24)
        exists = c.execute("select 1 from pg_roles where rolname = 'pcg_app'").fetchone()
        c.execute(f"{'alter' if exists else 'create'} role pcg_app with login password %s".replace('%s', "'" + app_pw.replace("'", "''") + "'"))
        c.execute('grant usage on schema pcg to pcg_app')
        c.execute('grant select, insert, update, delete on all tables in schema pcg to pcg_app')
        c.execute('grant usage, select on all sequences in schema pcg to pcg_app')
        c.execute('alter default privileges in schema pcg grant select, insert, update, delete on tables to pcg_app')
        c.execute('alter default privileges in schema pcg grant usage, select on sequences to pcg_app')
        dbname = c.execute('select current_database()').fetchone()[0]
        c.execute(f'grant connect on database {dbname} to pcg_app')

        # first admin
        email = a.admin_email.strip().lower()
        admin_pw = None
        if not c.execute('select 1 from pcg.admin_user where email = %s', (email,)).fetchone():
            admin_pw = secrets.token_urlsafe(12)
            c.execute('insert into pcg.admin_user (email, name, password_hash) values (%s, %s, %s)',
                      (email, a.admin_name, scrypt_hash(admin_pw)))

    # app connection string: same host/db, pcg_app credentials, no channel_binding (unsupported by node-postgres)
    u = urlsplit(owner_url)
    host = u.hostname + (f':{u.port}' if u.port else '')
    app_url = urlunsplit((u.scheme, f'pcg_app:{app_pw}@{host}', u.path, 'sslmode=require', ''))
    set_env('PCG_APP_PASSWORD', app_pw)
    set_env('PCG_APP_DATABASE_URL', app_url)
    if not e.get('SESSION_SECRET'):
        set_env('SESSION_SECRET', secrets.token_urlsafe(48))
    if admin_pw:
        set_env('ADMIN_INITIAL_EMAIL', email)
        set_env('ADMIN_INITIAL_PASSWORD', admin_pw)

    # verify the restricted role really is restricted, and publish an initial snapshot
    with psycopg.connect(app_url) as c:
        n = c.execute('select count(*) from pcg.model').fetchone()[0]
        try:
            c.execute('select count(*) from public.products')
            print('WARNING: pcg_app can read public.products')
        except psycopg.errors.InsufficientPrivilege:
            print('pcg_app is restricted to schema pcg (public tables not readable)')
    import pcg_db
    pcg_db.export()  # refresh static fallback JSON
    data = (GEN.parent / 'site' / 'assets' / 'data' / 'generator.json').read_text(encoding='utf-8')
    with psycopg.connect(owner_url) as c, c.transaction():
        if not c.execute('select 1 from pcg.snapshot').fetchone():
            c.execute('insert into pcg.snapshot (data, created_by) values (%s::jsonb, %s)', (data, 'setup'))
            print('initial snapshot published')
    print(f'pcg_app sees {n} models. Admin user: {email}' + (' (new — password saved to gen/.env as ADMIN_INITIAL_PASSWORD)' if admin_pw else ' (already existed)'))


if __name__ == '__main__':
    main()
