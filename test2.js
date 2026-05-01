const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => {
    return {
      hasCanvas: !!document.getElementById('particle-canvas'),
      wrapperClasses: document.getElementById('chat-wrapper').className,
      canvasDisplay: document.getElementById('particle-canvas').style.display
    };
  });
  console.log('DOM Data:', data);
  await browser.close();
})();
