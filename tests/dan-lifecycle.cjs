const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = p => ts.transpileModule(fs.readFileSync(p, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function flow(os, config = {}) {
  const pending = {};
  vm.runInNewContext(compile('lib/danPending.ts'), { exports: pending, setTimeout, clearTimeout });
  let listener, removed = 0, starts = 0, exchanges = 0, verifications = 0;
  const callback = 'tureesly://dan-callback?handoff=synthetic&linked=0';
  const popup = { closed: false, close() { this.closed = true; } };
  const modules = {
    '@/lib/danPending': pending,
    'react-native': { Platform: { OS: os } },
    'expo-linking': {
      parse: url => ({ queryParams: Object.fromEntries(new URL(url).searchParams) }),
      addEventListener: (_name, fn) => { listener = fn; return { remove() { removed++; } }; },
    },
    'expo-web-browser': { openAuthSessionAsync: async () => {
      if (config.browserError) throw Error('browser failed');
      if (config.cancelRace) { setTimeout(() => listener({ url: callback }), 10); return { type: 'cancel' }; }
      if (config.cancel) return { type: 'cancel' };
      return { type: 'success', url: callback };
    } },
    '@/lib/supabase': { supabase: {
      functions: { invoke: async name => {
        if (name === 'dan-auth-start') { starts++; if (config.startError) return { error: Error('network unavailable') }; await Promise.resolve(); return { data: { authorize_url: 'https://sso.gov.mn/synthetic' } }; }
        exchanges++; return config.exchangeError ? { error: Error('handoff expired') } : { data: { token_hash: 'synthetic-token' } };
      } },
      auth: { verifyOtp: async () => { verifications++; return config.otpError ? { error: Error('session unavailable') } : { data: { session: {}, user: { id: 'synthetic-user' } } }; } },
    } },
  };
  const exports = {};
  vm.runInNewContext(compile('lib/danAuth.ts'), { exports, require: name => modules[name], window: { location: { origin: 'https://arivly.mn' }, open: () => config.blockPopup ? null : popup } });
  const nativeIntent = {};
  vm.runInNewContext(compile('app/+native-intent.tsx'), { exports: nativeIntent, require: () => pending });
  return { run: () => exports.authenticateWithDan('sign_up', { termsAccepted: true }), pending, nativeIntent, popup, counts: () => ({ removed, starts, exchanges, verifications }) };
}

for (const os of ['android', 'ios', 'web']) {
  test(`${os}: signup reaches a verified session on first callback`, async () => {
    const f = flow(os);
    assert.equal((await f.run()).userId, 'synthetic-user');
    assert.equal(f.counts().exchanges, 1);
    assert.equal(f.counts().verifications, 1);
  });
  for (const failure of ['startError', 'exchangeError', 'otpError', 'browserError']) {
    test(`${os}: ${failure} releases flow so the user can retry`, async () => {
      const f = flow(os, { [failure]: true });
      await assert.rejects(f.run());
      // A leaked flow would instead report "DAN нэвтрэлт үргэлжилж байна".
      f.pending.beginDanFlow();
      f.pending.endDanFlow();
      assert.equal(f.counts().removed, os === 'web' ? 0 : 1);
      if (os === 'web') assert.equal(f.popup.closed, true);
    });
  }
}

test('Android resume cancellation followed by callback completes without a second DAN attempt', async () => {
  const f = flow('android', { cancelRace: true });
  assert.equal((await f.run()).userId, 'synthetic-user');
  assert.equal(f.counts().starts, 1);
});

test('double tap cannot launch a second browser or server signup', async () => {
  const f = flow('android');
  const first = f.run();
  await assert.rejects(f.run(), /үргэлжилж байна/);
  await first;
  assert.equal(f.counts().starts, 1);
});

test('blocked web popup releases the lock for retry without calling server', async () => {
  const f = flow('web', { blockPopup: true });
  await assert.rejects(f.run(), /popup/);
  f.pending.beginDanFlow(); f.pending.endDanFlow();
  assert.equal(f.counts().starts, 0);
});

test('warm callback preserves active auth form, cold callback preserves handoff', () => {
  const f = flow('android');
  const path = 'tureesly://dan-callback?handoff=synthetic&linked=0';
  assert.equal(f.nativeIntent.redirectSystemPath({ path, initial: true }), '/dan-callback?handoff=synthetic&linked=0');
  f.pending.beginDanFlow();
  assert.equal(f.nativeIntent.redirectSystemPath({ path, initial: false }), '/auth');
  f.pending.endDanFlow();
});

test('actual cancel is bounded and leaves signup retryable', async () => {
  const f = flow('android', { cancel: true });
  await assert.rejects(f.run(), /цуцлагдсан/);
  f.pending.beginDanFlow(); f.pending.endDanFlow();
  assert.equal(f.counts().exchanges, 0);
});
