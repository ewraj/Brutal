const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);
  const size = await page.evaluate(() => {
    const c = document.getElementById('particle-canvas');
    return c ? { w: c.width, h: c.height, sw: c.style.width, sh: c.style.height, d: c.style.display } : null;
  });
  console.log('Canvas:', size);
  await browser.close();
})();
