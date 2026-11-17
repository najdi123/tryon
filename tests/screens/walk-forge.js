// A viewer who gets hold of an admin's open form must still be refused by the server.
//   ADMIN_PW=.. VIEWER_PW=.. node walk-forge.js <base>
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const base = process.argv[2];
const R = {};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const login = async (u, p) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fa-IR" });
    const page = await ctx.newPage();
    await page.goto(`${base}/admin/login`);
    await page.fill("#username", u); await page.fill("#password", p);
    await page.click("button[type=submit]");
    await page.waitForLoadState("networkidle");
    return { ctx, page };
  };
  const viewer = await login("at-walk-viewer", process.env.VIEWER_PW);
  const admin = await login("at-walk-admin", process.env.ADMIN_PW);
  R.bothIn = viewer.page.url().endsWith("/admin") && admin.page.url().endsWith("/admin");
  const viewerCookie = (await viewer.ctx.cookies()).find((c) => c.name === "ar_admin");
  // the admin opens the forms, then the session behind the browser becomes the viewer's
  await admin.page.goto(`${base}/admin/galleries/new`);
  await admin.page.fill("#g-name", "ساخته با فرم دیگری"); await admin.page.fill("#g-pid", "FORGE-1");
  await admin.page.selectOption("#g-prov", "گیلان"); await admin.page.fill("#g-city", "رشت");
  await admin.ctx.clearCookies();
  await admin.ctx.addCookies([viewerCookie]);
  await admin.page.click("button:has-text('ذخیره')");
  await admin.page.waitForLoadState("networkidle"); await admin.page.waitForTimeout(1500);
  R.viewerSubmitRefused = admin.page.url().includes("denied=1");
  await admin.ctx.clearCookies();
  await admin.page.goto(`${base}/admin/login`);
  // with no session at all, the same submit goes to the login
  const anon = await login("at-walk-admin", process.env.ADMIN_PW);
  await anon.page.goto(`${base}/admin/galleries/new`);
  await anon.page.fill("#g-name", "بدون ورود"); await anon.page.fill("#g-pid", "FORGE-2");
  await anon.page.selectOption("#g-prov", "گیلان"); await anon.page.fill("#g-city", "رشت");
  await anon.ctx.clearCookies();
  await anon.page.click("button:has-text('ذخیره')");
  await anon.page.waitForLoadState("networkidle"); await anon.page.waitForTimeout(1500);
  R.signedOutSubmitRefused = anon.page.url().endsWith("/admin/login");
  // five wrong passwords lock the name from this address
  const lock = await browser.newContext({ locale: "fa-IR" });
  const lp = await lock.newPage();
  for (let i = 0; i < 6; i++) {
    await lp.goto(`${base}/admin/login`);
    await lp.fill("#username", "at-walk-viewer"); await lp.fill("#password", "wrong-password-" + i);
    await lp.click("button[type=submit]"); await lp.waitForLoadState("networkidle"); await lp.waitForTimeout(300);
  }
  R.lockedAfterFiveWrong = await lp.locator("[role=alert]").filter({ hasText: /دقیقه|بعد|قفل|تلاش/ }).count() > 0;
  R.lockText = (await lp.locator("form [role=alert]").allInnerTexts()).join(" | ");
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch((e) => { console.log(JSON.stringify(R, null, 1)); console.error("WALK FAILED", e.message.slice(0, 400)); process.exit(1); });
