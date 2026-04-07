const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to http://localhost:3000');
  await page.goto('http://localhost:3000');
  await page.screenshot({ path: 'screenshot-1-home.png' });

  // Wait for page load
  await new Promise(r => setTimeout(r, 2000));
  
  // Find and click Login/Register or whatever button it is
  console.log('Checking for login/register links...');
  // Just dump the HTML to see what we have
  const html = await page.content();
  console.log('HTML length:', html.length);
  
  await browser.close();
})();
