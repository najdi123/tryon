// The brief's screen tests, on a phone-sized browser: QR to output, back between steps, photo
// problems and the gallery fallback, no data, processing errors, phone layout.
//   node walk-accept.js <base> <qr token> <photo> <out dir> [ai]
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const fs = require("fs");
const [,, base, token, photo, out, withAi] = process.argv;
const R = {};
const UA = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const phone = (width, height) => browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fa-IR", userAgent: UA });
  const ctx = await phone(393, 852);
  const page = await ctx.newPage();
  global.__page = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png`, fullPage: true });
  const visible = (t) => page.locator(`text=${t}`).first().isVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  // The smallest height among the buttons and links a customer can tap on the screen now.
  const smallestTap = () => page.evaluate(() => Math.min(...[...document.querySelectorAll("button, a[href], label:has(input[type=search])")]
    .filter((el) => el.offsetParent !== null && !el.disabled).map((el) => Math.round(el.getBoundingClientRect().height))));
  const layout = {};
  const note = async (step) => { layout[step] = { overflow: await overflow(), smallestTap: await smallestTap() }; };
  const pickShade = async (code) => {
    await page.fill("input[type=search]", code);
    await page.waitForTimeout(300);
    await page.locator("ul button").first().click();
  };

  // ── no data, and a catalogue that fails to load ──
  await page.route("**/api/catalog", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lines: [], aiAvailable: false }) }));
  await page.goto(base, { waitUntil: "networkidle" });
  R.emptyCatalogSaysSo = (await visible("هنوز رنگی برای نمایش ثبت نشده است")) && (await visible("تلاش دوباره"));
  await shot("a-01-empty");
  await page.unroute("**/api/catalog");
  await page.route("**/api/catalog", (r) => r.fulfill({ status: 500, body: "x" }));
  await page.reload({ waitUntil: "networkidle" });
  R.failedCatalogSaysSo = (await visible("فهرست رنگ‌ها بارگذاری نشد")) && (await visible("تلاش دوباره"));
  await shot("a-02-catalog-error");
  await page.unroute("**/api/catalog");
  await page.click("text=تلاش دوباره");
  R.retryRecovers = await page.waitForSelector("text=برندت رو انتخاب کن", { timeout: 15000 }).then(() => true).catch(() => false);

  // ── QR to output; statistics unreachable must not stop the customer ──
  await page.route("**/api/events", (r) => r.abort());
  await page.goto(`${base}/q/${token}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=برندت رو انتخاب کن");
  R.galleryNamed = await visible("گالری آزمون یک");
  await note("brand");
  await shot("a-03-brand");
  await page.click("text=رنگ موی اویستر");
  await page.waitForSelector("text=عکس خودت رو انتخاب کن");
  await note("photo-empty");

  // ── photo: both ways offered, a bad file explained, the gallery still works ──
  R.cameraAndGalleryOffered = (await visible("گرفتن سلفی")) && (await visible("انتخاب از گالری"))
    && (await page.locator("input[type=file][capture=user]").count()) === 1 && (await page.locator("input[type=file]:not([capture])").count()) === 1;
  R.cannotContinueWithoutPhoto = await page.locator("button:has-text('ادامه به امتحان رنگ')").isDisabled();
  fs.writeFileSync(`${out}/not-a-photo.txt`, "this is not a photo");
  await page.setInputFiles("input[type=file]:not([capture])", `${out}/not-a-photo.txt`);
  await page.waitForTimeout(800);
  R.badFileExplained = await visible("این فایل عکس نیست");
  await shot("a-04-bad-file");
  fs.writeFileSync(`${out}/broken.jpg`, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]));
  await page.setInputFiles("input[type=file][capture=user]", `${out}/broken.jpg`);
  await page.waitForTimeout(1500);
  R.unreadablePhotoExplained = (await visible("عکس خوانده نشد")) && (await page.locator("button:has-text('ادامه به امتحان رنگ')").isDisabled());
  await page.setInputFiles("input[type=file]:not([capture])", photo); // the camera gave nothing usable: the gallery still works
  await page.waitForSelector("img[alt='عکس شما']", { timeout: 90000 });
  R.galleryFallbackWorks = !(await visible("عکس خوانده نشد")) && !(await visible("این فایل عکس نیست"));
  await note("photo-ready");
  await page.click("text=ادامه به امتحان رنگ");
  await page.waitForSelector("text=رنگ دلخواهت رو امتحان کن");
  await note("try-empty");
  // a shade close to the photo's own hair is made on the phone, with no upload and no consent
  let localCode = null;
  for (const code of ["3/0", "1/0", "4/0", "5/0"]) {
    await pickShade(code);
    await page.click("text=امتحان این رنگ");
    const asked = await page.waitForSelector("text=اجازه استفاده از عکس", { timeout: 2500 }).then(() => true).catch(() => false);
    if (!asked) { localCode = code; break; }
    await page.click("text=نه، نفرست"); await page.waitForTimeout(400);
  }
  R.localShade = localCode;
  await page.waitForSelector("text=ذخیره تصویر و کد رنگ");
  await page.waitForTimeout(800);
  R.outputReadyWithStatisticsDown = (await page.locator("button:has-text('ذخیره تصویر و کد رنگ')").isEnabled()) && (await visible("پیش‌نمایش رنگ"));
  await note("try-result");
  await shot("a-05-result");
  await page.unroute("**/api/events");

  // ── back and forward between the steps keep every choice ──
  await page.locator("[aria-label='بازگشت']").click(); await page.waitForTimeout(500);
  R.backButtonToPhotoKeepsPhoto = (await visible("عکس خودت رو انتخاب کن")) && (await page.locator("img[alt='عکس شما']").isVisible());
  await page.goBack(); await page.waitForTimeout(500);
  R.browserBackToBrand = await visible("برندت رو انتخاب کن");
  await page.goForward(); await page.waitForTimeout(500);
  R.forwardKeepsPhoto = await page.locator("img[alt='عکس شما']").isVisible();
  await page.goForward(); await page.waitForTimeout(600);
  R.forwardKeepsShadeAndPreview = (await visible("رنگ دلخواهت رو امتحان کن")) && (await visible("ذخیره تصویر و کد رنگ"));
  await page.goBack(); await page.waitForTimeout(400);
  await page.click("text=ادامه به امتحان رنگ"); await page.waitForTimeout(500);
  R.continueAgainKeepsPreview = await visible("ذخیره تصویر و کد رنگ");

  // ── processing errors ──
  let uploads = 0;
  const consentAndSend = async () => {
    await page.click("text=امتحان این رنگ");
    if (await page.waitForSelector("text=اجازه استفاده از عکس", { timeout: 2500 }).then(() => true).catch(() => false)) await page.click("text=موافقم، بفرست");
  };
  await page.route("**/api/tryon", (r) => { uploads += 1; return r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "failed" }) }); });
  await pickShade("10/0");
  await consentAndSend();
  R.serviceErrorExplained = await page.waitForSelector("text=ساخت پیش‌نمایش ناموفق بود", { timeout: 20000 }).then(() => true).catch(() => false);
  R.errorLeavesTryAgain = (await visible("امتحان این رنگ")) || (await visible("تلاش دوباره"));
  await shot("a-06-service-error");
  await page.unroute("**/api/tryon");
  await page.route("**/api/tryon", (r) => { uploads += 1; return r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "daily_limit" }) }); });
  await consentAndSend();
  R.dailyLimitExplained = await page.waitForSelector("text=به سقف پیش‌نمایش رسیده‌اید", { timeout: 20000 }).then(() => true).catch(() => false);
  await page.unroute("**/api/tryon");
  await page.route("**/api/tryon", (r) => { uploads += 1; return r.abort(); });
  await consentAndSend();
  R.offlineExplained = await page.waitForSelector("text=اینترنت قطع است", { timeout: 20000 }).then(() => true).catch(() => false);
  await shot("a-07-offline");
  await page.unroute("**/api/tryon");
  await pickShade(localCode); await page.waitForTimeout(400);
  R.earlierPreviewSurvivesErrors = await visible("ذخیره تصویر و کد رنگ");
  R.errorAttempts = uploads;

  // ── one real picture from the image service, end to end ──
  if (withAi === "ai") {
    await pickShade("9/3");
    await consentAndSend();
    R.aiOutcomeShown = await Promise.race([
      page.waitForSelector("text=ذخیره تصویر و کد رنگ", { timeout: 120000 }).then(() => "preview"),
      page.waitForSelector("text=به رنگ واقعی نزدیک نشد", { timeout: 120000 }).then(() => "honest refusal"),
    ]).catch(() => "nothing");
    await page.waitForTimeout(1500);
    await shot("a-08-ai");
  }

  // ── a narrow phone ──
  const small = await (await phone(320, 568)).newPage();
  await small.goto(base, { waitUntil: "networkidle" });
  await small.waitForSelector("text=برندت رو انتخاب کن");
  R.narrowPhoneNoOverflow = !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await small.screenshot({ path: `${out}/a-09-320.png`, fullPage: true });
  R.layout = layout;
  R.noOverflowAnywhere = Object.values(layout).every((l) => !l.overflow);
  R.tapTargetsAtLeast44 = Object.values(layout).every((l) => l.smallestTap >= 44);
  R.pageErrors = errors;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch(async (e) => { try { await global.__page.screenshot({ path: `${out}/a-fail.png`, fullPage: true }); } catch { /* no page yet */ } console.log(JSON.stringify(R, null, 1)); console.error("WALK FAILED", e.message.slice(0, 500)); process.exit(1); });
