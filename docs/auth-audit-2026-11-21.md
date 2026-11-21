# Registration and login audit — 2026-11-21

## Scope and evidence

Shared Android, iOS and web registration/login code, native return handling,
web popup callback, onboarding, password login, DAN password verification,
profile restoration and backend registration protections were reviewed.
Automated service/browser doubles are explicitly different from real DAN/device tests.

| Scenario | Evidence | Result |
| --- | --- | --- |
| First callback creates a session: Android/iOS/web branches | `tests/dan-lifecycle.cjs`, actual client functions with service doubles | Pass |
| Android resume/cancel arrives before URL | Actual pending handler + delayed synthetic deep link | Pass |
| Cold start receives handoff | Native-intent rewrite retains callback parameters | Pass |
| Warm return while auth form owns the flow | Callback captured for existing flow; auth form retained | Pass |
| Duplicate tap and duplicate callback | Actual lock and shared one-use exchange promise | Pass |
| Server/network, browser, token verification failures | Lock/listeners/popup released; another attempt allowed | Pass |
| User closes browser | Bounded callback grace period, then cancel and retry allowed | Pass |
| Web blocks popup | Server not invoked; lock released, actionable error | Pass |
| Existing identity and incomplete onboarding | Actual backend handler tests | Pass |
| Duplicate phone, missing consent, expired state, unauthenticated completion | Actual backend handler tests + live anonymous checks | Pass |
| Signup committed but response lost | Client verifies completion before attempting credential write again | Pass |
| Profile outage / credit refresh outage | No overwrite of existing profile; ancillary error does not block profile | Pass |
| Terms dialog, scroll-to-end enablement | Local exported web build in in-app browser | Pass |
| Paste +976 number, empty password validation | Local exported web build in in-app browser | Pass |
| Rejected callback offers working return to login | Local exported web build in in-app browser | Pass |

Full offline test suite: **180 passed, 0 failed**. TypeScript noEmit: pass.
Web production export: pass (`output/arivly-web-auth-audit`).
Live endpoint checks: three passed, without creating identities or sessions.
Live database: no orphan DAN identities, missing DAN profiles, completed signup
login mismatches or duplicate profile phones. Login mutation permissions restricted
to backend; service terms are present.

## Changes

- Recover cold native callbacks on a dedicated progress/error screen instead of
  discarding the handoff and returning to the signup form.
- Capture warm callbacks for the existing auth flow. Handle Android's delayed
  deep link after browser cancellation; retain password recovery behavior on warm return.
- Prevent simultaneous DAN launches and duplicate handoff redemption.
- Repeat web popup callback notification briefly if Expo has not registered its listener yet.
- Offer retry when service terms fail to load, without accepting unread terms.
- Normalize pasted country-code phone numbers in login and signup forms.
- Never upsert fallback profile/credit values on a generic read failure. Create
  a missing profile only on explicit not-found and tolerate a concurrent insert.
- Do not make optional credit/activity updates determine login success.

## Practical limits and release checks

No claim of end-to-end certification on every device: no iPhone or Android phone
was connected during this audit. Real government/bank identity credentials were
not entered and no real account/password was created or reset by the audit.
Live DAN, banks and network availability remain outside application control.
Errors must offer a return/retry path; temporary external failure cannot be
guaranteed never to happen.

Before promoting the next native releases, verify on a real Android and iPhone:
fresh DAN signup, immediate continuation after consent, phone/password completion,
logout/login, interrupted signup resume, and DAN password recovery. Include switching
to bank/SMS app, backgrounding the app and a cold return to the callback.
Desktop and mobile Safari/Chrome must finish the full live popup flow on arivly.mn.
Localhost is deliberately not allowed as a live DAN return origin.

These changes require deployment of the new web export and new Android/iOS builds.
Build 25 and the installed iOS release do not contain these fixes. No backend
function or database schema was modified by this audit. The live service terms
still contain the old Tureesly name; their substantive legal text was not changed.
