const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('static/js/journey-stats.js', 'utf8'), context);
const flights = [
    { id: 1, date: '2024-01-01', origin_airport_id: 1, dest_airport_id: 2, origin_city_id: 1, dest_city_id: 2, origin_code: 'AAA', dest_code: 'BBB', distance: 1000, duration_actual: 0, duration_scheduled: 120, airline_id: 1, airline_name: 'Test', seat_number: '1A', seat_type: 'Aisle', std: '2024-01-01 10:00', atd: '2024-01-01 10:05', sta: '2024-01-01 12:00', ata: '2024-01-01 12:10' },
    { id: 2, date: '2025-01-01', origin_airport_id: 2, dest_airport_id: 3, origin_city_id: 2, dest_city_id: 3, origin_code: 'BBB', dest_code: 'CCC', distance: 8000, duration_scheduled: 600, seat_number: '2A' },
    { id: 3, date: '2099-01-01', distance: 99999, duration_scheduled: 9999 }
];
const cities = [{ id: 1, name: 'A', country: 'China', country_code: 'CN', continent: 'Asia' }, { id: 2, name: 'B', country: 'China', country_code: 'CN', continent: 'Asia' }, { id: 3, name: 'C', country: 'UK', country_code: 'GB', continent: 'Europe' }];
const completed = f => f.date < '2026-01-01';
const selected = context.selectJourneyFlights(flights, 'all', 'completed', completed);
assert.equal(selected.length, 2);
assert.equal(context.selectJourneyFlights(flights, '2099', 'completed', completed).length, 0);
assert.equal(context.selectJourneyFlights(flights, '2099', 'pending', completed).length, 1);
assert.equal(context.selectJourneyFlights(flights, 'all', 'all', completed).length, 3);
const before = JSON.stringify(flights);
const stats = context.aggregateJourneyStats(selected, cities);
assert.equal(stats.totals.distance, 9000);
assert.equal(stats.totals.duration, 600, 'Actual zero must not fall back to scheduled time');
assert.equal(stats.totals.airports, 3);
assert.equal(stats.totals.countries, 2);
assert.equal(stats.cumulative_airports_by_year[0].count, 2);
assert.equal(stats.cumulative_airports_by_year[1].count, 3);
assert.equal(stats.quality.on_time_performance.total_tracked, 1);
assert.equal(stats.quality.on_time_performance.on_time_rate, 100);
assert.equal(stats.distributions.route_distance_buckets.reduce((sum, b) => sum + b.count, 0), 2);
assert.equal(stats.records.longest_distance.id, 2);
assert.equal(context.journeySeatType(flights[0]), 'Aisle');
assert.equal(context.journeySeatType(flights[1]), 'Unknown', 'Do not infer placement from seat letters');
assert.equal(JSON.stringify(flights), before);
const empty = context.aggregateJourneyStats([], []);
assert.equal(empty.totals.flights, 0);
assert.equal(empty.quality.on_time_performance.on_time_rate, null);
assert.equal(empty.top.airports.length, 0);
const app = fs.readFileSync('static/js/app.js', 'utf8');
context.State = { journeyYear: '2024' };
vm.runInContext(app.slice(app.indexOf('function parseLocalMonth('), app.indexOf('function isLowCostAirline(')), context);
assert.equal(context.buildRecentTwelveMonths([{ month: '2099-01', count: 9 }])[11].month, '2024-12');
assert.equal(context.buildContinuousYears({ flights_by_year: [{ year: 2024 }] }).length, 1);
console.log('Journey scope checks passed: filtering, aggregates, cumulative totals, empty states, seats and month range.');
