const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(1000);
  const data = await page.evaluate(() => {
    const c = document.getElementById('particle-canvas');
    if (!c) return 'no canvas';
    const rect = c.getBoundingClientRect();
    const wrapper = c.parentElement.getBoundingClientRect();
    return {
      cw: c.width,
      ch: c.height,
      rw: rect.width,
      rh: rect.height,
      ww: wrapper.width,
      wh: wrapper.height,
      display: c.style.display,
      zIndex: window.getComputedStyle(c).zIndex,
      opacity: c.style.opacity
    };
  });
  console.log('Canvas Data:', data);
  await browser.close();
})();
