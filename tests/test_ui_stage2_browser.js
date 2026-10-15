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
        assert.equal(await page.locator('#journey-hero .journey-eyebrow').first().textContent(),'Flight overview');
        assert.deepEqual(await page.locator('#journey-metrics .journey-metric > span').allTextContents(),['Distance','Flight time']);
        assert.equal(await page.locator('#journey-metrics .journey-metric').count(),2);
        assert.equal(await page.locator('#journey-hero .journey-overview-records #journey-highlights').count(),1);
        assert.equal(await page.locator('#journey-highlights .journey-highlight-card').count(),4);
        assert.equal(await page.locator('.journey-trends-panel').isVisible(),false);
        assert.equal(await page.locator('.journey-recent-flight').count(),2);
        await page.locator('[data-journey-tab="statistics"]').click();
        const trendSnapshot = () => page.evaluate(() => JSON.stringify({
            charts: ['yearComboChart','footprintGrowthChart','monthlyChart'].map(id => Chart.getChart(id).data),
            months: document.querySelector('.month-of-year-grid').innerHTML,
            heatmap: document.querySelector('.journey-heatmap-row > article').innerHTML
        }));
        const allTrends = await trendSnapshot();
        for (const year of ['all','2024','2099']) {
            await page.selectOption('#year-filter',year);
            for (const status of ['all','completed','pending']) {
                await page.selectOption('#journey-status-filter',status);
                assert.equal(await trendSnapshot(),allTrends,'All five trends must ignore year/status filters');
                assert.equal(await page.evaluate(()=>filterFlightsForInsight('year',2024,'all').length),1);
                assert.equal(await page.evaluate(()=>filterFlightsForInsight('month','2099-01','all').length),1);
                assert.equal(await page.evaluate(()=>filterFlightsForInsight('monthOfYear',1,'all').length),2);
            }
        }
        await page.selectOption('#year-filter','all');
        await page.selectOption('#journey-status-filter','all');
        assert.deepEqual(await page.locator('#journey-trends .stats-header').allTextContents(),[
            'Yearly rhythm', 'Footprint collection timeline',
            'Monthly flight heatmap (Contribution Graph)', 'Last twelve months', 'Month pattern'
        ]);
        assert.deepEqual(await page.locator('.journey-summary-panel > .journey-section-heading h2').allTextContents(),['Your flight profile']);
        assert.deepEqual(await page.locator('.journey-summary-panel .journey-summary-card > .stats-header').allTextContents(),[
            'Your aviation world', 'Flight Profile Insights'
        ]);
        assert.equal(await page.locator('.journey-summary-panel .journey-summary-card').count(),2);
        assert.equal(await page.locator('.journey-summary-panel #journey-highlights').count(),0);
        assert.equal(await page.locator('.journey-summary-panel #profile-stats-dashboard').count(),1);
        assert.equal(await page.locator('.journey-summary-panel #journey-profile-insights').count(),1);
        assert.equal(await page.locator('#journey-trends [data-journey-profile-card]').count(),0);
        assert.equal(await page.locator('#journey-profile-insights [data-journey-profile-card]').count(),0);
        assert.equal(await page.locator('#journey-profile-insights .preference-donut-box').count(),1);
        assert.ok(await page.evaluate(()=>Boolean(document.querySelector('.journey-summary-panel').compareDocumentPosition(document.querySelector('.journey-trends-panel')) & Node.DOCUMENT_POSITION_FOLLOWING)));
        for (const width of [1440,1024,768,576,390,320]) {
            await page.setViewportSize({width,height:844});
            await page.waitForTimeout(200);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
            assert.deepEqual(await page.locator('.map-controls').evaluate(el => {
                const s = getComputedStyle(el); return [s.backgroundColor,s.padding,s.boxShadow];
            }), ['rgba(0, 0, 0, 0)','0px','none']);
            assert.ok(await page.evaluate(()=>Chart.getChart('classDonutChart').width>0));
            const filterStyles = await page.evaluate(() => ['year-filter', 'journey-status-filter'].map(id => {
                const element = document.getElementById(id);
                const style = getComputedStyle(element);
                const option = getComputedStyle(element.options[0]);
                return {font: style.font, color: style.color, padding: style.padding, height: element.getBoundingClientRect().height, optionFont: option.font};
            }));
            assert.deepEqual(filterStyles[0], filterStyles[1], `Filter typography must match at ${width}px`);
            if (width <= 768) assert.ok(filterStyles[0].font.includes('16px'), 'Mobile selects need 16px text');
            const monthLayout = await page.evaluate(() => {
                const grid = document.querySelector('.month-of-year-grid');
                const original = grid.innerHTML;
                grid.outerHTML = renderMonthOfYearStats([{month:'2024-01',count:100}, {month:'2024-02',count:25}, {month:'2024-07',count:100}]);
                const updated = document.querySelector('.month-of-year-grid');
                const rect = el => { const r = el.getBoundingClientRect(); return {top:r.top,bottom:r.bottom}; };
                const result = [...updated.children].map(el => ({item:rect(el),bar:rect(el.querySelector('i')),count:rect(el.querySelector('strong')),label:rect(el.querySelector('.month-of-year-label'))}));
                updated.innerHTML = original;
                return result;
            });
            monthLayout.forEach(({item,bar,count,label}) => {
                assert.ok(count.bottom < bar.top, 'Count sits above its bar');
                assert.ok(count.top >= item.top, 'Maximum count fits inside chart');
                assert.ok(label.top > bar.bottom, 'Month sits below its bar');
            });
            assert.ok(monthLayout[0].count.top < monthLayout[1].count.top, 'Count follows bar height');
            if (width <= 768) assert.ok(monthLayout[6].item.top - monthLayout[0].item.bottom >= 28, 'Mobile rows have breathing room');
            if (width >= 1024) {
                assert.ok(await page.evaluate(()=>document.querySelector('.journey-filters').getBoundingClientRect().x > document.querySelector('.journey-hero-copy').getBoundingClientRect().x));
            }
        }
        await page.selectOption('#journey-status-filter','pending');
        assert.equal(await page.evaluate(()=>filterFlightsForInsight('missing','health').length),0);
        assert.equal(await page.locator('#journey-highlights .journey-highlight-card').count(),4);
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
        await page.evaluate(()=>navigateTo('flights'));
        await page.waitForFunction(()=>document.querySelectorAll('#flights-table tbody tr').length===2);
        assert.equal(await page.locator('#flight-health-filter span').textContent(),'Needs attention · 1');
        assert.equal(await page.locator('#flights-table tbody .flight-row-needs-attention').count(),1);
        assert.equal(await page.locator('#flights-table tbody .flight-health-warning').count(),1);
        await page.locator('#flight-health-filter').click();
        assert.equal(await page.locator('#flight-health-filter').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('#flights-table tbody tr').count(),1);
        assert.ok((await page.locator('#flights-table tbody tr').textContent()).includes('TEST1'));
        await page.locator('#flight-health-filter').click();
        assert.equal(await page.locator('#flights-table tbody tr').count(),2);
        await page.evaluate(()=>{ navigateTo('profile', false); history.replaceState({}, '', '/'); });
        await page.waitForFunction(()=>State.cache.stats?.totals.flights===0);
        empty = true;
        await page.reload({waitUntil:'networkidle'});
        await page.waitForFunction(()=>State.cache.stats?.totals.flights===0);
        await page.locator('[data-journey-tab="statistics"]').click();
        assert.equal(await page.locator('.donut-sample-count').last().textContent(),'No data available');
        assert.deepEqual(errors,[]);
        console.log('Stage 2 browser checks passed: six widths, tabs, scope, charts, map, metric switch, empty data.');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
