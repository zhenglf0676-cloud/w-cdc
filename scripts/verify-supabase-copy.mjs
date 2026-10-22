/** Compare two Supabase projects without printing row contents or credentials.
 * Usage: SOURCE_SUPABASE_URL=... SOURCE_SUPABASE_SERVICE_ROLE_KEY=... \
 *        TARGET_SUPABASE_URL=... TARGET_SUPABASE_SERVICE_ROLE_KEY=... \
 *        node scripts/verify-supabase-copy.mjs
 */
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const defaultTables = ['profiles', 'discharge_outlets', 'pollutant_applications', 'monitoring_data', 'notifications'];
const tables = process.env.MIGRATION_TABLES ? process.env.MIGRATION_TABLES.split(',').map(table => table.trim()).filter(Boolean) : defaultTables;
if (tables.some(table => !/^[a-z][a-z0-9_]*$/.test(table))) throw new Error('MIGRATION_TABLES contains an invalid table name');
const pageSize = 500;

function client(prefix) {
  const url = process.env[`${prefix}_SUPABASE_URL`];
  const key = process.env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`];
  if (!url || !key) throw new Error(`Missing ${prefix} Supabase connection settings`);
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

async function tableDigest(db, table) {
  const countResult = await db.from(table).select('id', { count: 'exact', head: true });
  if (countResult.error) throw new Error(`${table} count: ${countResult.error.message}`);
  const digest = createHash('sha256');
  let rows = 0;
  while (true) {
    const { data, error } = await db.from(table).select('*').order('id', { ascending: true }).range(rows, rows + pageSize - 1);
    if (error) throw new Error(`${table} page at ${rows}: ${error.message}`);
    for (const record of data ?? []) digest.update(`${JSON.stringify(canonical(record))}\n`);
    rows += data?.length ?? 0;
    if ((data?.length ?? 0) < pageSize) break;
  }
  if (rows !== countResult.count) throw new Error(`${table} changed during verification: count ${countResult.count}, read ${rows}`);
  return { count: rows, sha256: digest.digest('hex') };
}

async function authIdsDigest(db) {
  const digest = createHash('sha256');
  let page = 1;
  const allIds = [];
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw new Error(`auth.users page ${page}: ${error.message}`);
    const ids = (data?.users ?? []).map(user => user.id);
    allIds.push(...ids);
    if (ids.length < pageSize) break;
    page += 1;
  }
  for (const id of allIds.sort()) digest.update(`${id}\n`);
  return { count: allIds.length, sha256: digest.digest('hex') };
}

const source = client('SOURCE');
const target = client('TARGET');
let mismatch = false;

for (const table of tables) {
  const [left, right] = await Promise.all([tableDigest(source, table), tableDigest(target, table)]);
  const same = left.count === right.count && left.sha256 === right.sha256;
  mismatch ||= !same;
  console.log(`${same ? 'OK' : 'MISMATCH'} ${table}: source=${left.count} target=${right.count}; content digest ${same ? 'matches' : 'differs'}`);
}

const [leftUsers, rightUsers] = await Promise.all([authIdsDigest(source), authIdsDigest(target)]);
const usersSame = leftUsers.count === rightUsers.count && leftUsers.sha256 === rightUsers.sha256;
mismatch ||= !usersSame;
console.log(`${usersSame ? 'OK' : 'MISMATCH'} auth user IDs: source=${leftUsers.count} target=${rightUsers.count}`);
if (mismatch) process.exitCode = 1;
