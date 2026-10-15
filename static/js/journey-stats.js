// Pure aggregation over the selected flights. Never mutate the source cache.
function selectJourneyFlights(flights, year, status, isCompleted) {
    return flights.filter(f => (year === 'all' || String(f.date || '').startsWith(year)) &&
        (status === 'all' || isCompleted(f) === (status === 'completed')));
}

function journeySeatType(flight) {
    const value = String(flight.seat_type || '').trim().toLowerCase();
    return ({ window: 'Window', aisle: 'Aisle', middle: 'Middle', '靠窗': 'Window', '靠过道': 'Aisle', '中间': 'Middle' })[value] || 'Unknown';
}

function journeyDayNight(flight) {
    const time = String(flight.atd || flight.std || '').match(/(?:^|[ T])(\d{2}):\d{2}/);
    if (!time || Number(time[1]) > 23) return 'Unknown';
    return Number(time[1]) >= 6 && Number(time[1]) < 18 ? 'Day' : 'Night';
}

function journeyMissingFields(flight, isCompleted) {
    const missing = [];
    const date = String(flight.date || '');
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) missing.push('date');
    if (!String(flight.flight_number || '').trim()) missing.push('flight_number');
    if (isCompleted(flight)) {
        if (!flight.aircraft_model_id) missing.push('aircraft');
        if (!flight.registration) missing.push('registration');
        if (!flight.atd || !flight.ata) missing.push('actual_times');
        if (!Number(flight.distance)) missing.push('distance');
    }
    return missing;
}

function aggregateJourneyStats(flights, cities, isCompleted = () => true) {
    const stats = { totals: { flights: flights.length }, top: {}, breakdowns: { alliance: Object.create(null), manufacturer: Object.create(null) },
        records: {}, distributions: {}, quality: {} };
    const cityMap = new Map(cities.map(c => [String(c.id), c]));
    const rankings = {};
    const add = (kind, id, name, extra) => {
        if (id === undefined || id === null || id === '') return;
        rankings[kind] ||= new Map();
        const item = rankings[kind].get(String(id)) || { name: name || 'Unknown', extra, count: 0 };
        item.count++;
        rankings[kind].set(String(id), item);
    };
    const years = new Map(), months = new Map(), cumulative = new Map();
    const seen = { airports: new Set(), cities: new Set(), countries: new Set() };
    const buckets = { '<500 km': 0, '500-1,499 km': 0, '1,500-3,999 km': 0, '4,000-6,999 km': 0, '7,000+ km': 0, Unknown: 0 };
    const dayNight = { Day: 0, Night: 0, Unknown: 0 };
    const departures = [], arrivals = [];
    const delay = (actual, scheduled) => {
        if (!actual || !scheduled) return null;
        // Compare local wall times in the same airport, independent of browser DST.
        const parse = s => /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(s) ? Date.parse(s.replace(' ', 'T').replace(/Z$/, '') + 'Z') : NaN;
        const result = (parse(actual) - parse(scheduled)) / 60000;
        return Number.isFinite(result) ? result : null;
    };
    let distance = 0, duration = 0;
    for (const f of [...flights].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))) {
        const km = Number(f.distance) || 0, minutes = Number(f.duration_actual ?? f.duration_scheduled) || 0;
        distance += km; duration += minutes;
        const year = String(f.date || '').slice(0, 4), month = String(f.date || '').slice(0, 7);
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(f.date || '');
        if (validDate) {
            const row = years.get(year) || { year: Number(year), count: 0, distance: 0, duration: 0 };
            row.count++; row.distance += km; row.duration += minutes; years.set(year, row);
            months.set(month, (months.get(month) || 0) + 1);
        }
        for (const side of ['origin', 'dest']) {
            const airport = f[`${side}_airport_id`], city = cityMap.get(String(f[`${side}_city_id`]));
            add('airports', airport, f[`${side}_code`], f[`${side}_name`]);
            add(side === 'origin' ? 'airports_departure' : 'airports_arrival', airport, f[`${side}_code`], f[`${side}_name`]);
            if (city) {
                add('cities', city.id, city.name, city.country_code);
                add('countries', city.country_code || city.country, city.country, city.country_code);
                add('continents', city.continent, city.continent);
            }
            if (validDate) {
                if (airport) seen.airports.add(airport);
                if (city) seen.cities.add(city.id);
                if (city?.country_code || city?.country) seen.countries.add(city.country_code || city.country);
            }
        }
        if (validDate) cumulative.set(year, Object.fromEntries(Object.entries(seen).map(([key, set]) => [key, set.size])));
        add('airlines', f.airline_id, f.airline_name, f.airline_alliance);
        add('aircraft', f.aircraft_model_id, f.aircraft_model, f.manufacturer);
        if (f.origin_code && f.dest_code) add('routes', `${f.origin_code}-${f.dest_code}`, `${f.origin_code}-${f.dest_code}`);
        for (const [kind, value] of [['alliance', f.airline_alliance], ['manufacturer', f.manufacturer]]) {
            if (value) stats.breakdowns[kind][value] = (stats.breakdowns[kind][value] || 0) + 1;
        }
        const record = { ...f, origin: f.origin_code, dest: f.dest_code, duration: minutes };
        if (km > Number(stats.records.longest_distance?.distance || 0)) stats.records.longest_distance = record;
        if (minutes > Number(stats.records.longest_duration?.duration || 0)) stats.records.longest_duration = record;
        const bucket = !km ? 'Unknown' : km < 500 ? '<500 km' : km < 1500 ? '500-1,499 km' : km < 4000 ? '1,500-3,999 km' : km < 7000 ? '4,000-6,999 km' : '7,000+ km';
        buckets[bucket]++;
        dayNight[journeyDayNight(f)]++;
        for (const field of journeyMissingFields(f, isCompleted)) {
            const key = `missing_${field}`;
            stats.quality[key] = (stats.quality[key] || 0) + 1;
        }
        const dep = delay(f.atd, f.std), arr = delay(f.ata, f.sta);
        if (dep !== null) departures.push(dep);
        if (arr !== null) arrivals.push(arr);
    }
    for (const key of ['airports', 'airports_departure', 'airports_arrival', 'cities', 'countries', 'continents', 'airlines', 'aircraft', 'routes']) {
        stats.top[key] = [...(rankings[key]?.values() || [])].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        stats.totals[key] = rankings[key]?.size || 0;
    }
    stats.totals.distance = distance; stats.totals.duration = duration;
    const route = stats.top.routes[0];
    if (route) stats.records.most_frequent_route = { route: route.name, count: route.count };
    const yearly = [...years.values()];
    stats.flights_by_year = yearly; stats.distance_by_year = yearly; stats.duration_by_year = yearly;
    stats.flights_by_month = [...months].map(([month, count]) => ({ month, count }));
    for (const key of Object.keys(seen)) stats[`cumulative_${key}_by_year`] = [...cumulative].map(([year, counts]) => ({ year: Number(year), count: counts[key] }));
    stats.distributions.route_distance_buckets = Object.entries(buckets).map(([name, count]) => ({ name, count }));
    stats.distributions.day_night = Object.entries(dayNight).map(([name, count]) => ({ name, count }));
    const average = values => values.length ? Math.round(values.reduce((sum, n) => sum + Math.max(0, n), 0) / values.length * 10) / 10 : 0;
    stats.quality.on_time_performance = { total_tracked: arrivals.length, on_time_rate: arrivals.length ? Math.round(arrivals.filter(n => n <= 15).length / arrivals.length * 1000) / 10 : null, avg_departure_delay: average(departures), avg_arrival_delay: average(arrivals) };
    return stats;
}
