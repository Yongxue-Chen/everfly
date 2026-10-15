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
            let data = [];
            if (pathname === '/api/flights/detailed') data = empty ? [] : fixture;
            else if (pathname === '/api/cities') data = [{id:1,name:'A',country:'China',country_code:'CN'},{id:2,name:'B',country:'UK',country_code:'GB'}];
            else if (pathname === '/api/entities/flights/1') data = {type:'flights',entity:{...fixture[0],airline_id:1,airline_name:'Test Air'},stats:{},related:{}};
            else if (pathname === '/api/entities/airports/1') data = {type:'airports',entity:{id:1,name:'Alpha Airport',iata_code:'AAA',icao_code:'AAAA',city_id:1,country:'China',timezone:'Asia/Shanghai',lat:40,lon:10},stats:{flights:1},related:{flights:[]}};
            assert.equal(route.request().method(),'GET','UI tests must not write data');
            return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
        });
        await page.goto('http://ui.test/',{waitUntil:'networkidle'});
        await page.waitForFunction(()=>State.journeyFlights?.length===2);
        assert.equal(await page.inputValue('#year-filter'),'all');
        assert.equal(await page.inputValue('#journey-status-filter'),'all');
        assert.equal(await page.locator('#journey-hero #year-filter').count(),1);
        assert.equal(await page.locator('#journey-hero #journey-status-filter').count(),1);
        assert.equal(await page.locator('.nav-item[data-view-nav="profile"]').getAttribute('href'),'/profile');
        assert.equal(await page.locator('.nav-item[data-view-nav="flights"]').getAttribute('href'),'/flights');
        assert.equal(await page.locator('.nav-item[data-view-nav="datasets"]').getAttribute('href'),'/library');
        assert.equal(await page.locator('.mobile-nav-item[data-mobile-view="flights"]').getAttribute('href'),'/flights');
        await page.locator('#settings-menu-button').click();
        assert.equal(await page.locator('#settings-menu-button').getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('#settings-menu [role="menuitem"]').count(),2);
        assert.equal(await page.locator('#settings-menu').getByText('Library',{exact:true}).count(),0);
        assert.equal(await page.locator('[role="dialog"]:not(#entity-panel)').count(),0,'Account button must not open profile modal');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#settings-menu-button').getAttribute('aria-expanded'),'false');
        assert.equal(await page.evaluate(()=>document.activeElement?.id),'settings-menu-button');
        await page.evaluate(()=>{ window.navigationSentinel = true; });
        await page.locator('.mobile-nav-item[data-mobile-view="flights"]').click();
        await page.waitForFunction(()=>State.currentView==='flights');
        assert.equal(new URL(page.url()).pathname,'/flights');
        assert.equal(await page.locator('.mobile-nav-item[data-mobile-view="flights"]').getAttribute('aria-current'),'page');
        assert.equal(await page.evaluate(()=>window.navigationSentinel),true,'Internal navigation must not reload the page');
        await page.goBack();
        await page.waitForFunction(()=>State.currentView==='profile');
        assert.equal(await page.locator('.mobile-nav-item[data-mobile-view="profile"]').getAttribute('aria-current'),'page');
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
            const overflow = await page.evaluate(() => ({
                page: document.documentElement.scrollWidth,
                viewport: innerWidth,
                elements: [...document.querySelectorAll('body *')].filter(element => {
                    const rect = element.getBoundingClientRect();
                    return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
                }).slice(0, 8).map(element => ({ className: element.className, id: element.id, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }))
            }));
            assert.ok(overflow.page<=overflow.viewport,`Overflow at ${width}: ${JSON.stringify(overflow.elements)}`);
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
        assert.equal(await page.locator('#flight-results-status').textContent(),'2 flights');
        await page.locator('#flight-search').fill('BBB');
        assert.equal(await page.locator('#flights-table tbody tr').count(),1);
        assert.ok((await page.locator('#flights-table tbody tr').textContent()).includes('TEST1'));
        assert.equal(await page.locator('#flight-results-status').textContent(),'1 of 2 flights');
        await page.locator('#flight-filter-reset').click();
        assert.equal(await page.locator('#flights-table tbody tr').count(),2);
        await page.locator('.mobile-nav-primary').focus();
        await page.evaluate(()=>openEntityPanel('flights',1));
        await page.waitForFunction(()=>State.entityPanelCurrent?.type==='flights');
        assert.equal(await page.locator('#entity-panel').getAttribute('role'),'dialog');
        assert.equal(await page.locator('#entity-panel').getAttribute('aria-modal'),'true');
        assert.equal(await page.locator('#entity-panel-back').isDisabled(),true);
        assert.equal(await page.evaluate(()=>document.activeElement?.id),'entity-panel');
        assert.ok(await page.locator('body').evaluate(element=>element.classList.contains('entity-panel-open')));
        assert.equal(await page.locator('.flight-hero-actions .action-label').textContent(),'Delete');
        await page.evaluate(()=>openEntityPanel('airports',1));
        await page.waitForFunction(()=>State.entityPanelCurrent?.type==='airports');
        assert.equal(await page.locator('#entity-panel-back').isEnabled(),true);
        assert.equal(await page.locator('.entity-field > span',{hasText:/^id$/i}).count(),0);
        const panelFocusable = page.locator('#entity-panel button:not([disabled]), #entity-panel a[href]');
        await panelFocusable.last().focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement?.id),'entity-panel-back');
        if (process.env.UI_SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.UI_SCREENSHOT_DIR,{recursive:true});
            for (const width of [1440,390]) {
                await page.setViewportSize({width,height:900});
                await page.evaluate(()=>document.querySelector('#entity-panel-body').scrollTop=0);
                assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Entity panel overflow at ${width}`);
                await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,`entity-panel-stage6-${width}.png`),fullPage:false});
            }
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#entity-panel').isHidden(),true);
        assert.ok(await page.evaluate(()=>document.activeElement?.classList.contains('mobile-nav-primary')));
        await page.selectOption('#flight-sort-select','date:asc');
        assert.ok((await page.locator('#flights-table tbody tr').first().textContent()).includes('TEST1'));
        await page.locator('.mobile-nav-primary').click();
        const dialog = page.locator('[role="dialog"]:not(#entity-panel)');
        assert.equal(await dialog.getAttribute('aria-modal'),'true');
        assert.equal(await dialog.locator('.modal-footer button').count(),2);
        assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('name')),'flight_number');
        assert.equal(await dialog.locator('[name="flight_number"]').getAttribute('required'),'');
        assert.equal(await dialog.locator('[name="date"]').getAttribute('required'),'');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[role="dialog"]:not(#entity-panel)').count(),0);
        assert.ok(await page.locator('.mobile-nav-primary').evaluate(element => element === document.activeElement));
        if (process.env.UI_SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.UI_SCREENSHOT_DIR,{recursive:true});
            for (const width of [1440,390]) {
                await page.setViewportSize({width,height:900});
                await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,`flights-stage4-${width}.png`),fullPage:true});
            }
        }
        assert.equal(await page.locator('#flight-health-filter span').textContent(),'Needs attention · 1');
        assert.equal(await page.locator('#flights-table tbody .flight-row-needs-attention').count(),1);
        assert.equal(await page.locator('#flights-table tbody .flight-health-warning').count(),1);
        await page.locator('#flight-health-filter').click();
        assert.equal(await page.locator('#flight-health-filter').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('#flights-table tbody tr').count(),1);
        assert.ok((await page.locator('#flights-table tbody tr').textContent()).includes('TEST1'));
        await page.locator('#flight-health-filter').click();
        assert.equal(await page.locator('#flights-table tbody tr').count(),2);
        await page.evaluate(()=>navigateTo('datasets'));
        await page.waitForFunction(()=>document.querySelectorAll('.library-overview-card').length===4);
        assert.equal(await page.locator('#view-datasets .tabs').count(),0);
        assert.equal(await page.locator('#view-datasets button:disabled').count(),0);
        assert.equal(await page.locator('#dataset-results-status').textContent(),'2 records');
        assert.equal(await page.locator('.library-overview-card[aria-pressed="true"]').count(),1);
        await page.locator('#dataset-search').fill('UK');
        assert.equal(await page.locator('#dataset-results-status').textContent(),'1 of 2 records');
        assert.equal(await page.locator('#dataset-table tbody tr').count(),1);
        await page.locator('#dataset-filter-reset').click();
        assert.equal(await page.locator('#dataset-table tbody tr').count(),2);
        await page.setViewportSize({width:1024,height:900});
        await page.locator('#dataset-table .data-sort-button').first().click();
        assert.equal(await page.locator('#dataset-table th').first().getAttribute('aria-sort'),'ascending');
        await page.locator('#btn-view-card').click();
        assert.equal(await page.locator('#btn-view-card').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('#dataset-cards .library-card').count(),2);
        await page.locator('#dataset-add-button').click();
        assert.equal(await page.locator('[role="dialog"]:not(#entity-panel) form.form-grid').count(),1);
        const cityName = page.locator('[role="dialog"]:not(#entity-panel) [name="name"]');
        assert.equal(await cityName.getAttribute('id'),await page.locator('[role="dialog"]:not(#entity-panel) label').first().getAttribute('for'));
        await page.keyboard.press('Escape');
        await page.evaluate(()=>showToast('Library feedback ready'));
        assert.equal(await page.locator('.app-toast').textContent(),'Library feedback ready');
        await page.locator('.library-overview-card[data-dataset-key="airports"]').click();
        await page.waitForFunction(()=>State.currentDataset==='airports' && document.querySelector('#dataset-table').getAttribute('aria-busy')==='false' && document.querySelector('#dataset-results-status').textContent==='0 records');
        const emptyLibrary = await page.evaluate(()=>({heading:document.querySelector('#dataset-empty-state h3').textContent,filter:State.filter,filters:State.libraryFilters,total:State.cache.airports.length}));
        assert.equal(emptyLibrary.heading,'No records yet',JSON.stringify(emptyLibrary));
        assert.equal(await page.locator('#dataset-add-button span').textContent(),'Add airport');
        await page.locator('.library-overview-card[data-dataset-key="cities"]').click();
        await page.waitForFunction(()=>State.currentDataset==='cities' && document.querySelector('#dataset-table').getAttribute('aria-busy')==='false');
        await page.evaluate(()=>document.querySelector('#toast-region')?.replaceChildren());
        if (process.env.UI_SCREENSHOT_DIR) fs.mkdirSync(process.env.UI_SCREENSHOT_DIR,{recursive:true});
        for (const width of [1440,390]) {
            await page.setViewportSize({width,height:900});
            await page.waitForTimeout(150);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Library overflow at ${width}`);
            if (width === 390) assert.equal(await page.locator('.library-card-actions').first().evaluate(element=>getComputedStyle(element).opacity),'1');
            if (process.env.UI_SCREENSHOT_DIR) {
                await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,`library-stage5-${width}.png`),fullPage:true});
            }
        }
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
