const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker(offline = false) {
  const listeners = {};
  const network = [], cached = [];
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://tureesly.test' }, clients: { claim() {} }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    URL, Response,
    caches: { open: async () => ({ addAll: async paths => cached.push(...paths) }), match: async () => new Response('offline'), keys: async () => [], delete: async () => true },
    fetch: async request => { network.push(request); if (offline) throw new Error('offline'); return new Response('live'); },
  });
  return { listeners, network, cached };
}

test('PWA installation caches only public offline assets', async () => {
  const w = worker();
  let pending;
  w.listeners.install({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual(w.cached, ['/offline.html', '/logo.png']);
});

test('service worker never intercepts payment API, authentication or mutation requests', () => {
  const w = worker();
  for (const request of [
    { method: 'POST', mode: 'cors', url: 'https://api.supabase.co/functions/v1/qpay-service' },
    { method: 'GET', mode: 'cors', url: 'https://api.supabase.co/auth/v1/user' },
    { method: 'GET', mode: 'navigate', url: 'https://bank.test/pay' },
    { method: 'POST', mode: 'navigate', url: 'https://tureesly.test/auth' },
  ]) w.listeners.fetch({ request, respondWith: () => assert.fail('Sensitive request intercepted') });
  assert.equal(w.network.length, 0);
});

test('navigation always uses live network and falls back only when offline', async () => {
  for (const offline of [false, true]) {
    const w = worker(offline);
    let response;
    w.listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://tureesly.test/' }, respondWith: promise => { response = promise; } });
    assert.equal(await (await response).text(), offline ? 'offline' : 'live');
    assert.equal(w.network.length, 1);
  }
});
