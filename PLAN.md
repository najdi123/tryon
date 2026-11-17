# Ayeneh-rang: the plan and where it stands

Ayeneh-rang ("آینه‌رنگ") is a Farsi, phone-first web app for Zibarokh Qeshm. A customer scans a
gallery's QR code, picks a brand line, gives a photo, and sees hair colours on themselves before
buying. The company's staff panel reports usage by province, gallery, brand and shade.

The brief is two Word documents by Ali Shafiei (16 November 2026) with four reference pictures.
This file is the working plan: what was decided, what is built, what is left. It is updated when a
phase moves or a decision is made.

Last updated: 17 November 2026.

## Where things stand

| Phase | What | State |
|---|---|---|
| 0 | Setup, database, official catalogue | Done |
| 1 | QR links, sessions, events | Done, reviewed, fixes in |
| 2 | The three customer screens, the picture engine | Built, reviewed, fixes in; colour check being added |
| 3 | The staff panel, reports, Excel export | Not started |
| 4 | The brief's tests, then delivery to the test site | Not started |
| 5 | Later features (live camera, hairstyles, highlight, ombre, balayage) | After the base version |

The live site (zibarokh.rukhat.com) still serves the old app. Nothing new is deployed there.
A stopped test copy of the new code is on the server at `/root/qr-tryon-stage`, port 3018.

## Decisions

Made by Ali Najdi on 16 and 17 November 2026 unless marked otherwise.

- **The old project is extended, not replaced.** The brief asks for this.
- **Photos may go to the image service**, with a consent sheet before the first upload. Dark-enough
  shades are made on the phone and upload nothing.
- **Hosting stays on the current server.** Iran hosting is not being planned now.
- **Name, mobile and province are optional**, as the brief says. Not built yet.
- **Galleries and staff are added by the admin** in the panel. The app ships with one admin and
  sample galleries marked as sample.
- **The image model is `gemini-3.1-flash-lite-image`**, after the tests below. It replaces
  `gemini-2.5-flash-image`, which is deprecated.
- **Every preview is measured, not judged by an AI.** See "The colour check".
- **Formulas are never shown.** Mixing ratios, oxidant strengths and waiting times printed on the
  charts stay out of the app.
- **Open: the 12-hour gallery rule.** A customer who returns after a 30-minute break keeps their
  gallery for 12 hours from the scan and is not counted as a new QR entry. The alternative is
  "unknown origin". Waiting for Ali's answer.

## What is built

### The catalogue
- Read from photographs of the three printed colour charts: BiancaColor 110 shades, Oyster
  Perlacolor 92, Oyster Perlacolor No Ammonia 41. File: `data/catalog-official.json`.
- Correctors, mixtones, lighteners and toners are in the file but not offered for try-on.
- **Farsi names need checking against the paper:** 43 Bianca names were rebuilt from the English
  line, and every Oyster name is a translation (the Oyster charts have no Farsi).
- **Swatch colours are estimates** built from each shade's level and tone (`lib/catalog/hex.ts`).
  Measuring them from the phone photos proved unreliable (see the tests). Better values are owed.

### Counting (Phase 1)
- A gallery's QR opens `/q/<token>`. The server checks the token; the browser cannot claim a gallery.
- A session ends after 30 idle minutes. A refresh or a second scan inside that time is not a
  second entry. An unknown or switched-off QR is "unknown origin".
- Each event has a unique id and is stored once. Robots, link previews and signed-in staff are
  left out. An image tag or a prefetch pointing at a QR link counts nothing.
- No photo and no phone number is ever in a session or an event.

### The customer screens (Phase 2)
- Brand, photo, try colour, on one page; the phone's back button walks the steps and keeps choices.
- Photo checks: too small, too dark (judged by the brightest tenth of the picture), almost no hair
  visible. A fringe under a scarf is enough.
- Search by name or code in Persian or Latin digits, colour-family chips, before/after slider,
  saved picture labelled with brand and shade code, share, the safety note.
- Hairstyle change, highlight, ombre and balayage are shown disabled and marked "به‌زودی".
- The on-device model and the Farsi font are served by the site itself; nothing is fetched from a
  foreign host while a customer waits.
- Cost limits: 30 image-service pictures per browser per day and 2,000 for the whole site per day
  (both numbers are settings).

### The colour check
What happens to every picture the image service makes:

1. The phone measures the hair colour in the picture against the shade's colour.
2. **Close enough:** shown as it came.
3. **A bit off** (typically too dark): corrected on the phone by arithmetic on the hair pixels.
   No second picture, no extra cost, no second AI.
4. **Far off, or the hair did not change:** one new picture is requested, asking for a colour moved
   to compensate for the miss. One retry only.
5. **Still wrong:** the customer is told this shade could not be previewed on this photo.

A try-on counts as a success only when the phone kept the picture (steps 2, 3 or a good retry).
The rules and their numbers are in `lib/colour/judge.ts`, with tests.

## The model tests (17 November 2026)

One question: which model paints the colour it is asked for. Two computer-made faces (brown wavy
hair, black curly hair), four shades, each model run twice. Distance from the target colour is
measured in the hair; under about 3 is hard to see, over about 10 is plainly different.

| Shade | Lite | 3.1 | 2.5 (old) |
|---|---|---|---|
| Light gold 9/3 | 3 to 4 | 12 to 23 | 9 to 24 |
| Dark brown 4/0 | 3 to 4 | 2 to 10 | not run |
| Ash blond 8/1 | 3 to 4 | 19 to 26 | not run |
| Red 6/66 | 22 to 25 | 31 to 46 | not run |

- Lite repeated itself: two runs differed by under 2.5 on every shade.
- Lite took about 4 seconds a picture; the others 7 to 14.
- The old model changed the picture's proportions on a tall photo.
- Reds come out darker than asked on every model; the on-phone correction is for this case.
- Correcting a result that is far off blows out the highlights, and pasting the customer's own
  pixels back around the hair leaves a dark fringe. So the correction is kept small and never
  pastes back.

Limits of the tests: both faces are computer-made, and the target colours were approximate.
Pictures and scripts: `D:\tmp\ayeneh-exp` on Ali's PC.

Rough prices per picture from third-party lists (not Google's own page): Lite about $0.034,
2.5 about $0.039, 3.1 about $0.045 to $0.067.

## What is left

### Before the base version is done
- **Phase 3, the staff panel:** login with admin and viewer roles; overview with filters (time in
  Tehran days, province, gallery, brand); province, gallery and shade reports; gallery and QR
  management with QR download; settings and change log; Excel export equal to the screen.
- **Phase 4:** the tests the brief lists (QR to output, back navigation, duplicate events, Tehran
  day boundary, card totals equal tables, filter combinations, shared codes across lines,
  unauthorized access, Excel equals screen); a setup guide; deploy to the test site with an nginx
  rate limit on the events and try-on addresses.
- **A real phone test:** camera, saving the labelled picture, share. Not possible from a desk.
- **Real photos:** every test so far used computer-made faces.

### Owed by the client or Ali
- Better colour values for the shades (the brands' digital values, or the charts photographed flat
  in daylight beside a white sheet).
- A check of the Farsi shade names against the paper charts.
- Logos and box pictures for the three brand cards, and a before/after photo they own. Today's are
  stand-ins: wordmarks set in type, and a picture cropped from the client's own design mock.
- Who gets admin and viewer logins.

### Known gaps
- The optional name, mobile and province form is not built.
- Keyboard focus is not trapped inside the bottom sheets.
- Sample galleries are not marked as sample in the customer footer.
- The old model's exact shutdown date is unconfirmed; the app no longer depends on it.

## How it runs

- Code: `D:\web ali\shahab\qr-hair-color-tryon`, GitHub `najdi123/tryon`, branch `main`.
- Stack: Next.js 16, Tailwind 4, Prisma 7 on PostgreSQL 16. No Docker.
- Server: Servitro. Live app in `/root/qr-tryon` (pm2 `qr-tryon`, port 3008, nginx site
  `zibarokh-rukhat`). Database `ayeneh` on the same box. Secrets live only in `.env.local` there.
- Checks: `npm test` (rule tests), `npx tsc --noEmit`, `npx eslint`.
- After `npm install`: `npm run assets` puts the on-device model under `public/mediapipe`.
