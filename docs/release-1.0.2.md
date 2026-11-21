# Arivly 1.0.2 final release — 2026-11-21

Includes registration/login audit fixes in auth-audit-2026-11-21.md.

## Update and version display

Android uses Google Play's available-version API. iOS checks Apple's Mongolia
listing and compares numeric public versions, verifies bundle ID and OS support.
When an installable newer version is found, a non-dismissable modal links to the
appropriate store. Offline/store errors do not invent an update or block startup.
This behavior requires this new app binary; old installed binaries retain their
previous optional-update implementation until updated. iOS public releases must
increment the marketing version, not merely the internal build number.

Profile uses native version/build on both platforms and displays the packaged
release date 2026.11.21. This date is not claimed to be the store approval date.

## Rental notifications

Live notifications schema is `body`/`related_id`, not `content`/`reference_id`.
Client read/mark-read code and new triggers now match the live schema.

New pending rentals create an in-app owner notification in the same transaction.
Approved/rejected/cancelled/completed rental changes notify the other party.
Notification inserts enqueue per-device push jobs. HTTP wakeup failure cannot
roll back the rental; cron retries every minute. No historical requests were
backfilled or broadcast. The disabled insurance demo remains disabled.

Native registration retries on foreground and token rotation. Devices are stored
individually; token ownership transfers on account switch. Logout unregisters the
current device while its session is still available. Registration timeout is 15s.

Service-only queue leases prevent concurrent sends of the same queued job.
Transient errors retry with backoff (8 attempts / 24h maximum). Expo tickets are
saved and receipts checked after 15 minutes. Invalid devices are removed. A
successful receipt means provider acceptance, not proof a human saw the alert.
Push remains at-least-once: a lost response after provider acceptance can cause
a duplicate on retry. In-app notification is the durable record.

Backend deployed: migration 20261121000000, rental-push-worker,
send-rental-request-push. Legacy direct-push calls now acknowledge the queue
instead of sending a second untracked notification. Queue and device tables are
RLS-enabled and inaccessible to app roles; registration RPC checks auth.uid().

## Validation and release boundary

SQL migration/queue/lease/permission tests ran on the live schema inside rollback,
using a synthetic token. pg_net does not issue those requests before commit.
No real test notification was sent. Live cron is enabled and its run succeeded;
queue was empty at inspection; unauthenticated queue read/register are denied.
Store-version, token-ownership, timeout/error cleanup, tickets, receipts, invalid
devices and retry exhaustion have automated tests. Full test results are retained
in output/final-release-tests.log; TypeScript and production web export pass.

Physical Android/iOS APNs/FCM delivery, permission denial/settings, background,
terminated launch, tapping a notification, and full live DAN flow still require
device verification. Existing Apple signing credentials were found by EAS;
that is not proof APNs delivery works. No IAP/payment enablement changed.

Android artifact: 1.0.2 (27). iOS EAS: 1.0.2 (69), build
aee27f4f-939c-490c-b1d5-aefe4fe78050. Build/deployment artifacts are in
output/Arivly-final-1.0.2 (ignored by git). Upload its `web` child directory to
Cloudflare Pages, not the parent directory. Do not promote native releases
without device testing. Git contains source/tests/docs, never signing keys or IPA/AAB.
