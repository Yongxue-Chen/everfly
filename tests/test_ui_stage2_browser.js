// PLAYWRIGHT_MODULE=/path/to/playwright node tests/test_ui_stage2_browser.js
// Synthetic fixtures only; no production account or database access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = [
    { id: 1, date: '2024-01-01', flight_number: 'TEST1', origin_code: 'AAA', dest_code: 'BBB', origin_airport_id: 1, dest_airport_id: 2, origin_city_id: 1, dest_city_id: 2, distance: 1000, duration_scheduled: 120, seat_type: 'Window', flight_class: 'Economy', std: '2024-01-01 10:00', origin: {lat: 40,lon: 10}, dest: {lat: 50,lon: 20} },
    { id: 2, date: '2099-01-01', flight_number: 'TEST2', distance: 9000, seat_number: '1A', origin: {}, dest: {} }
];
(async () => {
    const browser = await chromium.launch({args:['--no-sandbox']});
    try {
        const page = await browser.newPage({viewport:{width:390,height:844}});
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        let empty = false;
        const template = fs.readFileSync(path.join(root,'templates/index.html'),'utf8').replace(/{{ user\| tojson \| safe }}/, '{"id":1,"username":"UI Test"}').replace('{{ csrf_token() }}','test');
        await page.route('http://ui.test/**', async route => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname === '/') return route.fulfill({contentType:'text/html',body:template});
            if (pathname.startsWith('/static/')) return route.fulfill({contentType:pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'image/png',body:fs.readFileSync(path.join(root,pathname))});
            const data = pathname === '/api/flights/detailed' ? (empty ? [] : fixture) : pathname === '/api/cities' ? [{id:1,name:'A',country:'China',country_code:'CN'},{id:2,name:'B',country:'UK',country_code:'GB'}] : [];
            assert.equal(route.request().method(),'GET','UI tests must not write data');
            return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
        });
        await page.goto('http://ui.test/',{waitUntil:'networkidle'});
        await page.waitForFunction(()=>State.journeyFlights?.length===2);
        assert.equal(await page.inputValue('#year-filter'),'all');
        assert.equal(await page.inputValue('#journey-status-filter'),'all');
        assert.equal(await page.locator('#journey-hero #year-filter').count(),1);
        assert.equal(await page.locator('#journey-hero #journey-status-filter').count(),1);
        assert.equal(await page.locator('.journey-trends-panel').isVisible(),false);
        assert.equal(await page.locator('.journey-recent-flight').count(),2);
        await page.locator('[data-journey-tab="statistics"]').click();
        for (const width of [1440,1024,768,576,390,320]) {
            await page.setViewportSize({width,height:844});
            await page.waitForTimeout(200);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
            assert.ok(await page.evaluate(()=>Chart.getChart('classDonutChart').width>0));
            if (width >= 1024) {
                assert.ok(await page.evaluate(()=>document.querySelector('.journey-filters').getBoundingClientRect().x > document.querySelector('.journey-hero-copy').getBoundingClientRect().x));
            }
        }
        await page.selectOption('#journey-status-filter','pending');
        assert.equal(await page.evaluate(()=>filterFlightsForInsight('missing','health').length),0);
        assert.equal(await page.locator('.journey-highlight-card').last().locator('strong').textContent(),'All tidy');
        await page.selectOption('#journey-status-filter','all');
        assert.equal(await page.evaluate(()=>State.cache.stats.totals.flights),2);
        await page.selectOption('#year-filter','2099');
        assert.equal(await page.evaluate(()=>filterFlightsForInsight('all').length),1);
        assert.equal(await page.evaluate(()=>Chart.getChart('seatDonutChart').data.datasets[0].data[3]),1);
        await page.selectOption('#journey-status-filter','completed');
        assert.equal(await page.evaluate(()=>State.cache.stats.totals.flights),0);
        assert.equal(await page.locator('.donut-sample-count').first().textContent(),'No data available');
        await page.evaluate(()=>{
            window.originalFootprint = Chart.getChart('footprintGrowthChart');
            window.originalFootprintData = JSON.stringify(window.originalFootprint.data);
            window.originalFootprint.setDatasetVisibility(1,false);
            window.originalFootprint.update('none');
        });
        await page.selectOption('#journey-year-metric','distance');
        assert.ok(await page.evaluate(()=>Chart.getChart('footprintGrowthChart')===window.originalFootprint));
        assert.ok(await page.evaluate(()=>JSON.stringify(Chart.getChart('footprintGrowthChart').data)===window.originalFootprintData));
        assert.equal(await page.evaluate(()=>Chart.getChart('footprintGrowthChart').isDatasetVisible(1)),false);
        assert.equal(await page.evaluate(()=>Chart.getChart('yearComboChart').data.datasets[0].label),'Distance (km)');
        await page.locator('[data-journey-tab="overview"]').click();
        assert.equal(await page.evaluate(()=>State.profileMapFlights.length),0);
        await page.locator('[data-journey-tab="statistics"]').click();
        assert.equal(await page.inputValue('#year-filter'),'2099');
        assert.equal(await page.inputValue('#journey-year-metric'),'distance');
        empty = true;
        await page.reload({waitUntil:'networkidle'});
        await page.waitForFunction(()=>State.cache.stats?.totals.flights===0);
        await page.locator('[data-journey-tab="statistics"]').click();
        assert.equal(await page.locator('.donut-sample-count').last().textContent(),'No data available');
        assert.deepEqual(errors,[]);
        console.log('Stage 2 browser checks passed: six widths, tabs, scope, charts, map, metric switch, empty data.');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
