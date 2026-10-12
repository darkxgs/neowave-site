import crypto from 'node:crypto';
import { query, one, tx } from './db.js';
import { HttpError } from './http.js';
import { hashPassword, verifyPassword, validateNewPassword } from './auth.js';

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9.\-/]*$/;
const OPT_RE = /^[A-Za-z0-9.+/]+$/;
const str = v => (v == null ? '' : String(v)).trim();
const orNull = v => str(v) || null;

/* ================= read ================= */
export async function bootstrap() {
  const [families, types, features, models, snap, lastChange] = await Promise.all([
    query('select id, name from pcg.family order by sort'),
    query('select t.id, t.family_id, t.name from pcg.product_type t join pcg.family f on f.id = t.family_id order by f.sort, t.sort'),
    query(`select f.id, f.type_id, f.name, (select count(*)::int from pcg.model_feature mf where mf.feature_id = f.id) as uses
           from pcg.feature f order by f.sort, f.name`),
    query(`select m.id, m.base_code, m.type_id, m.name, m.active, m.image_path, m.superseded_by, m.updated_at,
                  m.datasheet_url is not null as has_datasheet,
                  (select count(*)::int from pcg.spec s where s.model_id = m.id) as spec_count
           from pcg.model m order by m.active desc, m.sort, m.base_code`),
    one('select id, created_at, created_by from pcg.snapshot order by id desc limit 1'),
    one(`select max(at) as at from pcg.audit_log where action not like 'publish%' and action not like 'user%' and action <> 'password'`),
  ]);
  const published = snap?.created_at, changed = lastChange?.at;
  return { families, types, features, models,
           publish: { last: snap, unpublished: !!changed && (!published || new Date(changed) > new Date(published)) } };
}

export async function getModel(id) {
  const m = await one('select * from pcg.model where id = $1', [id]);
  if (!m) throw new HttpError(404, 'Model not found');
  const specs = await query('select id, name from pcg.spec where model_id = $1 order by position', [id]);
  const opts = specs.length
    ? await query('select spec_id, code, label from pcg.spec_option where spec_id = any($1) order by spec_id, position', [specs.map(s => s.id)])
    : [];
  m.specs = specs.map(s => ({ name: s.name, options: opts.filter(o => o.spec_id === s.id).map(o => ({ code: o.code, label: o.label })) }));
  m.features = (await query('select feature_id from pcg.model_feature where model_id = $1', [id])).map(r => r.feature_id);
  return m;
}

/* ================= validate + write ================= */
async function validate(m, db, id) {
  const errs = [];
  const code = str(m.base_code);
  if (!code) errs.push('Model code is required.');
  else if (!CODE_RE.test(code)) errs.push('Model code may only contain letters, digits, dots, slashes and dashes (no spaces).');
  else if (await db.one('select 1 from pcg.model where lower(base_code) = lower($1) and id is distinct from $2', [code, id ?? null]))
    errs.push(`Another model already uses the code ${code}.`);
  if (!str(m.name)) errs.push('Name is required.');
  if (!await db.one('select 1 from pcg.product_type where id = $1', [m.type_id])) errs.push('Choose a product type.');
  if (!Array.isArray(m.specs)) m.specs = [];
  if (m.specs.length > 30) errs.push('A model can have at most 30 code segments.');
  m.specs.forEach((s, i) => {
    const n = str(s?.name) || `Segment ${i + 1}`;
    if (!str(s?.name)) errs.push(`Segment ${i + 1} needs a name.`);
    const opts = Array.isArray(s?.options) ? s.options : [];
    if (!opts.length) errs.push(`“${n}” needs at least one option.`);
    if (opts.length > 200) errs.push(`“${n}” has too many options.`);
    const seen = new Set();
    for (const o of opts) {
      const c = str(o?.code);
      if (!c) errs.push(`“${n}”: every option needs a code.`);
      else if (!OPT_RE.test(c)) errs.push(`“${n}”: option code “${c}” may not contain dashes or spaces.`);
      else if (seen.has(c.toLowerCase())) errs.push(`“${n}”: option code “${c}” is used twice.`);
      seen.add(c.toLowerCase());
      if (!str(o?.label)) errs.push(`“${n}”: option “${c || '?'}” needs a label.`);
    }
  });
  for (const f of ['datasheet_url', 'manual_url']) {
    const u = str(m[f]);
    if (u && !/^https?:\/\//.test(u)) errs.push(`${f === 'datasheet_url' ? 'Datasheet' : 'Manual'} URL must start with http:// or https://`);
  }
  const img = str(m.image_path);
  if (img && !/^(assets\/img\/[\w./-]+|media\/products\/[\w-]+\.(png|jpe?g|webp))$/.test(img)) errs.push('Unsupported photo location.');
  if (errs.length) throw new HttpError(422, [...new Set(errs)].join(' '));
}

async function write(db, id, m) {
  const vals = [str(m.base_code), m.type_id, str(m.name), str(m.description), orNull(m.datasheet_url), orNull(m.manual_url),
                orNull(m.image_path), m.active !== false, orNull(m.superseded_by)];
  if (id == null) {
    id = (await db.one(`insert into pcg.model (base_code, type_id, name, description, datasheet_url, manual_url, image_path, active, superseded_by, source, sort)
                        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'admin',(select coalesce(max(sort),0)+1 from pcg.model)) returning id`, vals)).id;
  } else {
    await db.query(`update pcg.model set base_code=$1, type_id=$2, name=$3, description=$4, datasheet_url=$5, manual_url=$6,
                    image_path=$7, active=$8, superseded_by=$9, updated_at=now() where id=$10`, [...vals, id]);
    await db.query('delete from pcg.spec where model_id = $1', [id]);
    await db.query('delete from pcg.model_feature where model_id = $1', [id]);
  }
  for (const [si, s] of m.specs.entries()) {
    const { id: sid } = await db.one('insert into pcg.spec (model_id, position, name) values ($1,$2,$3) returning id', [id, si, str(s.name)]);
    const opts = s.options.map((o, oi) => [sid, oi, str(o.code), str(o.label)]);
    await db.query(`insert into pcg.spec_option (spec_id, position, code, label)
                    select * from unnest($1::int[], $2::int[], $3::text[], $4::text[])`,
                   [opts.map(o => o[0]), opts.map(o => o[1]), opts.map(o => o[2]), opts.map(o => o[3])]);
  }
  const valid = new Set((await db.query('select id from pcg.feature where type_id = $1', [m.type_id])).map(r => r.id));
  for (const f of new Set((m.features || []).filter(f => valid.has(f))))
    await db.query('insert into pcg.model_feature (model_id, feature_id) values ($1,$2)', [id, f]);
  return id;
}

const audit = (db, user, action, code, detail = '') =>
  db.query('insert into pcg.audit_log (action, base_code, detail, actor) values ($1,$2,$3,$4)', [action, code, detail, user?.email || null]);

export async function saveModel(user, id, m) {
  const newId = await tx(async db => {
    if (id != null) {
      const cur = await db.one('select base_code, updated_at from pcg.model where id = $1 for update', [id]);
      if (!cur) throw new HttpError(404, 'Model not found');
      if (m.updated_at && new Date(cur.updated_at).getTime() !== new Date(m.updated_at).getTime())
        throw new HttpError(409, `${cur.base_code} was changed by someone else since you opened it. Reload it to see the latest version.`);
    }
    await validate(m, db, id);
    const nid = await write(db, id, m);
    const nOpts = m.specs.reduce((n, s) => n + s.options.length, 0);
    await audit(db, user, id == null ? 'create' : 'update', str(m.base_code),
                `${m.specs.length} segments, ${nOpts} options${m.active === false ? ', hidden' : ''}`);
    return nid;
  });
  return getModel(newId);
}

export async function deleteModel(user, id) {
  await tx(async db => {
    const r = await db.one('delete from pcg.model where id = $1 returning base_code', [id]);
    if (!r) throw new HttpError(404, 'Model not found');
    await audit(db, user, 'delete', r.base_code);
  });
}

/* ================= features ================= */
export async function createFeature(user, b) {
  const name = str(b.name);
  if (!name) throw new HttpError(422, 'Feature name is required.');
  if (name.length > 60) throw new HttpError(422, 'Feature names are limited to 60 characters.');
  const fid = `${b.type_id}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return tx(async db => {
    if (!await db.one('select 1 from pcg.product_type where id = $1', [b.type_id])) throw new HttpError(422, 'Unknown product type.');
    if (await db.one('select 1 from pcg.feature where id = $1', [fid])) throw new HttpError(422, 'That feature already exists.');
    await db.query('insert into pcg.feature (id, type_id, name, sort) values ($1,$2,$3,(select coalesce(max(sort),0)+1 from pcg.feature))', [fid, b.type_id, name]);
    await audit(db, user, 'feature+', null, `${b.type_id}: ${name}`);
    return { id: fid };
  });
}
export async function renameFeature(user, fid, b) {
  const name = str(b.name);
  if (!name) throw new HttpError(422, 'Feature name is required.');
  await tx(async db => {
    if (!await db.one('update pcg.feature set name = $1 where id = $2 returning id', [name, fid])) throw new HttpError(404, 'Feature not found');
    await audit(db, user, 'feature~', null, `${fid} → ${name}`);
  });
}
export async function deleteFeature(user, fid) {
  await tx(async db => {
    const r = await db.one('delete from pcg.feature where id = $1 returning name', [fid]);
    if (!r) throw new HttpError(404, 'Feature not found');
    await audit(db, user, 'feature-', null, r.name);
  });
}

/* ================= publish: snapshot the generator data ================= */
export async function buildExport() {
  const [families, types, features, models, specs, opts, mf] = await Promise.all([
    query('select id, name from pcg.family order by sort'),
    query('select t.id, t.family_id as family, t.name from pcg.product_type t join pcg.family f on f.id = t.family_id order by f.sort, t.sort'),
    query('select id, type_id as type, name from pcg.feature order by sort'),
    query(`select id, base_code as code, type_id as type, name, description, datasheet_url as datasheet, manual_url as manual, image_path as image
           from pcg.model where active order by sort`),
    query('select s.id, s.model_id, s.name from pcg.spec s join pcg.model m on m.id = s.model_id where m.active order by s.model_id, s.position'),
    query('select spec_id, code, label from pcg.spec_option order by spec_id, position'),
    query('select model_id, feature_id from pcg.model_feature'),
  ]);
  const bySpec = new Map(), byModel = new Map(), feats = new Map();
  for (const o of opts) (bySpec.get(o.spec_id) || bySpec.set(o.spec_id, []).get(o.spec_id)).push([o.code, o.label]);
  for (const s of specs) (byModel.get(s.model_id) || byModel.set(s.model_id, []).get(s.model_id)).push({ name: s.name, options: bySpec.get(s.id) || [] });
  for (const r of mf) (feats.get(r.model_id) || feats.set(r.model_id, []).get(r.model_id)).push(r.feature_id);
  const usedTypes = new Set(models.map(m => m.type));
  const usedFeats = new Set(models.flatMap(m => feats.get(m.id) || []));
  return {
    families: families.filter(f => types.some(t => t.family === f.id && usedTypes.has(t.id))),
    types: types.filter(t => usedTypes.has(t.id)),
    features: features.filter(f => usedFeats.has(f.id)),
    models: models.map(({ id, ...m }) => ({
      ...Object.fromEntries(Object.entries(m).filter(([, v]) => v != null && v !== '')),
      specs: byModel.get(id) || [], features: (feats.get(id) || []).sort(),
    })),
  };
}

export async function publish(user) {
  const t0 = Date.now();
  const data = await buildExport();
  await tx(async db => {
    await db.query('insert into pcg.snapshot (data, created_by) values ($1, $2)', [JSON.stringify(data), user.email]);
    await db.query('delete from pcg.snapshot where id not in (select id from pcg.snapshot order by id desc limit 30)');
    await audit(db, user, 'publish', null, `${data.models.length} models`);
  });
  return { ok: true, models: data.models.length, ms: Date.now() - t0 };
}

export async function latestSnapshot() {
  const r = await one('select data, created_at from pcg.snapshot order by id desc limit 1');
  return r ? r : { data: await buildExport(), created_at: new Date() };
}

/* ================= activity ================= */
export const recentAudit = () => query('select at, action, base_code, detail, actor from pcg.audit_log order by id desc limit 60');

/* ================= team ================= */
export const listUsers = () => query('select id, email, name, created_at, last_login_at from pcg.admin_user order by created_at');

export async function createUser(user, b) {
  // the login can be a username (e.g. neowave1) or an email address
  const email = str(b.email).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._@+-]{2,99}$/.test(email)) throw new HttpError(422, 'Use a username of at least 3 letters/digits, or an email address.');
  const temp = crypto.randomBytes(9).toString('base64url');
  await tx(async db => {
    if (await db.one('select 1 from pcg.admin_user where email = $1', [email])) throw new HttpError(422, 'That username is already taken.');
    await db.query('insert into pcg.admin_user (email, name, password_hash) values ($1,$2,$3)', [email, str(b.name), hashPassword(temp)]);
    await audit(db, user, 'user+', null, email);
  });
  return { email, tempPassword: temp };
}

export async function deleteUser(user, id) {
  if (id === user.id) throw new HttpError(422, "You can't remove your own account.");
  await tx(async db => {
    const r = await db.one('delete from pcg.admin_user where id = $1 returning email', [id]);
    if (!r) throw new HttpError(404, 'User not found');
    await audit(db, user, 'user-', null, r.email);
  });
}

export async function changePassword(user, b) {
  validateNewPassword(b.next);
  const u = await one('select password_hash from pcg.admin_user where id = $1', [user.id]);
  if (!verifyPassword(String(b.current || ''), u.password_hash)) throw new HttpError(422, 'Your current password is incorrect.');
  return tx(async db => {
    const r = await db.one(`update pcg.admin_user set password_hash = $1, session_version = session_version + 1
                            where id = $2 returning id, email, name, session_version`, [hashPassword(b.next), user.id]);
    await audit(db, user, 'password', null, 'changed own password (other sessions signed out)');
    return r;
  });
}
