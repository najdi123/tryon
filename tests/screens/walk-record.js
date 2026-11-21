// Recording, the retouch switch and a turned phone, on the stage copy.
//   node walk-record.js <base> <photo> <out dir> [retouch]
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "D:/tmp/darb-sandbox/node_modules/playwright-core");
const [,, base, photo, out, mode] = process.argv;
const R = {};
const UA = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fa-IR", userAgent: UA });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const records = [];
  page.on("response", (r) => { if (r.url().endsWith("/api/tryon/record")) records.push(r.status()); });
  const visible = (t) => page.locator(`text=${t}`).first().isVisible();
  const pickShade = async (code) => { await page.fill("input[type=search]", code); await page.waitForTimeout(300); await page.locator("ul button").first().click(); };
  const tryIt = async () => {
    await page.click("text=امتحان این رنگ");
    const asked = await page.waitForSelector("text=اجازه استفاده از عکس", { timeout: 2500 }).then(() => true).catch(() => false);
    if (asked) await page.click("text=موافقم، بفرست");
    return asked;
  };
  const outcome = () => Promise.race([
    page.waitForSelector("button:has-text('ذخیره تصویر و کد رنگ'):not([disabled])", { timeout: 150000 }).then(() => "preview"),
    page.waitForSelector("text=به رنگ واقعی نزدیک نشد", { timeout: 150000 }).then(() => "refused: colour off"),
    page.waitForSelector("text=ساخت پیش‌نمایش ناموفق بود", { timeout: 150000 }).then(() => "failed"),
  ]).catch(() => "nothing");

  await page.goto(base, { waitUntil: "networkidle" });
  await page.click("text=رنگ موی اویستر");
  await page.waitForSelector("text=عکس خودت رو انتخاب کن");
  await page.setInputFiles("input[type=file]:not([capture])", photo);
  await page.waitForSelector("img[alt='عکس شما']", { timeout: 90000 });
  await page.click("text=ادامه به امتحان رنگ");
  await page.waitForSelector("text=رنگ دلخواهت رو امتحان کن");

  if (mode === "retouch") {
    // With the switch on, even a shade the phone could make goes to the image service.
    await pickShade("3/0");
    R.retouchAsksConsent = await tryIt();
    R.retouchOutcome = await outcome();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/r-03-retouch.png`, fullPage: true });
  } else {
    await pickShade("3/0");
    R.localAskedConsent = await tryIt();
    R.localOutcome = await outcome();
    await pickShade("9/3");
    await tryIt();
    R.aiOutcome = await outcome();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/r-01-portrait.png` });

    // the phone turned on its side: same column, nothing lost
    await page.setViewportSize({ width: 852, height: 393 });
    await page.waitForTimeout(600);
    R.landscape = await page.evaluate(() => {
      const main = document.querySelector("main").getBoundingClientRect();
      return { columnWidth: Math.round(main.width), centred: Math.abs(main.left - (window.innerWidth - main.right)) < 2, overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    R.landscapeKeepsPreview = (await visible("ذخیره تصویر و کد رنگ")) || (await visible("به رنگ واقعی نزدیک نشد"));
    await page.screenshot({ path: `${out}/r-02-landscape.png` });
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForTimeout(400);
    R.backToPortraitKeepsPreview = (await visible("ذخیره تصویر و کد رنگ")) || (await visible("به رنگ واقعی نزدیک نشد"));
  }
  await page.waitForTimeout(3000);
  R.recordAnswers = records;
  R.pageErrors = errors;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch((e) => { console.log(JSON.stringify(R, null, 1)); console.error("WALK FAILED", e.message.slice(0, 400)); process.exit(1); });
