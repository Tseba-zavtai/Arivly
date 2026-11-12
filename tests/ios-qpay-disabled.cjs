const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, platform, invoke) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, Response, require(name) {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === '@/lib/supabase') return { supabase: { functions: { invoke } } };
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

test('iOS disables QPay while Android retains its payment option', () => {
  assert.equal(load('constants/features.ts', 'ios').NATIVE_QPAY_ENABLED, false);
  assert.equal(load('constants/features.ts', 'android').NATIVE_QPAY_ENABLED, true);
});

test('iOS rejects every QPay operation before any network request', async () => {
  let calls = 0;
  const { callQPay } = load('lib/qpayPayments.ts', 'ios', () => { calls++; });
  for (const action of ['create', 'status', 'cancel']) {
    await assert.rejects(callQPay({ action }), /App Store/);
  }
  assert.equal(calls, 0);
});

test('Android QPay operations retain their request and response behavior using a fake server', async () => {
  const calls = [];
  const { callQPay } = load('lib/qpayPayments.ts', 'android', async (...args) => {
    calls.push(args);
    return { data: { orderId: 'mock-only' }, error: null };
  });
  for (const action of ['create', 'status', 'cancel']) {
    const result = await callQPay({ action });
    assert.equal(result.orderId, 'mock-only');
    assert.equal(calls.at(-1)[0], 'qpay-service');
    assert.equal(calls.at(-1)[1].body.action, action);
  }
});

test('iOS no longer declares QPay bank app schemes; Android keeps bank queries', () => {
  const config = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  assert.equal(config.ios.infoPlist.LSApplicationQueriesSchemes, undefined);
  assert.ok(config.plugins.includes('./plugins/with-bank-queries'));
  assert.match(fs.readFileSync('plugins/with-bank-queries.js', 'utf8'), /qpaywallet/);
});
