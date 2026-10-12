# NeoWave site

Hosted on Vercel: **https://neowave-site.vercel.app** · admin at **/admin**

```
site/        static website (Vercel outputDirectory) + site/admin (admin UI)
api/         Vercel functions: admin.js (all admin routes), generator.js (public data)
lib/         server code shared by the functions (db, auth, data logic)
gen/         local build scripts + secrets (.env) — never deployed (.vercelignore)
```

## Deploy

```bash
bash gen/build_all.sh               # rebuild generated pages + cache-bust assets
npx vercel deploy --prod            # upload site/, api/, lib/ to Vercel
```

Pages are served at clean URLs (`/products`, not `/products.html`; Vercel `cleanUrls` + 308 redirects).
Write links as `products.html` in the build scripts — `version_assets.py` rewrites them to `/products` as the last build step.
Animations are always on (`?motion=reduced` turns them off for a visit).

Static pages only change when you rebuild + redeploy. **Generator data does not need a deploy:**
admins edit it at `/admin` and press **Publish to site**.

Test the hosted setup locally (same functions, same headers, restricted DB user):

```bash
node dev-server.mjs                 # http://localhost:5530 and /admin
```

## Product code generator

| Piece | What it is |
| --- | --- |
| Neon Postgres, schema `pcg` | families → product types → features → models → ordered specs → option codes, plus `admin_user`, `audit_log`, `snapshot`, `login_attempt` |
| `/admin` | Sign-in (email + password), edit models/segments/options/photos/features, Team, Activity, change password |
| **Publish to site** | Saves a snapshot of the current data into `pcg.snapshot` |
| `/api/generator` | Serves the latest snapshot to the public generator (edge-cached ~60 s) |
| `site/assets/data/generator.json` | Static fallback if the API is unavailable (`python -I gen/pcg_db.py export`) |

Ordering code = `model.base_code` + `-` + each spec's chosen option `code`, in `spec.position` order.

### Security

- The Vercel functions connect as the Postgres role **`pcg_app`**, which can only use schema `pcg`
  (your other tables are not readable). The owner connection string stays in `gen/.env`.
- Passwords: scrypt hashes. Sessions: signed HttpOnly/Secure/SameSite=Strict cookie (8 h); changing a
  password signs out the user's other sessions. Failed sign-ins are rate-limited (8 per 15 min per IP/email).
- Vercel env vars (Sensitive): `DATABASE_URL` (pcg_app), `SESSION_SECRET`. Photo storage: `NEON_S3_*` (see below).
- `/admin` is sent with a strict Content-Security-Policy, `X-Frame-Options: DENY` and `noindex`.

### Admins

Admins sign in with a **username** (or email).
Change your password by clicking your name in the admin's top bar.
More admins: **Team** tab → Create account (a one-time temporary password is shown).

### Photo uploads

Uploads go to **Neon object storage** (S3-compatible, private bucket `assets`, prefix `products/`).
They are served publicly through `/media/products/<file>` (`api/media.js`, edge-cached for a year),
so the bucket never needs to be public. Vercel env vars: `NEON_S3_ENDPOINT`, `NEON_S3_KEY_ID`,
`NEON_S3_SECRET` (Sensitive), `NEON_S3_REGION`, `NEON_S3_BUCKET`.

### Analytics

Every public page loads Vercel Web Analytics (cookie-free); the admin does not. The pages ship with the classic
`/_vercel/insights/script.js` tag, and the Vercel build step (`scripts/vercel-build.mjs`) rewrites it to this
project's own analytics path from `VERCEL_OBSERVABILITY_CLIENT_CONFIG`. View visitors in Vercel → project
**neowave-site** → Analytics.

## Other build scripts

| Script | Builds |
| --- | --- |
| `build_products.py` | `products.html` from `catalog.json` (scraped website catalog) |
| `build_career.py` | `career.html` |
| `build_pages.py` | `news.html`, the 3 article pages, `contact.html` |
| `build_generator.py` | `generator.html` |
| `version_assets.py` | `?v=<hash>` cache-busting + the admin photo manifest (`assets/data/images.json`) |
| `pcg_db.py seed` | ⚠ recreates the pcg model tables from `pcg_dataset.json` — overwrites admin edits |
| `pcg_auth_setup.py` | one-time: auth tables, `pcg_app` role, first admin, initial snapshot |
