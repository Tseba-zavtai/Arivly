# Tureesly web / PWA

## Homepage content editor

Open `/admin-home` on the website using a super-admin Tureesly account and
confirm the account password. The editor supports adding/removing, showing/hiding,
and reordering homepage sections; editing plain text, images and calls to action;
and an interactive draft preview. It is a block editor, not an arbitrary HTML,
CSS or plugin builder. Real listing cards still come from the rental database.

`Ноорог хадгалах` saves the draft privately. `Нийтлэх` saves outstanding edits
and copies the draft to published content. `Нийтэлснийг сэргээх` loads the current
published page into the editor without publishing it. Public pages use only the
published row. Content changes do not require a Cloudflare upload after the
CMS-enabled web bundle has been deployed. The public content query is refreshed
when a page is reopened (up to 30 seconds of in-session query cache).

Migration `20261106010000_web_home_cms.sql` creates `web_home_pages`, guarded
save/publish RPCs and the `web-content` image bucket. It is registered in the
linked project's migration history. Changing page content cannot alter native
app screens, payment prices, database roles or the listing catalog schema.

Images must be JPEG, PNG or WebP and at most 5 MB. Each upload uses a unique URL.
Removing an image from a section unlinks it; it does not delete the stored file.
No client may overwrite or delete these media files. Clean up unused uploads
separately after verifying they are not referenced by a published page.

The web home and tab shell use Expo platform routes (`index.web.tsx` and
`_layout.web.tsx`). Native routes retain the existing app interface. The web
catalog uses JobsContext and the existing Supabase category catalog; no demo
listings or separate database are introduced.

## Build and preview

```powershell
npm run build:web
npm run preview:web
```

Open the local URL printed by the preview server (default port 4173). This URL
is local to the computer and is not a public hosting address.

## Cloudflare Pages deployment

Deploy the contents of `output/tureesly-web`, with the build command `npm run build:web`.
The `public` directory is copied into the export and includes SPA fallback
redirects, cache headers, a manifest, icons and offline support. A Pages project
gets a temporary `pages.dev` address; a purchased domain can be connected later.
No Supabase service-role key or QPay provider secret belongs in the web build.

After assigning the final origin, verify any configured Supabase Auth redirect
allowlists and DAN browser callback flow. Phone/password login uses the existing
app session. End-to-end authenticated posting, rental requests, uploads and bank
app return flows still require device QA before public launch.

## Homepage header and location browsing

In `/admin-home`, open general settings to change the logo, navigation labels,
destinations, ordering, visibility, and map section title. Older saved content
receives the default header without replacing its announcement or sections.
Save a draft and publish to make content changes visible publicly.

The default location link (`/#locations`) expands the map after the hero and
scrolls to it. The how-it-works link targets `/#how-it-works`; keep an enabled
steps section for this target. Terms remain available in the footer.

Map/list browsing includes active, unexpired listings with valid coordinates.
Nearby browsing requests browser location only after the user clicks it, filters
by the chosen radius, and sorts by distance. Current location is kept in memory,
not saved to Supabase. OpenStreetMap tiles require an internet connection and
retain attribution. Leaflet CSS, image assets, and license are bundled locally.

## Payments and offline behavior

The web sponsor-payment route uses the existing QPay checkout. iOS native QPay
remains disabled. Inspecting the checkout does not create an invoice; invoice
creation requires an explicit payment action. No live invoice is needed for
the offline tests.

The service worker caches only the public offline page and logo. It does not
cache auth responses, listing data, API calls or payments. Offline navigation
shows a connection message, not stale purchase or payment confirmations.

Android/Chrome can show the install prompt when the browser considers the app
eligible. iPhone users can use Safari > Share > Add to Home Screen. Hosting must
use HTTPS. Browser storage and login are separate from the native app; changing
the website origin may require users to sign in and install the PWA again.
