import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, webkit, AxeBuilder } from './libraries.mjs';

const exportRoot = resolve('dist');
const artifactRoot = resolve('artifacts');
await mkdir(artifactRoot, { recursive: true });
const report = { target: 'dist/ at /preview/', browsers: [], checks: [], limitations: [] };
const failures = [];
const record = async (name, fn) => {
  try { const evidence = await fn(); report.checks.push({ name, passed: true, evidence }); }
  catch (error) { failures.push(name); report.checks.push({ name, passed: false, error: String(error.message).slice(0, 2000) }); }
};

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith('/preview/')) { response.writeHead(404).end(); return; }
    const suffix = decodeURIComponent(path.slice('/preview/'.length)) || 'index.html';
    const file = resolve(exportRoot, suffix);
    if (!file.startsWith(exportRoot + sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(file);
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/preview/`;
const ids = ['N', 'R', 'U', 'P', 'E', 'H', 'S'];
const A = { N: '10', R: '2', U: '0.5', P: '2', E: '5', H: '8', S: '40' };
const zero = Object.fromEntries(ids.map(id => [id, '0']));
const readResults = async page => page.locator('#valid-results [data-value]').evaluateAll(elements => Object.fromEntries(elements.map(element => [element.id.replace('result-', ''), element.textContent])));
const setValues = async (page, values) => { for (const [id, value] of Object.entries(values)) await page.locator(`#${id}`).fill(value); };
const noOverflow = page => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
const expectNoOverflow = async page => { const sizes = await noOverflow(page); assert.ok(sizes.content <= sizes.viewport, JSON.stringify(sizes)); return sizes; };

try {
  for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    let browser;
    try { browser = await browserType.launch({ headless: true }); }
    catch (error) {
      if (engine === 'chromium') throw error;
      report.limitations.push('WebKit could not launch because required host shared libraries are unavailable. No Safari or physical iOS claim is made.');
      report.browsers.push({ engine, available: false });
      continue;
    }
    report.browsers.push({ engine, available: true, version: browser.version() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [], external = [], requests = [], missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) missing.push(new URL(response.url()).pathname); });
    await context.route('**/*', async route => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      if (requestUrl.origin !== origin) { external.push(requestUrl.origin); return route.abort(); }
      requests.push({ path: requestUrl.pathname, method: request.method() });
      await route.continue();
    });
    const check = (name, fn) => record(`${engine}: ${name}`, fn);
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);

      await check('A: default example, all six requested outputs', async () => {
        const r = await readResults(page);
        assert.deepEqual(r, { profit: '15.00', total: '25.00', revenue: '40.00', executions: '12', imd: '6', imdCost: '12.00', other: '5.00', human: '8.00', breakEven: '25.00' });
        assert.equal(await page.locator('#profit-status').innerText(), '盈利');
        return r;
      });
      await check('B: editing S immediately changes profit to −5.00 and status to 亏损', async () => {
        await page.locator('#S').fill('20');
        const r = await readResults(page);
        assert.equal(r.total, '25.00'); assert.equal(r.profit, '−5.00');
        assert.equal(await page.locator('#profit-status').innerText(), '亏损');
        assert.equal(await page.locator('#result-panel').getAttribute('data-state'), 'loss');
        return r;
      });
      await check('C: clear writes zero to all fields and outputs; balanced, no errors', async () => {
        await page.getByRole('button', { name: '清空', exact: true }).click();
        for (const id of ids) assert.equal(await page.locator(`#${id}`).inputValue(), '0');
        const r = await readResults(page);
        for (const [key, value] of Object.entries(r)) assert.equal(value, ['executions', 'imd'].includes(key) ? '0' : '0.00');
        assert.equal(await page.locator('#profit-status').innerText(), '盈亏平衡');
        assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
        return r;
      });
      await check('Load example restores all fields and correct results', async () => {
        await page.getByRole('button', { name: '载入示例' }).click();
        for (const id of ids) assert.equal(await page.locator(`#${id}`).inputValue(), A[id]);
        assert.equal((await readResults(page)).profit, '15.00');
      });
      await check('Batch retry semantics and one-time extra costs', async () => {
        await page.locator('#R').fill('3');
        const r = await readResults(page);
        assert.equal(r.executions, '13'); assert.equal(r.imd, '6.5'); assert.equal(r.total, '26.00');
        await setValues(page, { ...zero, E: '5', H: '8' });
        assert.equal((await readResults(page)).total, '13.00');
      });
      await check('Invalid input in every field suspends and clears result numbers, with associated Chinese errors', async () => {
        let combinations = 0;
        for (const id of ids) {
          await setValues(page, A);
          for (const bad of ['-1', '', 'abc', 'NaN', 'Infinity', '1e309']) {
            await page.locator(`#${id}`).fill(bad);
            assert.equal(await page.locator('#valid-results').isVisible(), false);
            assert.equal(await page.locator('#invalid-results').isVisible(), true);
            assert.equal(await page.locator(`#${id}`).getAttribute('aria-invalid'), 'true');
            assert.match(await page.locator(`#${id}`).getAttribute('aria-describedby'), new RegExp(`${id}-error`));
            assert.ok((await page.locator(`#${id}-error`).innerText()).length > 5);
            assert.equal(Object.values(await readResults(page)).every(value => value === ''), true);
            assert.doesNotMatch(await page.locator('#result-panel').innerText(), /NaN|Infinity|\$\s*[\d−]/);
            combinations++;
          }
          await page.locator(`#${id}`).fill(A[id]);
        }
        for (const id of ['N', 'R']) {
          await page.locator(`#${id}`).fill('1.5');
          assert.equal(await page.locator('#valid-results').isVisible(), false);
          await page.locator(`#${id}`).fill(A[id]);
        }
        assert.equal((await readResults(page)).profit, '15.00');
        return { invalidCombinations: combinations + 2, recovered: true };
      });
      await check('Error recovery button focuses first invalid field; clear recovers', async () => {
        await page.locator('#N').fill('-1');
        await page.locator('#S').fill('oops');
        await page.getByRole('button', { name: '前往修改' }).click();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'N');
        await page.getByRole('button', { name: '清空', exact: true }).click();
        assert.equal(await page.locator('#valid-results').isVisible(), true);
        assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
      });
      await check('Exact decimals, deferred rounding, tiny nonzero profit/IMD guidance', async () => {
        await setValues(page, { ...zero, E: '0.1', H: '0.2', S: '0.3' });
        assert.equal(await page.locator('#profit-status').innerText(), '盈亏平衡');
        await setValues(page, { ...zero, N: '1', U: '0.00000049', P: '100000000', S: '50' });
        const r = await readResults(page);
        assert.equal(r.imd, '0'); assert.equal(r.imdCost, '49.00'); assert.equal(r.profit, '1.00');
        assert.match(await page.locator('#precision-note').innerText(), /0.000001/);
        await setValues(page, { ...zero, E: '0.001' });
        assert.equal(await page.locator('#profit-status').innerText(), '亏损');
        assert.equal((await readResults(page)).profit, '0.00');
        assert.match(await page.locator('#precision-note').innerText(), /未舍入值/);
        await page.locator('#N').fill('9'.repeat(121));
        assert.match(await page.locator('#N-error').innerText(), /120/);
      });
      await check('Responsive layout at 320, 390, 768, 820, 1024 and 1440', async () => {
        await page.getByRole('button', { name: '载入示例' }).click();
        const measurements = [];
        for (const width of [320, 390, 768, 820, 1024, 1440]) {
          await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
          await page.evaluate(() => window.scrollTo(0, 0));
          measurements.push(await expectNoOverflow(page));
          if (width === 390) {
            for (const locator of [page.locator('h1'), page.locator('#N'), page.locator('#load-example')]) {
              const box = await locator.boundingBox();
              assert.ok(box.y >= 0 && box.y + box.height <= 844);
            }
            assert.ok(await page.locator('input').evaluateAll(inputs => inputs.every(input => parseFloat(getComputedStyle(input).fontSize) >= 16)));
            await page.screenshot({ path: `${artifactRoot}/mobile-390.png` });
            await page.screenshot({ path: `${artifactRoot}/mobile-390-full.png`, fullPage: true });
          }
          if (width === 1440) await page.screenshot({ path: `${artifactRoot}/desktop-1440.png`, fullPage: true });
        }
        return measurements;
      });
      await check('Long valid results remain visible without horizontal overflow at 320', async () => {
        await page.setViewportSize({ width: 320, height: 844 });
        await setValues(page, { ...A, N: '9'.repeat(120), U: '9'.repeat(120), P: '9'.repeat(120) });
        assert.equal(await page.locator('#valid-results').isVisible(), true);
        return await expectNoOverflow(page);
      });
      await check('200% text enlargement reflows at 390 (not native browser zoom)', async () => {
        await page.getByRole('button', { name: '载入示例' }).click();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
        const size = await expectNoOverflow(page);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        return size;
      });
      await check('Keyboard entry, buttons, skip link and visible focus styling', async () => {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
        await page.keyboard.press('Enter');
        await page.locator('#N').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'R');
        const tabOrder = ['U', 'P', 'E', 'H', 'S'];
        for (const id of tabOrder) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), id); }
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.type('20');
        assert.equal((await readResults(page)).profit, '−5.00');
        await page.locator('#clear').focus();
        await page.keyboard.press('Space');
        assert.equal((await readResults(page)).profit, '0.00');
        await page.locator('#load-example').focus();
        await page.keyboard.press('Enter');
        assert.equal((await readResults(page)).profit, '15.00');
        const focus = await page.locator('#load-example').evaluate(button => ({ style: getComputedStyle(button).outlineStyle, width: getComputedStyle(button).outlineWidth, color: getComputedStyle(button).outlineColor }));
        assert.equal(focus.style, 'solid'); assert.equal(focus.width, '3px');
        await page.screenshot({ path: `${artifactRoot}/keyboard-focus.png` });
        return { tabOrder: ['N', 'R', ...tabOrder], focus };
      });
      await check('Accessible labels, descriptions, result and error states: axe WCAG 2.2 AA', async () => {
        const violations = [];
        for (const state of ['profit', 'loss', 'balanced', 'invalid']) {
          await setValues(page, A);
          if (state === 'loss') await page.locator('#S').fill('20');
          if (state === 'balanced') await page.locator('#S').fill('25');
          if (state === 'invalid') await page.locator('#N').fill('-1');
          const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
          violations.push(...scan.violations.map(violation => ({ state, id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => node.target) })));
        }
        assert.deepEqual(violations, []);
        return { states: ['profit', 'loss', 'balanced', 'invalid'], violations: 0 };
      });
      await check('Reduced motion, forced colors, local font and metadata assets', async () => {
        await page.getByRole('button', { name: '载入示例' }).click();
        await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
        const motion = await page.locator('#load-example').evaluate(button => getComputedStyle(button).transitionDuration);
        assert.equal(motion, '0s');
        await page.emulateMedia({ forcedColors: 'none' });
        const resources = await page.evaluate(async () => {
          await document.fonts.ready;
          const image = document.querySelector('meta[property="og:image"]').content;
          const icon = document.querySelector('link[rel="icon"]').getAttribute('href');
          return { image: new URL(image, location.href).pathname, icon: new URL(icon, location.href).pathname, font: document.fonts.check('400 16px "IMD Chinese"', '任务成本') };
        });
        assert.equal(resources.font, true);
        for (const path of [resources.image, resources.icon]) assert.equal((await context.request.get(origin + path)).status(), 200);
        return { reducedMotionTransition: motion, ...resources };
      });
      await check('Rendered text, status, control boundaries and focus contrast', async () => {
        await page.locator('#N').focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        const measurements = await page.evaluate(() => {
          const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
          const luminance = value => rgb(value).map(channel => {
            channel /= 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
          const contrast = (first, second) => {
            const a = luminance(first), b = luminance(second);
            return Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 100) / 100;
          };
          const set = (id, value) => { const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
          const measure = (selector, property = 'color', threshold = 4.5) => {
            const element = document.querySelector(selector), style = getComputedStyle(element);
            let ancestor = element, background = style.backgroundColor;
            while (background === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) {
              ancestor = ancestor.parentElement;
              background = getComputedStyle(ancestor).backgroundColor;
            }
            return { selector, property, foreground: style[property], background, ratio: contrast(style[property], background), threshold };
          };
          set('N', '10'); set('S', '40');
          const pairs = ['h1', '.hint', '.button-primary', '.result-description', '.profit-amount', '.status-badge'].map(selector => measure(selector));
          pairs.push(measure('#N', 'borderTopColor', 3), measure('#clear', 'borderTopColor', 3));
          pairs.push(measure('#N', 'outlineColor', 3));
          set('S', '20'); pairs.push({ ...measure('.status-badge'), state: 'loss' });
          set('S', '25'); pairs.push({ ...measure('.status-badge'), state: 'balanced' });
          set('N', '-1'); pairs.push(measure('#N-error'));
          set('N', '10'); set('S', '40');
          return pairs;
        });
        for (const measurement of measurements) assert.ok(measurement.ratio >= measurement.threshold, JSON.stringify(measurement));
        return measurements;
      });
      await check('Refresh restores fictional A; no storage, upload, third-party request or missing resource', async () => {
        await page.locator('#S').fill('99');
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await page.locator('#S').inputValue(), '40');
        const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie }));
        assert.deepEqual(storage, { local: 0, session: 0, cookies: '' });
        assert.deepEqual(external, []);
        assert.deepEqual(errors, []);
        assert.deepEqual(missing, []);
        assert.ok(requests.every(request => request.method === 'GET' && request.path.startsWith('/preview/')));
        return { storage, externalRequests: external.length, consoleErrors: errors.length, missingResources: missing.length, resources: [...new Set(requests.map(request => request.path))] };
      });
      await check('JavaScript-disabled view does not show fabricated results', async () => {
        const noJsContext = await browser.newContext({ javaScriptEnabled: false });
        const noJs = await noJsContext.newPage();
        try {
          await noJs.goto(url);
          assert.equal(await noJs.locator('#valid-results').isVisible(), false);
          assert.match(await noJs.locator('noscript').innerText(), /请启用 JavaScript/);
        } finally { await noJsContext.close(); }
      });
    } finally { await context.close(); await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  await writeFile(`${artifactRoot}/browser-results.json`, JSON.stringify(report, null, 2) + '\n');
}
for (const check of report.checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}${check.error ? `\n${check.error}` : ''}`);
for (const limitation of report.limitations) console.log(`LIMITATION ${limitation}`);
console.log(`${report.checks.length - failures.length}/${report.checks.length} checks passed.`);
process.exitCode = failures.length ? 1 : 0;
