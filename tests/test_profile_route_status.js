const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../static/js/app.js'), 'utf8');
const helper = source.slice(source.indexOf('function isProfileFlightCompleted('), source.indexOf('function refreshProfileMapLayers('));
const context = vm.createContext({ Intl, Date });
vm.runInContext(helper, context);
const completed = context.isProfileFlightCompleted;
const now = new Date('2027-01-02T00:00:00Z');
const flight = { date: '2027-01-02', dest_timezone: 'Asia/Shanghai' };
assert.equal(completed({ ...flight, sta: '2027-01-02 07:59:00' }, now), true);
assert.equal(completed({ ...flight, sta: '2027-01-02 08:01:00' }, now), false);
assert.equal(completed({ ...flight, sta: '2027-01-02 08:00:00' }, now), true);
assert.equal(completed({ ...flight, ata: '2027-01-02 09:00:00', sta: '2027-01-02 07:00:00' }, now), false);
assert.equal(completed({ ...flight, ata: '2027-01-02 07:00:00', sta: '2027-01-02 09:00:00' }, now), true);
assert.equal(completed({ ...flight, sta: '07:30' }, now), true);
assert.equal(completed({ ...flight, sta: '2027-01-02T01:00:00+02:00' }, now), true);
assert.equal(completed({ ...flight, sta: '2027-01-02T01:00:00Z' }, now), false);
assert.equal(completed(flight, now), false);
assert.equal(completed({ ...flight, date: '2027-01-01' }, now), true);
assert.equal(completed({ ...flight, date: '2027-01-03' }, now), false);
assert.equal(completed({}, now), false);
assert.equal(completed({ ...flight, dest_timezone: 'Invalid', sta: '2027-01-02 01:00:00' }, now), false);
assert.equal(completed({ ...flight, dest_timezone: 'America/New_York', sta: '2027-01-01 20:00:00' }, now), false);
assert.equal(completed({ ...flight, dest_timezone: 'Europe/London', sta: '2027-07-01 13:00:00' }, new Date('2027-07-01T12:00:00Z')), true);
assert.match(source, /color: completed \? palette.completed : palette.pending/);
assert.match(source, /dashArray: completed \? null : '8 6'/);
console.log('Profile route status: 17 checks passed');

const removed = [];
const map = { removeLayer: layer => removed.push(layer) };
const layerContext = vm.createContext({
    State: { map },
    document: { querySelector: () => null },
    refreshProfileMapLayers: () => {},
    L: { tileLayer: (url, options) => ({ url, options, addTo() { return this; } }) }
});
vm.runInContext(source.slice(source.indexOf('function getProfileMapPalette('), source.indexOf('function getVisibleWorldLongitudeOffsets(')), layerContext);
layerContext.setMapLayer('map');
const standard = layerContext.State.profileBaseLayer;
assert.equal(standard.options.className, undefined);
assert.equal(standard.url, 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
assert.ok(standard.options.attribution.includes('OpenStreetMap'));
layerContext.setMapLayer('satellite');
assert.equal(removed[0], standard);
assert.equal(layerContext.State.profileBaseLayer.options.className, undefined);
layerContext.setMapLayer('map');
assert.equal(removed.length, 2);
assert.equal(layerContext.State.profileBaseLayer.options.className, undefined);
assert.ok(source.includes('fillColor: palette.airport'));
const css = fs.readFileSync(path.join(__dirname, '../static/css/style.css'), 'utf8');
assert.ok(!css.includes('profile-neutral-basemap'));
console.log('Basemap switching and palette: 9 checks passed');
assert.equal(layerContext.getProfileMapPalette().completed, '#8792a2');
layerContext.setMapLayer('satellite');
assert.equal(layerContext.State.profileMapType, 'satellite');
assert.equal(layerContext.getProfileMapPalette().completed, '#cbd5e1');
assert.equal(layerContext.getProfileMapPalette().pending, '#ff997c');
assert.equal(layerContext.getProfileMapPalette().airport, '#ffffff');
assert.equal(layerContext.getProfileMapPalette().border, '#17212b');
layerContext.setMapLayer('map');
assert.equal(layerContext.getProfileMapPalette().airport, '#345d80');
assert.equal(layerContext.getProfileMapPalette().pending, '#e07a5f');
console.log('Adaptive satellite colors: 8 checks passed');

// Exercise the actual redraw path, including removal of satellite outlines.
const drawn = [];
function fakeLayer(kind, options) {
    const layer = { kind, options, removed: false, bindPopup(html) { this.popup = html; return this; },
        addTo() { drawn.push(this); return this; }, remove() { this.removed = true; } };
    return layer;
}
Object.assign(layerContext, {
    console: { log() {} },
    getVisibleWorldLongitudeOffsets: () => [0],
    getGeodesicPath: () => [[0, 0], [10, 10]],
    shiftPathLongitude: points => points,
    escapeHtml: value => value,
    isProfileFlightCompleted: flight => flight.done
});
layerContext.L.polyline = (_, options) => fakeLayer('line', options);
layerContext.L.circleMarker = (_, options) => fakeLayer('marker', options);
layerContext.State.profileMapSelectedYear = 'all';
layerContext.State.profileMapFlights = [true, false].map(done => ({
    done, flight_number: 'TEST', date: '2026-01-01',
    origin: { code: 'AAA', lat: 0, lon: 0 }, dest: { code: 'BBB', lat: 10, lon: 10 }
}));
vm.runInContext(source.slice(source.indexOf('function refreshProfileMapLayers('), source.indexOf('// --- Stage 2 Features:')), layerContext);
layerContext.setMapLayer('satellite');
assert.equal(drawn.filter(l => l.kind === 'line').length, 4);
assert.equal(drawn[0].options.interactive, false);
assert.equal(drawn[1].options.color, '#cbd5e1');
assert.equal(drawn[3].options.color, '#ff997c');
assert.equal(drawn[3].options.dashArray, '8 6');
assert.equal(drawn[4].options.fillColor, '#ffffff');
const previous = drawn.slice();
drawn.length = 0;
layerContext.setMapLayer('map');
assert.ok(previous.every(l => l.removed));
assert.equal(drawn.filter(l => l.kind === 'line').length, 2);
assert.equal(drawn[0].options.color, '#8792a2');
assert.equal(drawn[1].options.color, '#e07a5f');
assert.equal(drawn[2].options.fillColor, '#345d80');
console.log('Route redraw and outline cleanup: 11 checks passed');
const repeat = layerContext.State.profileMapFlights[0];
layerContext.State.profileMapFlights.push({ ...repeat, flight_number: 'REPEAT' });
layerContext.State.profileMapFlights.push({ ...repeat, flight_number: 'RETURN', origin: repeat.dest, dest: repeat.origin });
drawn.length = 0;
layerContext.setMapLayer('map');
assert.equal(drawn.filter(l => l.kind === 'line').length, 4);
assert.ok(drawn[1].popup.includes('REPEAT'));
assert.ok(drawn[2].popup.includes('RETURN'));
assert.ok(drawn[2].popup.includes('BBB -> AAA'));
assert.equal(drawn[0].options.opacity, 0.55);
drawn.length = 0;
layerContext.setMapLayer('satellite');
assert.equal(drawn.filter(l => l.kind === 'line').length, 8);
assert.equal(drawn[1].options.color, '#cbd5e1');
console.log('Repeated and return routes: 7 checks passed');
layerContext.getGeodesicPath = (a, b, c, d) => [[a, b], [c, d]];
layerContext.L.polyline = (points, options) => Object.assign(fakeLayer('line', options), { points });
const pending = { ...repeat, done: false, flight_number: 'MH003' };
layerContext.State.profileMapFlights = [pending, { ...pending, flight_number: 'MH004', origin: pending.dest, dest: pending.origin }];
for (const type of ['map', 'satellite']) {
    drawn.length = 0;
    layerContext.setMapLayer(type);
    const routes = drawn.filter(l => l.kind === 'line' && l.options.interactive !== false);
    assert.equal(routes.length, 2);
    assert.deepEqual(routes[0].points, routes[1].points, 'Return-flight dashes must have identical path direction');
    assert.ok(routes.every(l=>l.options.dashArray === '8 6'));
}
assert.equal(completed({date:'2026-11-29',sta:'2026-11-30 07:15:00',dest_timezone:'Asia/Kuala_Lumpur'},new Date('2026-10-15T12:00:00Z')),false);
console.log('Pending round-trip dash alignment: 7 checks passed');
