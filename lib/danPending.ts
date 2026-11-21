// No credentials are persisted. A live browser flow owns warm callbacks;
// the callback screen recovers only when that flow no longer exists.
let pending: { url?: string; resolve?: (url: string | null) => void } | undefined;

export function beginDanFlow() {
  if (pending) throw new Error('DAN нэвтрэлт үргэлжилж байна. Түр хүлээнэ үү.');
  pending = {};
}
export function captureDanCallback(url: string) {
  if (!pending) return false;
  pending.url = url.replace(/^\/?dan-callback/i, 'tureesly://dan-callback');
  pending.resolve?.(pending.url);
  return true;
}
export function waitForDanCallback(milliseconds = 1500): Promise<string | null> {
  if (pending?.url) return Promise.resolve(pending.url);
  if (!pending) return Promise.resolve(null);
  const flow = pending;
  return new Promise(resolve => {
    const timer = setTimeout(() => { flow.resolve = undefined; resolve(null); }, milliseconds);
    flow.resolve = url => { clearTimeout(timer); flow.resolve = undefined; resolve(url); };
  });
}
export function endDanFlow() { pending = undefined; }
