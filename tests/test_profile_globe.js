const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'static/js/app.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'templates/index.html'), 'utf8');

assert.match(template, /id="flight-globe" hidden/);
assert.match(template, /data-map-layer="globe"/);
assert.match(template, /maplibre-gl@5\.6\.0/);
assert.match(source, /projection: \{ type: 'globe' \}/);
assert.match(source, /typeof maplibregl\.supported === 'function' && !maplibregl\.supported\(\)/);

const routeSource = { data: null, setData(data) { this.data = data; } };
const airportSource = { data: null, setData(data) { this.data = data; } };
const jumps = [];
const globeMap = {
    getSource(id) {
        return id === 'profile-globe-routes' ? routeSource : airportSource;
    },
    jumpTo(options) { jumps.push(options); }
};
const context = vm.createContext({
    State: {
        globeMap,
        globeMapLoaded: true,
        profileMapSelectedYear: 'all',
        profileMapFlights: [
            {
                id: 1, done: true, date: '2026-01-02', flight_number: 'DONE1',
                origin: { code: 'MAN', name: 'Manchester', lat: 53.35, lon: -2.27 },
                dest: { code: 'PEK', name: 'Beijing Capital', lat: 40.08, lon: 116.58 }
            },
            {
                id: 2, done: false, date: '2026-12-20', flight_number: 'NEXT2',
                origin: { code: 'MAN', name: 'Manchester', lat: 53.35, lon: -2.27 },
                dest: { code: 'FRA', name: 'Frankfurt', lat: 50.04, lon: 8.56 }
            }
        ]
    },
    window: { innerWidth: 390 },
    ensureProfileGlobeLayers: () => {},
    isProfileFlightCompleted: flight => flight.done,
    getGeodesicPath: (lat1, lon1, lat2, lon2) => [[lat1, lon1], [lat2, lon2]],
    Date,
    Map
});

const helper = source.slice(
    source.indexOf('function refreshProfileGlobeLayers('),
    source.indexOf('function refreshProfileMapLayers(')
);
vm.runInContext(helper, context);
context.refreshProfileGlobeLayers({ resetCamera: true });

assert.equal(routeSource.data.features.length, 2);
assert.equal(routeSource.data.features[0].properties.completed, true);
assert.equal(routeSource.data.features[1].properties.completed, false);
assert.deepEqual(
    Array.from(routeSource.data.features[0].geometry.coordinates[0]),
    [-2.27, 53.35],
    'Globe GeoJSON coordinates must use longitude, latitude order'
);
assert.equal(airportSource.data.features.length, 3, 'Shared airports should be deduplicated');
assert.equal(jumps.length, 1);
assert.equal(jumps[0].zoom, 0.9, 'Mobile globe should start large but fully usable');

console.log('Profile globe checks passed: renderer, GeoJSON, status, airports and mobile camera.');
