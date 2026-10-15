// Run with PLAYWRIGHT_MODULE=/path/to/playwright node tests/test_ui_stage1_browser.js
// Isolated chart rendering: no production data, credentials or write requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent(`<main class="journey-shell"><section class="journey-trends-panel"><div class="journey-trends"><article class="journey-chart-card journey-chart-wide"><div class="preference-donut-box">${[0, 1, 2, 3].map(i => `<div class="donut-chart-wrapper"><span class="donut-chart-title">Distribution ${i + 1}</span><div class="donut-canvas-container"><canvas id="test-${i}"></canvas></div></div>`).join('')}</div></article></div></section></main>`);
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'static/css/style.css'), 'utf8') });
        await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/chart.js' });
        const source = fs.readFileSync(path.join(root, 'static/js/app.js'), 'utf8');
        await page.evaluate(helper => {
            window.State = { journeyCharts: {} };
            (0, eval)(helper);
            const datasets = [[90, 10], [1, 2, 3], [1, 2, 3, 4, 5, 6], []];
            datasets.forEach((data, i) => renderJourneyChart(`test-${i}`, {
                type: 'doughnut',
                data: { labels: data.map((_, j) => i === 2 ? `Long label <img src=x> category ${j}` : `Category ${j}`), datasets: [{ data, backgroundColor: ['#1c70bf', '#00a0b5', '#6cae75'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {} } }
            }));
        }, source.slice(source.indexOf('function destroyJourneyChart('), source.indexOf('function renderMonthOfYearStats(')));
        for (const width of [1440, 1024, 768, 576, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(250);
            const dimensions = await page.evaluate(() => ({
                width: document.documentElement.scrollWidth,
                radii: [0, 1, 2].map(i => Chart.getChart(`test-${i}`).getDatasetMeta(0).data[0].outerRadius),
                legends: document.querySelectorAll('.donut-legend').length,
                images: document.querySelectorAll('.donut-legend img').length
            }));
            assert.ok(dimensions.width <= width, `Unexpected overflow at ${width}: ${dimensions.width}`);
            assert.equal(new Set(dimensions.radii).size, 1, `Unequal donut radii at ${width}`);
            assert.equal(dimensions.legends, 4);
            assert.equal(dimensions.images, 0, 'Labels must be text, never HTML');
        }
        assert.equal(await page.locator('.donut-sample-count').last().textContent(), 'No data available');
        const toggle = page.locator('.donut-legend-row').first();
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
        assert.equal(await page.evaluate(() => Chart.getChart('test-0').getDataVisibility(0)), false);
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
        assert.deepEqual(errors, []);
        console.log('Stage 1 browser checks passed: six widths, equal rings, empty data, long labels, escaping, legend toggles.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
