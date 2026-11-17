# Ayeneh-rang (آینه‌رنگ)

A Farsi, phone-first hair colour try-on for Zibarokh Qeshm, with a staff panel that reports
usage per province, gallery, brand and shade.

- Customers scan a gallery's QR code, pick a brand, give a photo and try shades on it.
- Staff sign in at `/admin` to see the reports, register galleries, print QR codes, edit the
  catalogue and download Excel files.

`PLAN.md` holds the plan, the decisions and the counting rules. `TESTS.md` holds the test results
and the list of what is still open.

## What it needs

| Need | Version | Note |
|---|---|---|
| Node.js | 20 or newer | |
| PostgreSQL | 16 | one database and one role for the app |
| A process manager | pm2 | or any other that restarts the app |
| A web server | nginx | HTTPS is required: the cookies are HTTPS-only in production |
| A Google AI Studio key | paid | optional, see "The image service" below |

No Docker is used.

## Settings

Copy `.env.local.example` to `.env.local` and fill it in. The file is never committed.

| Name | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://USER:PASSWORD@127.0.0.1:5432/ayeneh` |
| `PUBLIC_BASE_URL` | yes, in production | The address customers open, no trailing slash. QR codes are printed with it. Without it the panel refuses to make a QR code. |
| `GEMINI_API_KEY` | no | Key for the image model. Without it, only shades close to the customer's own hair colour can be previewed (those are made on the phone). |
| `GEMINI_IMAGE_MODEL` | no | Default `gemini-3.1-flash-lite-image`. |
| `AI_TRYONS_PER_VISITOR_PER_DAY` | no | Default 30. Pictures one browser may ask the image service for in 24 hours. |
| `AI_TRYONS_SITE_PER_DAY` | no | Default 2000. The same for the whole site: this is the real ceiling on cost. |

## First install

```bash
# 1. the database (as the postgres user)
createuser --pwprompt ayeneh
createdb -O ayeneh ayeneh

# 2. the code
git clone https://github.com/najdi123/tryon.git ayeneh && cd ayeneh
cp .env.local.example .env.local      # then fill it in
npm ci                                # also builds the database client and the on-device model files

# 3. tables and catalogue
npm run db:deploy                     # creates the tables
npm run db:seed                       # loads the three shade charts (243 shades); safe to run again

# 4. the first staff user. The password is written to a file, never shown.
npx tsx scripts/create-admin.ts <username> "<name shown in the panel>" ADMIN
cat panel-password-<username>.txt     # give it to the person, then delete the file

# 5. build and run
npm run build
pm2 start "npx next start -p 3008" --name ayeneh
pm2 save
```

Then put nginx in front: `deploy/nginx-zibarokh.conf` is the site file used on the test server.
Change the server name and certificate paths. It sets the request limits the app relies on:

| Address | Limit per visitor address | Why |
|---|---|---|
| `/api/events` | 10 a second, bursts of 60 | usage statistics |
| `/api/tryon` | 30 a minute, bursts of 20, uploads up to 3 MB | each call costs money |
| `POST /admin/login` | 10 a minute, bursts of 5 | password guessing |

It also passes the visitor's real address to the app and drops any address the browser claims;
the staff login's lock depends on that.

## Updating

```bash
git pull
npm ci
npm run db:deploy
npm run build
pm2 restart ayeneh
```

## Sample data

Sample galleries are separate from real ones and are never mixed into real reports. The panel
shows them only in "sample mode".

```bash
npx tsx scripts/seed-demo.ts          # six sample galleries with about a month of made-up visits
```

It refuses to touch a gallery that is not marked as sample. Running it again replaces the sample
visits. Real galleries are added by an admin in the panel (Galleries, New gallery).

## Staff users

- Roles: an **admin** can change everything; a **viewer** sees reports and downloads Excel files.
- Admins add users and reset passwords in the panel (Settings).
- From the server: `npx tsx scripts/create-admin.ts <username> "<name>" [ADMIN|VIEWER]` creates a
  user or resets a password, and signs that user out everywhere.

## The image service

- Shades close to the customer's own hair colour are made on the phone. The photo is not sent
  anywhere.
- Other shades need Google's image model. The customer is asked first; the photo is sent for that
  one picture and is not stored by the app.
- Every picture that comes back is measured on the phone against the shade's colour. If it is
  off, it is corrected slightly or asked for once more; if it is still off, the customer is told
  the preview could not be made. Nothing off-colour is shown as a result.
- A free-tier key makes no pictures. Use a paid key.

## Checks

```bash
npm test                              # 33 rule tests, no database needed
npx tsc --noEmit
npx tsx scripts/report-check.ts       # read-only: cards, tables and Excel totals agree
```

The delivery tests run on a **separate test database** and a copy of the app started on it. They
wipe visits and galleries, so the script refuses any database whose name does not end in `_test`.

```bash
createdb -O ayeneh ayeneh_test
export DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/ayeneh_test
npm run db:deploy && npm run db:seed
npx next start -p 3019 &              # the app on the test database
npx tsx scripts/acceptance.ts http://127.0.0.1:3019
```

The phone-screen tests are in `tests/screens` and drive Chrome with `playwright-core`. See
`TESTS.md` for what each set covers and the latest results.

## Where things are

| Path | What |
|---|---|
| `app/page.tsx`, `components/ayeneh` | the customer's three screens |
| `app/q/[token]` | the address a QR code opens |
| `app/api` | session, events, catalogue, try-on |
| `app/admin`, `components/admin` | the staff panel |
| `lib/analytics` | the counting rules |
| `lib/reports` | the report queries and the Excel file |
| `lib/colour`, `lib/client` | the colour check and the on-phone preview |
| `lib/engine` | the image service, behind one small interface so it can be replaced |
| `data/catalog-official.json` | the shade charts |
| `prisma` | the tables |
