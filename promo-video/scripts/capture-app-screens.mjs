import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from 'playwright';
import sparticuzChromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const output = path.join(root, 'assets', 'screens');
const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:8081';
const viewport = { width: 390, height: 844 };

await mkdir(output, { recursive: true });

// In this Debian sandbox, include the runtime libraries shipped with the
// @sparticuz/chromium package (the regular browser download is unavailable).
const libArchive = path.resolve(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br');
await inflate(libArchive);
setupLambdaEnvironment('/tmp/al2023/lib');

const browser = await playwright.launch({
  headless: true,
  executablePath: await sparticuzChromium.executablePath(),
  args: [...sparticuzChromium.args, '--no-sandbox'],
  timeout: 120_000,
});
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 2,
  colorScheme: 'light',
  reducedMotion: 'reduce',
});
await context.route('https://example.supabase.co/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: '[]',
}));

const page = await context.newPage();
page.on('pageerror', error => console.error('[browser page error]', error.message));
page.on('console', message => {
  if (message.type() === 'error') console.error('[browser console error]', message.text());
});

async function capture(name, url, readyText) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByText(readyText, { exact: false }).first().waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(output, name), animations: 'disabled' });
  console.log(`Captured ${name} (${page.url()})`);
}

try {
  // This is the actual Expo Web login screen (unauthed context), rendered directly
  // by the React Native source. Its account instruction and blank form are app copy.
  await context.clearCookies();
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByText('Use the email address the school registered for you', { exact: false })
    .waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(output, 'login-light.png'), animations: 'disabled' });
  console.log('Captured login-light.png (actual Expo Web login screen)');

  // Authenticated routes use only source-owned screen layouts and static lesson
  // content. Record-backed pages remain their real empty states; no child or parent
  // record is present. This ephemeral local auth cache only passes Expo Router's
  // gate, while Supabase is pointed at an intercepted example host.
  await context.addInitScript(() => {
    localStorage.setItem('@mbk_auth_user', JSON.stringify({
      id: 'capture-only-parent',
      name: '',
      email: '',
      profileId: 'capture-only-parent',
      role: 'parent',
    }));
    localStorage.setItem('@mbk_theme', 'dark');
  });

  // Authenticated curriculum pages use real, source-defined lesson content only.
  await capture('learning-dark.png', `${baseUrl}/learning`, 'Learning');
  await capture('marks-empty-dark.png', `${baseUrl}/marks`, 'Marks');
  await capture('attendance-empty-dark.png', `${baseUrl}/attendance`, 'Attendance');
  await capture('homework-empty-dark.png', `${baseUrl}/homework`, 'Homework');
  await capture('messages-empty-dark.png', `${baseUrl}/messages`, 'Messages');
  await capture('more-empty-dark.png', `${baseUrl}/more`, 'More');
  await capture('lesson-intro-dark.png', `${baseUrl}/lesson/cnt_1?topicId=counting`, 'Count to 5');

  // Follow the real lesson flow: Start Lesson opens its source-authored concept
  // animation. Complete its taps, then capture the real first question (no injected
  // quiz results or progress are used).
  const startLesson = page.getByText('Start Lesson', { exact: true });
  if (await startLesson.isVisible()) {
    const emojiFontDir = path.join(root, 'assets', 'fonts');
    const emojiFace = async (file, unicodeRange) => {
      const bytes = await readFile(path.join(emojiFontDir, file));
      return `@font-face { font-family: 'Promo Noto Emoji'; src: url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2'); font-style: normal; font-weight: 400; font-display: block; unicode-range: ${unicodeRange}; }`;
    };
    const emojiCss = [
      await emojiFace('noto-color-emoji-6-400-normal.woff2', 'U+1F344-1F37F'),
      await emojiFace('noto-color-emoji-7-400-normal.woff2', 'U+2B50'),
      await emojiFace('noto-color-emoji-9-400-normal.woff2', 'U+261D,U+2665,U+2B50'),
      `.promo-emoji-text { font-family: 'Promo Noto Emoji', Inter, system-ui, sans-serif !important; }`,
    ].join('\n');
    await page.addStyleTag({ content: emojiCss });
    await page.evaluate(() => {
      const markEmojiText = () => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) {
          if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(node.textContent ?? '')) nodes.push(node);
        }
        for (const textNode of nodes) textNode.parentElement?.classList.add('promo-emoji-text');
      };
      markEmojiText();
      const observer = new MutationObserver(markEmojiText);
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      window.__promoEmojiObserver = observer;
    });
    await startLesson.click();
    await page.getByText('Tap each apple and count out loud', { exact: false })
      .waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, 'lesson-concept-dark.png'), animations: 'disabled' });
    console.log('Captured lesson-concept-dark.png (real in-app counting animation)');

    for (let i = 0; i < 3; i += 1) {
      await page.getByText('🍎', { exact: true }).nth(i).click();
      await page.waitForTimeout(160);
    }
    await page.getByText('Continue', { exact: true }).click();
    await page.getByText('Now count these stars', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 });
    for (let i = 0; i < 5; i += 1) {
      await page.getByText('⭐', { exact: true }).nth(i).click();
      await page.waitForTimeout(120);
    }
    await page.getByText('I get it!', { exact: true }).click();
    await page.getByText('Ready to count? Let us practice!', { exact: true }).click();
    await page.getByText('How many apples?', { exact: false }).waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, 'lesson-question-dark.png'), animations: 'disabled' });
    console.log('Captured lesson-question-dark.png (real in-app lesson question)');
  }
} finally {
  await browser.close();
}
