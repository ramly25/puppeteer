const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

const PORT = 3000;
let browser, page;

// fill with chatgpt cookies
const cookies = [];

(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1366, height: 768 }
  });

  console.log('Puppeteer browser launched');

  page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  );

  await page.setCookie(...cookies);
  console.log('Cookies applied');

  await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });

  await page.waitForSelector('textarea');
  console.log('Ready for prompts');
})();

async function waitForStopButtonToDisappear(page) {
  try {
    await page.waitForSelector('button[aria-label="Stop streaming"]', { timeout: 5000 });

    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return !btns.some(b => b.getAttribute('aria-label') === "Stop streaming");
    }, { timeout: 30000 });

    console.log('Assistant finished generating response');
  } catch (e) {
    console.warn('Stop streaming button not detected or never disappeared');
  }
}

app.post('/ask', async (req, res) => {
  const prompt = req.body.prompt;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    await page.waitForSelector('textarea');

    await page.type('textarea', prompt, { delay: 30 });
    await page.keyboard.press('Enter');

    await waitForStopButtonToDisappear(page);

    const messages = await page.$$eval('div[data-message-author-role="assistant"]', els =>
      els.map(el => el.innerText.trim())
    );

    const answer = messages.at(-1);
    if (!answer) throw new Error('No assistant response found.');

    console.log('Assistant Response:\n', answer);
    res.json({ response: answer });

  } catch (err) {
    console.error('Failed to process prompt:', err);
    res.status(500).json({ error: 'Failed to get assistant response' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});