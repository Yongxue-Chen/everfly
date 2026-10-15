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
assert.match(source, /color: completed \? '#697386' : '#e07a5f'/);
assert.match(source, /dashArray: completed \? null : '8 6'/);
console.log('Profile route status: 17 checks passed');

const removed = [];
const map = { removeLayer: layer => removed.push(layer) };
const layerContext = vm.createContext({
    State: { map },
    L: { tileLayer: (url, options) => ({ url, options, addTo() { return this; } }) }
});
vm.runInContext(source.slice(source.indexOf('function setMapLayer('), source.indexOf('function getVisibleWorldLongitudeOffsets(')), layerContext);
layerContext.setMapLayer('map');
const standard = layerContext.State.profileBaseLayer;
assert.equal(standard.options.className, 'profile-neutral-basemap');
assert.ok(standard.options.attribution.includes('OpenStreetMap'));
layerContext.setMapLayer('satellite');
assert.equal(removed[0], standard);
assert.equal(layerContext.State.profileBaseLayer.options.className, undefined);
layerContext.setMapLayer('map');
assert.equal(removed.length, 2);
assert.equal(layerContext.State.profileBaseLayer.options.className, 'profile-neutral-basemap');
assert.ok(source.includes("fillColor: '#345d80'"));
const css = fs.readFileSync(path.join(__dirname, '../static/css/style.css'), 'utf8');
assert.ok(css.includes('#flight-map .profile-neutral-basemap { filter: grayscale(1)'));
console.log('Basemap switching and palette: 8 checks passed');
