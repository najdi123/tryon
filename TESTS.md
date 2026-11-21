# Test results and open items

Run on 17 November 2026 against commit `main` after the fix described below, on the test server,
with a separate test database (`ayeneh_test`) holding fixed test data. The real database was not
touched. Nothing here was tested on a real phone: see "Not tested".

## Summary

| Set | How | Result |
|---|---|---|
| Counting rules | `npm test` | 33 of 33 |
| Delivery tests on fixed data | `scripts/acceptance.ts` | 109 of 109, three runs in a row |
| Phone screens | `tests/screens/walk-accept.js`, Chrome at 393 × 852 and 320 × 568 | 25 of 25 |
| Access through the screen | `tests/screens/walk-forge.js` | 4 of 4 |
| The camera inside the page (21 November) | `tests/screens/walk-camera.js`, Chrome with its test camera | 9 of 9 |
| Staff panel walk (Phase 3) | browser walk of every panel page | 29 of 29 |

One fault was found by these tests and fixed: when several requests from one new browser arrived
at the same instant, two or three sessions could be opened instead of one (six requests opened
three). Visits could be over-counted; QR entries could not. The fix is in
`lib/analytics/session.ts`; the test now passes on every run.

## What the brief asked for, and what was checked

| The brief's item | What was checked | Result |
|---|---|---|
| QR to output | Opening a gallery's QR link starts one session for that gallery and counts one entry. Brand, photo, shade, try-on and save are all recorded in that session and credited to that gallery, with the shade stored under its own brand line. The visit appears in today's report. On the screen: QR link, brand, photo, shade, preview, save button ready. One real picture from the image service was made and shown. | pass |
| Back between steps without losing the choice | The app's back button and the browser's back and forward: the photo, the chosen shade and the finished preview are all still there. | pass |
| Camera permission and the gallery fallback | Since 21 November "Take a selfie" opens the front camera inside the page (the browser asks for permission) with a shutter and a cancel button; "Choose from gallery" opens the photo picker. A refused permission and a browser that gives pages no camera are each explained in Farsi with the gallery still offered. Before that date the button opened the phone's own camera, which the first real-phone test showed some browsers replace with the gallery. A file that is not a photo and a photo that cannot be read are each explained in Farsi, the customer cannot continue without a usable photo, and choosing from the gallery afterwards works. | pass (desk only) |
| No data | An empty catalogue and a catalogue that fails to load each show a Farsi message and a retry button; retry recovers. An empty report shows zeros and an empty-state line, not an error. | pass |
| Processing error | Image service failure, daily limit reached and no internet each show their own Farsi message, leave the customer able to try again, and do not lose earlier previews. Statistics being unreachable does not stop the customer. | pass |
| Phone layout | No sideways scrolling on any step at 393 px or 320 px wide. Every button and link is at least 44 px tall. No page errors. | pass |
| Duplicate events | The same event sent twice, or eight times at once, is stored once. Opening the QR link again is not a second entry. Six requests at once from a new browser open one session. One session cannot add more than 500 events. | pass |
| Tehran day boundary | A visit at 23:59:59 belongs to that day; one at 00:00:00 to the next. A visit that starts before midnight and succeeds after it stays whole in the day it started. The per-day table agrees. | pass |
| Card totals equal tables | For every filter set below: sessions, QR entries, successful try-ons and shade selections on the cards equal the sums of the province, gallery, shade, brand and day tables, and equal numbers worked out by hand from the fixed data. | pass |
| Filter combinations | None; province; a second province; unknown province; gallery; unknown origin; each brand line; province + brand; province + brand with no visits; gallery + brand; province + gallery + brand; sample mode. Staff visits, robots and sample galleries are left out of real reports. | pass |
| Brands with shared codes | The same code in two brand lines is two rows with separate counts. A brand filter counts only that line's shade. In the app, a preview made for a code in one line is not shown for the same code in another. | pass |
| Access without permission | With no login, a made-up cookie, an expired login or a switched-off user: every panel page goes to the login, and the Excel and QR files answer "not allowed". A viewer opens reports and Excel but not the catalogue, settings or new-gallery pages. A viewer or signed-out browser submitting an admin's open form is refused and nothing is saved. Five wrong passwords lock that name from that address for ten minutes. | pass |
| Excel equals the screen | For four filter sets, the shade and gallery files' rows are the rows on the screen, cell by cell, and their total lines equal the cards. The province file equals the report. The file states its date range, filters and time of making. A search and a status filter change the file as they change the screen. | pass |

Also checked, beyond the brief's list:

- A QR code that is unknown, revoked, malformed or belongs to a switched-off gallery opens the
  app as "unknown origin" and never credits a gallery, not even one the visitor scanned before.
- Search robots, link previews (Telegram), browser prefetch and image tags count nothing.
- A browser cannot report a successful try-on for a picture the server made, cannot name another
  gallery, cannot send free text (such as a phone number) in an event, and cannot count a product
  that is not a hair colour (correctors, lighteners).
- No photo is accepted without consent. The daily picture limit per browser holds.
- After 30 idle minutes a new session starts, keeps its gallery and counts no new QR entry;
  12 hours after the scan it becomes unknown origin.

## Not tested

- **A real phone.** The camera, saving the picture to the phone and the share sheet cannot be
  checked from a desk. This needs the app on its public address.
- **Real customers' photos.** Every test used two computer-made faces. Head scarves, hats, very
  short hair, grey hair and poor light are untried.
- **Load.** No stress test was run. Reports are fast at one month of sample data (about 1,000
  visits); a year-long range over millions of events will be slow.
- **The request limits in nginx.** The file is written (`deploy/nginx-zibarokh.conf`) and is
  applied at deployment; it has not yet run on the server.
- **Iran hosting.** Not planned in this version, as agreed. The image service is Google's and is
  reached from the server; a server inside Iran would need its own check of that connection.

## Open items

Waiting for the client:

| Item | Why it matters |
|---|---|
| Better colour values for the shades | Today's are estimates from the chart layout. The image model paints what it is sent, so this is the main limit on colour accuracy. Each shade's colour can be corrected in the panel. |
| A check of the Farsi shade names | 43 Bianca names and all Oyster names were written from the English. They are marked "not checked" in the panel's catalogue page. |
| Brand logos, box pictures, a before/after photo they own | Today's are stand-ins. |
| Who gets admin and viewer logins | One admin is created at deployment. |
| The 12-hour rule | A customer who returns after a 30-minute break is kept with their gallery for 12 hours from the scan and is not a new QR entry. The alternative is to count them as unknown origin. |

Not built in this version:

- The optional name, mobile and province form.
- Deleting old events after the retention period (the setting is stored, nothing deletes yet).
- A Persian date picker in the panel's custom range (dates are shown in the Persian calendar; the
  two date boxes use the browser's own picker).
- Keeping keyboard focus inside the bottom sheets.
- A daily roll-up for fast year-long reports.
- Live camera preview, hairstyles, highlight, ombre and balayage (the later phase).

Depends on others:

- **Google's image model.** `gemini-3.1-flash-lite-image` on a paid key. Its price and its life
  are Google's to change; the model name is a setting, and the service sits behind one small
  interface (`lib/engine`) so it can be replaced.
- **The on-device hair model** (MediaPipe) is served from the app's own address, not from a
  foreign CDN.
