const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
    constructor() {
        this.children = [];
        this.style = {};
        this.attributes = {};
    }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { this.children.push(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
}

const source = fs.readFileSync(path.join(__dirname, '../static/js/app.js'), 'utf8');
let modal;
const context = vm.createContext({
    document: { createElement: () => new Element() },
    escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    formatCompactNumber: String,
    openModal: (title, render) => { modal = { title, content: render() }; }
});
vm.runInContext(source.slice(source.indexOf('const renderStatsDashboard ='),
    source.indexOf('function renderJourneyHero(')) +
    '\nthis.dashboard = renderStatsDashboard; this.showStats = showStatsModal;', context);

const stats = {
    totals: { airports: 2, airports_departure: 1, airports_arrival: 0 },
    top: {
        airports: [{ name: 'AAA', count: 3 }, { name: 'BBB', count: 2 }],
        airports_departure: [{ name: 'BBB', count: 2 }],
        airports_arrival: []
    },
    breakdowns: {}
};
const dashboard = new Element();
context.dashboard(stats, dashboard);
assert.equal(dashboard.children.length, 3);
const location = dashboard.children[0];
assert.equal((location.innerHTML.match(/class="aviation-world-rank"/g) || []).length, 4);
assert.ok(!location.innerHTML.includes('Departure Airports'));
assert.ok(!location.innerHTML.includes('Arrival Airports'));
location.onclick();
assert.equal(modal.title, 'Top Airports');
const [filters, summary, rows] = modal.content.children;
assert.equal(filters.children.length, 3);
assert.equal(summary.textContent, 'All airports · 2');
assert.equal(rows.children.length, 2);
assert.equal(filters.children[0].attributes['aria-pressed'], 'true');

filters.children[1].onclick();
assert.equal(summary.textContent, 'Departure airports · 1');
assert.equal(rows.children.length, 1);
assert.ok(rows.children[0].innerHTML.includes('BBB'));
assert.ok(rows.children[0].innerHTML.includes('width:100%'));
assert.equal(filters.children[0].attributes['aria-pressed'], 'false');
assert.equal(filters.children[1].attributes['aria-pressed'], 'true');

filters.children[2].onclick();
assert.equal(summary.textContent, 'Arrival airports · 0');
assert.equal(rows.children.length, 0);
assert.ok(rows.innerHTML.includes('No data available'));
filters.children[0].onclick();
assert.equal(rows.children.length, 2);
assert.ok(!rows.innerHTML.includes('No data available'));

location.onclick();
assert.equal(modal.content.children[1].textContent, 'All airports · 2');
context.showStats('Top Cities', [{ name: '<City>', count: 1 }]);
assert.equal(modal.content.children.length, 1);
assert.ok(modal.content.children[0].children[0].innerHTML.includes('&lt;City&gt;'));
context.showStats('Top Airlines', []);
assert.ok(modal.content.children[0].innerHTML.includes('No data available'));
console.log('Airport modal: dashboard, categories, counts, empty data, reset and other modals passed');
