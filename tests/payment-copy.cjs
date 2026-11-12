const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('components/StorePaymentScreen.tsx', 'utf8');

test('inactive and expired listings cannot use single or bulk promotion buttons', () => {
  const jobs = fs.readFileSync('app/my-jobs.tsx', 'utf8');
  assert.ok(jobs.includes('job.is_active !== false'));
  assert.ok(jobs.includes('!isListingExpired(job)'));
  assert.equal((jobs.match(/disabled=\{promotionUnavailable\}/g) || []).length, 2);
  assert.equal((jobs.match(/disabled=\{promotionDisabled\}/g) || []).length, 2);
  assert.ok(jobs.includes('ids.includes(j.id) && !canPromote(j)'));
});
test('checkout keeps recovery but removes confusing repeated warnings', () => {
  for (const text of ['Автоматаар сунгах захиалга биш', 'Эцсийн үнэ дэлгүүрийн', 'Ашиглагдсан зарын эрхийг дахин олгохгүй']) assert.ok(!source.includes(text));
  assert.ok(source.includes('await store.recover()'));
  assert.ok(source.includes('await store.buy('));
  assert.ok(source.includes('onChooseQPay(selected)'));
  assert.ok(!source.includes('Худалдан авалтын тухай'));
  assert.ok(source.includes("router.push('/help/terms')"));
  assert.ok(source.includes('Таны сонголт'));
  assert.ok(source.includes('Дахин төлөх шаардлагагүй.'));
});

test('listing promotion buttons do not advertise a stale fixed price', () => {
  const jobs = fs.readFileSync('app/my-jobs.tsx', 'utf8');
  assert.ok(!jobs.includes('1,000₮'));
  assert.ok(!jobs.includes('selected.length*1000'));
});

test('verified checkout navigates directly to the result with no extra success screen', () => {
  assert.ok(!source.includes('Худалдан авалт баталгаажлаа'));
  assert.ok(!source.includes('setSuccess'));
  assert.ok(source.includes("router.replace(kind === 'credit' ? '/profile' : kind === 'bump' ? '/' : '/my-jobs')"));
  assert.ok(source.includes('store.completed.productId === requested.current'));
  const context = fs.readFileSync('contexts/StorePurchaseContext.tsx', 'utf8');
  assert.ok(context.indexOf('await completeStorePurchase(') < context.indexOf('setCompleted(previous'));
  assert.ok(context.indexOf('await Promise.allSettled([state.current.refetchProfile(), state.current.loadJobs()])') < context.indexOf('setCompleted(previous'));
});
