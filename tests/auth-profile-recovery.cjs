const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load({ firstError, secondError, rpcReject = false, insertError } = {}) {
  const body = fs.readFileSync('contexts/AuthContext.tsx', 'utf8').split('const fetchProfile = useCallback(')[1].split('[persistUser]')[0].trim().replace(/,$/, '');
  let reads = 0, inserts = 0, writes = 0;
  const profile = { id: 'synthetic-user', phone: '+97699112233', available_post_credits: 17 };
  const chain = { select() { return this; }, eq() { return this; }, single: async () => {
    const error = ++reads === 1 ? firstError : secondError;
    return error ? { error } : { data: profile };
  }, insert: async () => { inserts++; return { error: insertError }; } };
  const handler = vm.runInNewContext(ts.transpileModule(`(${body})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    supabase: { rpc: () => rpcReject ? Promise.reject(Error('offline')) : Promise.resolve({}), from: () => chain },
    normalizePhone: x => x, mapProfileRowToUser: x => x, persistUser: async () => { writes++; },
    mountedRef: { current: true }, setUser() {}, console: { warn() {} },
  });
  return { run: () => handler('synthetic-user', '+97699112233'), counts: () => ({ reads, inserts, writes }) };
}

test('profile network failure never upserts or resets existing account credits', async () => {
  const f = load({ firstError: { code: 'NETWORK' }, secondError: { code: 'NETWORK' } });
  await assert.rejects(f.run());
  assert.deepEqual(f.counts(), { reads: 2, inserts: 0, writes: 0 });
});
test('ancillary credit refresh failure cannot block a valid profile', async () => {
  const f = load({ rpcReject: true });
  assert.equal((await f.run()).available_post_credits, 17);
  assert.equal(f.counts().inserts, 0);
});
test('missing profile creation race loads existing profile instead of overwriting it', async () => {
  const f = load({ firstError: { code: 'PGRST116' }, insertError: { code: '23505' } });
  assert.equal((await f.run()).available_post_credits, 17);
  assert.equal(f.counts().inserts, 1);
});
test('short profile outage recovers on second read without any profile mutation', async () => {
  const f = load({ firstError: { code: 'NETWORK' } });
  assert.equal((await f.run()).id, 'synthetic-user');
  assert.deepEqual(f.counts(), { reads: 2, inserts: 0, writes: 1 });
});
