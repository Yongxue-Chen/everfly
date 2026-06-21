
// --- Constants & Config ---
const API_BASE = '/api';

// Init User Info
if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    const avatar = document.getElementById('user-avatar-initial');
    const name = document.getElementById('user-display-name');
    if (avatar && CURRENT_USER.username) avatar.textContent = CURRENT_USER.username[0].toUpperCase();
    if (name && CURRENT_USER.username) name.textContent = CURRENT_USER.username;
}

const DATASETS = {
    cities: {
        label: 'Cities',
        endpoint: 'cities',
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'country', label: 'Country' },
            { key: 'country_code', label: 'Code' },
            { key: 'timezone', label: 'Timezone' },
            { key: 'continent', label: 'Continent' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'country', label: 'Country', type: 'text' },
            { key: 'country_code', label: 'Country Code', type: 'text', placeholder: 'e.g. US' },
            { key: 'timezone', label: 'Timezone', type: 'text' },
            { key: 'continent', label: 'Continent', type: 'text', placeholder: 'Auto-filled' }
        ]
    },
    airports: {
        label: 'Airports',
        endpoint: 'airports',
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'iata_code', label: 'IATA' },
            { key: 'icao_code', label: 'ICAO' },
            { key: 'city_id', label: 'City', type: 'lookup', lookup: 'cities', display: 'name' },
            { key: 'lat', label: 'Lat' },
            { key: 'lon', label: 'Lon' },
            { key: 'terminals', label: 'Terminals' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'iata_code', label: 'IATA Code', type: 'text' },
            { key: 'icao_code', label: 'ICAO Code', type: 'text' },
            { key: 'city_id', label: 'City', type: 'select', lookup: 'cities', display: 'name' },
            { key: 'lat', label: 'Latitude', type: 'number', step: 'any' },
            { key: 'lon', label: 'Longitude', type: 'number', step: 'any' },
            { key: 'terminals', label: 'Terminals (comma separated)', type: 'text', placeholder: 'e.g. T1, T2, T3' }
        ]
    },
    airlines: {
        label: 'Airlines',
        endpoint: 'airlines',
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'iata_code', label: 'IATA' },
            { key: 'icao_code', label: 'ICAO' },
            { key: 'frequent_flyer_program', label: 'FF Program' },
            { key: 'frequent_flyer_id', label: 'FF ID' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'iata_code', label: 'IATA Code', type: 'text', required: false },
            { key: 'icao_code', label: 'ICAO Code', type: 'text', required: false },
            { key: 'callsign', label: 'Callsign', type: 'text', required: false },
            { key: 'country', label: 'Country', type: 'text', required: false },
            { key: 'alliance', label: 'Alliance', type: 'text', required: false },
            { key: 'frequent_flyer_program', label: 'FF Program', type: 'text', required: false },
            { key: 'frequent_flyer_id', label: 'FF ID (Member No.)', type: 'text', required: false },
            { key: 'website_url', label: 'Website URL', type: 'text', required: false, placeholder: 'https://example.com' }
        ]
    },
    aircraft_models: {
        label: 'Aircraft',
        endpoint: 'aircraft_models',
        columns: [
            { key: 'manufacturer', label: 'Manufacturer' },
            { key: 'name', label: 'ID (Name)' },
            { key: 'model', label: 'Model' },
            { key: 'series', label: 'Series' },
            { key: 'subtype', label: 'Subtype' },
            // Variant Defs
            { key: 'tags_generation', label: 'Gen Options' },
            { key: 'tags_winglets', label: 'Winglet Options' },
            { key: 'tags_config', label: 'Config Options' }
        ],
        fields: [
            { key: 'manufacturer', label: 'Manufacturer', type: 'select', options: ['Boeing', 'Airbus'] },
            { key: 'model', label: 'Model', type: 'text' },
            { key: 'series', label: 'Series', type: 'text' },
            { key: 'subtype', label: 'Subtype', type: 'text' },
            // Variant Options: Comma separated list of allowable values
            { key: 'tags_generation', label: 'Generation Options', type: 'text', placeholder: 'e.g. ceo, neo, NG, MAX' },
            { key: 'tags_winglets', label: 'Winglet Options', type: 'text', placeholder: 'e.g. Sharklets, Scimitar, None' },
            { key: 'tags_config', label: 'Config Options', type: 'text', placeholder: 'e.g. C28Y150, High Density' }
        ]
    }
};

// --- State ---
const State = {
    currentView: 'profile',
    currentDataset: 'cities',
    map: null,
    cache: {
        cities: [],
        airports: [],
        airlines: [],
        aircraft_models: [],
        flights: []
    },
    flightSort: { key: 'date', dir: 'desc' },
    flightFilters: {},
    profileLayers: [],
    profileMapFlights: null,
    profileMapSelectedYear: 'all',
    profileMapMoveHandlerBound: false,
    profileMapResizeObserverBound: false,
    entityPanelHistory: [],
    journeyCharts: {},
    libraryViewMode: 'table',
    libraryFilters: {}
};

// --- API Client ---
const API = {
    async get(endpoint) {
        const separator = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${API_BASE}/${endpoint}${separator}_t=${Date.now()}`);
        return res.json();
    },
    async post(endpoint, data) {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async upload(endpoint, formData) {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'X-CSRFToken': CSRF_TOKEN },
            body: formData // No Content-Type header, let browser set boundary
        });
        return res.json();
    },
    async put(endpoint, id, data) {
        const res = await fetch(`${API_BASE}/${endpoint}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async delete(endpoint, id) {
        const res = await fetch(`${API_BASE}/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': CSRF_TOKEN }
        });
        return res.json();
    }
};

function normalizeWebsiteUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function airlineLogoPlaceholder(size = 'list') {
    return `<span class="airline-logo airline-logo-${size} airline-logo-placeholder" aria-hidden="true"><i class="fa-solid fa-building"></i></span>`;
}

function airlineLogoMarkup(logoUrl, logoSourceUrl, code, size = 'list') {
    const primary = logoUrl || logoSourceUrl || '';
    const fallbackSource = logoUrl && logoSourceUrl ? logoSourceUrl : '';
    if (!primary) return airlineLogoPlaceholder(size);
    return `<span class="airline-logo airline-logo-${size}"><img loading="lazy" src="${escapeHtml(primary)}" data-fallback-src="${escapeHtml(fallbackSource)}" data-logo-size="${escapeHtml(size)}" alt="" onerror="handleAirlineLogoError(this)"></span>`;
}

function handleAirlineLogoError(image) {
    const fallback = image.dataset.fallbackSrc;
    if (fallback && image.src !== fallback) {
        image.dataset.fallbackSrc = '';
        image.src = fallback;
        return;
    }
    image.parentElement.innerHTML = airlineLogoPlaceholder(image.dataset.logoSize || 'list');
}

async function manageAirlineLogo(id) {
    openModal('Manage airline logo', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <form class="form-grid">
                <div class="form-group full-width">
                    <label>Public logo URL</label>
                    <input name="source_url" type="url" placeholder="https://example.com/airline-logo.svg">
                    <small>Recommended for the free plan. The original URL remains as a fallback.</small>
                </div>
                <div class="form-group full-width">
                    <label>Or upload a logo</label>
                    <input name="file" type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml">
                    <small>PNG, JPEG, WebP, or SVG, up to 1 MB. Uploads require ImageKit configuration.</small>
                </div>
            </form>`;
        return container;
    }, async data => {
        const overlay = modalStack[modalStack.length - 1];
        const file = overlay?.querySelector('input[name="file"]')?.files?.[0];
        let result;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            result = await API.upload(`airlines/${id}/logo`, formData);
        } else {
            const sourceUrl = (data.source_url || '').trim();
            if (!sourceUrl) {
                alert('Enter a public logo URL or choose a file.');
                return false;
            }
            result = await API.post(`airlines/${id}/logo`, { source_url: sourceUrl });
        }
        if (result.error) {
            alert(result.error);
            return false;
        }
        openEntityPanel('airlines', id, false);
        if (State.currentView === 'flights') loadFlights();
        if (State.currentView === 'datasets' && State.currentDataset === 'airlines') loadDataset('airlines');
        return true;
    });
}

function invalidateProfileMapSize() {
    if (!State.map) return;
    const invalidate = () => State.map.invalidateSize({ pan: false });
    invalidate();
    requestAnimationFrame(invalidate);
    setTimeout(invalidate, 100);
    setTimeout(invalidate, 350);
    setTimeout(invalidate, 900);
}

function bindProfileMapResizeObserver() {
    if (State.profileMapResizeObserverBound || typeof ResizeObserver === 'undefined') return;
    const container = document.querySelector('#view-profile .map-container');
    if (!container) return;

    const observer = new ResizeObserver(() => invalidateProfileMapSize());
    observer.observe(container);
    State.profileMapResizeObserverBound = true;
}

function toggleDropdown() {
    const dropdown = document.getElementById('settings-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
}

// Close dropdown if clicked outside
window.onclick = function (event) {
    if (!event.target.matches('.dropdown-toggle') && !event.target.closest('.dropdown-toggle')) {
        const dropdown = document.getElementById('settings-dropdown');
        if (dropdown && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    }
}

async function openEditProfileModal() {
    // Pre-fetch API key status before opening modal
    let apiKeyConfigured = false;
    try {
        const status = await API.get('profile/api-key');
        apiKeyConfigured = status.configured;
    } catch (e) {}

    const statusColor = apiKeyConfigured ? '#4caf50' : '#ff9800';
    const statusText = apiKeyConfigured ? 'Configured ✓' : 'Not set';

    openModal('Edit Profile', () => {
        const div = document.createElement('div');
        div.innerHTML = `
            <form id="edit-profile-form">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" name="username" value="${escapeHtml(CURRENT_USER.username)}" required>
                </div>
                <div class="form-group">
                    <label>New Password (leave blank to keep current)</label>
                    <input type="password" name="password" placeholder="New Password">
                </div>
                <div class="form-group">
                    <label>Confirm Password</label>
                    <input type="password" name="confirm_password" placeholder="Confirm Password">
                </div>
                <hr style="margin: 16px 0; border-color: #444;">
                <div class="form-group">
                    <label>FlightAware API Key &nbsp;<span style="font-size:0.8em; color:${statusColor};">${statusText}</span></label>
                    <input type="password" name="flightaware_api_key" placeholder="Leave blank to keep current">
                </div>
            </form>
        `;
        return div;
    }, async () => {
        const form = document.querySelector('#edit-profile-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (data.password && data.password !== data.confirm_password) {
            alert("Passwords do not match!");
            return false;
        }

        const payload = {
            username: data.username,
            password: data.password || null
        };

        const res = await API.post('profile/update', payload);
        if (res.error) {
            alert(res.error);
            return false;
        }

        // Update local state
        CURRENT_USER.username = data.username;
        const _displayName = document.getElementById('user-display-name');
        const _avatarInitial = document.getElementById('user-avatar-initial');
        if (_displayName) _displayName.textContent = data.username;
        if (_avatarInitial) _avatarInitial.textContent = data.username[0].toUpperCase();

        // Save FlightAware API key if provided
        const newApiKey = (data.flightaware_api_key || '').trim();
        if (newApiKey) {
            const keyRes = await API.post('profile/api-key', { api_key: newApiKey });
            if (keyRes.error) {
                alert('Profile saved, but API key error: ' + keyRes.error);
                return false;
            }
        }

        alert(res.message + (newApiKey ? '\nFlightAware API key saved.' : ''));
    });
}

// --- Entity Detail Panel ---
const ENTITY_LABELS = {
    flights: 'Flight', airlines: 'Airline', airports: 'Airport', cities: 'City', aircraft_models: 'Aircraft'
};

function entityDisplayName(type, entity) {
    if (type === 'flights') return entity.flight_number || 'Flight';
    if (type === 'aircraft_models') return [entity.manufacturer, entity.name || entity.model, entity.series].filter(Boolean).join(' ');
    return entity.name || ENTITY_LABELS[type] || 'Details';
}

function entityLinkButton(type, id, label, extraClass = '') {
    if (!id) return `<span>${escapeHtml(label || '-')}</span>`;
    const destination = ENTITY_LABELS[type] || 'record';
    return `<button class="entity-link ${extraClass}" title="Open ${escapeHtml(destination)} details" aria-label="Open ${escapeHtml(destination)} details: ${escapeHtml(label || '-')}" onclick="event.stopPropagation(); openEntityPanel('${type}', ${Number(id)})">${escapeHtml(label || '-')}<i class="fa-solid fa-arrow-up-right-from-square"></i></button>`;
}

async function openEntityPanel(type, id, pushHistory = true) {
    if (!type || !id) return;
    if (pushHistory) State.entityPanelHistory.push({ type, id: Number(id) });
    const panel = document.getElementById('entity-panel');
    const overlay = document.getElementById('entity-panel-overlay');
    const body = document.getElementById('entity-panel-body');
    panel.hidden = false;
    overlay.hidden = false;
    document.body.classList.add('entity-panel-open');
    body.innerHTML = '<div class="entity-panel-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading details...</div>';
    try {
        const payload = await API.get(`entities/${type}/${id}`);
        if (payload.error) throw new Error(payload.error);
        renderEntityPanel(payload);
    } catch (error) {
        body.innerHTML = `<div class="entity-panel-state entity-panel-error">${escapeHtml(error.message || 'Unable to load details')}<button class="btn btn-secondary" onclick="openEntityPanel('${type}', ${Number(id)}, false)">Retry</button></div>`;
    }
}

function closeEntityPanel() {
    document.getElementById('entity-panel').hidden = true;
    document.getElementById('entity-panel-overlay').hidden = true;
    document.body.classList.remove('entity-panel-open');
    State.entityPanelHistory = [];
}

function goBackEntityPanel() {
    if (State.entityPanelHistory.length <= 1) return closeEntityPanel();
    State.entityPanelHistory.pop();
    const previous = State.entityPanelHistory[State.entityPanelHistory.length - 1];
    openEntityPanel(previous.type, previous.id, false);
}

function editEntityFromPanel(type, entity) {
    if (type === 'flights') {
        const flight = State.cache.flights.find(item => item.id === entity.id) || entity;
        openEditFlightModal(flight);
        return;
    }
    openEditDatasetModal(entity, type, () => {
        openEntityPanel(type, entity.id, false);
        if (State.currentView === 'datasets' && State.currentDataset === type) loadDataset(type);
    });
}

function editCurrentEntityPanel() {
    const current = State.entityPanelCurrent;
    if (!current) return;
    editEntityFromPanel(current.type, current.entity);
}

async function deleteCurrentEntityPanel() {
    const current = State.entityPanelCurrent;
    if (!current || !confirm(`Delete this ${ENTITY_LABELS[current.type] || 'record'}?`)) return;
    const result = await API.delete(current.type, current.entity.id);
    if (result.error) return alert(result.error);
    closeEntityPanel();
    if (State.currentView === 'profile') loadProfile();
    if (State.currentView === 'flights') loadFlights();
    if (State.currentView === 'datasets' && State.currentDataset === current.type) loadDataset(current.type);
}

function entityRelationshipLinks(type, entity) {
    const links = [];
    const add = (target, id, label, detail = '') => {
        if (!id) return;
        links.push(`<button class="entity-related-row" onclick="openEntityPanel('${target}', ${Number(id)})"><span><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></span><i class="fa-solid fa-chevron-right"></i></button>`);
    };
    if (type === 'flights') {
        add('airlines', entity.airline_id, entity.airline_name || 'Airline', 'Airline');
        add('airports', entity.origin_airport_id, entity.origin_name || entity.origin_code || 'Origin airport', 'Origin');
        add('airports', entity.dest_airport_id, entity.dest_name || entity.dest_code || 'Destination airport', 'Destination');
        add('aircraft_models', entity.aircraft_model_id, entity.aircraft_model || 'Aircraft model', 'Aircraft');
    } else if (type === 'airports') {
        add('cities', entity.city_id, entity.city_name || 'City', 'City');
    }
    if (type === 'airlines' && entity.website_url) {
        links.push(`<a class="entity-related-row" href="${escapeHtml(normalizeWebsiteUrl(entity.website_url))}" target="_blank" rel="noopener noreferrer"><span><b>Official website</b><small>${escapeHtml(entity.website_url)}</small></span><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`);
    }
    return links.join('');
}

function renderEntityPanel(payload) {
    const { type, entity, stats = {}, related = {} } = payload;
    State.entityPanelCurrent = { type, entity };
    const title = entityDisplayName(type, entity);
    document.getElementById('entity-panel-title').textContent = ENTITY_LABELS[type] || 'Details';
    const codes = [entity.iata_code, entity.icao_code, entity.flight_number].filter(Boolean);
    const relationshipLinks = entityRelationshipLinks(type, entity);
    const statsHtml = Object.entries(stats).filter(([, value]) => value !== null).map(([key, value]) => `
        <div class="entity-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(key.replaceAll('_', ' '))}</span></div>`).join('');
    const metadata = Object.entries(entity).filter(([key, value]) => value !== null && value !== '' && !['user_id', 'logo_url', 'logo_source_url'].includes(key)).slice(0, 18).map(([key, value]) => `
        <div class="entity-field"><span>${escapeHtml(key.replaceAll('_', ' '))}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    const relatedFlights = (related.flights || []).map(f => `
        <button class="entity-related-row" onclick="openEntityPanel('flights', ${Number(f.id)})"><span><b>${escapeHtml(f.flight_number || 'Flight')}</b><small>${escapeHtml(f.date || '')}</small></span><span>${escapeHtml(f.origin_code || '')} → ${escapeHtml(f.dest_code || '')}</span></button>`).join('');
    const relatedAirports = (related.airports || []).map(a => `
        <button class="entity-related-row" onclick="openEntityPanel('airports', ${Number(a.id)})"><span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.iata_code || a.icao_code || '')}</small></span></button>`).join('');
    document.getElementById('entity-panel-body').innerHTML = `
        <section class="entity-hero">${type === 'airlines' ? airlineLogoMarkup(entity.logo_url, entity.logo_source_url, entity.iata_code || entity.icao_code || entity.name, 'detail') : `<div class="entity-mark">${escapeHtml((codes[0] || title || '?').slice(0, 3).toUpperCase())}</div>`}<div class="entity-hero-copy"><h2>${escapeHtml(title)}</h2><p>${codes.map(escapeHtml).join(' · ')}</p><div class="entity-hero-actions"><button class="btn btn-sm btn-primary" onclick="editCurrentEntityPanel()">Edit</button>${type === 'airlines' ? `<button class="btn btn-sm btn-secondary" onclick="manageAirlineLogo(${Number(entity.id)})">Manage logo</button>` : ''}<button class="btn btn-sm action-danger" onclick="deleteCurrentEntityPanel()"><i class="fa-solid fa-trash"></i> Delete</button></div></div></section>
        ${statsHtml ? `<section><h3>Overview</h3><div class="entity-stats">${statsHtml}</div></section>` : ''}
        ${relationshipLinks ? `<section><h3>Connections</h3>${relationshipLinks}</section>` : ''}
        <section><h3>Details</h3><div class="entity-fields">${metadata}</div></section>
        ${relatedAirports ? `<section><h3>Airports</h3>${relatedAirports}</section>` : ''}
        ${relatedFlights ? `<section><h3>Related flights</h3>${relatedFlights}</section>` : ''}`;
}

// --- View Management ---
function navigateTo(viewName) {
    // Update State
    State.currentView = viewName;

    // Update Navbar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (viewName === 'profile' || viewName === 'flights' || viewName === 'datasets') {
        document.querySelector(`.nav-item[data-view-nav="${viewName}"]`)?.classList.add('active');
    }
    document.querySelectorAll('.mobile-nav-item[data-mobile-view]').forEach(el => {
        el.classList.toggle('active', el.dataset.mobileView === viewName);
    });

    // Update View Visibility
    document.querySelectorAll('.view').forEach(el => el.style.display = 'none');

    // Show active view
    if (viewName === 'profile') {
        document.getElementById('view-profile').style.display = 'block';
        invalidateProfileMapSize();
        loadProfile();
    } else if (viewName === 'flights') {
        document.getElementById('view-flights').style.display = 'block';
        loadFlights();
    } else if (viewName === 'datasets') {
        document.getElementById('view-datasets').style.display = 'block';
        loadDataset(State.currentDataset);
    }
}

// --- Map Logic ---
function initMap() {
    if (document.getElementById('flight-map')) {
        State.map = L.map('flight-map', {
            minZoom: 1
        }).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(State.map);
        bindProfileMapResizeObserver();
    }
}

function setMapLayer(type) {
    if (!State.map) return;
    // Basic implementation for layer switching could be improved with actual layers
    if (type === 'satellite') {
        // Placeholder for satellite tile provider (e.g., Esri)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        }).addTo(State.map);
    } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(State.map);
    }
}

function getVisibleWorldLongitudeOffsets(map, bufferCopies = 1) {
    if (!map || !map.getBounds) return [0];

    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    if (!Number.isFinite(west) || !Number.isFinite(east)) return [0];

    const startWorld = Math.floor((west + 180) / 360) - bufferCopies;
    const endWorld = Math.floor((east + 180 - 0.000001) / 360) + bufferCopies;
    const offsets = [];

    for (let world = startWorld; world <= endWorld; world++) {
        offsets.push(world * 360);
    }

    return [...new Set(offsets)].sort((a, b) => a - b);
}

function shiftPathLongitude(points, offset) {
    return points.map(([lat, lon]) => [lat, lon + offset]);
}

// Helper for Great Circle Path (Geodesic)
function getGeodesicPath(lat1, lon1, lat2, lon2, numPoints = 100) {
    if (lat1 === lat2 && lon1 === lon2) return [[lat1, lon1]];
    const toRad = x => x * Math.PI / 180;
    const toDeg = x => x * 180 / Math.PI;
    const phi1 = toRad(lat1), lambda1 = toRad(lon1);
    const phi2 = toRad(lat2), lambda2 = toRad(lon2);
    const d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((phi1 - phi2) / 2), 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.pow(Math.sin((lambda1 - lambda2) / 2), 2)));
    if (d === 0) return [[lat1, lon1]];
    let points = [];
    for (let i = 0; i <= numPoints; i++) {
        const f = i / numPoints;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
        const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
        const z = A * Math.sin(phi1) + B * Math.sin(phi2);
        points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
    }
    return points;
}

function bindProfileMapMoveHandler() {
    if (!State.map || State.profileMapMoveHandlerBound) return;

    State.map.on('moveend zoomend', () => {
        if (State.profileMapFlights) refreshProfileMapLayers({ fitBounds: false });
    });
    State.profileMapMoveHandlerBound = true;
}

// --- Data Loading & Rendering ---

async function loadDataset(datasetKey) {
    // Normalize keys
    if (datasetKey === 'aircraft') datasetKey = 'aircraft_models';

    State.currentDataset = datasetKey;

    // Update Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Find button by onclick content is hacky but works for now
    const tabs = document.querySelectorAll('.tab-btn');
    if (datasetKey === 'cities') tabs[0].classList.add('active');
    if (datasetKey === 'airports') tabs[1].classList.add('active');
    if (datasetKey === 'airlines') tabs[2].classList.add('active');
    if (datasetKey === 'aircraft_models') tabs[3].classList.add('active');

    const config = DATASETS[datasetKey];
    if (!config) return;

    // Fetch data
    const data = await API.get(config.endpoint);
    State.cache[datasetKey] = data; // Cache for lookups

    // Fetch dependencies for lookups and overview counts.
    if (datasetKey === 'airports') await API.get('cities').then(d => State.cache.cities = d);
    await Promise.all(Object.entries(DATASETS).map(async ([key, dataset]) => {
        if (State.cache[key]?.length || key === datasetKey) return;
        try {
            State.cache[key] = await API.get(dataset.endpoint);
        } catch (e) {
            console.warn(`Failed to load ${key} overview`, e);
        }
    }));

    // Reset sort/filter on new dataset load
    State.filter = '';
    State.sort = { key: null, dir: 'asc' };
    State.libraryFilters = {};
    const searchInput = document.getElementById('dataset-search');
    if (searchInput) {
        searchInput.value = '';
        if (datasetKey === 'cities') {
            searchInput.placeholder = 'Search city, country, continent...';
        } else if (datasetKey === 'airports') {
            searchInput.placeholder = 'Search airport, IATA, ICAO, city...';
        } else if (datasetKey === 'airlines') {
            searchInput.placeholder = 'Search airline, IATA, ICAO...';
        } else if (datasetKey === 'aircraft_models') {
            searchInput.placeholder = 'Search manufacturer, model, series...';
        } else {
            searchInput.placeholder = 'Search...';
        }
    }

    // --- Dynamic Toolbar Buttons ---
    const dynamicContainer = document.getElementById('dataset-dynamic-actions');
    if (dynamicContainer) {
        dynamicContainer.innerHTML = '';
        const addDisabledAutoFillButton = (html) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-info';
            btn.innerHTML = html;
            btn.disabled = true;
            btn.title = 'Auto-fill is currently disabled';
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            dynamicContainer.appendChild(btn);
        };
        if (datasetKey === 'airports') {
            addDisabledAutoFillButton('<i class="fas fa-magic"></i> Auto-Fill');
        }
        if (datasetKey === 'cities') {
            addDisabledAutoFillButton('<i class="fas fa-magic"></i> Auto-Fill Codes');
        }
        if (datasetKey === 'airlines') {
            addDisabledAutoFillButton('<i class="fas fa-magic"></i> Auto-Fill IATA');
        }
    }

    renderLibraryFilters(datasetKey);
    renderDatasetTable(config, data);
    renderLibraryOverview();
}

function switchDatasetTab(key) {
    loadDataset(key);
}

function filterDataset() {
    State.filter = document.getElementById('dataset-search').value.toLowerCase();
    const config = DATASETS[State.currentDataset];
    renderDatasetTable(config, State.cache[State.currentDataset]);
}

async function clearCurrentDataset() {
    const config = DATASETS[State.currentDataset];
    if (!confirm(`WARNING: Are you sure you want to DELETE ALL records from ${config.label}?\nThis action cannot be undone.`)) return;

    // Double confirmation
    if (!confirm(`Really clear all ${config.label}?`)) return;

    try {
        const res = await fetch(`${API_BASE}/clear/${config.endpoint}`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': CSRF_TOKEN }
        });
        const json = await res.json();

        if (json.error) {
            alert('Error: ' + json.error);
        } else {
            alert(json.message);
            loadDataset(State.currentDataset); // Refresh
        }
    } catch (e) {
        alert('Failed: ' + e);
    }
}

function sortDataset(key) {
    if (State.sort.key === key) {
        State.sort.dir = State.sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        State.sort.key = key;
        State.sort.dir = 'asc';
    }
    const config = DATASETS[State.currentDataset];
    renderDatasetTable(config, State.cache[State.currentDataset]);
}

function getProcessedDatasetData(config, data) {
    let processedData = [...data];

    // 1. Filter (Search)
    if (State.filter) {
        const filterVal = State.filter.toLowerCase();
        processedData = processedData.filter(item => {
            return Object.values(item).some(val =>
                String(val).toLowerCase().includes(filterVal)
            );
        });
    }

    // 2. Composite Filter (from UI badges/selects)
    if (State.libraryFilters) {
        Object.entries(State.libraryFilters).forEach(([key, value]) => {
            if (value) {
                processedData = processedData.filter(item => String(item[key]) === String(value));
            }
        });
    }

    // 3. Sort
    if (State.sort.key) {
        processedData.sort((a, b) => {
            let valA = a[State.sort.key];
            let valB = b[State.sort.key];

            const colDef = config.columns.find(c => c.key === State.sort.key);
            if (colDef && colDef.type === 'lookup' && State.cache[colDef.lookup]) {
                const lookupA = State.cache[colDef.lookup].find(i => i.id === valA);
                const lookupB = State.cache[colDef.lookup].find(i => i.id === valB);
                valA = lookupA ? lookupA[colDef.display] : valA;
                valB = lookupB ? lookupB[colDef.display] : valB;
            }

            if (valA < valB) return State.sort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return State.sort.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return processedData;
}

function switchLibraryView(mode) {
    State.libraryViewMode = mode;
    
    // Update view toggle button classes
    const btnTable = document.getElementById('btn-view-table');
    const btnCard = document.getElementById('btn-view-card');
    if (btnTable && btnCard) {
        if (mode === 'table') {
            btnTable.classList.add('active');
            btnCard.classList.remove('active');
        } else {
            btnCard.classList.add('active');
            btnTable.classList.remove('active');
        }
    }
    
    const config = DATASETS[State.currentDataset];
    const data = State.cache[State.currentDataset] || [];
    renderDatasetTable(config, data);
}

function renderDatasetCards(config, data) {
    const container = document.getElementById('dataset-cards');
    if (!container) return;
    container.innerHTML = '';

    const processedData = getProcessedDatasetData(config, data);

    if (processedData.length === 0) {
        container.innerHTML = '<div class="empty-state">No records found matching current criteria.</div>';
        return;
    }

    processedData.forEach(item => {
        const card = document.createElement('article');
        card.className = 'library-card';
        card.onclick = () => openEntityPanel(State.currentDataset, item.id);
        
        let cardHTML = '';
        const badges = getDataHealthBadges(State.currentDataset, item);
        
        if (State.currentDataset === 'cities') {
            const countryStr = item.country_code ? `${item.country} (${item.country_code})` : item.country;
            cardHTML = `
                <div class="library-card-header">
                    <span class="library-card-icon"><i class="fa-solid fa-city"></i></span>
                    <div class="library-card-title-group">
                        <h4 class="library-card-title">${escapeHtml(item.name)}${badges}</h4>
                        <span class="library-card-subtitle">${escapeHtml(countryStr || '-')}</span>
                    </div>
                </div>
                <div class="library-card-body">
                    <div class="library-card-info"><i class="fa-solid fa-globe"></i> ${escapeHtml(item.continent || '-')}</div>
                    <div class="library-card-info"><i class="fa-solid fa-clock"></i> ${escapeHtml(item.timezone || '-')}</div>
                </div>
            `;
        } else if (State.currentDataset === 'airports') {
            let cityVal = item.city_id;
            if (State.cache.cities) {
                const cityItem = State.cache.cities.find(c => c.id === item.city_id);
                if (cityItem) {
                    cityVal = `${cityItem.name}, ${cityItem.country}`;
                }
            }
            const iata = item.iata_code || '';
            const icao = item.icao_code || '';
            const codeDisplay = [iata, icao].filter(Boolean).join(' / ');
            cardHTML = `
                <div class="library-card-header">
                    <div class="library-card-large-code">${escapeHtml(iata || icao || '???')}</div>
                    <div class="library-card-title-group">
                        <h4 class="library-card-title">${escapeHtml(item.name)}${badges}</h4>
                        <span class="library-card-subtitle">${escapeHtml(cityVal || '-')}</span>
                    </div>
                </div>
                <div class="library-card-body">
                    <div class="library-card-info"><i class="fa-solid fa-plane-departure"></i> Code: ${escapeHtml(codeDisplay || '-')}</div>
                    <div class="library-card-info"><i class="fa-solid fa-location-dot"></i> Lat: ${item.lat || '-'}, Lon: ${item.lon || '-'}</div>
                    ${item.terminals ? `<div class="library-card-info"><i class="fa-solid fa-door-open"></i> Terminals: ${escapeHtml(item.terminals)}</div>` : ''}
                </div>
            `;
        } else if (State.currentDataset === 'airlines') {
            const codes = [item.iata_code, item.icao_code].filter(Boolean).join(' · ');
            cardHTML = `
                <div class="library-card-header">
                    <div class="library-card-logo-box">
                        ${airlineLogoMarkup(item.logo_url, item.logo_source_url, item.iata_code || item.icao_code || item.name)}
                    </div>
                    <div class="library-card-title-group">
                        <h4 class="library-card-title">${escapeHtml(item.name)}${badges}</h4>
                        <span class="library-card-subtitle">${escapeHtml(codes || '-')}</span>
                    </div>
                </div>
                <div class="library-card-body">
                    ${item.frequent_flyer_program ? `<div class="library-card-info"><i class="fa-solid fa-id-card"></i> Program: ${escapeHtml(item.frequent_flyer_program)}</div>` : ''}
                    ${item.frequent_flyer_id ? `<div class="library-card-info"><i class="fa-solid fa-user"></i> ID: ${escapeHtml(item.frequent_flyer_id)}</div>` : ''}
                    ${item.website_url ? `
                        <div class="library-card-info">
                            <i class="fa-solid fa-link"></i> 
                            <a href="${normalizeWebsiteUrl(item.website_url)}" target="_blank" rel="noopener noreferrer" class="library-card-link" onclick="event.stopPropagation()">
                                Official Website <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                        </div>` : ''}
                </div>
            `;
        } else if (State.currentDataset === 'aircraft_models') {
            const tags = [];
            if (item.tags_generation) tags.push(item.tags_generation);
            if (item.tags_winglets) tags.push(item.tags_winglets);
            if (item.tags_config) tags.push(item.tags_config);

            const tagsMarkup = tags.length > 0 ? `
                <div class="library-card-tags">
                    ${tags.map(t => `<span class="library-card-tag-chip">${escapeHtml(t)}</span>`).join('')}
                </div>
            ` : '';

            cardHTML = `
                <div class="library-card-header">
                    <span class="library-card-icon"><i class="fa-solid fa-plane"></i></span>
                    <div class="library-card-title-group">
                        <h4 class="library-card-title">${escapeHtml(item.manufacturer)} ${escapeHtml(item.model)}${badges}</h4>
                        <span class="library-card-subtitle">Series: ${escapeHtml(item.series || '-')} ${item.subtype ? `(${escapeHtml(item.subtype)})` : ''}</span>
                    </div>
                </div>
                <div class="library-card-body">
                    <div class="library-card-info"><i class="fa-solid fa-tag"></i> Name: ${escapeHtml(item.name || '-')}</div>
                    ${tagsMarkup}
                </div>
            `;
        }

        // Actions Footer
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'library-card-actions';
        actionsDiv.onclick = (e) => e.stopPropagation();

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-xs btn-outline-primary';
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
        editBtn.onclick = () => openEditDatasetModal(item);
        actionsDiv.appendChild(editBtn);

        if (State.currentDataset === 'airports') {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn btn-xs btn-outline-info';
            upBtn.innerHTML = '<i class="fas fa-sync"></i> Sync';
            upBtn.onclick = async () => {
                if (!confirm('Update this airport?')) return;
                const res = await API.post(`airports/${item.id}/update`, {});
                if (res.error) alert(res.error);
                else loadDataset('airports');
            };
            actionsDiv.appendChild(upBtn);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-xs btn-outline-danger';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
        delBtn.onclick = () => deleteDatasetItem(item.id);
        actionsDiv.appendChild(delBtn);

        card.innerHTML = cardHTML;
        card.appendChild(actionsDiv);
        container.appendChild(card);
    });
}

function renderDatasetTable(config, data) {
    const table = document.getElementById('dataset-table');
    const cards = document.getElementById('dataset-cards');

    if (State.libraryViewMode === 'card') {
        if (table) table.style.display = 'none';
        if (cards) cards.style.display = 'grid';
        renderDatasetCards(config, data);
        return;
    }

    if (cards) cards.style.display = 'none';
    if (table) table.style.display = 'table';
    if (table) {
        table.className = 'data-table'; // Ensure class is set
        table.innerHTML = '';
    }

    const processedData = getProcessedDatasetData(config, data);

    // Header
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    config.columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label;
        th.style.cursor = 'pointer';
        th.onclick = () => sortDataset(col.key);

        // Add sort indicator
        if (State.sort.key === col.key) {
            th.textContent += State.sort.dir === 'asc' ? ' ▲' : ' ▼';
        }

        trHead.appendChild(th);
    });
    const thAction = document.createElement('th');
    thAction.textContent = 'Actions';
    trHead.appendChild(thAction);
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    processedData.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'data-row';
        tr.title = `Open ${ENTITY_LABELS[State.currentDataset] || 'record'} details`;
        tr.onclick = () => openEntityPanel(State.currentDataset, item.id);
        config.columns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'data-cell';
            td.setAttribute('data-label', col.label);
            let val = item[col.key];

            // Handle Lookups
            if (col.type === 'lookup' && State.cache[col.lookup]) {
                const lookupItem = State.cache[col.lookup].find(i => i.id === item[col.key]);
                val = lookupItem ? lookupItem[col.display] : val;
            }

            if (State.currentDataset === 'airlines' && col.key === 'name') {
                const identity = document.createElement('div');
                identity.className = 'library-airline-cell';
                const badges = getDataHealthBadges('airlines', item);
                identity.innerHTML = `${airlineLogoMarkup(item.logo_url, item.logo_source_url, item.iata_code || item.icao_code || item.name)}<span class="library-airline-copy"><strong>${escapeHtml(val || '-')}</strong>${badges}<small class="library-airline-codes">${escapeHtml([item.iata_code, item.icao_code].filter(Boolean).join(' · '))}</small></span>`;
                if (item.website_url) {
                    const link = document.createElement('a');
                    link.href = normalizeWebsiteUrl(item.website_url);
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.title = 'Open official website';
                    link.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
                    link.onclick = (event) => event.stopPropagation();
                    identity.appendChild(link);
                }
                td.appendChild(identity);
            } else {
                if (col.key === 'name' || (State.currentDataset === 'aircraft_models' && col.key === 'manufacturer')) {
                    const badges = getDataHealthBadges(State.currentDataset, item);
                    if (badges) {
                        const nameSpan = document.createElement('span');
                        nameSpan.style.display = 'inline-flex';
                        nameSpan.style.alignItems = 'center';
                        nameSpan.innerHTML = `${escapeHtml(val || '-')} ${badges}`;
                        td.appendChild(nameSpan);
                    } else {
                        td.textContent = val;
                    }
                } else {
                    td.textContent = val;
                }
            }
            tr.appendChild(td);
        });

        // Actions
        const tdAction = document.createElement('td');
        tdAction.className = 'data-cell data-actions';
        tdAction.setAttribute('data-label', 'Actions');

        // Single Update Buttons
        if (State.currentDataset === 'airports') {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn-icon';
            upBtn.innerHTML = '<i class="fas fa-sync"></i>';
            upBtn.title = 'Update Data';
            upBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm('Update this airport?')) return;
                const res = await API.post(`airports/${item.id}/update`, {});
                if (res.error) alert(res.error);
                else { alert(res.message); loadDataset('airports'); }
            };
            tdAction.appendChild(upBtn);
        }
        if (State.currentDataset === 'cities') {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn-icon';
            upBtn.innerHTML = '<i class="fas fa-sync"></i>';
            upBtn.title = 'Update Data';
            upBtn.onclick = async (e) => {
                e.stopPropagation();
                const res = await API.post(`cities/${item.id}/update`, {});
                if (res.error) alert(res.error);
                else { loadDataset('cities'); }
            };
            tdAction.appendChild(upBtn);
        }
        if (State.currentDataset === 'airlines') {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn-icon';
            upBtn.innerHTML = '<i class="fas fa-sync"></i>';
            upBtn.title = 'Update Data';
            upBtn.onclick = async (e) => {
                e.stopPropagation();
                const res = await API.post(`airlines/${item.id}/update`, {});
                if (res.error) alert(res.error);
                else { loadDataset('airlines'); }
            };
            tdAction.appendChild(upBtn);
        }

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-icon action-edit';
        btnEdit.title = 'Edit record';
        btnEdit.setAttribute('aria-label', 'Edit record');
        btnEdit.setAttribute('data-action-label', 'Edit');
        btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i><span>Edit</span>';
        btnEdit.onclick = (e) => { e.stopPropagation(); openEditDatasetModal(item); };

        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-sm btn-icon action-danger';
        btnDel.title = 'Delete record';
        btnDel.setAttribute('aria-label', 'Delete record');
        btnDel.setAttribute('data-action-label', 'Delete');
        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i><span>Delete</span>';
        btnDel.onclick = (e) => { e.stopPropagation(); deleteDatasetItem(item.id); };

        tdAction.appendChild(btnEdit);
        tdAction.appendChild(btnDel);
        tr.appendChild(tdAction);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

// --- Modals ---
// --- Modals (Stacked) ---
const modalStack = [];

function openModal(title, contentFn, onSave) {
    const zIndex = 2000 + (modalStack.length * 10);

    // Create DOM
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = zIndex;

    const modal = document.createElement('div');
    modal.className = 'modal';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<h3>${escapeHtml(title)}</h3><button class="close-btn">&times;</button>`;
    header.querySelector('.close-btn').onclick = () => closeModal();

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.appendChild(contentFn());

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save';

    if (onSave) {
        saveBtn.onclick = async () => {
            const form = body.querySelector('form');
            if (form && !form.checkValidity()) {
                form.reportValidity();
                return;
            }

            let data = {};
            if (form) {
                const formData = new FormData(form);
                data = Object.fromEntries(formData.entries());
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            try {
                const result = await onSave(data);
                if (result !== false) closeModal(); // Only close if not explicitly false
            } catch (e) {
                alert(e);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        };
    } else {
        saveBtn.style.display = 'none';
    }

    footer.appendChild(saveBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    modalStack.push(overlay);
}

function closeModal() {
    if (modalStack.length === 0) return;
    const overlay = modalStack.pop();
    overlay.remove();
}

// --- Forms ---
function createForm(fields, item = {}) {
    const form = document.createElement('form');
    fields.forEach(col => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = col.label;
        formGroup.appendChild(label);

        let input;

        if (col.type === 'select' || col.type === 'lookup') {
            // Wrapper for flex
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '5px';

            input = document.createElement('select');
            input.name = col.key;
            if (col.required) input.required = true;

            // Populate options helper
            const populate = (items) => {
                input.innerHTML = '<option value="">-- Select --</option>';
                items.forEach(opt => {
                    const el = document.createElement('option');
                    if (typeof opt === 'object') {
                        el.value = opt.id || opt;
                        el.textContent = opt[col.display || 'name'] || opt.label || opt;
                    } else {
                        el.value = opt;
                        el.textContent = opt;
                    }
                    if (item && item[col.key] == el.value) el.selected = true;
                    input.appendChild(el);
                });
            };

            // Lookup vs Options
            if (col.lookup && State.cache[col.lookup]) {
                const list = [...State.cache[col.lookup]];
                // basic sort by name if available
                if (list.length > 0 && list[0].name) {
                    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                }
                populate(list);

                // Add (+) Button for lookups
                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'btn btn-sm btn-secondary';
                addBtn.innerText = '+';
                addBtn.title = 'Add New Item';
                addBtn.onclick = () => {
                    // Open Create Modal for this entity
                    // We need to know which dataset key maps to this lookup
                    // Usually col.lookup matches the dataset key (airports, airlines, etc)
                    openEditDatasetModal({}, col.lookup, async (newId) => {
                        // Success callback
                        State.cache[col.lookup] = await API.get(DATASETS[col.lookup].endpoint);
                        // Re-sort
                        const newList = [...State.cache[col.lookup]];
                        if (newList.length > 0 && newList[0].name) {
                            newList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                        }
                        populate(newList);
                        input.value = newId;
                        input.dispatchEvent(new Event('change'));
                    });
                };
                wrapper.appendChild(input);
                wrapper.appendChild(addBtn);
                input.style.flex = '1';

            } else if (col.options) {
                populate(col.options);
                wrapper.appendChild(input);
            } else {
                wrapper.appendChild(input);
            }

            formGroup.appendChild(wrapper);

        } else if (col.type === 'textarea') {
            input = document.createElement('textarea');
            input.name = col.key;
            input.rows = 3;
            if (item[col.key]) input.value = item[col.key];
            formGroup.appendChild(input);
        } else {
            input = document.createElement('input');
            input.type = col.type || 'text';
            input.name = col.key;
            if (col.placeholder) input.placeholder = col.placeholder;
            if (col.required) input.required = true;
            if (col.step) input.step = col.step;
            if (item[col.key]) input.value = item[col.key];
            formGroup.appendChild(input);
        }

        form.appendChild(formGroup);
    });
    return form;
}

// --- Form Generators ---
async function openAddDatasetModal() {
    const config = DATASETS[State.currentDataset];
    // Ensure dependencies are loaded
    if (State.currentDataset === 'airports' && !State.cache.cities) State.cache.cities = await API.get('cities');

    openModal(`Add ${config.label}`, () => createForm(config.fields), async (data) => {
        // Auto-Generate Name for Aircraft
        if (State.currentDataset === 'aircraft_models') {
            const suffix = (data.subtype && data.subtype.trim()) ? data.subtype : data.series;
            data.name = `${data.model}-${suffix}`;
        }
        const res = await API.post(config.endpoint, data);
        if (res.error) {
            alert(res.error);
            return false; // Prevent modal from closing
        }
        loadDataset(State.currentDataset); // Refresh
        return res.id; // Return the new ID for lookup callbacks
    });
}

async function openEditDatasetModal(item, datasetOverride = null, onSuccess = null) {
    const currentDatasetKey = datasetOverride || State.currentDataset;
    const config = DATASETS[currentDatasetKey];
    // Ensure dependencies are loaded
    if (currentDatasetKey === 'airports' && !State.cache.cities) State.cache.cities = await API.get('cities');

    openModal(`${item.id ? 'Edit' : 'Add'} ${config.label}`, () => createForm(config.fields, item), async (data) => {
        // Auto-Generate Name for Aircraft
        if (currentDatasetKey === 'aircraft_models') {
            const suffix = (data.subtype && data.subtype.trim()) ? data.subtype : data.series;
            data.name = `${data.model}-${suffix}`;
        }
        let res;
        if (item.id) {
            res = await API.put(config.endpoint, item.id, data);
        } else {
            res = await API.post(config.endpoint, data);
        }

        if (res.error) {
            alert(res.error);
            return false; // Prevent modal from closing
        }

        if (onSuccess) {
            onSuccess(res.id); // Pass the new/updated ID to the callback
        } else {
            loadDataset(State.currentDataset); // Refresh only if not a lookup add
        }
        return res.id; // Return the new ID for lookup callbacks
    });
}

function openImportModal() {
    const config = DATASETS[State.currentDataset];
    const contentFn = () => {
        const div = document.createElement('div');

        let helpText = '';
        if (State.currentDataset === 'airports') {
            helpText = `
                <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                    <strong>表头说明 (Headers):</strong><br>
                    • <code>iata_code</code>: <b>(必填)</b> IATA 三字码 (如 PEK, JFK)<br>
                    • <code>name</code>: 机场名称 (若为空将自动从云端获取)<br>
                    • <code>icao_code</code>: ICAO 四字码 (如 ZBAA, KJFK)<br>
                    • <code>city</code>: 城市名称 (自动关联，不存在将自动创建)<br>
                    • <code>lat/lon</code>: 经纬度 (若为空将自动获取)<br>
                    • <code>terminals</code>: 航站楼 (逗号分隔，如 T1,T2,T3)
                </div>
            `;
        } else if (State.currentDataset === 'cities') {
            helpText = `
                <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                    <strong>表头说明 (Headers):</strong><br>
                    • <code>name</code>: 城市名称 (必填)<br>
                    • <code>country</code>: 国家名称<br>
                    • <code>country_code</code>: ISO 国家代码 (如 CN, US)<br>
                    • <code>timezone</code>: 时区 (如 Asia/Shanghai)
                </div>
            `;
        } else if (State.currentDataset === 'airlines') {
            helpText = `
                <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                    <strong>表头说明 (Headers):</strong><br>
                    • <code>name</code>: 航空公司名称 (必填)<br>
                    • <code>iata_code</code>: IATA 二字码 (如 CA, MU)<br>
                    • <code>icao_code</code>: ICAO 三字码 (如 CCA, CES)
                </div>
            `;
        } else if (State.currentDataset === 'flights') {
            helpText = `
                <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                    <strong>表头说明 (Headers):</strong><br>
                    • <code>date</code>: 航班日期 (YYYY-MM-DD)<br>
                    • <code>flight_number</code>: 航班号<br>
                    • <code>origin_code</code>: 出发机场 IATA/ICAO 码<br>
                    • <code>dest_code</code>: 目的机场 IATA/ICAO 码<br>
                    • <code>airline_iata</code>: 航空公司 IATA 二字码<br>
                    • <code>aircraft_model</code>: 机型名称 (如 B738, A320)<br>
                    • <code>registration</code>: 飞机注册号<br>
                    • <code>std/sta/atd/ata</code>: 计划/实际起降时间 (YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DDTHH:MM)<br>
                    • <code>seat_number</code>: 座位号<br>
                    • <code>seat_type</code>: 座位类型 (如 Window, Aisle)<br>
                    • <code>flight_class</code>: 舱位 (如 Economy, Business)<br>
                    • <code>note</code>: 备注
                </div>
            `;
        }

        div.innerHTML = `
            <p>正在导入: <strong>${config.label}</strong></p>
            ${helpText}
            <input type="file" id="csv-file-input" accept=".csv" style="margin-top:10px; display:block; width:100%;">
        `;
        return div;
    };

    openModal(`Import ${config.label} CSV`, contentFn, async () => {
        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput.files[0]) {
            alert('Please select a file');
            return false;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const res = await API.upload(`import/${config.endpoint}`, formData);
            if (res.error) {
                alert('Error: ' + res.error);
                return false;
            } else {
                alert(res.message);
                if (res.errors && res.errors.length > 0) {
                    alert('Some rows failed:\n' + res.errors.slice(0, 10).join('\n') + (res.errors.length > 10 ? '\n...' : ''));
                }
                loadDataset(State.currentDataset);
            }
        } catch (e) {
            alert('Upload failed: ' + e);
            return false;
        }
    });
}


async function deleteDatasetItem(id) {
    if (!confirm('Are you sure?')) return;
    const config = DATASETS[State.currentDataset];
    await API.delete(config.endpoint, id);
    loadDataset(State.currentDataset);
}

// --- Flights Logic ---
async function loadFlights() {
    // Alias for compatibility
    await fetchFlights();
}

async function fetchFlights() {
    const flights = await API.get('flights/detailed');
    // Pre-process dates for sorting: Use full STD string for precision
    flights.forEach(f => {
        // Use full STD string for Date column display/sort if Date is missing
        f.date = f.std || f.date || '';
        // Create timestamp for accurate sorting (handles timezones correctly)
        f._std_ts = f.std ? Date.parse(f.std) : (f.date ? Date.parse(f.date) : 0);
    });
    State.cache.flights = flights;
    renderFlights();
}

function sortFlights(key) {
    if (State.flightSort.key === key) {
        State.flightSort.dir = State.flightSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        State.flightSort.key = key;
        State.flightSort.dir = 'asc'; // Default NEW sort is Ascending (Oldest first)
    }
    renderFlights();
}

function filterFlights() {
    const filterRow = document.querySelector('.filter-row');
    if (!filterRow) return;
    const ths = filterRow.querySelectorAll('th');

    State.flightFilters = {};
    const map = [
        ['date', 'flight_number'],
        null,
        ['origin_name', 'origin_code'],
        ['dest_name', 'dest_code'],
        null,
        'airline_name',
        ['aircraft_model', 'registration', 'tag_generation', 'tag_winglets', 'tag_config'],
        ['seat_number', 'seat_type', 'flight_class'],
        'note',
    ];

    ths.forEach((th, idx) => {
        const input = th.querySelector('input');
        if (input && input.value && map[idx]) {
            State.flightFilters[map[idx]] = input.value.toLowerCase();
        }
    });

    renderFlights();
}

function renderFlights() {
    let data = [...State.cache.flights];

    const filters = State.flightFilters;
    if (Object.keys(filters).length > 0) {
        data = data.filter(item => Object.entries(filters).every(([key, filterValue]) => {
            const keys = key.split(',');
            return keys.some(field => (item[field] || '').toString().toLowerCase().includes(filterValue));
        }));
    }

    const { key, dir } = State.flightSort;
    if (key) {
        data.sort((a, b) => {
            if (key === 'std' || key === 'date') {
                return dir === 'asc' ? a._std_ts - b._std_ts : b._std_ts - a._std_ts;
            }
            let va = a[key] ?? '';
            let vb = b[key] ?? '';
            if (key === 'distance' || key === 'duration_actual') {
                va = parseFloat(va) || 0;
                vb = parseFloat(vb) || 0;
                return dir === 'asc' ? va - vb : vb - va;
            }
            va = va.toString().toLowerCase();
            vb = vb.toString().toLowerCase();
            if (va < vb) return dir === 'asc' ? -1 : 1;
            if (va > vb) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const tbody = document.querySelector('#flights-table tbody');
    tbody.innerHTML = '';
    const safe = (value) => escapeHtml(value || '-');

    data.forEach(f => {
        const tr = document.createElement('tr');
        const formatTime = (iso) => escapeHtml(iso ? iso.replace('T', ' ').substring(0, 16) : '-');
        const displayDate = escapeHtml(f.date ? f.date.split(/[ T]/)[0] : '-');
        const distanceText = escapeHtml(f.distance ? `${f.distance} km` : '-');
        const scheduledDuration = escapeHtml(f.duration_scheduled ? `${f.duration_scheduled} min` : '-');
        const actualDuration = escapeHtml(f.duration_actual ? `${f.duration_actual} min` : '-');
        const registration = f.registration ? escapeHtml(f.registration) : '-';
        const registrationLink = f.registration
            ? `<a class="registration-link" href="https://www.flightera.net/en/planes/${encodeURIComponent(f.registration)}" target="_blank" rel="noopener" title="Open registration on Flightera" aria-label="Open registration ${registration} on Flightera" onclick="event.stopPropagation()">${registration}<i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
            : '-';
        const tags = [f.tag_generation, f.tag_winglets, f.tag_config].filter(Boolean);
        const originTerminal = f.origin_terminal ? `Terminal ${escapeHtml(f.origin_terminal)}` : 'Terminal -';
        const destTerminal = f.dest_terminal ? `Terminal ${escapeHtml(f.dest_terminal)}` : 'Terminal -';
        const airlineLogo = airlineLogoMarkup(f.airline_logo_url, f.airline_logo_source_url, f.airline_iata_code || f.airline_icao_code || f.airline_name);
        const airlineLogoLink = f.airline_id
            ? `<button class="airline-logo-link" title="Open Airline details" aria-label="Open Airline details: ${escapeHtml(f.airline_name || '-')}" onclick="event.stopPropagation(); openEntityPanel('airlines', ${Number(f.airline_id)})">${airlineLogo}</button>`
            : airlineLogo;

        tr.className = 'flight-row';
        tr.title = 'Open flight details';
        tr.innerHTML = `
            <td class="flight-cell flight-summary" data-label="Date / Flight">
                <div class="flight-summary-date">${displayDate}</div>
                <div class="flight-route-strip"><div class="flight-route-point"><span class="flight-route-name">${safe(f.origin_name || f.origin_code)}</span><small class="flight-route-terminal">${safe(f.origin_code)} · ${originTerminal}</small></div><i class="fa-solid fa-plane"></i><div class="flight-route-point"><span class="flight-route-name">${safe(f.dest_name || f.dest_code)}</span><small class="flight-route-terminal">${safe(f.dest_code)} · ${destTerminal}</small></div></div>
                <div class="flight-summary-main flight-summary-actions"><div class="flight-summary-number">${safe(f.flight_number)}</div><div class="flight-summary-button-group"><button class="btn btn-sm flight-update-summary action-api" data-action-label="Update" aria-label="Update flight from AeroAPI" title="Update from AeroAPI"><i class="fa-solid fa-cloud-arrow-down"></i><span>API</span></button></div></div>
                <div class="flight-row-hint"><span>View flight details</span><i class="fa-solid fa-chevron-right"></i></div>
            </td>
            <td class="flight-cell flight-times" data-label="Times">
                <div class="flight-times-grid">
                    <div><span>STD</span><strong>${formatTime(f.std)}</strong></div>
                    <div><span>ATD</span><strong>${formatTime(f.atd)}</strong></div>
                    <div><span>STA</span><strong>${formatTime(f.sta)}</strong></div>
                    <div><span>ATA</span><strong>${formatTime(f.ata)}</strong></div>
                </div>
            </td>
            <td class="flight-cell flight-origin" data-label="From">${entityLinkButton('airports', f.origin_airport_id, f.origin_name || f.origin_code)}<div style="font-size:0.75rem; color:#666">${safe(f.origin_code)} ${f.origin_terminal ? `(${escapeHtml(f.origin_terminal)})` : ''}</div></td>
            <td class="flight-cell flight-destination" data-label="To">${entityLinkButton('airports', f.dest_airport_id, f.dest_name || f.dest_code)}<div style="font-size:0.75rem; color:#666">${safe(f.dest_code)} ${f.dest_terminal ? `(${escapeHtml(f.dest_terminal)})` : ''}</div></td>
            <td class="flight-cell flight-metrics" data-label="Dist / Dur">
                <div>${distanceText}</div><small>Sched ${scheduledDuration}</small><small>Actual ${actualDuration}</small>
            </td>
            <td class="flight-cell flight-airline" data-label="Airline"><div class="flight-airline-content">${airlineLogoLink}${entityLinkButton('airlines', f.airline_id, f.airline_name)}</div></td>
            <td class="flight-cell flight-aircraft" data-label="Aircraft / Reg">
                <div class="flight-aircraft-model">${entityLinkButton('aircraft_models', f.aircraft_model_id, f.aircraft_model)}</div>
                <div class="flight-aircraft-registration">${registrationLink}</div>
                ${tags.length ? `<div class="flight-aircraft-tags">${tags.map(tag => `<span class="flight-aircraft-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
            </td>
            <td class="flight-cell flight-seat" data-label="Seat / Class">
                <div>${safe(f.seat_number)} <small>${safe(f.seat_type)}</small></div><small>${safe(f.flight_class)}</small>
            </td>
            <td class="flight-cell flight-note" data-label="Note" style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(f.note || '')}">${escapeHtml(f.note || '')}</td>
        `;
        tr.onclick = () => openEntityPanel('flights', f.id);
        tr.querySelectorAll('.flight-update-summary').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); updateFlightFromAeroAPI(f.id); }; });
        tbody.appendChild(tr);
    });
}

async function updateFlightFromAeroAPI(id) {
    try {
        const preview = await API.post(`flights/${id}/aeroapi_preview`, {});
        if (preview.error) {
            alert('Update failed: ' + preview.error);
            return;
        }
        if (preview.ambiguous) {
            openAeroApiCandidateModal(id, preview.candidates || []);
            return;
        }

        openAeroApiDiffModal(id, preview);
    } catch (e) { alert('Error: ' + e); }
}

function openAeroApiCandidateModal(id, candidates) {
    if (!candidates.length) {
        alert('No AeroAPI candidates found.');
        return;
    }

    openModal('Select AeroAPI Flight', () => {
        const div = document.createElement('div');
        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.fontSize = '0.85rem';
        table.innerHTML = `
            <thead>
                <tr>
                    <th></th>
                    <th>Flight</th>
                    <th>Route</th>
                    <th>Departure</th>
                    <th>Arrival</th>
                    <th>Reg</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');

        const valueText = (value) => {
            if (value === null || value === undefined || value === '') return '-';
            return String(value);
        };
        const routeText = (candidate) => {
            const origin = candidate.origin_iata || candidate.origin_code || '?';
            const dest = candidate.destination_iata || candidate.destination_code || '?';
            return `${origin} → ${dest}`;
        };
        const timeText = (scheduled, actual) => {
            if (scheduled && actual && scheduled !== actual) return `${scheduled} / ${actual}`;
            return scheduled || actual || '-';
        };

        candidates.forEach((candidate, position) => {
            const tr = document.createElement('tr');
            const radioTd = document.createElement('td');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'aeroapi-candidate';
            radio.value = candidate.index;
            radio.required = true;
            if (position === 0) radio.checked = true;
            radioTd.appendChild(radio);

            const flightTd = document.createElement('td');
            flightTd.textContent = candidate.ident_iata || candidate.ident || candidate.ident_icao || 'Unknown';
            const routeTd = document.createElement('td');
            routeTd.textContent = routeText(candidate);
            const depTd = document.createElement('td');
            depTd.textContent = timeText(candidate.scheduled_out, candidate.actual_out);
            const arrTd = document.createElement('td');
            arrTd.textContent = timeText(candidate.scheduled_in, candidate.actual_in);
            const regTd = document.createElement('td');
            regTd.textContent = valueText(candidate.registration);

            tr.onclick = () => { radio.checked = true; };
            tr.appendChild(radioTd);
            tr.appendChild(flightTd);
            tr.appendChild(routeTd);
            tr.appendChild(depTd);
            tr.appendChild(arrTd);
            tr.appendChild(regTd);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        div.appendChild(table);
        return div;
    }, async () => {
        const selected = document.querySelector('input[name="aeroapi-candidate"]:checked');
        if (!selected) {
            alert('Select a flight candidate.');
            return false;
        }

        const candidateIndex = Number(selected.value);
        const preview = await API.post(`flights/${id}/aeroapi_preview`, { candidate_index: candidateIndex });
        if (preview.error) {
            alert('Update failed: ' + preview.error);
            return false;
        }
        if (preview.ambiguous) {
            alert('Select one AeroAPI flight before reviewing fields.');
            return false;
        }

        closeModal();
        openAeroApiDiffModal(id, preview);
        return false;
    });
}

function openAeroApiDiffModal(id, preview) {
    const diffs = preview.diffs || [];
    const relatedDiffs = preview.related_diffs || [];
    const selectable = diffs.filter(d => d.status !== 'same');
    if ((diffs.length === 0 || selectable.length === 0) && relatedDiffs.length === 0) {
        alert('No AeroAPI differences found.');
        return;
    }

    openModal('Review AeroAPI Updates', () => {
        const div = document.createElement('div');
        const summary = document.createElement('p');
        summary.style.marginTop = '0';
        summary.textContent = `Matched flight: ${preview.debug_match || 'Unknown'}`;
        div.appendChild(summary);

        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.fontSize = '0.85rem';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Field</th>
                    <th>Local</th>
                    <th>AeroAPI</th>
                    <th>Replace</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');

        const valueText = (value) => {
            if (value === null || value === undefined || value === '') return '—';
            return String(value);
        };

        diffs.forEach(diff => {
            const tr = document.createElement('tr');
            const fieldTd = document.createElement('td');
            const localTd = document.createElement('td');
            const remoteTd = document.createElement('td');
            const actionTd = document.createElement('td');

            fieldTd.textContent = diff.label || diff.field;
            localTd.textContent = valueText(diff.local);
            remoteTd.textContent = valueText(diff.remote);

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = 'aeroapi-field';
            cb.value = diff.field;
            cb.checked = !!diff.default_selected;
            if (diff.status === 'same') cb.disabled = true;
            actionTd.appendChild(cb);

            if (diff.status === 'conflict') {
                tr.style.backgroundColor = '#fff8e1';
            } else if (diff.status === 'missing') {
                tr.style.backgroundColor = '#eef7ee';
            }

            tr.appendChild(fieldTd);
            tr.appendChild(localTd);
            tr.appendChild(remoteTd);
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
        });

        relatedDiffs.forEach(diff => {
            const tr = document.createElement('tr');
            const fieldTd = document.createElement('td');
            const localTd = document.createElement('td');
            const remoteTd = document.createElement('td');
            const actionTd = document.createElement('td');

            fieldTd.textContent = diff.label || diff.field;
            localTd.textContent = '—';
            remoteTd.textContent = valueText(diff.remote);
            actionTd.textContent = 'Auto';
            tr.style.backgroundColor = '#eef7ee';

            tr.appendChild(fieldTd);
            tr.appendChild(localTd);
            tr.appendChild(remoteTd);
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        div.appendChild(table);
        return div;
    }, async (data) => {
        const checked = Array.from(document.querySelectorAll('input[name="aeroapi-field"]:checked')).map(cb => cb.value);
        if (checked.length === 0 && relatedDiffs.length === 0) {
            alert('No fields selected.');
            return false;
        }

        const res = await API.post(`flights/${id}/aeroapi_apply`, {
            fields: checked,
            candidate_index: preview.candidate_index
        });
        if (res.error) {
            alert('Update failed: ' + res.error);
            return false;
        }
        alert(`Updated ${res.fields_updated || 0} fields.`);
        loadFlights();
    });
}

async function updateMissingFlights() {
    const btn = document.querySelector('button[onclick="updateMissingFlights()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }

    try {
        const res = await API.post('flights/update_aeroapi_missing', {});
        alert(`Bulk update complete.\nUpdated: ${res.updated}\nTotal Candidates: ${res.total_candidates}`);
        loadFlights();
    } catch (e) {
        alert('Bulk update error: ' + e);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-download-alt"></i> Update Missing'; }
    }
}

function openImportFlightsModal() {
    const old = State.currentDataset;
    State.currentDataset = 'flights';
    const config = { label: 'Flights', endpoint: 'flights' };

    openModal('Import Flights CSV', () => {
        const div = document.createElement('div');
        div.innerHTML = `
            <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                <strong>表头说明 (Headers):</strong><br>
                • <code>flight_number</code>: 航班号 (如 CA123)<br>
                • <code>origin_code/dest_code</code>: IATA 机场代码 (如 PEK)<br>
                • <code>origin_terminal/dest_terminal</code>: 航站楼 (如 T1, T2)<br>
                • <code>std/sta/atd/ata</code>: <strong>日期时间格式: <code>YYYY-MM-DD HH:mm [TZ]</code></strong><br>
                  (支持时区, 如 <code>2024-01-01 12:30+08:00</code> 或 <code>2024-01-01 12:30 GMT</code>)<br>
                • <code>registration</code>: 飞机注册号 (如 B-1234)<br>
                • <code>airline</code>: 航空公司名称, IATA, 或 ICAO 代码<br>
                • <code>aircraft</code>: 飞机型号名称<br>
                • <code>distance</code>: 飞行距离 (数字)<br>
                • <code>seat_number</code>: 座位号 (如 12A)<br>
                • <code>seat_type</code>: 座位位置 (Window/Aisle)<br>
                • <code>class</code>: 舱位/等级 (Economy/Business)<br>
                • <code>note</code>: 备注
            </div>
            <p>请选择 CSV 文件进行导入:</p>
            <input type="file" id="csv-file-input" accept=".csv" style="width:100%;">
        `;
        const input = div.querySelector('input');
        // No onchange handler needed
        return div;
    }, async () => {
        const fileInput = document.getElementById('csv-file-input');
        if (!fileInput || !fileInput.files[0]) {
            alert('Please select a file');
            return false;
        }

        try {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            const res = await API.upload(`import/flights`, formData);

            if (res.error) {
                alert('Import Error: ' + res.error);
                return false;
            } else {
                const errorMsg = (res.errors && res.errors.length) ? "\nErrors: " + res.errors.join(", ") : "";
                alert(res.message + errorMsg);
                loadFlights();
                State.currentDataset = old;
            }
        } catch (e) {
            alert('Import failed: ' + e);
            return false;
        }
    });
}

async function deleteFlight(id) {
    if (!confirm('Delete flight?')) return;
    await API.delete('flights', id);
    loadFlights();
}

async function openEditFlightModal(item) {
    // Fetch dependencies
    const [airports, airlines, aircraft] = await Promise.all([
        API.get('airports'),
        API.get('airlines'),
        API.get('aircraft_models')
    ]);

    // Sync cache
    State.cache.airports = airports;
    State.cache.airlines = airlines;
    State.cache.aircraft_models = aircraft;

    const flightFields = [
        { key: 'flight_number', label: 'Flight Number', type: 'text' },
        { key: 'registration', label: 'Aircraft Reg', type: 'text' },
        { key: 'origin_airport_id', label: 'Origin', type: 'select', lookup: 'airports', display: 'name' },
        { key: 'dest_airport_id', label: 'Destination', type: 'select', lookup: 'airports', display: 'name' },
        { key: 'std', label: 'Sched Departure', type: 'datetime-local' },
        { key: 'atd', label: 'Actual Departure', type: 'datetime-local' },
        { key: 'sta', label: 'Sched Arrival', type: 'datetime-local' },
        { key: 'ata', label: 'Actual Arrival', type: 'datetime-local' },
        { key: 'origin_terminal', label: 'Origin Terminal', type: 'select', features: ['dynamic_add'], options: [] },
        { key: 'dest_terminal', label: 'Dest Terminal', type: 'select', features: ['dynamic_add'], options: [] },
        { key: 'distance', label: 'Distance (km)', type: 'number' },
        { key: 'duration_scheduled', label: 'Sched Duration (min)', type: 'number' },
        { key: 'duration_actual', label: 'Actual Duration (min)', type: 'number' },
        { key: 'airline_id', label: 'Airline', type: 'select', lookup: 'airlines', display: 'name' },
        { key: 'aircraft_model_id', label: 'Aircraft', type: 'select', lookup: 'aircraft_models', display: 'name' },
        { key: 'tag_generation', label: 'Generation', type: 'select', options: [] },
        { key: 'tag_winglets', label: 'Winglets', type: 'select', options: [] },
        { key: 'tag_config', label: 'Config', type: 'select', options: [] },
        { key: 'seat_number', label: 'Seat', type: 'text' },
        { key: 'seat_type', label: 'Seat Type', type: 'select', options: ['Window', 'Aisle', 'Middle'] },
        { key: 'flight_class', label: 'Class', type: 'select', options: ['Economy', 'Premium Economy', 'Business', 'First'] },
        { key: 'note', label: 'Note', type: 'textarea' }
    ];

    openModal('Edit Flight', () => {
        // Pre-process times for datetime-local input (YYYY-MM-DDTHH:MM)
        ['std', 'atd', 'sta', 'ata'].forEach(k => {
            if (item[k]) {
                // If format is "YYYY-MM-DD HH:MM:SS" (from DB) -> "YYYY-MM-DDTHH:MM"
                // If format is "YYYY-MM-DDTHH:MM..." (ISO) -> "YYYY-MM-DDTHH:MM"
                let val = item[k].replace(' ', 'T');
                if (val.length > 16) val = val.substring(0, 16);
                item[k] = val;
            }
        });

        const form = createForm(flightFields, item);

        // Re-inject dynamic logic (Terminals & Variants)
        // This is a bit redundant with openAddFlightModal, ideally refactored
        const originSelect = form.querySelector('[name="origin_airport_id"]');
        const destSelect = form.querySelector('[name="dest_airport_id"]');
        const originTermSelect = form.querySelector('[name="origin_terminal"]');
        const destTermSelect = form.querySelector('[name="dest_terminal"]');
        const aircraftSelect = form.querySelector('[name="aircraft_model_id"]');
        const genSelect = form.querySelector('[name="tag_generation"]');
        const wlSelect = form.querySelector('[name="tag_winglets"]');
        const cfgSelect = form.querySelector('[name="tag_config"]');

        const updateAirportInfo = (airportId, terminalSelect, labelPrefix) => {
            // ... same logic as Add Flight ...
            // Let's just implement the terminal population
            terminalSelect.innerHTML = '<option value="">-- Select --</option>';
            const airport = airports.find(a => a.id == airportId);
            if (airport && airport.terminals) {
                airport.terminals.split(',').forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.trim(); opt.textContent = t.trim();
                    if (item[`${labelPrefix.toLowerCase()}_terminal`] == opt.value) opt.selected = true;
                    terminalSelect.appendChild(opt);
                });
            }
        };

        const updateVariants = (modelId) => {
            const model = aircraft.find(m => m.id == modelId);
            [genSelect, wlSelect, cfgSelect].forEach(s => s.innerHTML = '<option value="">-- Select --</option>');
            if (model) {
                const map = { 'tag_generation': 'tags_generation', 'tag_winglets': 'tags_winglets', 'tag_config': 'tags_config' };
                Object.entries(map).forEach(([key, tagKey]) => {
                    const select = form.querySelector(`[name="${key}"]`);
                    if (model[tagKey]) {
                        model[tagKey].split(',').forEach(v => {
                            const opt = document.createElement('option');
                            opt.value = v.trim(); opt.textContent = v.trim();
                            if (item[key] == opt.value) opt.selected = true;
                            select.appendChild(opt);
                        });
                    }
                });
            }
        };

        originSelect.addEventListener('change', (e) => updateAirportInfo(e.target.value, originTermSelect, 'Origin'));
        destSelect.addEventListener('change', (e) => updateAirportInfo(e.target.value, destTermSelect, 'Dest'));
        aircraftSelect.addEventListener('change', (e) => updateVariants(e.target.value));

        // --- Dynamic Add Helper ---
        const injectAddButton = (select, parentSelect, parentList, parentField, apiEndpoint, refreshFn, itemKey) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-secondary';
            btn.innerText = '+';
            btn.title = 'Add New Item';
            btn.onclick = async () => {
                const parentId = parentSelect.value;
                if (!parentId) return alert('Please select a parent item first.');

                const newValue = prompt(`Enter new value for ${parentField}:`);
                if (!newValue) return;

                const parentObj = parentList.find(x => x.id == parentId);
                if (!parentObj) return;

                let current = parentObj[parentField] || '';
                // Check duplicate
                if (current.split(',').map(s => s.trim()).includes(newValue.trim())) {
                    alert('Item already exists.');
                    return;
                }

                parentObj[parentField] = current ? current + ', ' + newValue : newValue;

                try {
                    // Update Backend
                    await API.put(apiEndpoint, parentId, parentObj);

                    // Update Local Item state so refreshFn selects it (if refreshFn uses item)
                    // Terminal refresh uses 'item', Variant refresh uses 'item'
                    item[itemKey] = newValue;

                    // Refresh Options
                    refreshFn(parentId);

                    // Explicitly set value just in case
                    select.value = newValue;
                } catch (e) {
                    alert('Update failed: ' + e);
                }
            };

            // Append to wrapper
            if (select.parentNode) {
                select.parentNode.appendChild(btn);
                select.style.flex = '1';
            }
        };

        // Inject Buttons
        injectAddButton(originTermSelect, originSelect, airports, 'terminals', 'airports', (pid) => updateAirportInfo(pid, originTermSelect, 'Origin'), 'origin_terminal');
        injectAddButton(destTermSelect, destSelect, airports, 'terminals', 'airports', (pid) => updateAirportInfo(pid, destTermSelect, 'Dest'), 'dest_terminal');

        injectAddButton(genSelect, aircraftSelect, aircraft, 'tags_generation', 'aircraft_models', updateVariants, 'tag_generation');
        injectAddButton(wlSelect, aircraftSelect, aircraft, 'tags_winglets', 'aircraft_models', updateVariants, 'tag_winglets');
        injectAddButton(cfgSelect, aircraftSelect, aircraft, 'tags_config', 'aircraft_models', updateVariants, 'tag_config');

        // Initial Trigger
        updateAirportInfo(item.origin_airport_id, originTermSelect, 'Origin');
        updateAirportInfo(item.dest_airport_id, destTermSelect, 'Dest');
        updateVariants(item.aircraft_model_id);

        // --- Auto-Calc Duration Logic ---
        const stdInput = form.querySelector('[name="std"]');
        const staInput = form.querySelector('[name="sta"]');
        const durSchedInput = form.querySelector('[name="duration_scheduled"]');

        const atdInput = form.querySelector('[name="atd"]');
        const ataInput = form.querySelector('[name="ata"]');
        const durActualInput = form.querySelector('[name="duration_actual"]');

        if (durSchedInput) {
            durSchedInput.readOnly = true;
            durSchedInput.style.backgroundColor = '#f0f0f0';
        }
        if (durActualInput) {
            durActualInput.readOnly = true;
            durActualInput.style.backgroundColor = '#f0f0f0';
        }

        const calcDuration = async (startIn, endIn, durIn) => {
            if (!startIn || !endIn || !durIn) return;
            const startVal = startIn.value;
            const endVal = endIn.value;
            const oid = originSelect.value;
            const did = destSelect.value;

            if (startVal && endVal && oid && did) {
                // Show loading state?
                durIn.style.backgroundColor = '#e0e0e0';
                try {
                    const res = await API.post('calculate_duration', {
                        start: startVal,
                        end: endVal,
                        origin_id: oid,
                        dest_id: did
                    });
                    if (res.minutes !== undefined) {
                        durIn.value = res.minutes;
                    } else if (res.error) {
                        console.error(res.error);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    durIn.style.backgroundColor = '#f0f0f0';
                }
            }
        };

        const attachCalc = (s, e, d) => {
            const handler = () => calcDuration(s, e, d);
            s.addEventListener('change', handler);
            e.addEventListener('change', handler);
            // Also re-calc if airports change?
            originSelect.addEventListener('change', handler);
            destSelect.addEventListener('change', handler);
        };

        if (stdInput && staInput && durSchedInput) {
            attachCalc(stdInput, staInput, durSchedInput);
        }

        if (atdInput && ataInput && durActualInput) {
            attachCalc(atdInput, ataInput, durActualInput);
        }

        return form;
    }, async (data) => {
        const res = await API.put('flights', item.id, data);
        if (res.error) {
            alert('Save failed: ' + res.error);
            return false;
        }
        loadFlights();
    });
}

async function openAddFlightModal() {
    // Simplified Quick Add Mode
    // Only ask for Flight Number and Date
    const flightFields = [
        { key: 'flight_number', label: 'Flight Number', type: 'text', placeholder: 'e.g. CA123' },
        { key: 'date', label: 'Date', type: 'date' } // Use date input, backend stores YYYY-MM-DD
    ];

    openModal('Add Flight (Quick)', () => {
        const form = createForm(flightFields);
        // Set default date to today
        const dateInput = form.querySelector('[name="date"]');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        return form;
    }, async (data) => {
        // Create skeleton flight
        // We might need to ensure backend accepts missing FKs. 
        // Assuming database schema allows NULLs for origin/dest/airline/etc.

        try {
            const res = await API.post('flights', data);
            if (res.error) {
                alert('Error: ' + res.error);
                return;
            }

            const flightId = res.id || res.lastrowid; // Check what API returns

            if (State.currentView === 'flights') loadFlights();
            if (State.currentView === 'profile') loadProfile(); // Update profile counts

            // Manual update only via cloud button

        } catch (e) {
            alert('Error creating flight: ' + e);
        }
    });
}

// --- Profile & Stats ---
// --- Profile & Stats ---
// --- Profile & Stats ---
// --- Profile Stats Helpers ---

const formatCompactNumber = (value) => Number(value || 0).toLocaleString();
const formatKm = (value) => `${Math.round(Number(value || 0)).toLocaleString()} km`;
const formatHours = (minutes) => `${Math.round(Number(minutes || 0) / 60).toLocaleString()}h`;

function routeLabel(record) {
    if (!record) return 'Not enough data';
    const origin = record.origin || record.route?.split('-')[0] || '';
    const dest = record.dest || record.route?.split('-')[1] || '';
    return origin && dest ? `${origin} -> ${dest}` : (record.route || record.flight_number || 'Not enough data');
}

function normalizeYear(value) {
    return String(value || '').slice(0, 4);
}

function normalizeMonth(value) {
    return String(value || '').slice(0, 7);
}

function parseLocalMonth(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    return new Date(year || 1970, (month || 1) - 1, 1);
}

function monthKeyFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildRecentTwelveMonths(monthRows) {
    const counts = Object.fromEntries((monthRows || []).map(row => [row.month, Number(row.count || 0)]));
    const latestDataMonth = (monthRows || []).map(row => row.month).sort().pop();
    const end = latestDataMonth ? parseLocalMonth(latestDataMonth) : new Date();
    end.setDate(1);
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const month = monthKeyFromDate(d);
        months.push({ month, count: counts[month] || 0 });
    }
    return months;
}

function buildContinuousYears(stats) {
    const years = Array.from(new Set([
        ...(stats.flights_by_year || []).map(d => Number(d.year)),
        ...(stats.distance_by_year || []).map(d => Number(d.year)),
        ...(stats.duration_by_year || []).map(d => Number(d.year))
    ])).filter(Boolean);
    if (!years.length) return [];
    const start = Math.min(...years);
    const end = Math.max(new Date().getFullYear(), Math.max(...years));
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function isLowCostAirline(flight) {
    const name = String(flight.airline_name || '').toLowerCase();
    return /ryanair|easyjet|airasia|southwest|jetstar|scoot|spring|vietjet|cebu|wizz|frontier|spirit|norse|peach|zipair|hk express|flynas|flydubai|low cost|low-cost|lowcost|廉航/.test(name);
}

function airlineCategoryForFlight(flight) {
    const alliance = `${flight.airline_alliance || ''} ${flight.airline_ff_program || ''}`;
    if (/SkyTeam|天合/i.test(alliance)) return 'SkyTeam';
    if (/Star Alliance|星空/i.test(alliance)) return 'Star Alliance';
    if (/Oneworld|寰宇/i.test(alliance)) return 'Oneworld';
    if (isLowCostAirline(flight)) return 'Low-cost';
    return 'Other';
}

function distanceBucketForFlight(flight) {
    const distance = Number(flight.distance || 0);
    if (!distance) return 'Unknown';
    if (distance < 500) return '<500 km';
    if (distance < 1500) return '500-1,499 km';
    if (distance < 4000) return '1,500-3,999 km';
    if (distance < 7000) return '4,000-6,999 km';
    return '7,000+ km';
}

function filterFlightsForInsight(kind, value) {
    return (State.cache.flights || []).filter(flight => {
        if (kind === 'all') return true;
        if (kind === 'year') return normalizeYear(flight.date) === String(value);
        if (kind === 'month') return normalizeMonth(flight.date) === String(value);
        if (kind === 'monthOfYear') return Number(String(flight.date || '').slice(5, 7)) === Number(value);
        if (kind === 'distanceBucket') return distanceBucketForFlight(flight) === value;
        if (kind === 'route') return `${flight.origin_code}-${flight.dest_code}` === value;
        if (kind === 'airlineCategory') return airlineCategoryForFlight(flight) === value;
        if (kind === 'airline') return flight.airline_name === value;
        if (kind === 'manufacturer') return flight.manufacturer === value;
        if (kind === 'aircraft') return flight.aircraft_model === value;
        if (kind === 'airport') return flight.origin_code === value || flight.dest_code === value;
        if (kind === 'locations') return Boolean(flight.origin_code || flight.dest_code);
        if (kind === 'delayed') {
            if (!flight.std || !flight.atd) return false;
            const t1 = new Date(flight.std.replace(' ', 'T'));
            const t2 = new Date(flight.atd.replace(' ', 'T'));
            return t2 > t1;
        }
        if (kind === 'missing') {
            if (value === 'aircraft') return !flight.aircraft_model_id;
            if (value === 'registration') return !flight.registration;
            if (value === 'actual_times') return !flight.atd || !flight.ata;
            if (value === 'distance') return !flight.distance;
        }
        return false;
    });
}

function openFlightListModal(title, flights) {
    const rows = [...(flights || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    openModal(title, () => {
        const container = document.createElement('div');
        container.className = 'flight-list-modal';
        if (!rows.length) {
            container.innerHTML = '<p class="flight-list-empty">No matching flights.</p>';
            return container;
        }
        container.innerHTML = rows.map(flight => `
            <button class="flight-list-row" onclick="openEntityPanel('flights', ${Number(flight.id)}); closeModal();">
                <span><strong>${escapeHtml(flight.flight_number || '-')}</strong><small>${escapeHtml(flight.date || '')}</small></span>
                <em>${escapeHtml(flight.origin_code || '-')} -> ${escapeHtml(flight.dest_code || '-')}</em>
                <span><strong>${escapeHtml(flight.airline_name || 'Unknown airline')}</strong><small>${escapeHtml(flight.aircraft_model || '')}</small></span>
            </button>
        `).join('');
        return container;
    });
}
window.openFlightListModal = openFlightListModal;
window.filterFlightsForInsight = filterFlightsForInsight;


function renderJourneyHighlights(stats) {
    const container = document.getElementById('journey-highlights');
    if (!container) return;
    const records = stats.records || {};
    const quality = stats.quality || {};
    const qualityTotal = (Number(quality.missing_aircraft || 0) +
                          Number(quality.missing_registration || 0) +
                          Number(quality.missing_actual_times || 0) +
                          Number(quality.missing_distance || 0) +
                          Number(quality.missing_airport_coordinates || 0) +
                          Number(quality.missing_airline_logos || 0));
    const otp = quality.on_time_performance || { avg_departure_delay: 0, avg_arrival_delay: 0, on_time_rate: 100, total_tracked: 0 };
    const cards = [
        {
            icon: 'fa-route',
            label: 'Longest distance',
            value: records.longest_distance?.distance ? formatKm(records.longest_distance.distance) : 'No distance yet',
            meta: routeLabel(records.longest_distance),
            flights: () => filterFlightsForInsight('route', `${records.longest_distance?.origin}-${records.longest_distance?.dest}`)
        },
        {
            icon: 'fa-clock',
            label: 'Longest time',
            value: records.longest_duration?.duration ? formatHours(records.longest_duration.duration) : 'No duration yet',
            meta: routeLabel(records.longest_duration),
            flights: () => filterFlightsForInsight('route', `${records.longest_duration?.origin}-${records.longest_duration?.dest}`)
        },
        {
            icon: 'fa-repeat',
            label: 'Most repeated route',
            value: records.most_frequent_route?.route || 'No repeat yet',
            meta: records.most_frequent_route?.count ? `${records.most_frequent_route.count} flights` : 'Every journey is still unique',
            flights: () => filterFlightsForInsight('route', records.most_frequent_route?.route)
        },
        {
            icon: 'fa-plane-arrival',
            label: 'On-time performance',
            value: `${otp.on_time_rate}% on-time`,
            meta: `Avg delay: Dep ${otp.avg_departure_delay}m / Arr ${otp.avg_arrival_delay}m`,
            flights: () => filterFlightsForInsight('delayed')
        },
        {
            icon: 'fa-screwdriver-wrench',
            label: 'Data health',
            value: qualityTotal ? `${formatCompactNumber(qualityTotal)} gaps` : 'All tidy',
            meta: qualityTotal ? 'Missing fields across flights and Library' : 'No obvious missing metadata',
            flights: () => [
                ...filterFlightsForInsight('missing', 'aircraft'),
                ...filterFlightsForInsight('missing', 'registration'),
                ...filterFlightsForInsight('missing', 'actual_times'),
                ...filterFlightsForInsight('missing', 'distance')
            ].filter((flight, index, rows) => rows.findIndex(row => row.id === flight.id) === index)
        }
    ];
    container.innerHTML = '';
    cards.forEach(card => {
        const el = document.createElement('button');
        el.className = 'journey-highlight-card';
        el.onclick = () => openFlightListModal(card.label, card.flights());
        el.innerHTML = `
            <span class="journey-highlight-icon"><i class="fa-solid ${card.icon}"></i></span>
            <div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><small>${escapeHtml(card.meta)}</small></div>
        `;
        container.appendChild(el);
    });
}

function destroyJourneyChart(key) {
    if (State.journeyCharts[key]) {
        State.journeyCharts[key].destroy();
        delete State.journeyCharts[key];
    }
}

function renderJourneyChart(key, config) {
    const canvas = document.getElementById(key);
    if (!canvas || typeof Chart === 'undefined') return;
    destroyJourneyChart(key);
    State.journeyCharts[key] = new Chart(canvas.getContext('2d'), config);
}

function renderMonthOfYearStats(monthRows) {
    const totals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0 }));
    (monthRows || []).forEach(row => {
        const month = Number(String(row.month || '').slice(5, 7));
        if (month >= 1 && month <= 12) totals[month - 1].count += Number(row.count || 0);
    });
    const max = Math.max(...totals.map(row => row.count), 1);
    return `<div class="month-of-year-grid">${totals.map(row => `
        <button class="month-of-year-item" onclick="openFlightListModal('Month pattern', filterFlightsForInsight('monthOfYear', ${row.month}))" title="${row.count} flights in month ${row.month}">
            <span>${String(row.month).padStart(2, '0')}</span>
            <i style="--month-level:${Math.max(8, Math.round((row.count / max) * 100))}%"></i>
            <strong>${row.count}</strong>
        </button>
    `).join('')}</div>`;
}

function renderJourneyTrends(stats) {
    const container = document.getElementById('journey-trends');
    if (!container) return;
    const months = stats.flights_by_month || [];
    const recentMonths = buildRecentTwelveMonths(months);
    const buckets = stats.distributions?.route_distance_buckets || [];
    const years = buildContinuousYears(stats);
    const byYear = (rows, key) => Object.fromEntries((rows || []).map(row => [row.year, Number(row[key] || 0)]));
    const flightMap = byYear(stats.flights_by_year, 'count');
    const distanceMap = byYear(stats.distance_by_year, 'distance');
    const durationMap = byYear(stats.duration_by_year, 'duration');

    const yearlySpanDataHtml = `
        <div class="yearly-span-table-container">
            <table class="yearly-span-table">
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>Flights</th>
                        <th>Distance</th>
                        <th>Duration</th>
                        <th>New Airports</th>
                    </tr>
                </thead>
                <tbody>
                    ${years.slice().reverse().map(y => {
                        const fCount = flightMap[y] || 0;
                        const dist = distanceMap[y] || 0;
                        const dur = durationMap[y] || 0;
                        const newApsByYr = (stats.new_airports_by_year || []).find(d => Number(d.year) === Number(y));
                        const newAps = newApsByYr ? newApsByYr.count : 0;
                        return `
                            <tr>
                                <td><strong>${y}</strong></td>
                                <td>${fCount}</td>
                                <td>${dist > 0 ? formatCompactNumber(Math.round(dist)) + ' km' : '-'}</td>
                                <td>${dur > 0 ? Math.floor(dur / 60) + 'h' : '-'}</td>
                                <td><span class="new-airport-badge ${newAps > 0 ? 'active' : ''}">${newAps > 0 ? `+${newAps}` : '-'}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = `
        <article class="journey-chart-card journey-chart-wide">
            <div class="stats-header">Yearly rhythm</div>
            <p class="journey-chart-note">Left axis: flights and hours. Right axis: total distance in km.</p>
            <div class="journey-chart-box"><canvas id="yearComboChart"></canvas></div>
            ${yearlySpanDataHtml}
        </article>
        
        <article class="journey-chart-card journey-chart-wide">
            <div class="stats-header">Monthly flight heatmap (Contribution Graph)</div>
            <p class="journey-chart-note">Grid color intensity represents flight frequency per month across years.</p>
            ${renderFlightHeatmap(months)}
        </article>

        <article class="journey-chart-card"><div class="stats-header">Recent months</div><div class="journey-chart-box"><canvas id="monthlyChart"></canvas></div></article>
        <article class="journey-chart-card"><div class="stats-header">Month pattern</div><p class="journey-chart-note">Flights grouped by calendar month, January through December.</p>${renderMonthOfYearStats(months)}</article>
        
        <article class="journey-chart-card journey-chart-wide">
            <div class="stats-header">Flight Profile Insights (Preferences & Distributions)</div>
            <div class="preference-donut-box">
                <div class="donut-chart-wrapper">
                    <span class="donut-chart-title">Cabin Class</span>
                    <div class="donut-canvas-container"><canvas id="classDonutChart"></canvas></div>
                </div>
                <div class="donut-chart-wrapper">
                    <span class="donut-chart-title">Seat Placement</span>
                    <div class="donut-canvas-container"><canvas id="seatDonutChart"></canvas></div>
                </div>
                <div class="donut-chart-wrapper">
                    <span class="donut-chart-title">Day & Night</span>
                    <div class="donut-canvas-container"><canvas id="dayNightDonutChart"></canvas></div>
                </div>
                <div class="donut-chart-wrapper">
                    <span class="donut-chart-title">Route Distance Mix</span>
                    <div class="donut-canvas-container"><canvas id="distanceBucketChart"></canvas></div>
                </div>
            </div>
        </article>

        <article class="journey-chart-card journey-chart-wide">
            <div class="stats-header">Footprint collection timeline</div>
            <p class="journey-chart-note">Growth curve of cumulative airports, cities, and countries unlocked over the years.</p>
            <div class="journey-chart-box"><canvas id="footprintGrowthChart"></canvas></div>
        </article>
    `;

    renderJourneyChart('yearComboChart', {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                { type: 'bar', label: 'Flights', data: years.map(y => flightMap[y] || 0), backgroundColor: 'rgba(28, 112, 191, .18)', borderColor: '#1c70bf', borderWidth: 1, borderRadius: 4, yAxisID: 'y' },
                { type: 'line', label: 'Distance (km)', data: years.map(y => distanceMap[y] || 0), borderColor: '#00a0b5', backgroundColor: 'rgba(0,160,181,.08)', tension: .35, pointRadius: 3, yAxisID: 'y1' },
                { type: 'line', label: 'Hours', data: years.map(y => Math.round((durationMap[y] || 0) / 60)), borderColor: '#ef8b2c', backgroundColor: 'rgba(239,139,44,.08)', tension: .35, pointRadius: 3, yAxisID: 'y' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            onClick: (event, elements) => {
                if (!elements.length) return;
                const year = years[elements[0].index];
                openFlightListModal('Yearly rhythm', filterFlightsForInsight('year', year));
            },
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Flights / Hours' }, grid: { color: '#eef3f8' } },
                y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Distance (km)' }, grid: { drawOnChartArea: false } },
                x: { grid: { display: false } }
            }
        }
    });

    renderJourneyChart('monthlyChart', {
        type: 'bar',
        data: { labels: recentMonths.map(d => d.month), datasets: [{ label: 'Flights', data: recentMonths.map(d => d.count), backgroundColor: 'rgba(28, 112, 191, 0.85)', borderColor: '#1c70bf', borderWidth: 1, borderRadius: 4 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (!elements.length) return;
                const month = recentMonths[elements[0].index].month;
                openFlightListModal('Recent months', filterFlightsForInsight('month', month));
            },
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Flights' }, grid: { color: '#eef3f8' } }, x: { grid: { display: false } } }
        }
    });

    renderJourneyChart('distanceBucketChart', {
        type: 'doughnut',
        data: { labels: buckets.map(d => d.name), datasets: [{ data: buckets.map(d => d.count), backgroundColor: ['#1c70bf', '#00a0b5', '#6cae75', '#ef8b2c', '#c86c8f', '#aeb9c6'], borderWidth: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (!elements.length) return;
                const bucket = buckets[elements[0].index]?.name;
                openFlightListModal('Route distance mix', filterFlightsForInsight('distanceBucket', bucket));
            },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } },
            cutout: '60%'
        }
    });

    const cabinCounts = {};
    const seatCounts = { Window: 0, Aisle: 0, Middle: 0 };
    const flights = State.cache.flights || [];
    
    flights.forEach(f => {
        const cls = (f.flight_class || 'Unknown').trim();
        cabinCounts[cls] = (cabinCounts[cls] || 0) + 1;
        
        const seat = (f.seat_number || '').trim().toUpperCase();
        if (seat) {
            const lastChar = seat.slice(-1);
            if (['A', 'F', 'K', 'L'].includes(lastChar)) {
                seatCounts.Window++;
            } else if (['C', 'D', 'G', 'H', 'J'].includes(lastChar)) {
                seatCounts.Aisle++;
            } else if (['B', 'E'].includes(lastChar)) {
                seatCounts.Middle++;
            }
        }
    });

    renderJourneyChart('classDonutChart', {
        type: 'doughnut',
        data: {
            labels: Object.keys(cabinCounts),
            datasets: [{
                data: Object.values(cabinCounts),
                backgroundColor: ['#1c70bf', '#00a0b5', '#6cae75', '#ef8b2c', '#c86c8f'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } },
            cutout: '60%'
        }
    });

    renderJourneyChart('seatDonutChart', {
        type: 'doughnut',
        data: {
            labels: ['Window', 'Aisle', 'Middle'],
            datasets: [{
                data: [seatCounts.Window, seatCounts.Aisle, seatCounts.Middle],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } },
            cutout: '60%'
        }
    });

    const dayNightCounts = stats.distributions?.day_night || [];
    const dayNightMap = Object.fromEntries(dayNightCounts.map(d => [d.name, d.count]));
    renderJourneyChart('dayNightDonutChart', {
        type: 'doughnut',
        data: {
            labels: ['Day', 'Night', 'Unknown'],
            datasets: [{
                data: [dayNightMap['Day'] || 0, dayNightMap['Night'] || 0, dayNightMap['Unknown'] || 0],
                backgroundColor: ['#ef8b2c', '#142943', '#8290a2'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } },
            cutout: '60%'
        }
    });

    // Render Footprint Growth Timeline Chart
    const cumAirports = stats.cumulative_airports_by_year || [];
    const cumCities = stats.cumulative_cities_by_year || [];
    const cumCountries = stats.cumulative_countries_by_year || [];
    
    const growthYears = buildContinuousYears(stats);
    const airportsMap = Object.fromEntries(cumAirports.map(d => [d.year, d.count]));
    const citiesMap = Object.fromEntries(cumCities.map(d => [d.year, d.count]));
    const countriesMap = Object.fromEntries(cumCountries.map(d => [d.year, d.count]));
    
    let lastAirports = 0, lastCities = 0, lastCountries = 0;
    const airportsData = [];
    const citiesData = [];
    const countriesData = [];
    
    growthYears.forEach(y => {
        if (airportsMap[y] !== undefined) lastAirports = airportsMap[y];
        if (citiesMap[y] !== undefined) lastCities = citiesMap[y];
        if (countriesMap[y] !== undefined) lastCountries = countriesMap[y];
        
        airportsData.push(lastAirports);
        citiesData.push(lastCities);
        countriesData.push(lastCountries);
    });

    renderJourneyChart('footprintGrowthChart', {
        type: 'line',
        data: {
            labels: growthYears,
            datasets: [
                { label: 'Airports', data: airportsData, borderColor: '#1c70bf', backgroundColor: 'rgba(28, 112, 191, .08)', fill: true, tension: 0.25, pointRadius: 3 },
                { label: 'Cities', data: citiesData, borderColor: '#00a0b5', backgroundColor: 'rgba(0, 160, 181, .08)', fill: true, tension: 0.25, pointRadius: 3 },
                { label: 'Countries', data: countriesData, borderColor: '#ef8b2c', backgroundColor: 'rgba(239, 139, 44, .08)', fill: true, tension: 0.25, pointRadius: 3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Cumulative Counts' }, grid: { color: '#eef3f8' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function datasetQualityFor(key, rows) {
    const isMissing = value => value === null || value === undefined || value === '';
    if (key === 'cities') return rows.filter(row => isMissing(row.country_code) || isMissing(row.timezone) || isMissing(row.continent)).length;
    if (key === 'airports') return rows.filter(row => isMissing(row.iata_code) || isMissing(row.icao_code) || isMissing(row.lat) || isMissing(row.lon) || isMissing(row.timezone)).length;
    if (key === 'airlines') return rows.filter(row => isMissing(row.iata_code) || isMissing(row.icao_code) || (isMissing(row.logo_url) && isMissing(row.logo_source_url))).length;
    if (key === 'aircraft_models') return rows.filter(row => isMissing(row.manufacturer) || isMissing(row.model)).length;
    return 0;
}

function renderLibraryOverview() {
    const container = document.getElementById('library-overview');
    if (!container) return;
    const items = [
        ['cities', 'Cities', 'fa-city'],
        ['airports', 'Airports', 'fa-tower-observation'],
        ['airlines', 'Airlines', 'fa-building'],
        ['aircraft_models', 'Aircraft', 'fa-plane']
    ];
    container.innerHTML = items.map(([key, label, icon]) => {
        const rows = State.cache[key] || [];
        const gaps = datasetQualityFor(key, rows);
        const active = State.currentDataset === key ? ' active' : '';
        const health = gaps ? `${formatCompactNumber(gaps)} gaps` : 'Healthy';
        return `<button class="library-overview-card${active}" onclick="switchDatasetTab('${key === 'aircraft_models' ? 'aircraft' : key}')">
            <span class="library-overview-icon"><i class="fa-solid ${icon}"></i></span>
            <span><strong>${formatCompactNumber(rows.length)}</strong><small>${escapeHtml(label)}</small></span>
            <em class="library-health-pill ${gaps ? 'needs-work' : ''}">${escapeHtml(health)}</em>
        </button>`;
    }).join('');
}

window.handleLocationClick = (title, topKey) => {
    if (State.cache.stats && State.cache.stats.top) {
        showStatsModal(title, State.cache.stats.top[topKey]);
    }
};

window.handleAllianceClick = (allianceName) => {
    const groups = {
        'SkyTeam (天合联盟)': ['SkyTeam', '天合联盟'],
        'Star Alliance (星空联盟)': ['Star Alliance', '星空联盟'],
        'Oneworld (寰宇一家)': ['Oneworld', '寰宇一家']
    };
    const keywords = groups[allianceName];
    if (!keywords || !State.cache.stats || !State.cache.stats.top) return;
    const filtered = State.cache.stats.top.airlines.filter(a => 
        keywords.some(kw => (a.extra || '').includes(kw))
    );
    showStatsModal(allianceName, filtered);
};

window.handleManufacturerClick = (manufacturerName) => {
    if (!State.cache.stats || !State.cache.stats.top) return;
    const filtered = State.cache.stats.top.aircraft.filter(a => a.extra === manufacturerName);
    showStatsModal(manufacturerName + ' Models', filtered);
};

const renderStatsDashboard = (stats, container) => {
    if (!container) return;
    container.innerHTML = '';

    // --- Card 1: Locations ---
    const locCard = document.createElement('article');
    locCard.className = 'aviation-world-card aviation-world-teal';
    locCard.onclick = () => showStatsModal('Top Airports', stats.top.airports);

    const locRows = [
        { label: 'Continents', count: stats.totals.continents, topKey: 'continents', title: 'Top Continents' },
        { label: 'Countries', count: stats.totals.countries, topKey: 'countries', title: 'Top Countries' },
        { label: 'Cities', count: stats.totals.cities, topKey: 'cities', title: 'Top Cities' },
        { label: 'Total Airports', count: stats.totals.airports, topKey: 'airports', title: 'Top Airports (Total Visits)' },
        { label: 'Departure Airports', count: stats.totals.airports_departure || 0, topKey: 'airports_departure', title: 'Top Departure Airports' },
        { label: 'Arrival Airports', count: stats.totals.airports_arrival || 0, topKey: 'airports_arrival', title: 'Top Arrival Airports' },
        { label: 'Routes', count: stats.totals.routes, topKey: 'routes', title: 'Top Routes' }
    ];

    const locRanksHtml = locRows.map((row, index) => `
        <button class="aviation-world-rank" onclick="event.stopPropagation(); handleLocationClick('${escapeHtml(row.title)}', '${escapeHtml(row.topKey)}')">
            <span>${index + 1}</span>
            <strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong>
            <em>${formatCompactNumber(row.count)}</em>
        </button>
    `).join('');

    locCard.innerHTML = `
        <div class="aviation-world-topline">
            <span class="aviation-world-icon"><i class="fa-solid fa-earth-americas"></i></span>
            <div><span>Locations</span><strong>${formatCompactNumber(stats.totals.airports)}</strong><small>airports</small></div>
        </div>
        <div class="aviation-world-ranks">${locRanksHtml}</div>
    `;
    container.appendChild(locCard);

    // --- Card 2: Airlines ---
    const alCard = document.createElement('article');
    alCard.className = 'aviation-world-card aviation-world-amber';
    alCard.onclick = () => showStatsModal('Top Airlines', stats.top.airlines);

    const groups = {
        'SkyTeam (天合联盟)': ['SkyTeam', '天合联盟'],
        'Star Alliance (星空联盟)': ['Star Alliance', '星空联盟'],
        'Oneworld (寰宇一家)': ['Oneworld', '寰宇一家']
    };
    const counts = {
        'SkyTeam (天合联盟)': 0,
        'Star Alliance (星空联盟)': 0,
        'Oneworld (寰宇一家)': 0
    };

    Object.entries(stats.breakdowns.alliance || {}).forEach(([k, v]) => {
        for (const [groupName, keywords] of Object.entries(groups)) {
            if (keywords.some(kw => k.includes(kw))) {
                counts[groupName] += v;
                break;
            }
        }
    });

    const allianceRows = Object.entries(counts)
        .filter(([k, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

    let alRanksHtml = '';
    if (!allianceRows.length) {
        alRanksHtml = '<div class="aviation-world-empty">No alliance data yet</div>';
    } else {
        alRanksHtml = allianceRows.map((row, index) => `
            <button class="aviation-world-rank" data-name="${escapeHtml(row.name)}" onclick="event.stopPropagation(); handleAllianceClick(this.getAttribute('data-name'))">
                <span>${index + 1}</span>
                <strong title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</strong>
                <em>${formatCompactNumber(row.count)}</em>
            </button>
        `).join('');
    }

    alCard.innerHTML = `
        <div class="aviation-world-topline">
            <span class="aviation-world-icon"><i class="fa-solid fa-building"></i></span>
            <div><span>Airlines</span><strong>${formatCompactNumber(stats.totals.airlines)}</strong><small>airlines</small></div>
        </div>
        <div class="aviation-world-ranks">${alRanksHtml}</div>
    `;
    container.appendChild(alCard);

    // --- Card 3: Aircraft ---
    const acCard = document.createElement('article');
    acCard.className = 'aviation-world-card aviation-world-rose';
    acCard.onclick = () => showStatsModal('Top Aircraft', stats.top.aircraft);

    const mfrs = Object.entries(stats.breakdowns.manufacturer || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    let acRanksHtml = '';
    if (!mfrs.length) {
        acRanksHtml = '<div class="aviation-world-empty">No aircraft data yet</div>';
    } else {
        acRanksHtml = mfrs.map((row, index) => `
            <button class="aviation-world-rank" data-name="${escapeHtml(row.name)}" onclick="event.stopPropagation(); handleManufacturerClick(this.getAttribute('data-name'))">
                <span>${index + 1}</span>
                <strong title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</strong>
                <em>${formatCompactNumber(row.count)}</em>
            </button>
        `).join('');
    }

    acCard.innerHTML = `
        <div class="aviation-world-topline">
            <span class="aviation-world-icon"><i class="fa-solid fa-plane-up"></i></span>
            <div><span>Aircraft</span><strong>${formatCompactNumber(stats.totals.aircraft)}</strong><small>models</small></div>
        </div>
        <div class="aviation-world-ranks">${acRanksHtml}</div>
    `;
    container.appendChild(acCard);
};

const showStatsModal = (title, data) => {
    openModal(title, () => {
        const d = document.createElement('div');
        d.style.maxHeight = '60vh'; d.style.overflowY = 'auto'; d.style.paddingRight = '10px';
        if (!data || data.length === 0) {
            d.innerHTML = '<p style="padding:10px; color:#666">No data available.</p>';
            return d;
        }
        const max = Math.max(...data.map(d => d.count), 1);
        data.forEach(item => {
            const row = document.createElement('div');
            row.className = 'chart-row';
            const pct = (item.count / max) * 100;
            const extra = item.extra ? ` <small style='color:#999; margin-left:5px;'>${escapeHtml(item.extra)}</small>` : '';
            row.innerHTML = `
                <div class="chart-label" title="${escapeHtml(item.name)}">${escapeHtml(item.name || 'Unknown')}${extra}</div>
                <div class="chart-bar-bg"><div class="chart-bar" style="width:${pct}%"></div></div>
                <div class="chart-val">${item.count}</div>
            `;
            d.appendChild(row);
        });
        return d;
    });
};

function renderJourneyHero(flights) {
    const totalDist = flights.reduce((sum, f) => sum + (parseFloat(f.distance) || 0), 0);
    const totalMin = flights.reduce((sum, f) => sum + (f.duration_actual || f.duration_scheduled || 0), 0);
    const airportIds = new Set(flights.flatMap(f => [f.origin_airport_id, f.dest_airport_id]).filter(Boolean));
    const airlineIds = new Set(flights.map(f => f.airline_id).filter(Boolean));
    const latest = flights[0] || {};
    const count = document.getElementById('journey-flight-count');
    const summary = document.getElementById('journey-summary');
    const route = document.getElementById('journey-route');
    const metrics = document.getElementById('journey-metrics');
    
    if (count) count.textContent = `${flights.length.toLocaleString()} flights`;
    if (summary) summary.textContent = `${Math.round(totalDist).toLocaleString()} km across ${airportIds.size} airports`;
    if (route) route.innerHTML = latest.origin_code && latest.dest_code ? `<strong>${escapeHtml(latest.origin_code)}</strong><span></span><i class="fa-solid fa-plane"></i><span></span><strong>${escapeHtml(latest.dest_code)}</strong>` : '<strong>Ready for your next journey</strong>';
    
    // Inject latest flight data health reminder
    let reminder = document.getElementById('journey-health-reminder');
    if (latest.id) {
        const missingFields = [];
        if (!latest.aircraft_model_id) missingFields.push('aircraft model');
        if (!latest.registration) missingFields.push('registration');
        if (!latest.distance) missingFields.push('distance');
        if (!latest.atd || !latest.ata || !latest.std || !latest.sta) missingFields.push('flight times');
        
        if (missingFields.length > 0) {
            if (!reminder) {
                reminder = document.createElement('div');
                reminder.id = 'journey-health-reminder';
                reminder.className = 'journey-health-reminder';
                if (route && route.parentNode) {
                    route.parentNode.insertBefore(reminder, route.nextSibling);
                }
            }
            reminder.onclick = () => openEntityPanel('flights', latest.id);
            reminder.innerHTML = `
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>Latest flight <b>${escapeHtml(latest.flight_number || 'Flight')}</b> is missing: ${missingFields.join(', ')}. Complete now →</span>
            `;
            reminder.style.display = 'flex';
        } else if (reminder) {
            reminder.style.display = 'none';
        }
    } else if (reminder) {
        reminder.style.display = 'none';
    }

    const earthRoundsVal = totalDist / 40075;
    const earthRounds = earthRoundsVal >= 10 ? earthRoundsVal.toFixed(1) : earthRoundsVal.toFixed(2);
    const flightDays = (totalMin / (60 * 24)).toFixed(1);

    if (metrics) metrics.innerHTML = `
        <div class="journey-metric">
            <span>Distance</span>
            <strong>${Math.round(totalDist).toLocaleString()} km</strong>
            <small class="journey-metric-sub">约绕地球 ${earthRounds} 圈</small>
        </div>
        <div class="journey-metric">
            <span>In the air</span>
            <strong>${Math.floor(totalMin / 60).toLocaleString()}h</strong>
            <small class="journey-metric-sub">约 ${flightDays} 天在空中</small>
        </div>
        <div class="journey-metric">
            <span>Airports</span>
            <strong>${airportIds.size}</strong>
            <small class="journey-metric-sub">visited</small>
        </div>
        <div class="journey-metric">
            <span>Airlines</span>
            <strong>${airlineIds.size}</strong>
            <small class="journey-metric-sub">carriers</small>
        </div>`;
}

// Calculate & Render Header Stats
const renderHeaderStats = (flights) => {
    renderJourneyHero(flights);
};

async function loadProfile() {
    try {
        const [stats, flights] = await Promise.all([
            API.get('stats'),
            API.get('flights/detailed')
        ]);
        State.cache.flights = flights;
        State.cache.stats = stats;
        console.log(`Data fetched: ${flights.length} flights`);

        // 1. Header Stats
        try {
            renderHeaderStats(flights);
            console.log("Header stats rendered");
        } catch (e) {
            console.error("Header error: " + e.message);
        }

        // 2. Dashboard
        try {
            renderJourneyHighlights(stats);
            renderJourneyTrends(stats);
            renderStatsDashboard(stats, document.getElementById('profile-stats-dashboard'));
            console.log("Dashboard rendered");
        } catch (e) {
            console.error("Dashboard error: " + e.message);
        }

        // 3. Map
        try {
            renderProfileMap(flights, 'all');
            console.log("Map rendered");
        } catch (e) {
            console.error("Map error: " + e.message);
        }

        // Year Logic
        const yearSelect = document.getElementById('year-filter');
        if (yearSelect) {
            yearSelect.innerHTML = '<option value="all">All Years</option>';
            const years = new Set(flights.map(f => f.date ? f.date.substring(0, 4) : null).filter(y => y));
            const sortedYears = Array.from(years).sort().reverse();
            sortedYears.forEach(year => yearSelect.options.add(new Option(year, year)));

            // Remove old listeners by cloning or reassigning
            const newSelect = yearSelect.cloneNode(true);
            yearSelect.parentNode.replaceChild(newSelect, yearSelect);
            newSelect.onchange = () => {
                const val = newSelect.value;
                const filtered = val === 'all' ? flights : flights.filter(f => f.date && f.date.startsWith(val));
                renderHeaderStats(filtered);
                renderProfileMap(flights, val);
                invalidateProfileMapSize();
            };
        }

    } catch (e) {
        console.error("Profile load error", e);
    }
}

// Extracted Map Rendering
function renderProfileMap(flights, selectedYear) {
    if (!State.map) initMap();
    if (!State.map) return;

    State.profileMapFlights = flights;
    State.profileMapSelectedYear = selectedYear;
    bindProfileMapMoveHandler();
    refreshProfileMapLayers({ fitBounds: true });
    invalidateProfileMapSize();
}

function refreshProfileMapLayers({ fitBounds = false } = {}) {
    if (!State.map || !State.profileMapFlights) return;

    const selectedYear = State.profileMapSelectedYear;
    const flights = State.profileMapFlights;
    const filtered = selectedYear === 'all' ? flights : flights.filter(f => f.date && f.date.startsWith(selectedYear));
    const longitudeOffsets = getVisibleWorldLongitudeOffsets(State.map, 1);

    // Clear Layers
    if (State.profileLayers) {
        State.profileLayers.forEach(l => l.remove());
    }
    State.profileLayers = [];

    const airports = {};
    const fitLayers = [];
    let drawnCount = 0;

    console.log("renderProfileMap: filtered flights =", filtered.length);
    filtered.forEach(f => {
        if (!f.origin || !f.dest) {
            console.log("Missing origin or dest");
            return;
        }
        const lat1 = parseFloat(f.origin.lat), lon1 = parseFloat(f.origin.lon);
        const lat2 = parseFloat(f.dest.lat), lon2 = parseFloat(f.dest.lon);

        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return;

        // Draw Geodesic Line
        const curvePoints = getGeodesicPath(lat1, lon1, lat2, lon2);
        longitudeOffsets.forEach(offset => {
            const line = L.polyline(shiftPathLongitude(curvePoints, offset), { color: '#ffb800', weight: 2, opacity: 0.6 });
            line.bindPopup(`${escapeHtml(f.flight_number)}<br>${escapeHtml(f.date)}<br>${escapeHtml(f.origin.code)} -> ${escapeHtml(f.dest.code)}`);
            line.addTo(State.map);
            State.profileLayers.push(line);
        });
        if (fitBounds) fitLayers.push(L.polyline(curvePoints));
        drawnCount++;

        airports[f.origin.code] = { loc: [lat1, lon1], name: f.origin.name };
        airports[f.dest.code] = { loc: [lat2, lon2], name: f.dest.name };
    });

    // Draw Markers
    Object.entries(airports).forEach(([code, data]) => {
        longitudeOffsets.forEach(offset => {
            const loc = [data.loc[0], data.loc[1] + offset];
            const m = L.circleMarker(loc, { radius: 4, color: '#00b0ff', fillColor: '#00b0ff', fillOpacity: 0.8 });
            m.bindPopup(`<b>${escapeHtml(code)}</b><br>${escapeHtml(data.name)}`);
            m.addTo(State.map);
            State.profileLayers.push(m);
        });
        if (fitBounds) fitLayers.push(L.circleMarker(data.loc));
    });

    // Fit Bounds
    if (fitBounds && fitLayers.length > 0) {
        const group = new L.featureGroup(fitLayers);
        State.map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
    console.log(`Map rendering complete: ${drawnCount} routes drawn across ${longitudeOffsets.length} world copies, ${Object.keys(airports).length} airports`);
}

// --- Stage 2 Features: Heatmap & Filters ---

function renderFlightHeatmap(months) {
    const dataByYearMonth = {};
    let minYear = new Date().getFullYear();
    let maxYear = minYear;

    months.forEach(m => {
        const parts = m.month.split('-');
        if (parts.length === 2) {
            const yr = parseInt(parts[0], 10);
            const mn = parseInt(parts[1], 10);
            if (!dataByYearMonth[yr]) dataByYearMonth[yr] = {};
            dataByYearMonth[yr][mn] = parseInt(m.count, 10);
            if (yr < minYear) minYear = yr;
            if (yr > maxYear) maxYear = yr;
        }
    });

    // Years from minYear to maxYear (left to right)
    const years = [];
    for (let y = minYear; y <= maxYear; y++) {
        years.push(y);
    }

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = months.map(m => parseInt(m.count, 10));
    const maxCount = Math.max(...counts, 1);

    const getLevelClass = (count) => {
        if (!count) return 'level-0';
        const pct = count / maxCount;
        if (pct <= 0.25) return 'level-1';
        if (pct <= 0.5) return 'level-2';
        if (pct <= 0.75) return 'level-3';
        return 'level-4';
    };

    let html = `
        <div class="heatmap-container">
            <div class="heatmap-header">
                <div class="heatmap-label-placeholder"></div>
                ${years.map(yr => `<div class="heatmap-year-column-label">${yr}</div>`).join('')}
            </div>
            <div class="heatmap-grid">
    `;

    // 12 rows for months
    monthLabels.forEach((monthName, monthIdx) => {
        const mn = monthIdx + 1; // 1-indexed month
        html += `<div class="heatmap-row"><div class="heatmap-month-row-label">${monthName}</div>`;
        years.forEach(yr => {
            const count = (dataByYearMonth[yr] && dataByYearMonth[yr][mn]) || 0;
            const monthStr = `${yr}-${String(mn).padStart(2, '0')}`;
            const levelClass = getLevelClass(count);
            html += `
                <button class="heatmap-cell ${levelClass}" 
                        title="${yr}-${monthName}: ${count} flights" 
                        onclick="openFlightListModal('${yr}-${monthName}', filterFlightsForInsight('month', '${monthStr}'))">
                </button>
            `;
        });
        html += `</div>`;
    });

    html += `
            </div>
            <div class="heatmap-legend">
                <span>Less</span>
                <span class="heatmap-cell level-0"></span>
                <span class="heatmap-cell level-1"></span>
                <span class="heatmap-cell level-2"></span>
                <span class="heatmap-cell level-3"></span>
                <span class="heatmap-cell level-4"></span>
                <span>More</span>
            </div>
        </div>
    `;

    return html;
}

function renderLibraryFilters(datasetKey) {
    const bar = document.getElementById('dataset-filters-bar');
    if (!bar) return;
    bar.innerHTML = '';
    bar.style.display = 'flex';

    const data = State.cache[datasetKey] || [];
    const getUniqueValues = (list, key) => {
        return [...new Set(list.map(item => item[key]).filter(Boolean))].sort();
    };

    if (datasetKey === 'cities') {
        const continents = getUniqueValues(data, 'continent');
        const countries = getUniqueValues(data, 'country');

        bar.innerHTML = `
            <label>Continent: 
                <select id="filter-city-continent" onchange="applyLibraryFilter('continent', this.value)">
                    <option value="">All</option>
                    ${continents.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </label>
            <label>Country: 
                <select id="filter-city-country" onchange="applyLibraryFilter('country', this.value)">
                    <option value="">All</option>
                    ${countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </label>
            <label>Data Gaps: 
                <select id="filter-city-gaps" onchange="applyLibraryFilter('gaps', this.value)">
                    <option value="">All</option>
                    <option value="timezone">Missing Timezone</option>
                    <option value="continent">Missing Continent</option>
                    <option value="country_code">Missing Country Code</option>
                </select>
            </label>
        `;
    } else if (datasetKey === 'airports') {
        const countries = [...new Set((State.cache.cities || []).map(c => c.country).filter(Boolean))].sort();
        const cities = getUniqueValues(State.cache.cities || [], 'name');

        bar.innerHTML = `
            <label>Country: 
                <select id="filter-airport-country" onchange="applyLibraryFilter('country', this.value)">
                    <option value="">All</option>
                    ${countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </label>
            <label>City: 
                <select id="filter-airport-city" onchange="applyLibraryFilter('city', this.value)">
                    <option value="">All</option>
                    ${cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </label>
            <label>Data Gaps: 
                <select id="filter-airport-gaps" onchange="applyLibraryFilter('gaps', this.value)">
                    <option value="">All</option>
                    <option value="iata_code">Missing IATA</option>
                    <option value="icao_code">Missing ICAO</option>
                    <option value="coordinates">Missing Coordinates</option>
                    <option value="timezone">Missing Timezone</option>
                </select>
            </label>
        `;
    } else if (datasetKey === 'airlines') {
        const alliances = getUniqueValues(data, 'alliance');
        const countries = getUniqueValues(data, 'country');

        bar.innerHTML = `
            <label>Alliance: 
                <select id="filter-airline-alliance" onchange="applyLibraryFilter('alliance', this.value)">
                    <option value="">All</option>
                    ${alliances.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
                </select>
            </label>
            <label>Country: 
                <select id="filter-airline-country" onchange="applyLibraryFilter('country', this.value)">
                    <option value="">All</option>
                    ${countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </label>
            <label>Logo: 
                <select id="filter-airline-logo" onchange="applyLibraryFilter('logo', this.value)">
                    <option value="">All</option>
                    <option value="has">Has Logo</option>
                    <option value="missing">No Logo</option>
                </select>
            </label>
            <label>Website: 
                <select id="filter-airline-website" onchange="applyLibraryFilter('website', this.value)">
                    <option value="">All</option>
                    <option value="has">Has Website</option>
                    <option value="missing">No Website</option>
                </select>
            </label>
        `;
    } else if (datasetKey === 'aircraft_models') {
        const manufacturers = getUniqueValues(data, 'manufacturer');
        const seriesList = getUniqueValues(data, 'series');
        
        const allTags = new Set();
        data.forEach(item => {
            ['tags_generation', 'tags_winglets', 'tags_config'].forEach(key => {
                if (item[key]) {
                    item[key].split(',').map(t => t.trim()).filter(Boolean).forEach(t => allTags.add(t));
                }
            });
        });
        const tags = [...allTags].sort();

        bar.innerHTML = `
            <label>Manufacturer: 
                <select id="filter-aircraft-mfr" onchange="applyLibraryFilter('manufacturer', this.value)">
                    <option value="">All</option>
                    ${manufacturers.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
                </select>
            </label>
            <label>Series: 
                <select id="filter-aircraft-series" onchange="applyLibraryFilter('series', this.value)">
                    <option value="">All</option>
                    ${seriesList.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
                </select>
            </label>
            <label>Tag Chip: 
                <select id="filter-aircraft-tag" onchange="applyLibraryFilter('tag', this.value)">
                    <option value="">All</option>
                    ${tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
                </select>
            </label>
        `;
    }
}
window.renderLibraryFilters = renderLibraryFilters;

function applyLibraryFilter(key, value) {
    State.libraryFilters[key] = value;
    const config = DATASETS[State.currentDataset];
    const data = State.cache[State.currentDataset] || [];
    renderDatasetTable(config, data);
}
window.applyLibraryFilter = applyLibraryFilter;

function getDataHealthBadges(datasetKey, item) {
    const badges = [];
    const isMissing = val => val === null || val === undefined || val === '';
    if (datasetKey === 'cities') {
        if (isMissing(item.timezone)) badges.push('<span class="health-badge missing">Missing timezone</span>');
        if (isMissing(item.continent)) badges.push('<span class="health-badge missing">Missing continent</span>');
        if (isMissing(item.country_code)) badges.push('<span class="health-badge missing">Missing code</span>');
    } else if (datasetKey === 'airports') {
        if (isMissing(item.iata_code)) badges.push('<span class="health-badge missing">Missing IATA</span>');
        if (isMissing(item.icao_code)) badges.push('<span class="health-badge missing">Missing ICAO</span>');
        if (isMissing(item.lat) || isMissing(item.lon)) badges.push('<span class="health-badge missing">No coordinates</span>');
        if (isMissing(item.timezone)) badges.push('<span class="health-badge missing">Missing timezone</span>');
    } else if (datasetKey === 'airlines') {
        if (isMissing(item.iata_code) && isMissing(item.icao_code)) badges.push('<span class="health-badge missing">No codes</span>');
        if (isMissing(item.logo_url) && isMissing(item.logo_source_url)) badges.push('<span class="health-badge missing">No logo</span>');
        if (isMissing(item.website_url)) badges.push('<span class="health-badge missing">No website</span>');
    } else if (datasetKey === 'aircraft_models') {
        if (isMissing(item.manufacturer)) badges.push('<span class="health-badge missing">No manufacturer</span>');
        if (isMissing(item.model)) badges.push('<span class="health-badge missing">No model</span>');
    }
    return badges.join('');
}
window.getDataHealthBadges = getDataHealthBadges;

function getProcessedDatasetData(config, data) {
    let processedData = [...data];

    // 1. Text Filter
    if (State.filter) {
        processedData = processedData.filter(item => {
            return Object.values(item).some(val =>
                String(val).toLowerCase().includes(State.filter)
            );
        });
    }

    // 2. Composite Filters
    if (State.libraryFilters) {
        Object.entries(State.libraryFilters).forEach(([key, val]) => {
            if (!val) return;
            
            if (State.currentDataset === 'cities') {
                if (key === 'gaps') {
                    if (val === 'timezone') processedData = processedData.filter(item => !item.timezone);
                    if (val === 'continent') processedData = processedData.filter(item => !item.continent);
                    if (val === 'country_code') processedData = processedData.filter(item => !item.country_code);
                } else {
                    processedData = processedData.filter(item => String(item[key]) === val);
                }
            } else if (State.currentDataset === 'airports') {
                if (key === 'gaps') {
                    if (val === 'iata_code') processedData = processedData.filter(item => !item.iata_code);
                    if (val === 'icao_code') processedData = processedData.filter(item => !item.icao_code);
                    if (val === 'timezone') processedData = processedData.filter(item => !item.timezone);
                    if (val === 'coordinates') processedData = processedData.filter(item => item.lat === null || item.lon === null);
                } else if (key === 'country') {
                    processedData = processedData.filter(item => {
                        const cityItem = (State.cache.cities || []).find(c => c.id === item.city_id);
                        return cityItem && cityItem.country === val;
                    });
                } else if (key === 'city') {
                    processedData = processedData.filter(item => {
                        const cityItem = (State.cache.cities || []).find(c => c.id === item.city_id);
                        return cityItem && cityItem.name === val;
                    });
                } else {
                    processedData = processedData.filter(item => String(item[key]) === val);
                }
            } else if (State.currentDataset === 'airlines') {
                if (key === 'logo') {
                    if (val === 'has') processedData = processedData.filter(item => item.logo_url || item.logo_source_url);
                    if (val === 'missing') processedData = processedData.filter(item => !item.logo_url && !item.logo_source_url);
                } else if (key === 'website') {
                    if (val === 'has') processedData = processedData.filter(item => item.website_url);
                    if (val === 'missing') processedData = processedData.filter(item => !item.website_url);
                } else {
                    processedData = processedData.filter(item => String(item[key]) === val);
                }
            } else if (State.currentDataset === 'aircraft_models') {
                if (key === 'tag') {
                    processedData = processedData.filter(item => {
                        const tags = [item.tags_generation, item.tags_winglets, item.tags_config]
                            .filter(Boolean)
                            .flatMap(t => t.split(',').map(s => s.trim().toUpperCase()));
                        return tags.includes(val.toUpperCase());
                    });
                } else {
                    processedData = processedData.filter(item => String(item[key]) === val);
                }
            }
        });
    }

    // 3. Sort
    if (State.sort.key) {
        processedData.sort((a, b) => {
            let valA = a[State.sort.key];
            let valB = b[State.sort.key];

            const colDef = config.columns.find(c => c.key === State.sort.key);
            if (colDef && colDef.type === 'lookup' && State.cache[colDef.lookup]) {
                const lookupA = State.cache[colDef.lookup].find(i => i.id === valA);
                const lookupB = State.cache[colDef.lookup].find(i => i.id === valB);
                valA = lookupA ? lookupA[colDef.display] : valA;
                valB = lookupB ? lookupB[colDef.display] : valB;
            }

            if (valA < valB) return State.sort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return State.sort.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return processedData;
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("FlightLog: App Initializing...");
        initMap();
        console.log("FlightLog: Map Initialized");
        navigateTo('profile');
        console.log("FlightLog: Navigated to Profile");
    } catch (e) {
        console.error("FlightLog Init Error:", e);
        alert("App Initialization Failed: " + e.message);
    }
});
