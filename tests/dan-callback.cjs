const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  let exchanges = 0, verifications = 0;
  const exports = {};
  const modules = {
    'expo-linking': { addEventListener: () => ({ remove() {} }), parse: value => ({ queryParams: Object.fromEntries(new URL(value).searchParams) }) },
    'expo-web-browser': {}, 'react-native': { Platform: { OS: 'android' } },
    '@/lib/supabase': { supabase: {
      functions: { invoke: async (name, options) => {
        assert.equal(name, 'dan-auth-complete');
        assert.equal(options.body.handoff, 'synthetic-handoff');
        exchanges++;
        await Promise.resolve();
        return { data: { token_hash: 'synthetic-token' } };
      } },
      auth: { verifyOtp: async () => { verifications++; return { data: { session: {}, user: { id: 'synthetic-user' } } }; } },
    } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/danAuth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => name === '@/lib/danPending' ? { beginDanFlow() {}, endDanFlow() {}, captureDanCallback() {}, waitForDanCallback: async () => null } : modules[name] });
  return { complete: exports.completeDanCallback, counts: () => [exchanges, verifications] };
}

test('cold callback completes signup without starting DAN again', async () => {
  const flow = load();
  assert.equal((await flow.complete('tureesly://dan-callback?handoff=synthetic-handoff')).userId, 'synthetic-user');
  assert.deepEqual(flow.counts(), [1, 1]);
});

test('browser and native route redeem a one-use handoff only once despite query ordering', async () => {
  const flow = load();
  const a = flow.complete('tureesly://dan-callback?linked=1&handoff=synthetic-handoff');
  const b = flow.complete('tureesly://dan-callback?handoff=synthetic-handoff&linked=1');
  assert.equal(a, b);
  await Promise.all([a, b]);
  await flow.complete('tureesly://dan-callback?handoff=synthetic-handoff');
  assert.deepEqual(flow.counts(), [1, 1]);
});

test('DAN rejection does not create a session', async () => {
  const flow = load();
  await assert.rejects(flow.complete('tureesly://dan-callback?error=identity_already_registered'), /бүртгүүлсэн/);
  assert.deepEqual(flow.counts(), [0, 0]);
});
