import { captureDanCallback } from '@/lib/danPending';

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  // Preserve the one-use callback for warm and cold app starts.
  if (/^(?:tureesly:\/\/)?\/?dan-callback(?:[/?#]|$)/i.test(path)) {
    if (captureDanCallback(path)) return '/auth';
    return path.replace(/^(?:tureesly:\/\/)?\/?dan-callback/i, '/dan-callback');
  }
  return '/';
}
