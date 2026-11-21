// The in-page camera, with Chrome's fake camera: opens, shoots, cancels, and explains a refusal.
//   node walk-camera.js <base> <out dir>
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "D:/tmp/darb-sandbox/node_modules/playwright-core");
const [,, base, out] = process.argv;
const R = {};
const UA = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  const open = async (permissions) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fa-IR", userAgent: UA, permissions });
    const page = await ctx.newPage();
    if (process.env.CATALOG_FILE) {
      const body = require("fs").readFileSync(process.env.CATALOG_FILE, "utf8");
      await page.route("**/api/catalog", (r) => r.fulfill({ status: 200, contentType: "application/json", body }));
      await page.route("**/api/events", (r) => r.abort());
    }
    await page.goto(base, { waitUntil: "networkidle" });
    await page.click("text=رنگ موی اویستر");
    await page.waitForSelector("text=عکس خودت رو انتخاب کن");
    return page;
  };
  const visible = (page, t) => page.locator(`text=${t}`).first().isVisible();

  const page = await open(["camera"]);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.click("text=گرفتن سلفی");
  await page.waitForSelector("button:has-text('عکس بگیر'):not([disabled])", { timeout: 15000 });
  R.liveViewShown = await page.locator("video").isVisible();
  R.videoPlaying = await page.evaluate(() => { const v = document.querySelector("video"); return v.videoWidth > 0 && !v.paused; });
  R.noOverflow = !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  R.shootInFirstView = await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("عکس بگیر")).getBoundingClientRect().bottom <= 760);
  await page.screenshot({ path: `${out}/c-01-live.png` });
  await page.click("text=انصراف");
  R.cancelReturns = (await visible(page, "گرفتن سلفی")) && (await page.locator("video").count()) === 0;
  await page.click("text=گرفتن سلفی");
  await page.waitForSelector("button:has-text('عکس بگیر'):not([disabled])", { timeout: 15000 });
  await page.click("button:has-text('عکس بگیر')");
  await page.waitForFunction(() => !document.querySelector("video"), null, { timeout: 10000 });
  // Chrome's fake camera shows a test pattern with no hair: the photo check must answer either way.
  R.shotHandled = await Promise.race([
    page.waitForSelector("img[alt='عکس شما']", { timeout: 60000 }).then(() => "accepted"),
    page.waitForSelector("[role=alert]:has-text('مو در عکس مشخص نیست')", { timeout: 60000 }).then(() => "refused: no hair"),
    page.waitForSelector("[role=alert]:has-text('عکس')", { timeout: 60000 }).then(() => "refused: other"),
  ]).catch(() => "nothing");
  await page.screenshot({ path: `${out}/c-02-after-shot.png` });
  R.pageErrors = errors;

  // camera refused by the customer
  const denied = await open([]);
  await denied.context().clearPermissions();
  await denied.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("no", "NotAllowedError")); });
  await denied.click("text=گرفتن سلفی");
  R.refusalExplained = await denied.waitForSelector("text=اجازه دوربین داده نشد", { timeout: 8000 }).then(() => true).catch(() => false);
  R.galleryStillOffered = await visible(denied, "انتخاب از گالری");
  await denied.screenshot({ path: `${out}/c-03-denied.png` });

  // a browser with no camera at all for pages (an in-app browser)
  const none = await open([]);
  await none.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("no", "NotFoundError")); });
  await none.click("text=گرفتن سلفی");
  R.unavailableExplained = await none.waitForSelector("text=دوربین در این برنامه باز نشد", { timeout: 8000 }).then(() => true).catch(() => false);

  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch((e) => { console.log(JSON.stringify(R, null, 1)); console.error("WALK FAILED", e.message.slice(0, 400)); process.exit(1); });
