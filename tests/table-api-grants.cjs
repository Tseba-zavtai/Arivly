const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../supabase/migrations');
const baselineFile = '20261021000000_explicit_table_api_grants.sql';
const readSql = file => fs.readFileSync(path.join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
const baseline = readSql(baselineFile);
const operations = ['select', 'insert', 'update', 'delete'];

function allowed(table, role, operation, sql = baseline) {
  const grants = sql.split(';').map(s => s.trim()).filter(s => /^grant /i.test(s));
  return grants.some(s => {
    const m = s.match(/^grant\s+(.+?)\s+on\s+(?:table\s+)?(.+?)\s+to\s+(.+)$/is);
    return m && m[1].split(',').map(x=>x.trim()).includes(operation)
      && m[2].split(',').map(x=>x.trim()).includes(`public.${table}`)
      && m[3].split(',').map(x=>x.trim()).includes(role);
  });
}
test('every migration-created table has explicit RLS and backend grants', () => {
  for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.sql'))) {
    const source = readSql(file);
    const legacy = file < baselineFile;
    const accessSql = legacy ? baseline : source;
    for (const match of source.matchAll(/create table(?: if not exists)? public\.(\w+)/gi)) {
      const table = match[1];
      assert.ok(accessSql.includes(`alter table public.${table} enable row level security`), table);
      const backendOperations = operations.filter(operation => allowed(table, 'service_role', operation, accessSql));
      assert.ok(backendOperations.length > 0, `${table} must explicitly grant backend access`);
      if (legacy) assert.deepEqual(backendOperations, operations, `${table} baseline operations`);
    }
  }
});
test('private auth, search, finance and cleanup tables have no client grants', () => {
  for (const table of ['dan_identities','dan_auth_states','dan_auth_handoffs','listing_search_events','qpay_service_orders','deleted_account_financial_records','account_deletion_files']) {
    for (const role of ['anon','authenticated']) for (const op of ['select','insert','update','delete']) assert.equal(allowed(table,role,op),false,`${table} ${role} ${op}`);
  }
});
test('public reads, owner operations and admin writes are preserved', () => {
  assert.ok(allowed('app_release_notes','anon','select'));
  assert.equal(allowed('app_release_notes','authenticated','insert'),false);
  for (const table of ['seasonal_collections','seasonal_collection_rules']) {
    assert.ok(allowed(table,'anon','select'));
    assert.ok(allowed(table,'authenticated','update'));
    assert.equal(allowed(table,'anon','update'),false);
  }
  assert.ok(allowed('user_contact_phones','authenticated','delete'));
  assert.ok(allowed('rental_disputes','authenticated','update'));
  assert.equal(allowed('rental_disputes','authenticated','delete'),false);
  assert.ok(allowed('mock_ebarimt_receipts','authenticated','select'));
  assert.equal(allowed('mock_ebarimt_receipts','authenticated','insert'),false);
});
