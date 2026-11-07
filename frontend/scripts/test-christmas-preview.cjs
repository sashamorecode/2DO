const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = process.env.PREVIEW_URL || 'https://ubuntu.taila64df0.ts.net/christmas-wrap/';
    await page.goto(url, { waitUntil: 'networkidle' });
    const complete = title => page.getByRole('button', { name: 'Complete ' + title, exact: true }).click();
    const replay = async () => {
      await page.getByRole('button', { name: 'Replay', exact: true }).click();
      await page.waitForTimeout(250);
    };
    // Record actual layout on every frame, including the transition delay.
    await page.evaluate(() => {
      window.layoutTrace = [];
      const start = performance.now();
      function sample() {
        const row = document.querySelector('[data-testid="task-row-1"]').getBoundingClientRect();
        const group = document.querySelector('[data-testid="task-group-C"]').getBoundingClientRect();
        window.layoutTrace.push({ t: performance.now() - start, y: row.y, height: row.height, groupY: group.y, groupHeight: group.height });
        if (performance.now() - start < 1000) requestAnimationFrame(sample);
      }
      sample();
    });
    await complete('Pick up Christmas gifts');
    const sleigh = page.getByTestId('christmas-sleigh');
    await page.waitForTimeout(780);
    const a = await sleigh.boundingBox();
    await page.waitForTimeout(150);
    const b = await sleigh.boundingBox();
    assert.ok(b.x > a.x + 5, 'sleigh advances between arrival frames');
    await page.waitForTimeout(200);
    const trace = await page.evaluate(() => window.layoutTrace);
    const first = trace[0], last = trace.at(-1);
    assert.ok(first.y - last.y > 70, 'remaining row fills completed row space');
    assert.ok(trace.some(f => f.y < first.y - 10 && f.y > last.y + 10), 'row slides rather than jumping');
    assert.ok(trace.every(f => Math.abs(f.height - first.height) < 2), 'row does not stretch');
    assert.ok(trace.every(f => Math.abs(f.groupHeight - first.groupHeight) < 2), 'group heading does not stretch');
    assert.ok(trace.some(f => f.groupY < first.groupY - 10 && f.groupY > last.groupY + 10), 'following group moves smoothly');
    await page.waitForTimeout(1500);
    assert.equal(await sleigh.count(), 0, 'flight finishes within 2.6 seconds');
    // Removing the last task in a section also moves the following header.
    await complete('Send the Christmas cards');
    await page.waitForTimeout(800);
    assert.equal(await page.getByTestId('task-group-B').count(), 0);
    assert.ok((await page.getByTestId('task-group-C').boundingBox()).y < last.groupY - 80);
    await page.waitForTimeout(1900);
    await replay();
    // Existing keyboard reordering still works with the animated row wrappers.
    await page.getByRole('button', { name: 'Reorder Make time for a hot chocolate', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(750);
    assert.ok((await page.getByTestId('task-row-3').boundingBox()).y < (await page.getByTestId('task-row-2').boundingBox()).y);
    await replay();
    for (const title of ['Pick up Christmas gifts', 'Send the Christmas cards', 'Make time for a hot chocolate', 'Put up the fairy lights']) await complete(title);
    await page.waitForTimeout(2700);
    assert.ok((await page.locator('body').innerText()).includes('Done · 4'));
    assert.ok((await page.locator('body').innerText()).includes('All wrapped up'));
    assert.equal(await sleigh.count(), 0);
    // A fresh context applies the system preference before Reanimated initializes.
    const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const quiet = await reduced.newPage();
    quiet.on('pageerror', e => errors.push(e.message));
    await quiet.goto(url, { waitUntil: 'networkidle' });
    await quiet.getByRole('button', { name: 'Complete Pick up Christmas gifts', exact: true }).click();
    await quiet.waitForTimeout(200);
    assert.equal(await quiet.getByTestId('christmas-sleigh').count(), 0);
    assert.ok((await quiet.locator('body').innerText()).includes('Done · 1'));
    await reduced.close();
    await page.setViewportSize({ width: 1280, height: 900 });
    await replay();
    await complete('Make time for a hot chocolate');
    await page.waitForTimeout(1500);
    const desktop = await sleigh.boundingBox();
    assert.ok(desktop.x > 350 && desktop.x + desktop.width < 1000, 'centered desktop pickup');
    await page.waitForTimeout(1200);
    assert.equal(await sleigh.count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: snappy flight, smooth row/group movement without stretching, section removal, keyboard reorder, rapid completions, empty state, reduced motion and desktop alignment.');
  } finally { await browser.close(); }
})();
