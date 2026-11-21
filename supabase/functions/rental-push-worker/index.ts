import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Public wakeup only. No caller-provided recipient, payload, token or queue ID
// is accepted. Service-only leases bound concurrency and retry counts.
serve(async req => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { data: jobs, error } = await db.rpc('claim_rental_push');
    if (error) throw error;
    let processed = 0;
    for (const job of jobs ?? []) {
      const save = async (patch: Record<string, unknown>) => {
        const { error } = await db.from('rental_push_queue').update({ leased_until: null, ...patch }).eq('id', job.id);
        if (error) throw error;
      };
      try {
        const receipt = job.state === 'ticket';
        const response = await fetch(`https://exp.host/--/api/v2/push/${receipt ? 'getReceipts' : 'send'}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify(receipt ? { ids: [job.ticket_id] } : {
            to: job.token, sound: 'default', title: job.title, body: job.body,
            channelId: 'default', data: { url: job.url }, ttl: 86400,
          }),
        });
        const result = await response.json();
        const ticket = receipt ? result?.data?.[job.ticket_id] : Array.isArray(result?.data) ? result.data[0] : result?.data;
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          const { error: removeError } = await db.from('push_devices').delete().eq('token', job.token);
          if (removeError) throw removeError;
          const { error: clearError } = await db.from('users').update({ expo_push_token: null }).eq('id', job.user_id).eq('expo_push_token', job.token);
          if (clearError) throw clearError;
          await save({ state: 'dead', last_error: 'DeviceNotRegistered' });
        } else if (!response.ok || (ticket?.status !== 'ok') || (!receipt && !ticket?.id)) {
          throw new Error(ticket?.details?.error ?? (receipt && !ticket ? 'ReceiptNotReady' : 'PushProviderError'));
        } else {
          await save(receipt ? { state: 'receipt_ok', last_error: null } : {
            state: 'ticket', ticket_id: ticket.id, last_error: null,
            next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString(),
          });
        }
        processed++;
      } catch (error) {
        await save({ state: job.attempts >= 8 ? 'failed' : job.state,
          last_error: error instanceof Error ? error.message.slice(0, 100) : 'PushError',
          next_attempt_at: new Date(Date.now() + Math.min(15 * 60000, 30000 * 2 ** job.attempts)).toISOString() });
      }
    }
    return Response.json({ processed });
  } catch {
    return Response.json({ error: 'push_worker_failed' }, { status: 503 });
  }
});
