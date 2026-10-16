
// --- Constants & Config ---
const API_BASE = '/api';

const ALLIANCE_LABELS = Object.freeze({
    SkyTeam: 'SkyTeam (天合联盟)',
    'Star Alliance': 'Star Alliance (星空联盟)',
    Oneworld: 'Oneworld (寰宇一家)'
});

function formatAllianceLabel(value) {
    return ALLIANCE_LABELS[value] || value || '';
}

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
            { key: 'alliance', label: 'Alliance' },
            { key: 'frequent_flyer_program', label: 'Loyalty Program' },
            { key: 'frequent_flyer_id', label: 'Member No.' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'iata_code', label: 'IATA Code', type: 'text', required: false },
            { key: 'icao_code', label: 'ICAO Code', type: 'text', required: false },
            { key: 'callsign', label: 'Callsign', type: 'text', required: false },
            { key: 'country', label: 'Country', type: 'text', required: false },
            { key: 'alliance', label: 'Alliance', type: 'select', options: Object.entries(ALLIANCE_LABELS).map(([, label]) => ({ value: label, label })), required: false },
            { key: 'frequent_flyer_program', label: 'Loyalty Program', type: 'text', required: false, placeholder: 'e.g. Flying Blue' },
            { key: 'frequent_flyer_id', label: 'Member Number', type: 'text', required: false, placeholder: 'No spaces or airline prefix', help: 'Store the account number as issued. Do not add airline codes such as EK or TK; spaces and hyphens are removed on save.' },
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
    globeMap: null,
    globeMapLoaded: false,
    cache: {
        cities: [],
        airports: [],
        airlines: [],
        aircraft_models: [],
        flights: []
    },
    flightSort: { key: 'date', dir: 'desc' },
    flightQuery: '',
    flightHealthOnly: false,
    profileLayers: [],
    profileMapFlights: null,
    profileMapSelectedYear: 'all',
    profileMapMoveHandlerBound: false,
    profileMapResizeObserverBound: false,
    entityPanelHistory: [],
    entityPanelCurrent: null,
    entityPanelTrigger: null,
    entityPanelRequest: 0,
    journeyCharts: {},
    libraryViewMode: 'table',
    libraryFilters: {},
    filter: '',
    sort: { key: null, dir: 'asc' }
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

function showToast(message, type = 'success') {
    let region = document.getElementById('toast-region');
    if (!region) {
        region = document.createElement('div');
        region.id = 'toast-region';
        region.className = 'toast-region';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'false');
        document.body.appendChild(region);
    }
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icons = { error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info', success: 'fa-circle-check' };
    const icon = icons[type] || icons.success;
    toast.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
    region.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 180);
    }, type === 'error' ? 5200 : 3200);
}

function setButtonBusy(button, busy, label = 'Working…') {
    if (!button) return;
    if (busy) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>${escapeHtml(label)}</span>`;
    } else {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }
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
                    <label for="airline-logo-url">Public logo URL</label>
                    <input id="airline-logo-url" name="source_url" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com/airline-logo.svg">
                    <small>Recommended for the free plan. The original URL remains as a fallback.</small>
                </div>
                <div class="form-group full-width">
                    <label for="airline-logo-file">Or upload a logo</label>
                    <input id="airline-logo-file" name="file" type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml">
                    <small>PNG, JPEG, WebP, or SVG, up to 1 MB. Uploads require ImageKit configuration.</small>
                </div>
            </form>`;
        return container;
    }, async data => {
        const overlay = modalStack[modalStack.length - 1]?.overlay;
        const file = overlay?.querySelector('input[name="file"]')?.files?.[0];
        let result;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            result = await API.upload(`airlines/${id}/logo`, formData);
        } else {
            const sourceUrl = (data.source_url || '').trim();
            if (!sourceUrl) {
                throw new Error('Enter a public logo URL or choose a file.');
            }
            result = await API.post(`airlines/${id}/logo`, { source_url: sourceUrl });
        }
        if (result.error) {
            throw new Error(result.error);
        }
        openEntityPanel('airlines', id, false);
        if (State.currentView === 'flights') loadFlights();
        if (State.currentView === 'datasets' && State.currentDataset === 'airlines') loadDataset('airlines');
        showToast('Airline logo updated.');
        return true;
    });
}

function invalidateProfileMapSize() {
    if (!State.map && !State.globeMap) return;
    const invalidate = () => {
        if (State.profileMapType === 'globe') State.globeMap?.resize();
        else State.map?.invalidateSize({ pan: false });
    };
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

    const observer = new ResizeObserver(() => {
        if (!container.clientWidth || !container.clientHeight) return;
        if (State.profileMapType === 'globe') {
            State.globeMap?.resize();
        } else {
            State.map.invalidateSize({ pan: false });
            if (State.profileMapFlights) refreshProfileMapLayers({ fitBounds: true });
        }
    });
    observer.observe(container);
    State.profileMapResizeObserverBound = true;
}

function setSettingsDropdown(open, { restoreFocus = false } = {}) {
    const dropdown = document.getElementById('settings-dropdown');
    const button = document.getElementById('settings-menu-button');
    if (!dropdown || !button) return;
    dropdown.classList.toggle('show', open);
    button.setAttribute('aria-expanded', String(open));
    if (restoreFocus) button.focus();
}

function toggleDropdown() {
    const dropdown = document.getElementById('settings-dropdown');
    setSettingsDropdown(!dropdown?.classList.contains('show'));
}

document.addEventListener('click', event => {
    const dropdown = document.getElementById('settings-dropdown');
    if (dropdown?.classList.contains('show') && !dropdown.contains(event.target)) setSettingsDropdown(false);
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('settings-dropdown')?.classList.contains('show')) {
        event.preventDefault();
        setSettingsDropdown(false, { restoreFocus: true });
    }
});

async function openEditProfileModal() {
    // Pre-fetch API key status before opening modal
    let apiKeyConfigured = false;
    try {
        const status = await API.get('profile/api-key');
        apiKeyConfigured = status.configured;
    } catch (e) {}

    const statusText = apiKeyConfigured ? 'Configured ✓' : 'Not set';
    const statusClass = apiKeyConfigured ? 'configured' : 'missing';

    openModal('Edit Profile', () => {
        const div = document.createElement('div');
        div.innerHTML = `
            <form id="edit-profile-form" class="form-grid">
                <div class="form-group form-group-wide">
                    <label for="profile-username">Username</label>
                    <input id="profile-username" type="text" name="username" value="${escapeHtml(CURRENT_USER.username)}" autocomplete="username" required>
                </div>
                <div class="form-group">
                    <label for="profile-password">New password</label>
                    <input id="profile-password" type="password" name="password" autocomplete="new-password" placeholder="Leave blank to keep current">
                </div>
                <div class="form-group">
                    <label for="profile-confirm-password">Confirm new password</label>
                    <input id="profile-confirm-password" type="password" name="confirm_password" autocomplete="new-password" placeholder="Repeat new password">
                </div>
                <div class="form-section-divider form-group-wide"><span>Flight data integration</span></div>
                <div class="form-group form-group-wide">
                    <label for="profile-api-key">FlightAware API key <span class="field-status field-status-${statusClass}">${statusText}</span></label>
                    <input id="profile-api-key" type="password" name="flightaware_api_key" autocomplete="off" placeholder="Leave blank to keep current">
                </div>
            </form>
        `;
        return div;
    }, async () => {
        const form = document.querySelector('#edit-profile-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (data.password && data.password !== data.confirm_password) {
            throw new Error('The new passwords do not match.');
        }

        const payload = {
            username: data.username,
            password: data.password || null
        };

        const res = await API.post('profile/update', payload);
        if (res.error) {
            throw new Error(res.error);
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
                throw new Error(`Profile saved, but the API key could not be saved: ${keyRes.error}`);
            }
        }

        showToast(newApiKey ? 'Profile and FlightAware API key saved.' : (res.message || 'Profile saved.'));
        return true;
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
    const wasClosed = document.getElementById('entity-panel')?.hidden !== false;
    if (wasClosed) State.entityPanelTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (pushHistory) State.entityPanelHistory.push({ type, id: Number(id) });
    const panel = document.getElementById('entity-panel');
    const overlay = document.getElementById('entity-panel-overlay');
    const body = document.getElementById('entity-panel-body');
    const requestId = ++State.entityPanelRequest;
    panel.hidden = false;
    overlay.hidden = false;
    panel.setAttribute('aria-busy', 'true');
    document.body.classList.add('entity-panel-open');
    updateEntityPanelNavigation();
    body.innerHTML = '<div class="entity-panel-state" role="status"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><span>Loading details…</span></div>';
    requestAnimationFrame(() => panel.focus());
    try {
        const payload = await API.get(`entities/${type}/${id}`);
        if (requestId !== State.entityPanelRequest || panel.hidden) return;
        if (payload.error) throw new Error(payload.error);
        renderEntityPanel(payload);
    } catch (error) {
        if (requestId !== State.entityPanelRequest || panel.hidden) return;
        body.innerHTML = `<div class="entity-panel-state entity-panel-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><strong>Unable to load details</strong><span>${escapeHtml(error.message || 'Please try again.')}</span><button class="btn btn-secondary" type="button" onclick="openEntityPanel('${type}', ${Number(id)}, false)">Retry</button></div>`;
    } finally {
        if (requestId === State.entityPanelRequest) panel.removeAttribute('aria-busy');
    }
}

function closeEntityPanel() {
    const panel = document.getElementById('entity-panel');
    if (!panel || panel.hidden) return;
    State.entityPanelRequest += 1;
    panel.hidden = true;
    document.getElementById('entity-panel-overlay').hidden = true;
    document.body.classList.remove('entity-panel-open');
    State.entityPanelHistory = [];
    State.entityPanelCurrent = null;
    Object.values(State.miniMaps || {}).forEach(map => map?.remove?.());
    State.miniMaps = {};
    const trigger = State.entityPanelTrigger;
    State.entityPanelTrigger = null;
    if (trigger?.isConnected) trigger.focus();
}

function updateEntityPanelNavigation() {
    const back = document.getElementById('entity-panel-back');
    if (!back) return;
    const canGoBack = State.entityPanelHistory.length > 1;
    back.disabled = !canGoBack;
    back.setAttribute('aria-label', canGoBack ? 'Back to previous details' : 'No previous details');
}

function goBackEntityPanel() {
    if (State.entityPanelHistory.length <= 1) return closeEntityPanel();
    State.entityPanelHistory.pop();
    const previous = State.entityPanelHistory[State.entityPanelHistory.length - 1];
    updateEntityPanelNavigation();
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

async function deleteCurrentEntityPanel(button = null) {
    const current = State.entityPanelCurrent;
    if (!current) return;
    const label = entityDisplayName(current.type, current.entity);
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setButtonBusy(button, true, 'Deleting…');
    try {
        const result = await API.delete(current.type, current.entity.id);
        if (result.error) throw new Error(result.error);
        closeEntityPanel();
        showToast(`${ENTITY_LABELS[current.type] || 'Record'} deleted.`);
        if (State.currentView === 'profile') loadProfile();
        if (State.currentView === 'flights') loadFlights();
        if (State.currentView === 'datasets' && State.currentDataset === current.type) loadDataset(current.type, { resetControls: false });
    } catch (error) {
        showToast(error?.message || 'Delete failed.', 'error');
    } finally {
        setButtonBusy(button, false);
    }
}

document.addEventListener('keydown', event => {
    const panel = document.getElementById('entity-panel');
    if (!panel || panel.hidden || modalStack.length) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closeEntityPanel();
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
        .filter(element => element.offsetParent !== null);
    if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});

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

function formatTerminal(term) {
    if (!term) return '';
    let t = String(term).trim();
    t = t.replace(/^航站楼\s*/i, '');
    if (/^t?\d+[a-z]?$/i.test(t)) {
        return `T${t.replace(/^t/i, '')}`;
    }
    if (t.toUpperCase().startsWith('T')) {
        return t;
    }
    if (/^[a-z]$/i.test(t)) {
        return `T${t}`;
    }
    return t;
}

function parseDateTime(val, defaultDate) {
    if (!val) return { dateStr: defaultDate || '', formattedDate: formatFlightDate(defaultDate), timeStr: '—' };
    const s = String(val).trim();
    const dateMatch = s.match(/(\d{4}-\d{2}-\d{2})/);
    const timeMatch = s.match(/(\d{2}:\d{2})/);

    let dateStr = dateMatch ? dateMatch[1] : (defaultDate || '');
    let timeStr = '—';
    if (timeMatch) {
        timeStr = timeMatch[1];
    } else if (/^\d{4}$/.test(s)) {
        timeStr = `${s.slice(0, 2)}:${s.slice(2)}`;
    } else if (!dateMatch && s.length <= 8 && s.includes(':')) {
        timeStr = s;
    }

    return {
        dateStr,
        formattedDate: formatFlightDate(dateStr),
        timeStr
    };
}

function formatFlightTime(str) {
    if (!str) return '—';
    const s = String(str).trim();
    const match = s.match(/(\d{2}:\d{2})/);
    if (match) return match[1];
    if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2)}`;
    return s;
}

function formatFlightDate(str) {
    if (!str) return '';
    const s = String(str).trim();
    const parts = s.split('-');
    if (parts.length === 3) {
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return s;
}

function renderFlightDetailPanel(entity, stats = {}, related = {}) {
    const title = entity.flight_number || 'Flight';
    document.getElementById('entity-panel-title').textContent = 'Flight Details';

    const originCode = entity.origin_code || entity.origin_name || 'DEP';
    const destCode = entity.dest_code || entity.dest_name || 'ARR';
    const originName = entity.origin_name || '';
    const destName = entity.dest_name || '';

    const baseDate = entity.date || '';
    const depInfo = parseDateTime(entity.std || entity.dep_time_scheduled || entity.atd || entity.dep_time_actual, baseDate);
    const arrInfo = parseDateTime(entity.sta || entity.arr_time_scheduled || entity.ata || entity.arr_time_actual, baseDate);

    const stdTime = parseDateTime(entity.std || entity.dep_time_scheduled, depInfo.dateStr).timeStr;
    const atdTime = parseDateTime(entity.atd || entity.dep_time_actual, depInfo.dateStr).timeStr;
    const staTime = parseDateTime(entity.sta || entity.arr_time_scheduled, arrInfo.dateStr).timeStr;
    const ataTime = parseDateTime(entity.ata || entity.arr_time_actual, arrInfo.dateStr).timeStr;

    const mainHeaderDate = depInfo.formattedDate || formatFlightDate(baseDate);

    // Duration & Distance
    const durationMins = entity.duration_actual || entity.duration_scheduled;
    let durationText = '';
    if (durationMins) {
        const hrs = Math.floor(durationMins / 60);
        const mins = durationMins % 60;
        durationText = hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
    }
    const distanceText = entity.distance ? `${Number(entity.distance).toLocaleString()} km` : '';

    // Seat & Cabin
    const seatNo = entity.seat_number ? `Seat ${entity.seat_number}` : '';
    const seatClass = entity.flight_class || entity.seat_type || '';
    const seatInfo = [seatNo, seatClass].filter(Boolean).join(' · ');

    // Aircraft & Registration
    const aircraftModel = entity.aircraft_model || '';
    const reg = entity.registration ? (entity.registration.toUpperCase().startsWith('B-') ? entity.registration : `B-${entity.registration}`) : '';
    const aircraftInfo = [aircraftModel, reg].filter(Boolean).join(' · ');
    const codeshareAliases = Array.isArray(entity.flight_aliases)
        ? entity.flight_aliases.filter(alias => alias.alias_type === 'codeshare')
        : [];

    // Weather container HTML
    let weatherHtml = '';
    if (entity.origin_icao || entity.dest_icao) {
        weatherHtml = `<section><h3>Airport weather</h3><div id="weather-panel-container">
            ${entity.origin_icao ? `<div class="weather-card" id="weather-dep"><div class="weather-card-header"><span class="weather-label">Departure</span><span class="weather-airport">${escapeHtml(entity.origin_code || '')} (${escapeHtml(entity.origin_icao)})</span></div><div class="weather-card-body weather-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading weather…</div></div>` : ''}
            ${entity.dest_icao ? `<div class="weather-card" id="weather-arr"><div class="weather-card-header"><span class="weather-label">Arrival</span><span class="weather-airport">${escapeHtml(entity.dest_code || '')} (${escapeHtml(entity.dest_icao)})</span></div><div class="weather-card-body weather-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading weather…</div></div>` : ''}
        </div></section>`;
    }

    // Notes
    let notesHtml = '';
    if (entity.note && entity.note.trim()) {
        notesHtml = `<section><div class="flight-notes-card"><div class="flight-notes-title"><i class="fa-solid fa-sticky-note"></i> Personal notes</div><div>${escapeHtml(entity.note)}</div></div></section>`;
    }

    // Related Connections
    const relationshipLinks = entityRelationshipLinks('flights', entity);
    const connectionsHtml = relationshipLinks ? `<section><h3>Connections</h3>${relationshipLinks}</section>` : '';

    // Track section HTML
    const trackHtml = `
        <section class="flight-track-section">
            <div class="flight-track-header">
                <h3>Flight track</h3>
                <button class="btn btn-sm btn-secondary" onclick="focusFlightTrackOnMainMap(${entity.id})" title="Focus this flight on the main map">
                    <i class="fa-solid fa-expand"></i> Focus on map
                </button>
            </div>
            <div class="flight-mini-map-container">
                <div id="flight-mini-map-${entity.id}" class="flight-mini-map">
                    <div class="flight-mini-map-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading track map…</div>
                </div>
            </div>
            <div class="flight-track-controls" id="track-controls-${entity.id}" style="display:none;">
                <div class="track-controls-row">
                    <button class="track-btn track-btn-labeled" id="btn-play-${entity.id}" onclick="toggleTrackAnimation(${entity.id})" title="Play / pause"><i class="fa-solid fa-play"></i> <span>Play</span></button>
                    <button class="track-btn track-btn-labeled" onclick="restartTrackAnimation(${entity.id})" title="Restart playback"><i class="fa-solid fa-rotate-left"></i> <span>Restart</span></button>
                    <input type="range" class="track-progress-slider" id="slider-${entity.id}" min="0" max="100" value="0" oninput="seekTrackAnimation(${entity.id}, this.value)">
                    <select class="track-speed-select" onchange="setTrackSpeed(${entity.id}, this.value)">
                        <option value="1">1x</option>
                        <option value="2">2x</option>
                        <option value="5" selected>5x</option>
                        <option value="10">10x</option>
                    </select>
                </div>
                <div class="flight-track-hud">
                    <span class="hud-item"><i class="fa-solid fa-mountain"></i> Altitude: <strong id="hud-alt-${entity.id}">0 m</strong></span>
                    <span class="hud-item"><i class="fa-solid fa-gauge"></i> Speed: <strong id="hud-spd-${entity.id}">0 km/h</strong></span>
                    <span class="hud-item"><i class="fa-solid fa-clock"></i> Progress: <strong id="hud-pct-${entity.id}">0%</strong></span>
                </div>
            </div>
        </section>`;

    const html = `
        <div class="flight-hero">
            <div class="flight-hero-brand">
                ${entity.airline_id ? airlineLogoMarkup(entity.airline_logo_url, entity.airline_logo_source_url, entity.airline_name || title, 'list') : '<div class="entity-mark" style="width:40px;height:40px;border-radius:10px;font-size:0.9rem;"><i class="fa-solid fa-plane"></i></div>'}
                <div class="flight-hero-main">
                    <div class="flight-hero-number">${escapeHtml(title)}</div>
                    <div class="flight-hero-meta">${escapeHtml(entity.airline_name || '')}${mainHeaderDate ? ` · ${escapeHtml(mainHeaderDate)}` : ''}</div>
                </div>
            </div>
            <div class="flight-hero-actions">
                <button class="btn btn-sm btn-primary" onclick="editCurrentEntityPanel()"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="btn btn-sm action-danger" type="button" aria-label="Delete ${escapeHtml(title)}" onclick="deleteCurrentEntityPanel(this)"><i class="fa-solid fa-trash" aria-hidden="true"></i><span class="action-label">Delete</span></button>
            </div>
        </div>

        <div class="flight-boarding-pass">
            <div class="flight-route-banner">
                <div class="flight-route-point">
                    <div class="flight-route-code">${escapeHtml(originCode)}</div>
                    ${originName ? `<div class="flight-route-name" title="${escapeHtml(originName)}">${escapeHtml(originName)}</div>` : ''}
                </div>
                <div class="flight-route-mid">
                    <i class="fa-solid fa-plane flight-route-icon"></i>
                </div>
                <div class="flight-route-point">
                    <div class="flight-route-code">${escapeHtml(destCode)}</div>
                    ${destName ? `<div class="flight-route-name" title="${escapeHtml(destName)}">${escapeHtml(destName)}</div>` : ''}
                </div>
            </div>

            <div class="flight-times-grid">
                <div class="flight-time-col">
                    <div class="flight-time-heading"><i class="fa-solid fa-plane-departure"></i> Departure</div>
                    ${depInfo.formattedDate ? `<div class="flight-time-date"><i class="fa-regular fa-calendar-days"></i> ${escapeHtml(depInfo.formattedDate)}</div>` : ''}
                    ${stdTime !== '—' ? `<div class="flight-time-row"><span class="flight-time-label">Scheduled (STD)</span><span class="flight-time-val">${escapeHtml(stdTime)}</span></div>` : ''}
                    ${atdTime !== '—' ? `<div class="flight-time-row"><span class="flight-time-label">Actual (ATD)</span><span class="flight-time-val highlight-atd">${escapeHtml(atdTime)}</span></div>` : ''}
                    ${entity.origin_terminal ? `<div class="flight-gate-badge">Terminal ${escapeHtml(formatTerminal(entity.origin_terminal))}</div>` : ''}
                </div>
                <div class="flight-time-col">
                    <div class="flight-time-heading"><i class="fa-solid fa-plane-arrival"></i> Arrival</div>
                    ${arrInfo.formattedDate ? `<div class="flight-time-date"><i class="fa-regular fa-calendar-days"></i> ${escapeHtml(arrInfo.formattedDate)}</div>` : ''}
                    ${staTime !== '—' ? `<div class="flight-time-row"><span class="flight-time-label">Scheduled (STA)</span><span class="flight-time-val">${escapeHtml(staTime)}</span></div>` : ''}
                    ${ataTime !== '—' ? `<div class="flight-time-row"><span class="flight-time-label">Actual (ATA)</span><span class="flight-time-val highlight-ata">${escapeHtml(ataTime)}</span></div>` : ''}
                    ${entity.dest_terminal ? `<div class="flight-gate-badge">Terminal ${escapeHtml(formatTerminal(entity.dest_terminal))}</div>` : ''}
                </div>
            </div>

            ${(durationText || distanceText) ? `
            <div class="flight-meta-bar">
                ${durationText ? `<div class="flight-meta-item"><i class="fa-solid fa-clock"></i> Duration: ${escapeHtml(durationText)}</div>` : ''}
                ${distanceText ? `<div class="flight-meta-item"><i class="fa-solid fa-route"></i> Distance: ${escapeHtml(distanceText)}</div>` : ''}
            </div>` : ''}
        </div>

        ${(seatInfo || aircraftInfo || entity.reason || codeshareAliases.length) ? `
        <div class="flight-details-grid">
            ${seatInfo ? `
            <div class="flight-detail-card">
                <div class="flight-detail-icon"><i class="fa-solid fa-chair"></i></div>
                <div class="flight-detail-info">
                    <div class="flight-detail-label">Seat and cabin</div>
                    <div class="flight-detail-value" title="${escapeHtml(seatInfo)}">${escapeHtml(seatInfo)}</div>
                </div>
            </div>` : ''}

            ${aircraftInfo ? `
            <div class="flight-detail-card">
                <div class="flight-detail-icon"><i class="fa-solid fa-plane-up"></i></div>
                <div class="flight-detail-info">
                    <div class="flight-detail-label">Aircraft / registration</div>
                    <div class="flight-detail-value" title="${escapeHtml(aircraftInfo)}">${escapeHtml(aircraftInfo)}</div>
                </div>
            </div>` : ''}

            ${entity.reason ? `
            <div class="flight-detail-card">
                <div class="flight-detail-icon"><i class="fa-solid fa-compass"></i></div>
                <div class="flight-detail-info">
                    <div class="flight-detail-label">Travel purpose</div>
                    <div class="flight-detail-value" title="${escapeHtml(entity.reason)}">${escapeHtml(entity.reason)}</div>
                </div>
            </div>` : ''}

            ${codeshareAliases.length ? `
            <div class="flight-detail-card flight-codeshare-card">
                <div class="flight-detail-icon"><i class="fa-solid fa-code-branch"></i></div>
                <div class="flight-detail-info">
                    <div class="flight-detail-label">Codeshare numbers</div>
                    <div class="flight-alias-list">${codeshareAliases.map(alias => `
                        <span class="flight-alias-badge">${escapeHtml(alias.flight_number)}${alias.airline_name ? ` · ${escapeHtml(alias.airline_name)}` : ''}${alias.is_booked_number ? ' · Booked' : ''}</span>
                    `).join('')}</div>
                </div>
            </div>` : ''}
        </div>` : ''}

        ${trackHtml}
        ${weatherHtml}
        ${notesHtml}
        ${connectionsHtml}
    `;

    document.getElementById('entity-panel-body').innerHTML = html;

    // Trigger asynchronous track fetch & weather fetch after rendering
    setTimeout(() => loadAndRenderFlightTrack(entity.id), 120);
    if (entity.origin_icao) _fetchWeather(entity.origin_icao, 'weather-dep');
    if (entity.dest_icao) _fetchWeather(entity.dest_icao, 'weather-arr');
}

State.miniMaps = State.miniMaps || {};
State.cacheTrackPoints = State.cacheTrackPoints || {};
State.trackAnimState = State.trackAnimState || {};

async function loadAndRenderFlightTrack(flightId) {
    const container = document.getElementById(`flight-mini-map-${flightId}`);
    if (!container) return;

    try {
        const res = await fetch(`/api/flights/${flightId}/track`);
        if (!res.ok) throw new Error('Track unavailable');
        const data = await res.json();
        const points = data.points || [];
        State.cacheTrackPoints[flightId] = points;

        if (!points || points.length === 0) {
            container.innerHTML = '<div class="flight-mini-map-empty"><i class="fa-solid fa-route"></i> No detailed track coordinates</div>';
            return;
        }

        // Clean up previous Leaflet instance if present
        if (State.miniMaps[flightId]) {
            State.miniMaps[flightId].remove();
            delete State.miniMaps[flightId];
        }

        container.innerHTML = '';
        const miniMap = L.map(container, {
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: false
        });

        State.miniMaps[flightId] = miniMap;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18
        }).addTo(miniMap);

        const latLngs = points.map(p => [p.lat, p.lon]);
        const polyline = L.polyline(latLngs, {
            color: '#0284c7',
            weight: 4,
            opacity: 0.9
        }).addTo(miniMap);

        // Add start and destination markers
        L.circleMarker(latLngs[0], { radius: 6, color: '#0369a1', fillColor: '#0284c7', fillOpacity: 1 }).addTo(miniMap);
        L.circleMarker(latLngs[latLngs.length - 1], { radius: 6, color: '#0369a1', fillColor: '#10b981', fillOpacity: 1 }).addTo(miniMap);

        const initialHeading = latLngs.length > 1 ? calculateBearing(latLngs[0][0], latLngs[0][1], latLngs[1][0], latLngs[1][1]) : 45;
        polyline.bindTooltip(`✈ <strong>Flight track</strong>`, { sticky: true });

        // Create animated plane marker
        const planeIcon = L.divIcon({
            className: 'mini-plane-icon-wrapper',
            html: `<div class="plane-icon-inner" style="color:#d97706;font-size:18px;transition:transform 0.1s linear;transform:rotate(${initialHeading - 45}deg);"><i class="fa-solid fa-plane"></i></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        const planeMarker = L.marker(latLngs[0], { icon: planeIcon }).addTo(miniMap);

        miniMap.fitBounds(polyline.getBounds(), { padding: [18, 18] });
        setTimeout(() => miniMap.invalidateSize(), 200);

        // Show playback controls and initialize animation state
        const controls = document.getElementById(`track-controls-${flightId}`);
        if (controls) controls.style.display = 'block';

        State.trackAnimState[flightId] = {
            points,
            currentIndex: 0,
            speed: 5,
            isPlaying: false,
            animFrame: null,
            planeMarker,
            mainPlaneMarker: null
        };

        updateTrackHUD(flightId, points[0].alt || 0, points[0].spd || 0, 0);

    } catch (e) {
        if (container) {
            container.innerHTML = '<div class="flight-mini-map-empty"><i class="fa-solid fa-route"></i> No track map data</div>';
        }
    }
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;

    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (toDeg(θ) + 360) % 360;
}

function ensureTrackAnimState(flightId) {
    State.trackAnimState = State.trackAnimState || {};
    if (!State.trackAnimState[flightId]) {
        const points = (State.cacheTrackPoints && State.cacheTrackPoints[flightId]) || [];
        State.trackAnimState[flightId] = {
            points,
            currentIndex: 0,
            speed: 5,
            isPlaying: false,
            animFrame: null,
            planeMarker: null,
            mainPlaneMarker: null
        };
    }
    return State.trackAnimState[flightId];
}

function updateTrackHUD(flightId, alt, spd, pct) {
    const altIds = [`hud-alt-${flightId}`, `main-hud-alt-${flightId}`];
    altIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${alt ? Math.round(alt * 0.3048) : 0} m`;
    });
    const spdIds = [`hud-spd-${flightId}`, `main-hud-spd-${flightId}`];
    spdIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${spd ? Math.round(spd) : 0} km/h`;
    });
    const pctIds = [`hud-pct-${flightId}`, `main-hud-pct-${flightId}`];
    pctIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${Math.round(pct)}%`;
    });
    const sliders = [`slider-${flightId}`, `main-slider-${flightId}`];
    sliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = Math.round(pct);
    });
}

function updatePlayButtonsState(flightId, isPlaying) {
    const btns = [`btn-play-${flightId}`, `main-btn-play-${flightId}`];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.innerHTML = isPlaying
                ? '<i class="fa-solid fa-pause"></i> <span>Pause</span>'
                : '<i class="fa-solid fa-play"></i> <span>Play</span>';
        }
    });
}

function toggleTrackAnimation(flightId) {
    const anim = ensureTrackAnimState(flightId);
    if (!anim) return;
    if (anim.isPlaying) {
        pauseTrackAnimation(flightId);
    } else {
        startTrackAnimation(flightId);
    }
}

function startTrackAnimation(flightId) {
    const anim = ensureTrackAnimState(flightId);
    if (!anim || !anim.points || !anim.points.length) return;

    if (anim.animFrame) {
        cancelAnimationFrame(anim.animFrame);
        anim.animFrame = null;
    }

    if (anim.currentIndex >= anim.points.length - 1) {
        anim.currentIndex = 0;
    }

    anim.isPlaying = true;
    updatePlayButtonsState(flightId, true);

    function step() {
        if (!anim.isPlaying) return;
        anim.currentIndex += 0.08 * anim.speed;
        if (anim.currentIndex >= anim.points.length - 1) {
            anim.currentIndex = anim.points.length - 1;
            updatePlanePosition(flightId);
            pauseTrackAnimation(flightId);
            return;
        }
        updatePlanePosition(flightId);
        if (anim.isPlaying) {
            anim.animFrame = requestAnimationFrame(step);
        }
    }
    anim.animFrame = requestAnimationFrame(step);
}

function pauseTrackAnimation(flightId) {
    const anim = ensureTrackAnimState(flightId);
    if (!anim) return;
    anim.isPlaying = false;
    if (anim.animFrame) {
        cancelAnimationFrame(anim.animFrame);
        anim.animFrame = null;
    }
    updatePlayButtonsState(flightId, false);
}

function restartTrackAnimation(flightId) {
    const anim = ensureTrackAnimState(flightId);
    if (!anim) return;
    pauseTrackAnimation(flightId);
    anim.currentIndex = 0;
    updatePlanePosition(flightId);
    startTrackAnimation(flightId);
}

function setTrackSpeed(flightId, speedVal) {
    const anim = ensureTrackAnimState(flightId);
    if (anim) anim.speed = parseFloat(speedVal) || 1;
}

function seekTrackAnimation(flightId, percent) {
    const anim = ensureTrackAnimState(flightId);
    if (!anim || !anim.points || !anim.points.length) return;
    const idx = (parseFloat(percent) / 100) * (anim.points.length - 1);
    anim.currentIndex = idx;
    updatePlanePosition(flightId);
}

function updatePlanePosition(flightId) {
    const anim = ensureTrackAnimState(flightId);
    if (!anim || !anim.points || !anim.points.length) return;

    const idx = Math.min(Math.floor(anim.currentIndex), anim.points.length - 1);
    const nextIdx = Math.min(idx + 1, anim.points.length - 1);
    const fraction = anim.currentIndex - idx;

    const p1 = anim.points[idx];
    const p2 = anim.points[nextIdx];

    const lat = p1.lat + (p2.lat - p1.lat) * fraction;
    const lon = p1.lon + (p2.lon - p1.lon) * fraction;
    const alt = (p1.alt || 0) + ((p2.alt || 0) - (p1.alt || 0)) * fraction;
    const spd = (p1.spd || 0) + ((p2.spd || 0) - (p1.spd || 0)) * fraction;
    const pct = (anim.currentIndex / (anim.points.length - 1)) * 100;

    let heading = 45;
    if (idx < anim.points.length - 1) {
        heading = calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon);
    }

    const setMarkerPosAndRotation = (marker) => {
        if (!marker) return;
        marker.setLatLng([lat, lon]);
        const el = marker.getElement();
        if (el) {
            const inner = el.querySelector('.plane-icon-inner');
            if (inner) {
                inner.style.transform = `rotate(${heading - 45}deg)`;
            }
        }
    };

    setMarkerPosAndRotation(anim.planeMarker);
    setMarkerPosAndRotation(anim.mainPlaneMarker);

    updateTrackHUD(flightId, alt, spd, pct);
}

function buildFocusedMapOverlay(flightId) {
    const mapContainer = document.querySelector('.journey-map-panel .map-container') || document.getElementById('flight-map');
    if (!mapContainer) return;

    let banner = document.getElementById('main-map-focused-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'main-map-focused-banner';
        banner.className = 'main-map-focused-banner';
        mapContainer.appendChild(banner);

        L.DomEvent.disableClickPropagation(banner);
        L.DomEvent.disableScrollPropagation(banner);
    }

    const flightNum = State.entityPanelCurrent?.entity?.flight_number || 'Flight';
    banner.innerHTML = `<span><i class="fa-solid fa-crosshairs"></i> Focused flight <strong>${escapeHtml(flightNum)}</strong> track</span> <button class="btn-reset-map-focus" id="btn-reset-map-focus-el"><i class="fa-solid fa-xmark"></i> Show all flights</button>`;
    banner.style.display = 'flex';

    const resetBtn = document.getElementById('btn-reset-map-focus-el');
    if (resetBtn) {
        resetBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            resetMainMapFocus();
        };
    }

    let panel = document.getElementById('main-map-track-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'main-map-track-panel';
        panel.className = 'main-map-track-panel';
        mapContainer.appendChild(panel);

        L.DomEvent.disableClickPropagation(panel);
        L.DomEvent.disableScrollPropagation(panel);
    }

    if (panel.dataset.flightId !== String(flightId)) {
        panel.dataset.flightId = String(flightId);
        panel.innerHTML = `
            <div class="track-controls-row">
                <button class="track-btn track-btn-labeled" id="main-btn-play-${flightId}" title="Play / pause"><i class="fa-solid fa-play"></i> <span>Play</span></button>
                <button class="track-btn track-btn-labeled" id="main-btn-restart-${flightId}" title="Restart playback"><i class="fa-solid fa-rotate-left"></i> <span>Restart</span></button>
                <input type="range" class="track-progress-slider" id="main-slider-${flightId}" min="0" max="100" value="0">
                <select class="track-speed-select" id="main-speed-${flightId}">
                    <option value="1">1x</option>
                    <option value="2">2x</option>
                    <option value="5" selected>5x</option>
                    <option value="10">10x</option>
                </select>
            </div>
            <div class="flight-track-hud">
                <span class="hud-item"><i class="fa-solid fa-mountain"></i> Altitude: <strong id="main-hud-alt-${flightId}">0 m</strong></span>
                <span class="hud-item"><i class="fa-solid fa-gauge"></i> Speed: <strong id="main-hud-spd-${flightId}">0 km/h</strong></span>
                <span class="hud-item"><i class="fa-solid fa-clock"></i> Progress: <strong id="main-hud-pct-${flightId}">0%</strong></span>
            </div>`;

        const playBtn = document.getElementById(`main-btn-play-${flightId}`);
        if (playBtn) playBtn.onclick = (e) => { e.stopPropagation(); toggleTrackAnimation(flightId); };

        const restartBtn = document.getElementById(`main-btn-restart-${flightId}`);
        if (restartBtn) restartBtn.onclick = (e) => { e.stopPropagation(); restartTrackAnimation(flightId); };

        const slider = document.getElementById(`main-slider-${flightId}`);
        if (slider) slider.oninput = (e) => { e.stopPropagation(); seekTrackAnimation(flightId, e.target.value); };

        const speedSelect = document.getElementById(`main-speed-${flightId}`);
        if (speedSelect) speedSelect.onchange = (e) => { e.stopPropagation(); setTrackSpeed(flightId, e.target.value); };
    }
    panel.style.display = 'block';
}

async function renderFocusedFlightTrackOnMap(flightId, options = {}) {
    if (!State.map) initMap();
    if (!State.map) return;

    const isAlreadyFocused = State.currentFocusedFlightId === flightId;
    State.focusedFlightId = flightId;
    State.currentFocusedFlightId = flightId;

    let points = (State.cacheTrackPoints && State.cacheTrackPoints[flightId]) || [];
    if (!points || points.length === 0) {
        try {
            const res = await fetch(`/api/flights/${flightId}/track`);
            if (res.ok) {
                const data = await res.json();
                points = data.points || [];
                State.cacheTrackPoints[flightId] = points;
            }
        } catch (e) {
            console.error('Failed to fetch track points for focus map:', e);
        }
    }

    if (!points || points.length === 0) return;

    if (!isAlreadyFocused) {
        // Clear existing profile layers
        if (State.profileLayers) {
            State.profileLayers.forEach(l => l.remove());
        }
        State.profileLayers = [];

        const latLngs = points.map(p => [p.lat, p.lon]);
        const flightNum = State.entityPanelCurrent?.entity?.flight_number || 'Flight';

        // Draw focused polyline track with click popup and hover tooltip
        const focusedLine = L.polyline(latLngs, {
            color: '#0284c7',
            weight: 5,
            opacity: 0.95
        }).addTo(State.map);

        focusedLine.bindTooltip(`✈ <strong>Flight ${escapeHtml(flightNum)}</strong> · Altitude ~10,660m · 870 km/h`, {
            sticky: true,
            direction: 'top',
            offset: [0, -10]
        });

        focusedLine.bindPopup(`
            <div style="font-family:sans-serif;padding:6px;min-width:180px;">
                <h4 style="margin:0 0 6px 0;color:#0284c7;font-size:0.95rem;"><i class="fa-solid fa-plane"></i> Flight ${escapeHtml(flightNum)} track</h4>
                <div style="font-size:0.82rem;color:#334155;line-height:1.6;">
                    <div>📍 <strong>Track points:</strong> ${latLngs.length} waypoints</div>
                    <div>✈ <strong>Cruise altitude:</strong> ~10,660 m (35,000 ft)</div>
                    <div>⚡ <strong>Average speed:</strong> ~870 km/h</div>
                </div>
            </div>
        `);
        State.profileLayers.push(focusedLine);

        // Draw Start & End markers
        const startMarker = L.circleMarker(latLngs[0], { radius: 7, color: '#0369a1', fillColor: '#0284c7', fillOpacity: 1 }).addTo(State.map).bindPopup(`<b>${escapeHtml(flightNum)} - Departure</b>`);
        const endMarker = L.circleMarker(latLngs[latLngs.length - 1], { radius: 7, color: '#0369a1', fillColor: '#10b981', fillOpacity: 1 }).addTo(State.map).bindPopup(`<b>${escapeHtml(flightNum)} - Arrival</b>`);
        State.profileLayers.push(startMarker);
        State.profileLayers.push(endMarker);

        // Main plane marker on State.map
        const initialHeading = latLngs.length > 1 ? calculateBearing(latLngs[0][0], latLngs[0][1], latLngs[1][0], latLngs[1][1]) : 45;
        const mainPlaneIcon = L.divIcon({
            className: 'main-plane-icon-wrapper',
            html: `<div class="plane-icon-inner" style="color:#d97706;font-size:24px;transition:transform 0.1s linear;transform:rotate(${initialHeading - 45}deg);"><i class="fa-solid fa-plane"></i></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });
        const mainPlaneMarker = L.marker(latLngs[0], { icon: mainPlaneIcon }).addTo(State.map);
        State.profileLayers.push(mainPlaneMarker);

        const anim = ensureTrackAnimState(flightId);
        anim.mainPlaneMarker = mainPlaneMarker;

        buildFocusedMapOverlay(flightId);

        if (options.fitBounds !== false) {
            invalidateProfileMapSize();
            setTimeout(() => {
                invalidateProfileMapSize();
                if (State.map) State.map.fitBounds(focusedLine.getBounds(), { padding: [70, 70] });
            }, 150);
        }
    }
}

async function focusFlightTrackOnMainMap(flightId) {
    if (State.profileMapType === 'globe') setMapLayer('map');
    State.focusedFlightId = flightId;
    State.currentFocusedFlightId = null;
    navigateTo('profile');
    closeEntityPanel();

    const mapPanel = document.querySelector('.journey-map-panel') || document.getElementById('flight-map');
    if (mapPanel) {
        mapPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    await renderFocusedFlightTrackOnMap(flightId, { fitBounds: true });
}

function resetMainMapFocus() {
    State.focusedFlightId = null;
    State.currentFocusedFlightId = null;

    const banner = document.getElementById('main-map-focused-banner');
    if (banner) banner.style.display = 'none';

    const panel = document.getElementById('main-map-track-panel');
    if (panel) panel.style.display = 'none';

    refreshProfileMapLayers({ fitBounds: true });
}

function renderEntityPanel(payload) {
    const { type, entity, stats = {}, related = {} } = payload;
    State.entityPanelCurrent = { type, entity };

    if (type === 'flights') {
        return renderFlightDetailPanel(entity, stats, related);
    }

    const title = entityDisplayName(type, entity);
    document.getElementById('entity-panel-title').textContent = ENTITY_LABELS[type] || 'Details';
    const codes = [entity.iata_code, entity.icao_code, entity.flight_number].filter(Boolean);
    const relationshipLinks = entityRelationshipLinks(type, entity);
    const statsHtml = Object.entries(stats).filter(([, value]) => value !== null).map(([key, value]) => `
        <div class="entity-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(key.replaceAll('_', ' '))}</span></div>`).join('');
    const entityFieldLabels = {
        iata_code: 'IATA code',
        icao_code: 'ICAO code',
        callsign: 'Callsign',
        country: 'Country',
        alliance: 'Alliance',
        frequent_flyer_program: 'Loyalty program',
        frequent_flyer_id: 'Member number',
        website_url: 'Official website',
        timezone: 'Time zone',
        country_code: 'Country code',
        lat: 'Latitude',
        lon: 'Longitude',
        terminals: 'Terminals',
        manufacturer: 'Manufacturer',
        model: 'Model',
        series: 'Series',
        subtype: 'Subtype',
        tags_generation: 'Generation options',
        tags_winglets: 'Winglet options',
        tags_config: 'Configuration options'
    };
    const hiddenEntityFields = ['id', 'name', 'user_id', 'logo_url', 'logo_source_url', 'logo_file_id', 'city_id'];
    if (type === 'airlines') hiddenEntityFields.push('iata_code', 'icao_code');
    const metadata = Object.entries(entity).filter(([key, value]) => value !== null && value !== '' && !hiddenEntityFields.includes(key)).slice(0, 18).map(([key, value]) => {
        const displayValue = type === 'airlines' && key === 'alliance' ? formatAllianceLabel(value) : value;
        return `<div class="entity-field"><span>${escapeHtml(entityFieldLabels[key] || key.replaceAll('_', ' '))}</span><strong class="${key === 'frequent_flyer_id' ? 'airline-member-number' : ''}">${escapeHtml(displayValue)}</strong></div>`;
    }).join('');
    const relatedFlights = (related.flights || []).map(f => `
        <button class="entity-related-row" onclick="openEntityPanel('flights', ${Number(f.id)})"><span><b>${escapeHtml(f.flight_number || 'Flight')}</b><small>${escapeHtml(f.date || '')}</small></span><span>${escapeHtml(f.origin_code || '')} → ${escapeHtml(f.dest_code || '')}</span></button>`).join('');
    const relatedAirports = (related.airports || []).map(a => `
        <button class="entity-related-row" onclick="openEntityPanel('airports', ${Number(a.id)})"><span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.iata_code || a.icao_code || '')}</small></span></button>`).join('');

    // Weather section placeholder for airports
    let weatherHtml = '';
    if (type === 'airports' && entity.icao_code) {
        weatherHtml = `<section><h3>Current weather</h3><div id="weather-panel-container">
            <div class="weather-card" id="weather-airport"><div class="weather-card-body weather-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</div></div>
        </div></section>`;
    }

    document.getElementById('entity-panel-body').innerHTML = `
        <section class="entity-hero">${type === 'airlines' ? airlineLogoMarkup(entity.logo_url, entity.logo_source_url, entity.iata_code || entity.icao_code || entity.name, 'detail') : `<div class="entity-mark">${escapeHtml((codes[0] || title || '?').slice(0, 3).toUpperCase())}</div>`}<div class="entity-hero-copy"><h2>${escapeHtml(title)}</h2><p>${codes.map(escapeHtml).join(' · ')}</p><div class="entity-hero-actions"><button class="btn btn-sm btn-primary" type="button" onclick="editCurrentEntityPanel()"><i class="fa-solid fa-pen" aria-hidden="true"></i> Edit</button>${type === 'airlines' ? `<button class="btn btn-sm btn-secondary" type="button" onclick="manageAirlineLogo(${Number(entity.id)})"><i class="fa-regular fa-image" aria-hidden="true"></i> Manage logo</button>` : ''}<button class="btn btn-sm action-danger" type="button" onclick="deleteCurrentEntityPanel(this)"><i class="fa-solid fa-trash" aria-hidden="true"></i> Delete</button></div></div></section>
        ${statsHtml ? `<section><h3>Overview</h3><div class="entity-stats">${statsHtml}</div></section>` : ''}
        ${relationshipLinks ? `<section><h3>Connections</h3>${relationshipLinks}</section>` : ''}
        ${weatherHtml}
        <section><h3>Details</h3><div class="entity-fields">${metadata}</div></section>
        ${relatedAirports ? `<section><h3>Airports</h3>${relatedAirports}</section>` : ''}
        ${relatedFlights ? `<section><h3>Related flights</h3>${relatedFlights}</section>` : ''}`;

    // Fetch weather data after rendering
    if (type === 'airports' && entity.icao_code) {
        _fetchWeather(entity.icao_code, 'weather-airport');
    }
}

function _fetchWeather(icao, containerId) {
    fetch(`/api/weather/metar/${encodeURIComponent(icao)}`)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => {
            const el = document.getElementById(containerId);
            if (!el) return;
            const body = el.querySelector('.weather-card-body');
            if (!body) return;
            body.classList.remove('weather-loading');
            body.innerHTML = _renderWeatherBody(data);
        })
        .catch(() => {
            const el = document.getElementById(containerId);
            if (!el) return;
            const body = el.querySelector('.weather-card-body');
            if (!body) return;
            body.classList.remove('weather-loading');
            body.innerHTML = '<span class="weather-unavailable">Weather data unavailable</span>';
        });
}

const FLIGHT_RULES_LABELS = {
    'vfr': 'VFR · Visual flight rules',
    'mvfr': 'MVFR · Marginal visual flight rules',
    'ifr': 'IFR · Instrument flight rules',
    'lifr': 'LIFR · Low instrument flight rules'
};

function _renderWeatherBody(w) {
    const temp = w.temperature != null ? `${Math.round(w.temperature)}°C` : '—';
    const windDir = w.wind_direction != null ? `${Math.round(w.wind_direction)}°` : 'VRB';
    const windSpd = w.wind_speed != null ? `${Math.round(w.wind_speed)}kt` : '—';
    const gust = w.wind_gust ? ` gusting ${Math.round(w.wind_gust)}kt` : '';
    const vis = w.visibility_m != null ? (w.visibility_m >= 9999 ? '10+ km' : `${(w.visibility_m / 1000).toFixed(1)} km`) : '—';
    const frRaw = (w.flight_rules || '').toLowerCase();
    const frLabel = FLIGHT_RULES_LABELS[frRaw] || w.flight_rules || '—';
    const conditionVisual = w.condition_emoji
        ? escapeHtml(w.condition_emoji)
        : '<i class="fa-solid fa-cloud-sun" aria-hidden="true"></i>';

    return `
        <div class="weather-main">
            <span class="weather-emoji">${conditionVisual}</span>
            <span class="weather-temp">${escapeHtml(temp)}</span>
            <span class="weather-condition">${escapeHtml(w.condition || 'Unknown')}</span>
        </div>
        <div class="weather-details">
            <div class="weather-detail" title="Wind direction and speed"><i class="fa-solid fa-wind"></i> Wind: ${escapeHtml(windDir)} @ ${escapeHtml(windSpd)}${escapeHtml(gust)}</div>
            <div class="weather-detail" title="Visibility"><i class="fa-solid fa-eye"></i> Visibility: ${escapeHtml(vis)}</div>
            <div class="weather-detail" title="Sea-level pressure"><i class="fa-solid fa-gauge-high"></i> Pressure: ${w.pressure != null ? escapeHtml(Math.round(w.pressure * 33.8639) + ' hPa') : '—'}</div>
            <div class="weather-detail weather-fr weather-fr-${escapeHtml(frRaw)}" title="Flight rules"><i class="fa-solid fa-shield-halved"></i> ${escapeHtml(w.flight_rules_emoji || '')} ${escapeHtml(frLabel)}</div>
        </div>
        <details class="weather-raw"><summary>View raw METAR</summary><code>${escapeHtml(w.raw || '—')}</code></details>`;
}

// --- View Management ---
// Route mapping for URL paths
const ROUTE_MAP = {
    'profile': '/profile',
    'flights': '/flights',
    'datasets': '/library'
};

// Reverse mapping: URL path -> view name
const PATH_TO_VIEW = {
    '/profile': 'profile',
    '/flights': 'flights',
    '/library': 'datasets'
};

function navigateTo(viewName, updateHistory = true) {
    // Update State
    State.currentView = viewName;

    // Update URL if needed
    if (updateHistory && ROUTE_MAP[viewName]) {
        const newPath = ROUTE_MAP[viewName];
        if (window.location.pathname !== newPath) {
            history.pushState({ view: viewName }, '', newPath);
        }
    }

    // Update Navbar
    document.querySelectorAll('.nav-item[data-view-nav]').forEach(el => {
        const active = el.dataset.viewNav === viewName;
        el.classList.toggle('active', active);
        if (active) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
    });
    document.querySelectorAll('.mobile-nav-item[data-mobile-view]').forEach(el => {
        const active = el.dataset.mobileView === viewName;
        el.classList.toggle('active', active);
        if (active) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
    });
    setSettingsDropdown(false);

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

// Get initial view from URL path
function getViewFromPath() {
    const path = window.location.pathname;
    return PATH_TO_VIEW[path] || 'profile';
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
    const viewName = e.state?.view || getViewFromPath();
    navigateTo(viewName, false);
});

// --- Map Logic ---
function initMap() {
    if (document.getElementById('flight-map')) {
        State.map = L.map('flight-map', {
            minZoom: 0, zoomSnap: 0.25, zoomDelta: 0.5
        }).setView([20, 0], 2);
        setMapLayer('map');
        bindProfileMapResizeObserver();
    }
}

function getProfileMapPalette(type = State.profileMapType) {
    return type === 'satellite'
        ? { completed: '#cbd5e1', pending: '#ff997c', airport: '#ffffff', border: '#17212b', completedOpacity: 0.95, pendingOpacity: 0.95 }
        : { completed: '#8792a2', pending: '#e07a5f', airport: '#345d80', border: '#ffffff', completedOpacity: 0.55, pendingOpacity: 0.9 };
}

function showProfileMapRenderer(type) {
    const flatMap = document.getElementById('flight-map');
    const globe = document.getElementById('flight-globe');
    if (flatMap) flatMap.hidden = type === 'globe';
    if (globe) globe.hidden = type !== 'globe';
}

function updateProfileMapLegend() {
    const palette = getProfileMapPalette();
    const legend = document.querySelector('.route-status-legend');
    if (!legend) return;
    legend.querySelector('.route-status-completed').style.borderColor = palette.completed;
    legend.querySelector('.route-status-pending').style.borderColor = palette.pending;
    const airport = legend.querySelector('.route-status-airport');
    airport.style.backgroundColor = palette.airport;
    airport.style.boxShadow = `0 0 0 1px ${palette.border}`;
}

function emptyFeatureCollection() {
    return { type: 'FeatureCollection', features: [] };
}

function ensureProfileGlobeLayers() {
    const globe = State.globeMap;
    if (!globe || !globe.isStyleLoaded()) return;
    if (!globe.getSource('profile-globe-routes')) {
        globe.addSource('profile-globe-routes', { type: 'geojson', data: emptyFeatureCollection() });
        globe.addLayer({
            id: 'profile-globe-routes-completed', type: 'line', source: 'profile-globe-routes',
            filter: ['==', ['get', 'completed'], true],
            paint: {
                'line-color': getProfileMapPalette('globe').completed,
                'line-width': 2.6,
                'line-opacity': getProfileMapPalette('globe').completedOpacity
            }
        });
        globe.addLayer({
            id: 'profile-globe-routes-pending', type: 'line', source: 'profile-globe-routes',
            filter: ['==', ['get', 'completed'], false],
            paint: {
                'line-color': getProfileMapPalette('globe').pending,
                'line-width': 2.8,
                'line-opacity': getProfileMapPalette('globe').pendingOpacity,
                'line-dasharray': [2.8, 2.1]
            }
        });
    }
    if (!globe.getSource('profile-globe-airports')) {
        globe.addSource('profile-globe-airports', { type: 'geojson', data: emptyFeatureCollection() });
        globe.addLayer({
            id: 'profile-globe-airports', type: 'circle', source: 'profile-globe-airports',
            paint: {
                'circle-radius': 4.5,
                'circle-color': getProfileMapPalette('globe').airport,
                'circle-stroke-color': getProfileMapPalette('globe').border,
                'circle-stroke-width': 1.4
            }
        });
    }
}

function bindProfileGlobeInteractions() {
    const globe = State.globeMap;
    if (!globe || globe.__profileInteractionsBound) return;
    const routeLayers = ['profile-globe-routes-completed', 'profile-globe-routes-pending'];
    routeLayers.forEach(layerId => {
        globe.on('click', layerId, event => {
            const feature = event.features?.[0];
            if (!feature) return;
            const p = feature.properties || {};
            new maplibregl.Popup()
                .setLngLat(event.lngLat)
                .setHTML(`${escapeHtml(p.flight_number)}<br>${escapeHtml(p.date)}<br>${escapeHtml(p.origin)} -&gt; ${escapeHtml(p.destination)}<br>${escapeHtml(p.status)}`)
                .addTo(globe);
        });
        globe.on('mouseenter', layerId, () => { globe.getCanvas().style.cursor = 'pointer'; });
        globe.on('mouseleave', layerId, () => { globe.getCanvas().style.cursor = ''; });
    });
    globe.on('click', 'profile-globe-airports', event => {
        const feature = event.features?.[0];
        if (!feature) return;
        const p = feature.properties || {};
        new maplibregl.Popup()
            .setLngLat(feature.geometry.coordinates)
            .setHTML(`<b>${escapeHtml(p.code)}</b><br>${escapeHtml(p.name)}`)
            .addTo(globe);
    });
    globe.on('mouseenter', 'profile-globe-airports', () => { globe.getCanvas().style.cursor = 'pointer'; });
    globe.on('mouseleave', 'profile-globe-airports', () => { globe.getCanvas().style.cursor = ''; });
    globe.__profileInteractionsBound = true;
}

function initProfileGlobe() {
    if (State.globeMap) return true;
    if (typeof maplibregl === 'undefined') return false;
    if (typeof maplibregl.supported === 'function' && !maplibregl.supported()) return false;
    try {
        State.globeMap = new maplibregl.Map({
            container: 'flight-globe',
            center: [8, 22],
            zoom: 1.25,
            minZoom: 0,
            maxZoom: 8,
            attributionControl: true,
            style: {
                version: 8,
                projection: { type: 'globe' },
                sources: {
                    'globe-basemap': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors'
                    }
                },
                layers: [
                    { id: 'globe-ocean', type: 'background', paint: { 'background-color': '#a9cfde' } },
                    { id: 'globe-basemap', type: 'raster', source: 'globe-basemap', paint: { 'raster-opacity': 0.94, 'raster-saturation': -0.34, 'raster-brightness-min': 0.14, 'raster-brightness-max': 0.94 } }
                ],
                sky: {
                    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0]
                }
            }
        });
        State.globeMap.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
        State.globeMap.on('load', () => {
            State.globeMapLoaded = true;
            ensureProfileGlobeLayers();
            bindProfileGlobeInteractions();
            refreshProfileGlobeLayers({ resetCamera: true });
        });
        State.globeMap.on('error', event => console.warn('Globe map error:', event?.error || event));
        return true;
    } catch (error) {
        console.warn('Unable to initialize globe mode:', error);
        State.globeMap = null;
        return false;
    }
}

function setMapLayer(type) {
    if (!State.map) return;
    let selectedType = ['map', 'satellite', 'globe'].includes(type) ? type : 'map';
    State.profileMapType = selectedType;
    showProfileMapRenderer(selectedType);
    if (selectedType === 'globe' && !initProfileGlobe()) {
        selectedType = 'map';
        State.profileMapType = 'map';
        showProfileMapRenderer('map');
        if (typeof showToast === 'function') showToast('Globe mode is unavailable on this device.');
    }
    document.querySelectorAll('[data-map-layer]').forEach(button => {
        const selected = button.dataset.mapLayer === State.profileMapType;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    updateProfileMapLegend();
    if (State.profileMapType === 'globe') {
        requestAnimationFrame(() => {
            State.globeMap?.resize();
            refreshProfileGlobeLayers({ resetCamera: true });
        });
        return;
    }
    if (State.profileBaseLayer) State.map.removeLayer(State.profileBaseLayer);
    if (selectedType === 'satellite') {
        State.profileBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        }).addTo(State.map);
    } else {
        State.profileBaseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(State.map);
    }
    requestAnimationFrame(() => State.map.invalidateSize({ pan: false }));
    refreshProfileMapLayers();
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

const LIBRARY_ITEM_LABELS = Object.freeze({
    cities: 'city',
    airports: 'airport',
    airlines: 'airline',
    aircraft_models: 'aircraft'
});

function libraryItemLabel(datasetKey, capitalize = false) {
    const label = LIBRARY_ITEM_LABELS[datasetKey] || 'record';
    return capitalize ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

function setLibraryLoading(loading) {
    const table = document.getElementById('dataset-table');
    const toolbar = document.querySelector('.library-toolbar');
    const status = document.getElementById('dataset-results-status');
    if (table) table.setAttribute('aria-busy', String(loading));
    if (toolbar) toolbar.classList.toggle('is-loading', loading);
    if (loading && status) status.textContent = 'Loading records…';
}

function updateLibraryControlLabels(datasetKey) {
    const itemLabel = LIBRARY_ITEM_LABELS[datasetKey] || 'record';
    const button = document.getElementById('dataset-add-button');
    if (button) button.querySelector('span').textContent = `Add ${itemLabel}`;
    const search = document.getElementById('dataset-search');
    if (!search) return;
    const placeholders = {
        cities: 'Search city, country or continent',
        airports: 'Search airport, IATA, ICAO or city',
        airlines: 'Search airline, IATA, ICAO or alliance',
        aircraft_models: 'Search manufacturer, model or series'
    };
    search.placeholder = placeholders[datasetKey] || 'Search records';
}

async function loadDataset(datasetKey, { resetControls = null } = {}) {
    if (datasetKey === 'aircraft') datasetKey = 'aircraft_models';
    const switchingDataset = State.currentDataset !== datasetKey;
    State.currentDataset = datasetKey;
    const config = DATASETS[datasetKey];
    if (!config) return;
    const shouldReset = resetControls ?? switchingDataset;
    setLibraryLoading(true);
    updateLibraryControlLabels(datasetKey);
    try {
        const data = await API.get(config.endpoint);
        if (!Array.isArray(data)) throw new Error(data?.error || `${config.label} could not be loaded.`);
        State.cache[datasetKey] = data;

        if (datasetKey === 'airports') {
            const cities = await API.get('cities');
            if (Array.isArray(cities)) State.cache.cities = cities;
        }
        await Promise.all(Object.entries(DATASETS).map(async ([key, dataset]) => {
            if (State.cache[key]?.length || key === datasetKey) return;
            try {
                const rows = await API.get(dataset.endpoint);
                if (Array.isArray(rows)) State.cache[key] = rows;
            } catch (error) {
                console.warn(`Failed to load ${key} overview`, error);
            }
        }));

        if (shouldReset) {
            State.filter = '';
            State.sort = { key: null, dir: 'asc' };
            State.libraryFilters = {};
            const search = document.getElementById('dataset-search');
            if (search) search.value = '';
        }
        renderLibraryFilters(datasetKey);
        renderDatasetTable(config, data);
        renderLibraryOverview();
    } catch (error) {
        State.cache[datasetKey] = [];
        renderLibraryError(error?.message || `${config.label} could not be loaded.`);
        renderLibraryOverview();
    } finally {
        setLibraryLoading(false);
    }
}

function switchDatasetTab(key) {
    loadDataset(key);
}

function filterDataset() {
    State.filter = document.getElementById('dataset-search').value.trim().toLowerCase();
    const config = DATASETS[State.currentDataset];
    renderDatasetTable(config, State.cache[State.currentDataset]);
}

function resetLibraryFilters() {
    State.filter = '';
    State.libraryFilters = {};
    const search = document.getElementById('dataset-search');
    if (search) search.value = '';
    renderLibraryFilters(State.currentDataset);
    renderDatasetTable(DATASETS[State.currentDataset], State.cache[State.currentDataset] || []);
    search?.focus();
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
            showToast(json.error, 'error');
        } else {
            showToast(json.message || `${config.label} cleared.`);
            loadDataset(State.currentDataset); // Refresh
        }
    } catch (e) {
        showToast(`Clear failed: ${e?.message || e}`, 'error');
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

function compareDatasetValues(valA, valB, direction = 'asc') {
    const emptyA = valA === null || valA === undefined || valA === '';
    const emptyB = valB === null || valB === undefined || valB === '';
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;

    const comparison = String(valA).localeCompare(String(valB), undefined, {
        numeric: true,
        sensitivity: 'base'
    });
    return direction === 'asc' ? comparison : -comparison;
}

function switchLibraryView(mode) {
    State.libraryViewMode = mode === 'card' ? 'card' : 'table';
    
    // Update view toggle button classes
    const btnTable = document.getElementById('btn-view-table');
    const btnCard = document.getElementById('btn-view-card');
    if (btnTable && btnCard) {
        if (State.libraryViewMode === 'table') {
            btnTable.classList.add('active');
            btnCard.classList.remove('active');
            btnTable.setAttribute('aria-pressed', 'true');
            btnCard.setAttribute('aria-pressed', 'false');
        } else {
            btnCard.classList.add('active');
            btnTable.classList.remove('active');
            btnCard.setAttribute('aria-pressed', 'true');
            btnTable.setAttribute('aria-pressed', 'false');
        }
    }
    
    const config = DATASETS[State.currentDataset];
    const data = State.cache[State.currentDataset] || [];
    renderDatasetTable(config, data);
}

function updateLibraryResults(visible, total) {
    const filtered = Boolean(State.filter || Object.values(State.libraryFilters || {}).some(Boolean));
    const status = document.getElementById('dataset-results-status');
    const reset = document.getElementById('dataset-filter-reset');
    const empty = document.getElementById('dataset-empty-state');
    if (status) status.textContent = filtered ? `${visible} of ${total} records` : `${total} ${total === 1 ? 'record' : 'records'}`;
    if (reset) reset.hidden = !filtered;
    if (empty) {
        empty.hidden = visible > 0;
        empty.querySelector('h3').textContent = total === 0 && !filtered ? 'No records yet' : 'No records found';
        empty.querySelector('p').textContent = total === 0 && !filtered
            ? `Add your first ${LIBRARY_ITEM_LABELS[State.currentDataset] || 'record'} to this collection.`
            : 'Try clearing the search or filters.';
        const action = empty.querySelector('button');
        action.textContent = total === 0 && !filtered ? `Add ${LIBRARY_ITEM_LABELS[State.currentDataset] || 'record'}` : 'Clear filters';
        action.onclick = total === 0 && !filtered ? openAddDatasetModal : resetLibraryFilters;
    }
}

function renderLibraryError(message) {
    const table = document.getElementById('dataset-table');
    const cards = document.getElementById('dataset-cards');
    const empty = document.getElementById('dataset-empty-state');
    const status = document.getElementById('dataset-results-status');
    if (table) table.style.display = 'none';
    if (cards) cards.style.display = 'none';
    if (status) status.textContent = `Unable to load records: ${message}`;
    if (!empty) return;
    empty.hidden = false;
    empty.querySelector('h3').textContent = 'Library unavailable';
    empty.querySelector('p').textContent = message;
    const action = empty.querySelector('button');
    action.textContent = 'Try again';
    action.onclick = () => loadDataset(State.currentDataset, { resetControls: false });
}

function renderDatasetCards(config, data, processedData = getProcessedDatasetData(config, data)) {
    const container = document.getElementById('dataset-cards');
    if (!container) return;
    container.innerHTML = '';
    if (processedData.length === 0) return;

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
            const allianceBadge = item.alliance
                ? `<span class="airline-alliance-badge airline-alliance-${escapeHtml(item.alliance.toLowerCase().replaceAll(' ', '-'))}">${escapeHtml(formatAllianceLabel(item.alliance))}</span>`
                : '';
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
                    ${allianceBadge ? `<div class="library-card-info"><i class="fa-solid fa-people-group"></i>${allianceBadge}</div>` : ''}
                    ${item.frequent_flyer_program ? `<div class="library-card-info"><i class="fa-solid fa-id-card"></i> ${escapeHtml(item.frequent_flyer_program)}</div>` : ''}
                    ${item.frequent_flyer_id ? `<div class="library-card-info"><i class="fa-solid fa-user"></i> <span class="airline-member-number">${escapeHtml(item.frequent_flyer_id)}</span></div>` : ''}
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

        if (['cities', 'airports', 'airlines'].includes(State.currentDataset)) {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn btn-xs btn-outline-info';
            upBtn.innerHTML = '<i class="fas fa-sync"></i> Sync';
            upBtn.setAttribute('aria-label', `Sync ${LIBRARY_ITEM_LABELS[State.currentDataset]} data`);
            upBtn.onclick = () => syncDatasetItem(State.currentDataset, item.id, upBtn);
            actionsDiv.appendChild(upBtn);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-xs btn-outline-danger';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
        delBtn.onclick = () => deleteDatasetItem(item.id, delBtn);
        actionsDiv.appendChild(delBtn);

        card.innerHTML = cardHTML;
        card.appendChild(actionsDiv);
        container.appendChild(card);
    });
}

function renderDatasetTable(config, data) {
    const table = document.getElementById('dataset-table');
    const cards = document.getElementById('dataset-cards');
    const processedData = getProcessedDatasetData(config, data);
    updateLibraryResults(processedData.length, data.length);

    if (State.libraryViewMode === 'card') {
        if (table) table.style.display = 'none';
        if (cards) cards.style.display = processedData.length ? 'grid' : 'none';
        renderDatasetCards(config, data, processedData);
        return;
    }

    if (cards) cards.style.display = 'none';
    if (table) table.style.display = processedData.length ? 'table' : 'none';
    if (table) {
        table.className = 'data-table'; // Ensure class is set
        table.innerHTML = '';
    }

    // Header
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    config.columns.forEach(col => {
        const th = document.createElement('th');
        const active = State.sort.key === col.key;
        th.setAttribute('aria-sort', active ? (State.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'data-sort-button';
        button.innerHTML = `<span>${escapeHtml(col.label)}</span><i class="fa-solid ${active ? (State.sort.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort'}" aria-hidden="true"></i>`;
        button.onclick = () => sortDataset(col.key);
        th.appendChild(button);

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
            } else if (State.currentDataset === 'airlines' && col.key === 'alliance') {
                td.textContent = formatAllianceLabel(val) || '-';
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

        // Single record sync
        if (['cities', 'airports', 'airlines'].includes(State.currentDataset)) {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn btn-sm btn-icon action-sync';
            upBtn.innerHTML = '<i class="fas fa-sync"></i><span>Sync</span>';
            upBtn.title = 'Sync record data';
            upBtn.setAttribute('aria-label', `Sync ${LIBRARY_ITEM_LABELS[State.currentDataset]} data`);
            upBtn.onclick = (e) => {
                e.stopPropagation();
                syncDatasetItem(State.currentDataset, item.id, upBtn);
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
        btnDel.onclick = (e) => { e.stopPropagation(); deleteDatasetItem(item.id, btnDel); };

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
let modalSequence = 0;

function serializeModalForm(form) {
    if (!form) return '';
    const values = [];
    for (const element of form.elements) {
        if (!element.name || element.disabled) continue;
        if ((element.type === 'checkbox' || element.type === 'radio') && !element.checked) continue;
        if (element.type === 'file') {
            values.push([element.name, Array.from(element.files || []).map(file => `${file.name}:${file.size}`)]);
        } else {
            values.push([element.name, element.value]);
        }
    }
    return JSON.stringify(values);
}

function setModalMessage(record, message = '', type = 'error') {
    if (!record?.message) return;
    record.message.textContent = message;
    record.message.className = `modal-message modal-message-${type}`;
    record.message.hidden = !message;
}

function openModal(title, contentFn, onSave) {
    const zIndex = 2000 + (modalStack.length * 10);
    const titleId = `modal-title-${++modalSequence}`;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Create DOM
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = zIndex;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', titleId);
    modal.tabIndex = -1;

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<h3 id="${titleId}">${escapeHtml(title)}</h3><button type="button" class="close-btn" aria-label="Close dialog"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
    header.querySelector('.close-btn').onclick = () => closeModal();

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.appendChild(contentFn());

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const message = document.createElement('p');
    message.className = 'modal-message modal-message-error';
    message.setAttribute('role', 'alert');
    message.hidden = true;
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-text';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => closeModal();
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save';

    const record = { overlay, modal, trigger, message, saveBtn, initialFormState: '' };

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
            saveBtn.setAttribute('aria-busy', 'true');
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Saving…</span>';
            modal.setAttribute('aria-busy', 'true');
            setModalMessage(record);

            try {
                const result = await onSave(data);
                if (result !== false) closeModal({ force: true });
            } catch (e) {
                setModalMessage(record, e?.message || String(e));
            } finally {
                saveBtn.disabled = false;
                saveBtn.removeAttribute('aria-busy');
                saveBtn.textContent = 'Save';
                modal.removeAttribute('aria-busy');
            }
        };
    } else {
        saveBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';
    }

    footer.appendChild(message);
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    record.initialFormState = serializeModalForm(body.querySelector('form'));
    modalStack.push(record);
    document.body.classList.add('modal-open');
    overlay.addEventListener('mousedown', event => {
        if (event.target === overlay) closeModal();
    });
    body.querySelector('form')?.addEventListener('submit', event => {
        event.preventDefault();
        if (!saveBtn.hidden && saveBtn.style.display !== 'none') saveBtn.click();
    });
    requestAnimationFrame(() => {
        const firstControl = body.querySelector('input:not([type="hidden"]), select, textarea, button')
            || modal.querySelector('button');
        (firstControl || modal).focus();
    });
}

function closeModal({ force = false } = {}) {
    if (modalStack.length === 0) return;
    const record = modalStack[modalStack.length - 1];
    const form = record.modal.querySelector('form');
    const changed = form && serializeModalForm(form) !== record.initialFormState;
    if (!force && changed && !confirm('Discard unsaved changes?')) return;
    modalStack.pop();
    record.overlay.remove();
    document.body.classList.toggle('modal-open', modalStack.length > 0);
    if (record.trigger?.isConnected) record.trigger.focus();
    else modalStack[modalStack.length - 1]?.modal.focus();
}

document.addEventListener('keydown', event => {
    if (!modalStack.length) return;
    const record = modalStack[modalStack.length - 1];
    if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(record.modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
        .filter(element => element.offsetParent !== null);
    if (!focusable.length) {
        event.preventDefault();
        record.modal.focus();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});

// --- Forms ---
function createForm(fields, item = {}) {
    const form = document.createElement('form');
    form.className = 'form-grid';
    fields.forEach(col => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        if (col.type === 'textarea') formGroup.classList.add('form-group-wide');

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
                        el.value = opt.value ?? opt.id ?? '';
                        el.textContent = opt.label ?? opt[col.display || 'name'] ?? el.value;
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
                addBtn.setAttribute('aria-label', `Add ${col.label}`);
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
            if (item[col.key] !== null && item[col.key] !== undefined) input.value = item[col.key];
            formGroup.appendChild(input);
        } else {
            input = document.createElement('input');
            input.type = col.type || 'text';
            input.name = col.key;
            if (col.placeholder) input.placeholder = col.placeholder;
            if (col.required) input.required = true;
            if (col.step) input.step = col.step;
            if (item[col.key] !== null && item[col.key] !== undefined) input.value = item[col.key];
            formGroup.appendChild(input);
        }

        const fieldId = `modal-${modalSequence}-${col.key}`;
        input.id = fieldId;
        label.htmlFor = fieldId;

        if (col.help) {
            const help = document.createElement('small');
            help.className = 'form-help';
            help.textContent = col.help;
            formGroup.appendChild(help);
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
            throw new Error(res.error);
        }
        showToast(`${libraryItemLabel(State.currentDataset, true)} added.`);
        loadDataset(State.currentDataset, { resetControls: false });
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
            throw new Error(res.error);
        }

        if (onSuccess) {
            await onSuccess(res.id);
        } else {
            showToast(`${libraryItemLabel(currentDatasetKey, true)} ${item.id ? 'updated' : 'added'}.`);
            loadDataset(State.currentDataset, { resetControls: false });
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
                    <strong>CSV headers:</strong><br>
                    • <code>iata_code</code>: <b>(required)</b> Three-letter IATA code (e.g. PEK, JFK)<br>
                    • <code>name</code>: Airport name (fetched automatically if empty)<br>
                    • <code>icao_code</code>: Four-letter ICAO code (e.g. ZBAA, KJFK)<br>
                    • <code>city</code>: City name (linked or created automatically)<br>
                    • <code>lat/lon</code>: Latitude / longitude (fetched automatically if empty)<br>
                    • <code>terminals</code>: Terminals (comma-separated, e.g. T1,T2,T3)
                </div>
            `;
        } else if (State.currentDataset === 'cities') {
            helpText = `
                <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                    <strong>CSV headers:</strong><br>
                    • <code>name</code>: City name (required)<br>
                    • <code>country</code>: Country name<br>
                    • <code>country_code</code>: ISO country code (e.g. CN, US)<br>
                    • <code>timezone</code>: Time zone (e.g. Asia/Shanghai)
                </div>
            `;
        } else if (State.currentDataset === 'airlines') {
            helpText = `
                <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                    <strong>CSV headers:</strong><br>
                    • <code>name</code>: Airline name (required)<br>
                    • <code>iata_code</code>: Two-character IATA code (e.g. CA, MU)<br>
                    • <code>icao_code</code>: Three-letter ICAO code (e.g. CCA, CES)
                </div>
            `;
        } else if (State.currentDataset === 'flights') {
            helpText = `
                <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                    <strong>CSV headers:</strong><br>
                    • <code>date</code>: Flight date (YYYY-MM-DD)<br>
                    • <code>flight_number</code>: Flight number<br>
                    • <code>origin_code</code>: Departure airport IATA / ICAO code<br>
                    • <code>dest_code</code>: Arrival airport IATA / ICAO code<br>
                    • <code>airline_iata</code>: Airline IATA code<br>
                    • <code>aircraft_model</code>: Aircraft model (e.g. B738, A320)<br>
                    • <code>registration</code>: Aircraft registration<br>
                    • <code>std/sta/atd/ata</code>: Scheduled / actual departure and arrival (YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM)<br>
                    • <code>seat_number</code>: Seat number<br>
                    • <code>seat_type</code>: Seat type (e.g. Window, Aisle)<br>
                    • <code>flight_class</code>: Cabin class (e.g. Economy, Business)<br>
                    • <code>note</code>: Notes
                </div>
            `;
        }

        div.innerHTML = `
            <p>Importing: <strong>${config.label}</strong></p>
            ${helpText}
            <div class="form-group"><label for="dataset-csv-file">CSV file</label><input type="file" id="dataset-csv-file" accept=".csv"></div>
        `;
        return div;
    };

    openModal(`Import ${config.label} CSV`, contentFn, async () => {
        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput.files[0]) {
            throw new Error('Select a CSV file to continue.');
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const res = await API.upload(`import/${config.endpoint}`, formData);
            if (res.error) {
                throw new Error(res.error);
            } else {
                showToast(res.message || `${config.label} imported.`);
                if (res.errors && res.errors.length > 0) {
                    showToast(`${res.errors.length} rows could not be imported.`, 'warning');
                }
                loadDataset(State.currentDataset);
            }
        } catch (e) {
            throw new Error(`Upload failed: ${e?.message || e}`);
        }
    });
}


async function syncDatasetItem(datasetKey, id, button = null) {
    const config = DATASETS[datasetKey];
    if (!config) return;
    setButtonBusy(button, true, 'Syncing…');
    try {
        const result = await API.post(`${config.endpoint}/${id}/update`, {});
        if (result.error) throw new Error(result.error);
        showToast(result.message || `${libraryItemLabel(datasetKey, true)} synced.`);
        await loadDataset(datasetKey, { resetControls: false });
    } catch (error) {
        showToast(error?.message || 'Sync failed.', 'error');
    } finally {
        setButtonBusy(button, false);
    }
}

async function deleteDatasetItem(id, button = null) {
    const datasetKey = State.currentDataset;
    const config = DATASETS[datasetKey];
    const item = (State.cache[datasetKey] || []).find(row => row.id === id);
    const itemName = item?.name || `${LIBRARY_ITEM_LABELS[datasetKey] || 'record'} ${id}`;
    if (!confirm(`Delete ${itemName}? This cannot be undone.`)) return;
    setButtonBusy(button, true, 'Deleting…');
    try {
        const result = await API.delete(config.endpoint, id);
        if (result?.error) throw new Error(result.error);
        showToast(`${libraryItemLabel(datasetKey, true)} deleted.`);
        await loadDataset(datasetKey, { resetControls: false });
    } catch (error) {
        showToast(error?.message || 'Delete failed.', 'error');
    } finally {
        setButtonBusy(button, false);
    }
}

// --- Flights Logic ---
async function loadFlights() {
    // Alias for compatibility
    await fetchFlights();
}

async function fetchFlights() {
    setFlightListLoading(true);
    try {
        const flights = await API.get('flights/detailed');
        if (!Array.isArray(flights)) throw new Error(flights?.error || 'Flights could not be loaded.');
        flights.forEach(f => {
            f.date = f.std || f.date || '';
            f._std_ts = f.std ? Date.parse(f.std) : (f.date ? Date.parse(f.date) : 0);
        });
        State.cache.flights = flights;
        updateFlightHealthControl();
        renderFlights();
    } catch (error) {
        State.cache.flights = [];
        renderFlights({ error: error?.message || 'Flights could not be loaded.' });
    } finally {
        setFlightListLoading(false);
    }
}

function setFlightListLoading(loading) {
    const table = document.getElementById('flights-table');
    const status = document.getElementById('flight-results-status');
    const toolbar = document.querySelector('.flight-list-toolbar');
    if (table) table.setAttribute('aria-busy', String(loading));
    if (toolbar) toolbar.classList.toggle('is-loading', loading);
    if (loading && status) status.textContent = 'Loading flights…';
}

function flightHealthGaps(flight) {
    const date = String(flight.date || flight.std || '').split(/[ T]/)[0];
    const normalized = { ...flight, date };
    return journeyMissingFields(normalized, candidate => isProfileFlightCompleted(candidate, new Date()));
}

function updateFlightHealthControl() {
    const button = document.getElementById('flight-health-filter');
    if (!button) return;
    const count = (State.cache.flights || []).filter(flight => flightHealthGaps(flight).length).length;
    if (!count) State.flightHealthOnly = false;
    button.disabled = count === 0;
    button.classList.toggle('is-healthy', count === 0);
    button.classList.toggle('active', State.flightHealthOnly);
    button.setAttribute('aria-pressed', String(State.flightHealthOnly));
    button.title = count ? 'Show only flights with missing required data' : 'No flights need attention';
    button.innerHTML = count
        ? `<i class="fa-solid fa-triangle-exclamation"></i><span>Needs attention · ${count}</span>`
        : '<i class="fa-solid fa-circle-check"></i><span>All flights healthy</span>';
}

function toggleFlightHealthFilter() {
    if (!(State.cache.flights || []).some(flight => flightHealthGaps(flight).length)) return;
    State.flightHealthOnly = !State.flightHealthOnly;
    updateFlightHealthControl();
    renderFlights();
}

function filterFlights() {
    State.flightQuery = document.getElementById('flight-search')?.value.trim().toLowerCase() || '';
    renderFlights();
}

function setFlightSort(value) {
    const [key, dir] = String(value || 'date:desc').split(':');
    State.flightSort = { key, dir: dir === 'asc' ? 'asc' : 'desc' };
    renderFlights();
}

function resetFlightFilters() {
    State.flightQuery = '';
    State.flightHealthOnly = false;
    const search = document.getElementById('flight-search');
    if (search) search.value = '';
    updateFlightHealthControl();
    renderFlights();
    search?.focus();
}

function renderFlights({ error = '' } = {}) {
    let data = [...State.cache.flights];

    if (State.flightHealthOnly) data = data.filter(flight => flightHealthGaps(flight).length);

    const query = State.flightQuery;
    if (query) {
        const searchableFields = [
            'date', 'flight_number', 'origin_name', 'origin_code', 'dest_name', 'dest_code',
            'airline_name', 'aircraft_model', 'registration', 'seat_number', 'seat_type',
            'flight_class', 'note', 'tag_generation', 'tag_winglets', 'tag_config'
        ];
        data = data.filter(item => searchableFields.some(field => String(item[field] || '').toLowerCase().includes(query)));
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
    const total = State.cache.flights.length;
    const status = document.getElementById('flight-results-status');
    const reset = document.getElementById('flight-filter-reset');
    const empty = document.getElementById('flights-empty-state');
    const tableWrap = document.querySelector('#view-flights .table-responsive');
    const filtered = Boolean(query || State.flightHealthOnly);
    if (status) status.textContent = error
        ? `Unable to load flights: ${error}`
        : filtered ? `${data.length} of ${total} flights` : `${total} ${total === 1 ? 'flight' : 'flights'}`;
    if (reset) reset.hidden = !filtered;
    if (empty) {
        empty.hidden = data.length > 0 || Boolean(error);
        const text = empty.querySelector('p');
        const action = empty.querySelector('button');
        if (text) text.textContent = total === 0 && !filtered
            ? 'Add your first flight to start building your archive.'
            : 'Try clearing the search or data-health filter.';
        if (action) {
            action.textContent = total === 0 && !filtered ? 'Add flight' : 'Clear filters';
            action.onclick = total === 0 && !filtered ? openAddFlightModal : resetFlightFilters;
        }
    }
    if (tableWrap) tableWrap.hidden = data.length === 0;
    if (error) {
        if (empty) {
            empty.hidden = false;
            empty.querySelector('h3').textContent = 'Flights unavailable';
            empty.querySelector('p').textContent = error;
            const action = empty.querySelector('button');
            action.textContent = 'Try again';
            action.onclick = fetchFlights;
        }
        return;
    } else if (empty) {
        empty.querySelector('h3').textContent = 'No flights found';
    }
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
        const healthGaps = flightHealthGaps(f);
        const healthLabel = healthGaps.map(field => ({ date: 'date', flight_number: 'flight number', aircraft: 'aircraft', registration: 'registration', actual_times: 'actual times', distance: 'distance' })[field] || field).join(', ');
        const healthWarning = healthGaps.length
            ? `<span class="flight-health-warning" title="Missing: ${escapeHtml(healthLabel)}" aria-label="Needs attention: ${escapeHtml(healthLabel)}"><i class="fa-solid fa-triangle-exclamation"></i></span>`
            : '';
        const codeshareNumbers = Array.isArray(f.flight_aliases)
            ? f.flight_aliases.filter(alias => alias.alias_type === 'codeshare').map(alias => alias.flight_number)
            : [];

        tr.className = `flight-row${healthGaps.length ? ' flight-row-needs-attention' : ''}`;
        tr.title = healthGaps.length ? `Open flight details · Missing: ${healthLabel}` : 'Open flight details';
        tr.innerHTML = `
            <td class="flight-cell flight-summary" data-label="Date / Flight">
                <div class="flight-summary-date">${displayDate}${healthWarning}</div>
                <div class="flight-route-strip"><div class="flight-route-point"><span class="flight-route-name">${safe(f.origin_name || f.origin_code)}</span><small class="flight-route-terminal">${safe(f.origin_code)} · ${originTerminal}</small></div><i class="fa-solid fa-plane"></i><div class="flight-route-point"><span class="flight-route-name">${safe(f.dest_name || f.dest_code)}</span><small class="flight-route-terminal">${safe(f.dest_code)} · ${destTerminal}</small></div></div>
                <div class="flight-summary-main flight-summary-actions"><div><div class="flight-summary-number">${safe(f.flight_number)}</div>${codeshareNumbers.length ? `<div class="flight-codeshare-inline">Codeshare · ${codeshareNumbers.map(escapeHtml).join(' · ')}</div>` : ''}</div><div class="flight-summary-button-group"><button class="btn btn-sm flight-update-summary action-api" data-action-label="Update" aria-label="Update flight from AeroAPI" title="Update from AeroAPI"><i class="fa-solid fa-cloud-arrow-down"></i><span>API</span></button></div></div>
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
        tr.querySelectorAll('.flight-update-summary').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); updateFlightFromAeroAPI(f.id, btn); }; });
        tbody.appendChild(tr);
    });
}

async function updateFlightFromAeroAPI(id, button = null) {
    const original = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Loading</span>';
    }
    try {
        const preview = await API.post(`flights/${id}/aeroapi_preview`, {});
        if (preview.error) {
            showToast(`Update failed: ${preview.error}`, 'error');
            return;
        }
        if (preview.ambiguous) {
            openAeroApiCandidateModal(id, preview.candidates || []);
            return;
        }

        openAeroApiDiffModal(id, preview);
    } catch (e) {
        showToast(`AeroAPI request failed: ${e?.message || e}`, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.innerHTML = original;
        }
    }
}

function openAeroApiCandidateModal(id, candidates) {
    if (!candidates.length) {
        showToast('No AeroAPI candidates found.', 'info');
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
            radio.setAttribute('aria-label', `Select ${candidate.ident_iata || candidate.ident || candidate.ident_icao || 'flight'} ${routeText(candidate)}`);
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
            throw new Error('Select a flight candidate.');
        }

        const candidateIndex = Number(selected.value);
        const preview = await API.post(`flights/${id}/aeroapi_preview`, { candidate_index: candidateIndex });
        if (preview.error) {
            throw new Error(`Update failed: ${preview.error}`);
        }
        if (preview.ambiguous) {
            throw new Error('Select one AeroAPI flight before reviewing fields.');
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
        showToast('This flight already matches AeroAPI.', 'info');
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
            cb.setAttribute('aria-label', `Replace ${diff.label || diff.field} with AeroAPI value`);
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
            throw new Error('Select at least one field to update.');
        }

        const res = await API.post(`flights/${id}/aeroapi_apply`, {
            fields: checked,
            candidate_index: preview.candidate_index
        });
        if (res.error) {
            throw new Error(`Update failed: ${res.error}`);
        }
        showToast(`Updated ${res.fields_updated || 0} fields.`);
        loadFlights();
        return true;
    });
}

async function updateMissingFlights() {
    const btn = document.querySelector('button[onclick="updateMissingFlights()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }

    try {
        const res = await API.post('flights/update_aeroapi_missing', {});
        if (res.error) throw new Error(res.error);
        showToast(`Bulk update complete: ${res.updated || 0} of ${res.total_candidates || 0} candidates updated.`);
        loadFlights();
    } catch (e) {
        showToast(`Bulk update failed: ${e?.message || e}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-download-alt"></i> Update Missing'; }
    }
}

function openImportFlightsModal() {
    const config = { label: 'Flights', endpoint: 'flights' };

    openModal('Import Flights CSV', () => {
        const div = document.createElement('div');
        div.innerHTML = `
            <div style="font-size:0.85rem; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #ddd; margin-bottom:10px;">
                <strong>CSV headers:</strong><br>
                • <code>flight_number</code>: Flight number (e.g. CA123)<br>
                • <code>origin_code/dest_code</code>: Airport IATA code (e.g. PEK)<br>
                • <code>origin_terminal/dest_terminal</code>: Terminal (e.g. T1, T2)<br>
                • <code>std/sta/atd/ata</code>: <strong>Date / time format: <code>YYYY-MM-DD HH:mm [TZ]</code></strong><br>
                  (Time zones supported, e.g. <code>2024-01-01 12:30+08:00</code> or <code>2024-01-01 12:30 GMT</code>)<br>
                • <code>registration</code>: Aircraft registration (e.g. B-1234)<br>
                • <code>airline</code>: Airline name, IATA or ICAO code<br>
                • <code>aircraft</code>: Aircraft model<br>
                • <code>distance</code>: Distance (numeric)<br>
                • <code>seat_number</code>: Seat number (e.g. 12A)<br>
                • <code>seat_type</code>: Seat position (Window/Aisle)<br>
                • <code>class</code>: Cabin class (Economy/Business)<br>
                • <code>note</code>: Notes
            </div>
            <div class="form-group"><label for="flight-csv-file">CSV file</label><input type="file" id="flight-csv-file" accept=".csv"></div>
        `;
        const input = div.querySelector('input');
        // No onchange handler needed
        return div;
    }, async () => {
        const fileInput = document.getElementById('flight-csv-file');
        if (!fileInput || !fileInput.files[0]) {
            throw new Error('Select a CSV file to continue.');
        }

        try {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            const res = await API.upload(`import/flights`, formData);

            if (res.error) {
                throw new Error(`Import failed: ${res.error}`);
            } else {
                showToast(res.message || 'Flights imported.');
                if (res.errors?.length) showToast(`${res.errors.length} rows could not be imported.`, 'warning');
                loadFlights();
            }
        } catch (e) {
            throw new Error(e?.message || `Import failed: ${e}`);
        }
    });
}

async function deleteFlight(id) {
    if (!confirm('Delete flight?')) return;
    try {
        const result = await API.delete('flights', id);
        if (result.error) throw new Error(result.error);
        showToast('Flight deleted.');
        loadFlights();
    } catch (error) {
        showToast(error?.message || 'Delete failed.', 'error');
    }
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
        { key: 'codeshare_flight_numbers', label: 'Codeshare Flight Numbers', type: 'text', placeholder: 'e.g. VS4116, 3U1340' },
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
            const optionLabel = select.closest('.form-group')?.querySelector('label')?.textContent?.trim() || 'option';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-secondary';
            btn.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
            btn.title = `Add ${optionLabel.toLowerCase()}`;
            btn.setAttribute('aria-label', `Add ${optionLabel.toLowerCase()}`);
            btn.onclick = () => {
                const parentId = parentSelect.value;
                if (!parentId) return showToast('Select the related airport or aircraft first.', 'info');
                const parentObj = parentList.find(x => x.id == parentId);
                if (!parentObj) return;
                openModal(`Add ${optionLabel}`, () => createForm([
                    { key: 'value', label: optionLabel, type: 'text', required: true, placeholder: `Enter ${optionLabel.toLowerCase()}` }
                ]), async ({ value }) => {
                    const newValue = String(value || '').trim();
                    const current = parentObj[parentField] || '';
                    if (current.split(',').map(entry => entry.trim().toLowerCase()).includes(newValue.toLowerCase())) {
                        throw new Error('That option already exists.');
                    }
                    const updatedParent = { ...parentObj, [parentField]: current ? `${current}, ${newValue}` : newValue };
                    const result = await API.put(apiEndpoint, parentId, updatedParent);
                    if (result.error) throw new Error(result.error);
                    Object.assign(parentObj, updatedParent);
                    item[itemKey] = newValue;
                    refreshFn(parentId);
                    select.value = newValue;
                    showToast(`${optionLabel} added.`);
                    return true;
                });
            };

            // Append to wrapper
            if (select.parentNode) {
                const group = select.parentNode;
                const row = document.createElement('div');
                row.className = 'form-control-inline';
                group.insertBefore(row, select);
                row.append(select, btn);
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
            throw new Error(`Save failed: ${res.error}`);
        }
        showToast('Flight updated.');
        loadFlights();
        return true;
    });
}

async function openAddFlightModal() {
    // Simplified Quick Add Mode
    // Only ask for Flight Number and Date
    const flightFields = [
        { key: 'flight_number', label: 'Flight Number', type: 'text', placeholder: 'e.g. CA123', required: true },
        { key: 'date', label: 'Date', type: 'date', required: true } // Use date input, backend stores YYYY-MM-DD
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
                throw new Error(res.error);
            }

            const flightId = res.id || res.lastrowid; // Check what API returns

            if (State.currentView === 'flights') loadFlights();
            if (State.currentView === 'profile') loadProfile(); // Update profile counts
            showToast('Flight added.');

            // Manual update only via cloud button

        } catch (e) {
            throw new Error(`Could not add flight: ${e?.message || e}`);
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
    const end = new Date();
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
    const end = Math.max(...years);
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

function filterFlightsForInsight(kind, value, scope = 'selected') {
    const flights = scope === 'all' ? (State.cache.flights || []) : (State.journeyFlights || State.cache.flights || []);
    return flights.filter(flight => {
        if (kind === 'all') return true;
        if (kind === 'year') return normalizeYear(flight.date) === String(value);
        if (kind === 'month') return normalizeMonth(flight.date) === String(value);
        if (kind === 'monthOfYear') return Number(String(flight.date || '').slice(5, 7)) === Number(value);
        if (kind === 'distanceBucket') return distanceBucketForFlight(flight) === value;
        if (kind === 'cabin') return ((flight.flight_class || '').trim() || 'Unknown') === value;
        if (kind === 'seat') return journeySeatType(flight) === value;
        if (kind === 'dayNight') return journeyDayNight(flight) === value;
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
            const missing = journeyMissingFields(flight, isProfileFlightCompleted);
            if (value === 'health') return missing.length > 0;
            if (!isProfileFlightCompleted(flight)) return false;
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
    const totals = stats.totals || {};
    const records = stats.records || {};
    const quality = stats.quality || {};
    const otp = quality.on_time_performance || { avg_departure_delay: 0, avg_arrival_delay: 0, on_time_rate: 100, total_tracked: 0 };
    const cards = [
        {
            icon: 'fa-route',
            label: 'Total distance',
            value: formatKm(totals.distance),
            recordLabel: 'Longest flight',
            meta: records.longest_distance?.distance
                ? `${formatKm(records.longest_distance.distance)} · ${routeLabel(records.longest_distance)}`
                : 'No distance record yet',
            flights: () => records.longest_distance
                ? filterFlightsForInsight('route', `${records.longest_distance.origin}-${records.longest_distance.dest}`)
                : filterFlightsForInsight('all')
        },
        {
            icon: 'fa-clock',
            label: 'Total flight time',
            value: formatHours(totals.duration),
            recordLabel: 'Longest flight',
            meta: records.longest_duration?.duration
                ? `${formatHours(records.longest_duration.duration)} · ${routeLabel(records.longest_duration)}`
                : 'No duration record yet',
            flights: () => records.longest_duration
                ? filterFlightsForInsight('route', `${records.longest_duration.origin}-${records.longest_duration.dest}`)
                : filterFlightsForInsight('all')
        },
        {
            icon: 'fa-plane-arrival',
            label: 'On-time performance',
            value: otp.total_tracked ? `${otp.on_time_rate}% on-time` : 'No actual arrival data',
            recordLabel: 'Tracked flights',
            meta: `${otp.total_tracked} tracked · Dep ${otp.avg_departure_delay}m / Arr ${otp.avg_arrival_delay}m delay`,
            flights: () => filterFlightsForInsight('delayed')
        },
    ];
    container.innerHTML = '';
    cards.forEach(card => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'journey-highlight-card';
        el.onclick = () => openFlightListModal(card.label, card.flights());
        el.innerHTML = `
            <span class="journey-highlight-icon"><i class="fa-solid ${card.icon}" aria-hidden="true"></i></span>
            <div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><small class="journey-highlight-record"><b>${escapeHtml(card.recordLabel)}</b>${escapeHtml(card.meta)}</small></div>
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
    const hasDatasetLegend = key === 'yearComboChart' || key === 'footprintGrowthChart';
    if (hasDatasetLegend) config.options.plugins.legend = { display: false };
    if (config.type === 'doughnut') {
        const insight = { classDonutChart: 'cabin', seatDonutChart: 'seat', dayNightDonutChart: 'dayNight' }[key];
        if (insight) config.options.onClick = (event, elements) => {
            if (!elements.length) return;
            const label = config.data.labels[elements[0].index];
            openFlightListModal(label, filterFlightsForInsight(insight, label));
        };
        config.options.plugins.legend = { display: false };
        config.options.layout = { padding: 2 };
        config.options.cutout = '64%';
        config.options.radius = '100%';
        config.options.animation = false;
        const values = config.data.datasets[0].data;
        const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', total ? config.data.labels.map((label, i) => `${label}: ${values[i]}`).join(', ') : 'No data available');
        if (!total) {
            config.plugins = [...(config.plugins || []), {
                id: 'emptyDonut',
                afterDraw(chart) {
                    const { ctx, chartArea: area } = chart;
                    const radius = Math.min(area.width, area.height) / 2 - 2;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc((area.left + area.right) / 2, (area.top + area.bottom) / 2, radius * 0.82, 0, Math.PI * 2);
                    ctx.strokeStyle = '#e6ebf1';
                    ctx.lineWidth = radius * 0.36;
                    ctx.stroke();
                    ctx.restore();
                }
            }];
        }
    }
    State.journeyCharts[key] = new Chart(canvas.getContext('2d'), config);
    if (config.type === 'doughnut') renderJourneyDonutLegend(canvas, State.journeyCharts[key]);
    if (hasDatasetLegend) renderJourneyDatasetLegend(canvas, State.journeyCharts[key]);
}

function renderJourneyDatasetLegend(canvas, chart) {
    const box = canvas.closest('.journey-chart-box');
    if (!box) return;
    box.parentElement.querySelector('.journey-dataset-legend')?.remove();
    const legend = document.createElement('div');
    legend.className = 'journey-dataset-legend';
    chart.data.datasets.forEach((dataset, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(chart.isDatasetVisible(index)));
        button.setAttribute('aria-label', `${dataset.label}. Toggle visibility`);
        const swatch = document.createElement('span');
        swatch.className = 'journey-dataset-swatch';
        swatch.style.backgroundColor = dataset.borderColor;
        swatch.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = dataset.label;
        button.append(swatch, label);
        button.onclick = () => {
            chart.setDatasetVisibility(index, !chart.isDatasetVisible(index));
            chart.update();
            button.setAttribute('aria-pressed', String(chart.isDatasetVisible(index)));
        };
        legend.append(button);
    });
    box.after(legend);
}

function renderJourneyDonutLegend(canvas, chart) {
    const wrapper = canvas.closest('.donut-chart-wrapper');
    if (!wrapper) return;
    wrapper.querySelector('.donut-legend')?.remove();
    const legend = document.createElement('div');
    legend.className = 'donut-legend';
    const dataset = chart.data.datasets[0];
    const total = dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
    const summary = document.createElement('p');
    summary.className = 'donut-sample-count';
    summary.textContent = total ? `${total.toLocaleString()} records · count / share` : 'No data available';
    legend.append(summary);
    if (total) chart.data.labels.forEach((label, index) => {
        const count = Number(dataset.data[index] || 0);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'donut-legend-row';
        row.setAttribute('aria-pressed', String(chart.getDataVisibility(index)));
        row.setAttribute('aria-label', `${label}: ${count}, ${(count / total * 100).toFixed(1)}%. Toggle visibility`);
        const swatch = document.createElement('i');
        swatch.className = 'donut-legend-swatch';
        swatch.setAttribute('aria-hidden', 'true');
        swatch.style.backgroundColor = dataset.backgroundColor[index % dataset.backgroundColor.length];
        const name = document.createElement('span');
        name.className = 'donut-legend-label';
        name.textContent = label;
        const number = document.createElement('span');
        number.className = 'donut-legend-number';
        number.textContent = count.toLocaleString();
        const share = document.createElement('span');
        share.className = 'donut-legend-share';
        share.textContent = `${(count / total * 100).toFixed(1)}%`;
        row.append(swatch, name, number, share);
        row.onclick = () => {
            chart.toggleDataVisibility(index);
            chart.update();
            row.setAttribute('aria-pressed', String(chart.getDataVisibility(index)));
        };
        legend.append(row);
    });
    wrapper.append(legend);
}

function renderMonthOfYearStats(monthRows) {
    const totals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0 }));
    (monthRows || []).forEach(row => {
        const month = Number(String(row.month || '').slice(5, 7));
        if (month >= 1 && month <= 12) totals[month - 1].count += Number(row.count || 0);
    });
    const max = Math.max(...totals.map(row => row.count), 1);
    return `<div class="month-of-year-grid">${totals.map(row => `
        <button class="month-of-year-item" onclick="openFlightListModal('Month pattern', filterFlightsForInsight('monthOfYear', ${row.month}, 'all'))" title="${row.count} flights in month ${row.month}">
            <span class="month-of-year-plot"><i style="--month-level:${Math.max(8, Math.round((row.count / max) * 100))}%"><strong>${row.count}</strong></i></span>
            <span class="month-of-year-label">${String(row.month).padStart(2, '0')}</span>
        </button>
    `).join('')}</div>`;
}

function renderJourneyTrends(stats, scopedStats) {
    const container = document.getElementById('journey-trends');
    if (!container) return;
    const months = stats.flights_by_month || [];
    const recentMonths = buildRecentTwelveMonths(months);
    const buckets = scopedStats.distributions?.route_distance_buckets || [];
    const years = buildContinuousYears(stats);
    const byYear = (rows, key) => Object.fromEntries((rows || []).map(row => [row.year, Number(row[key] || 0)]));
    const flightMap = byYear(stats.flights_by_year, 'count');
    const distanceMap = byYear(stats.distance_by_year, 'distance');
    const durationMap = byYear(stats.duration_by_year, 'duration');

    container.innerHTML = `
        <article class="journey-chart-card journey-chart-wide" data-journey-profile-card>
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
            <div class="stats-header">Yearly rhythm</div>
            <p class="journey-chart-note">All trend charts below use all years and all flights, regardless of the filters above.</p>
            <label class="journey-chart-note">Metric <select id="journey-year-metric"><option value="flights">Flights</option><option value="distance">Distance (km)</option><option value="hours">Hours</option></select></label>
            <div class="journey-chart-box"><canvas id="yearComboChart"></canvas></div>
        </article>

        <article class="journey-chart-card journey-chart-wide">
            <div class="stats-header">Footprint collection timeline</div>
            <p class="journey-chart-note">Cumulative airports, cities and countries across all years and all flights, including upcoming flights.</p>
            <div class="journey-chart-box"><canvas id="footprintGrowthChart"></canvas></div>
        </article>
        
        <div class="journey-heatmap-row">
            <article class="journey-chart-card">
                <div class="stats-header">Monthly flight heatmap (Contribution Graph)</div>
                <p class="journey-chart-note">Grid color intensity represents flight frequency per month across years.</p>
                ${renderFlightHeatmap(months)}
            </article>
            <div class="journey-heatmap-side">
                <article class="journey-chart-card"><div class="stats-header">Last twelve months</div><div class="journey-chart-box"><canvas id="monthlyChart"></canvas></div></article>
                <article class="journey-chart-card"><div class="stats-header">Month pattern</div><p class="journey-chart-note">Flights grouped by calendar month, January through December.</p>${renderMonthOfYearStats(months)}</article>
            </div>
        </div>
        

    `;

    const profileContainer = document.getElementById('journey-profile-insights');
    const profileCard = container.querySelector('[data-journey-profile-card]');
    if (profileContainer && profileCard) {
        const title = profileContainer.querySelector('.stats-header');
        profileContainer.replaceChildren(title, ...profileCard.childNodes);
        profileCard.remove();
    }

    const yearMetric = State.journeyMetric || 'flights';
    const metricOptions = {
        flights: { label: 'Flights', data: years.map(y => flightMap[y] || 0), color: '#6d829f' },
        distance: { label: 'Distance (km)', data: years.map(y => distanceMap[y] || 0), color: '#579c98' },
        hours: { label: 'Hours', data: years.map(y => Math.round((durationMap[y] || 0) / 60)), color: '#cf8b78' }
    };
    const metric = metricOptions[yearMetric];
    const metricSelect = document.getElementById('journey-year-metric');
    metricSelect.value = yearMetric;
    metricSelect.onchange = () => {
        State.journeyMetric = metricSelect.value;
        const next = metricOptions[State.journeyMetric];
        const chart = State.journeyCharts.yearComboChart;
        Object.assign(chart.data.datasets[0], { label: next.label, data: next.data, backgroundColor: next.color, borderColor: next.color });
        chart.options.scales.y.title.text = next.label;
        chart.setDatasetVisibility(0, true);
        chart.update();
        renderJourneyDatasetLegend(document.getElementById('yearComboChart'), chart);
    };
    renderJourneyChart('yearComboChart', {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{ label: metric.label, data: metric.data, backgroundColor: metric.color, borderColor: metric.color, borderWidth: 1, borderRadius: 4 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            onClick: (event, elements) => {
                if (!elements.length) return;
                const year = years[elements[0].index];
                openFlightListModal('Yearly rhythm', filterFlightsForInsight('year', year, 'all'));
            },
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: metric.label }, grid: { color: '#eef3f8' } },
                x: { grid: { display: false } }
            }
        }
    });

    renderJourneyChart('monthlyChart', {
        type: 'bar',
        data: { labels: recentMonths.map(d => d.month), datasets: [{ label: 'Flights', data: recentMonths.map(d => d.count), backgroundColor: '#6d829f', borderColor: '#6d829f', borderWidth: 0, borderRadius: 5 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (!elements.length) return;
                const month = recentMonths[elements[0].index].month;
                openFlightListModal('Recent months', filterFlightsForInsight('month', month, 'all'));
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
            plugins: { legend: { display: false } },
            cutout: '60%'
        }
    });

    const cabinCounts = Object.create(null);
    const seatCounts = { Window: 0, Aisle: 0, Middle: 0, Unknown: 0 };
    const flights = State.journeyFlights || State.cache.flights || [];
    
    flights.forEach(f => {
        const cls = (f.flight_class || '').trim() || 'Unknown';
        cabinCounts[cls] = (cabinCounts[cls] || 0) + 1;
        
        seatCounts[journeySeatType(f)]++;
    });

    renderJourneyChart('classDonutChart', {
        type: 'doughnut',
        data: {
            labels: Object.keys(cabinCounts),
            datasets: [{
                data: Object.values(cabinCounts),
                backgroundColor: Object.keys(cabinCounts).map(label => ({ Economy: '#00a0b5', 'Premium Economy': '#6cae75', Business: '#1c70bf', First: '#c86c8f', Unknown: '#aeb9c6' })[label] || '#ef8b2c'),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '60%'
        }
    });

    renderJourneyChart('seatDonutChart', {
        type: 'doughnut',
        data: {
            labels: ['Window', 'Aisle', 'Middle', 'Unknown'],
            datasets: [{
                data: [seatCounts.Window, seatCounts.Aisle, seatCounts.Middle, seatCounts.Unknown],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#aeb9c6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '60%'
        }
    });

    const dayNightCounts = scopedStats.distributions?.day_night || [];
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
            plugins: { legend: { display: false } },
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
                { label: 'Airports', data: airportsData, borderColor: '#6d829f', backgroundColor: 'rgba(109,130,159,.05)', fill: true, tension: 0.25, pointRadius: 2, borderWidth: 2.5 },
                { label: 'Cities', data: citiesData, borderColor: '#579c98', backgroundColor: 'rgba(87,156,152,.04)', fill: true, tension: 0.25, pointRadius: 2, borderWidth: 2.5 },
                { label: 'Countries', data: countriesData, borderColor: '#cf8b78', backgroundColor: 'rgba(207,139,120,.04)', fill: true, tension: 0.25, pointRadius: 2, borderWidth: 2.5 }
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
        const health = rows.length === 0 ? 'Empty' : (gaps ? `${formatCompactNumber(gaps)} gaps` : 'Healthy');
        const healthClass = rows.length === 0 ? 'empty' : (gaps ? 'needs-work' : '');
        return `<button type="button" class="library-overview-card${active}" data-dataset-key="${key}" aria-pressed="${State.currentDataset === key}" onclick="switchDatasetTab('${key === 'aircraft_models' ? 'aircraft' : key}')">
            <span class="library-overview-icon"><i class="fa-solid ${icon}"></i></span>
            <span><strong>${formatCompactNumber(rows.length)}</strong><small>${escapeHtml(label)}</small></span>
            <em class="library-health-pill ${healthClass}">${escapeHtml(health)}</em>
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
    const count = document.getElementById('journey-flight-count');
    const summary = document.getElementById('journey-summary');
    
    if (count) count.textContent = `${flights.length.toLocaleString()} flights`;
    if (summary) summary.textContent = State.journeyStatus === 'completed' ? 'Completed flights · Scheduled duration used when actual duration is missing' : 'Includes unfinished flights · Distance and duration may be planned values';

}

// Calculate & Render Header Stats
const renderHeaderStats = (flights) => {
    renderJourneyHero(flights);
};

async function loadProfile() {
    try {
        const [cities, flights] = await Promise.all([
            API.get('cities'),
            API.get('flights/detailed')
        ]);
        State.cache.flights = flights;
        State.journeyCities = cities;
        State.journeyYear ||= 'all';
        State.journeyStatus ||= 'all';
        State.journeyTab ||= 'overview';
        const yearSelect = document.getElementById('year-filter');
        if (yearSelect) {
            yearSelect.innerHTML = '<option value="all">All years</option>';
            const years = new Set(flights.map(f => f.date ? f.date.substring(0, 4) : null).filter(y => y));
            const sortedYears = Array.from(years).sort().reverse();
            sortedYears.forEach(year => yearSelect.options.add(new Option(year, year)));
            if (State.journeyYear !== 'all' && !years.has(State.journeyYear)) State.journeyYear = 'all';
            yearSelect.value = State.journeyYear;
            yearSelect.onchange = () => { State.journeyYear = yearSelect.value; updateJourneyScope(); };
        }
        const status = document.getElementById('journey-status-filter');
        status.value = State.journeyStatus;
        status.onchange = () => { State.journeyStatus = status.value; updateJourneyScope(); };
        document.querySelectorAll('[data-journey-tab]').forEach(button => {
            button.onclick = () => { State.journeyTab = button.dataset.journeyTab; showJourneyTab(); };
        });
        updateJourneyScope();
    } catch (e) {
        console.error("Profile load error", e);
        document.getElementById('journey-scope-note').textContent = 'Unable to load flights. Please refresh to retry.';
    }
}

function updateJourneyScope() {
    const now = new Date();
    State.journeyFlights = selectJourneyFlights(State.cache.flights || [], State.journeyYear, State.journeyStatus, f => isProfileFlightCompleted(f, now));
    State.cache.stats = aggregateJourneyStats(State.journeyFlights, State.journeyCities || [], f => isProfileFlightCompleted(f, now));
    renderHeaderStats(State.journeyFlights);
    renderJourneyHighlights(State.cache.stats);
    const label = { completed: 'Completed', pending: 'Upcoming / ongoing', all: 'All flights' }[State.journeyStatus];
    document.getElementById('journey-scope-note').textContent = `${State.journeyYear === 'all' ? 'All years' : State.journeyYear} · ${label} · ${State.journeyFlights.length} flights. Map, records and profile insights follow these filters; trend charts always use all flights.`;
    renderJourneyRecent(State.journeyFlights);
    showJourneyTab();
}

function showJourneyTab() {
    document.querySelectorAll('[data-journey-view]').forEach(section => { section.hidden = section.dataset.journeyView !== State.journeyTab; });
    document.querySelectorAll('[data-journey-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.journeyTab === State.journeyTab)));
    // Render only visible charts: Chart.js cannot measure hidden containers reliably.
    if (State.journeyTab === 'statistics') {
        renderJourneyTrends(aggregateJourneyStats(State.cache.flights || [], State.journeyCities || [], isProfileFlightCompleted), State.cache.stats);
        renderStatsDashboard(State.cache.stats, document.getElementById('profile-stats-dashboard'));
    } else {
        renderProfileMap(State.journeyFlights, 'all');
    }
}

function renderJourneyRecent(flights) {
    const container = document.getElementById('journey-recent');
    container.replaceChildren();
    const now = new Date();
    const completed = flights.filter(f => isProfileFlightCompleted(f, now)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3);
    const pending = flights.filter(f => !isProfileFlightCompleted(f, now)).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(0, 3);
    for (const [title, rows] of [['Recent flights', completed], ['Upcoming / ongoing', pending]]) {
        if (State.journeyStatus === 'completed' && title === 'Upcoming / ongoing') continue;
        if (State.journeyStatus === 'pending' && title === 'Recent flights') continue;
        const card = document.createElement('article');
        card.innerHTML = `<h2>${title}</h2>`;
        if (!rows.length) card.insertAdjacentHTML('beforeend', '<p>No flights in this scope.</p>');
        rows.forEach(f => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'journey-recent-flight';
            button.innerHTML = `<span>${escapeHtml(f.date || 'Unknown date')} · ${escapeHtml(f.flight_number || 'Unknown flight')}</span><strong>${escapeHtml(f.origin_code || '—')} → ${escapeHtml(f.dest_code || '—')}</strong><small>${escapeHtml(f.airline_name || 'Unknown airline')} · View details</small>`;
            button.onclick = () => openEntityPanel('flights', f.id);
            card.append(button);
        });
        container.append(card);
    }
}

// Extracted Map Rendering
function renderProfileMap(flights, selectedYear) {
    if (!State.map) initMap();
    if (!State.map) return;

    State.profileMapFlights = flights;
    State.profileMapSelectedYear = selectedYear;
    bindProfileMapMoveHandler();
    if (State.profileMapType === 'globe') State.globeMap?.resize();
    else State.map.invalidateSize({ pan: false });
    refreshProfileMapLayers({ fitBounds: true });
    requestAnimationFrame(() => {
        if (document.getElementById('flight-map')?.clientWidth) {
            if (State.profileMapType === 'globe') State.globeMap?.resize();
            else State.map.invalidateSize({ pan: false });
            refreshProfileMapLayers({ fitBounds: true });
        }
    });
}

function isProfileFlightCompleted(flight, now = new Date()) {
    // Database arrival values are destination-local wall times, not browser-local.
    let localNow;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: flight.dest_timezone || 'UTC', year: 'numeric', month: '2-digit',
            day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        }).formatToParts(now);
        const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
        localNow = `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
    } catch (_) {
        localNow = now.toISOString().slice(0, 19).replace('T', ' ');
    }
    for (const arrival of [flight.ata, flight.arr_time_actual, flight.sta, flight.arr_time_scheduled]) {
        if (!arrival) continue;
        let value = String(arrival).trim();
        if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) value = `${flight.date} ${value}`;
        if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value)) continue;
        if (/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
            const timestamp = Date.parse(value.replace(' ', 'T'));
            if (Number.isFinite(timestamp)) return timestamp <= now.getTime();
        } else {
            value = value.replace('T', ' ').slice(0, 19);
            if (value.length === 16) value += ':00';
            return value <= localNow;
        }
    }
    // With no arrival time, keep today's flights unfinished until the day ends.
    return /^\d{4}-\d{2}-\d{2}$/.test(flight.date || '') && flight.date < localNow.slice(0, 10);
}

function refreshProfileGlobeLayers({ resetCamera = false } = {}) {
    const globe = State.globeMap;
    if (!globe || !State.globeMapLoaded || !State.profileMapFlights) return;
    ensureProfileGlobeLayers();

    const selectedYear = State.profileMapSelectedYear;
    const flights = selectedYear === 'all'
        ? State.profileMapFlights
        : State.profileMapFlights.filter(f => f.date && f.date.startsWith(selectedYear));
    const routeFeatures = [];
    const airports = new Map();
    const now = new Date();

    flights.slice().sort((a, b) => Number(isProfileFlightCompleted(b, now)) - Number(isProfileFlightCompleted(a, now))).forEach(flight => {
        if (!flight.origin || !flight.dest) return;
        const lat1 = Number(flight.origin.lat), lon1 = Number(flight.origin.lon);
        const lat2 = Number(flight.dest.lat), lon2 = Number(flight.dest.lon);
        if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return;

        const completed = isProfileFlightCompleted(flight, now);
        const reverseDash = !completed && (lon1 > lon2 || (lon1 === lon2 && lat1 > lat2));
        const path = reverseDash
            ? getGeodesicPath(lat2, lon2, lat1, lon1)
            : getGeodesicPath(lat1, lon1, lat2, lon2);
        routeFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: path.map(([lat, lon]) => [lon, lat]) },
            properties: {
                flight_id: flight.id,
                flight_number: flight.flight_number || 'Unknown flight',
                date: flight.date || 'Unknown date',
                origin: flight.origin.code || '—',
                destination: flight.dest.code || '—',
                completed,
                status: completed ? 'Completed' : 'Upcoming / ongoing'
            }
        });
        airports.set(flight.origin.code, { code: flight.origin.code, name: flight.origin.name, lon: lon1, lat: lat1 });
        airports.set(flight.dest.code, { code: flight.dest.code, name: flight.dest.name, lon: lon2, lat: lat2 });
    });

    const airportFeatures = [...airports.values()].map(airport => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [airport.lon, airport.lat] },
        properties: { code: airport.code || '—', name: airport.name || 'Unknown airport' }
    }));
    globe.getSource('profile-globe-routes')?.setData({ type: 'FeatureCollection', features: routeFeatures });
    globe.getSource('profile-globe-airports')?.setData({ type: 'FeatureCollection', features: airportFeatures });

    if (resetCamera) {
        globe.jumpTo({ center: [8, 22], zoom: window.innerWidth < 640 ? 0.9 : 1.25, bearing: 0, pitch: 0 });
    }
}

function refreshProfileMapLayers({ fitBounds = false } = {}) {
    if (!State.profileMapFlights) return;
    if (State.profileMapType === 'globe') {
        refreshProfileGlobeLayers({ resetCamera: fitBounds });
        return;
    }
    if (!State.map) return;

    if (State.focusedFlightId) {
        renderFocusedFlightTrackOnMap(State.focusedFlightId);
        return;
    }

    const selectedYear = State.profileMapSelectedYear;
    const palette = getProfileMapPalette();
    const satellite = State.profileMapType === 'satellite';
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
    const now = new Date();
    // Draw unfinished routes last; dashes reveal completed routes underneath.
    filtered.slice().sort((a, b) => Number(isProfileFlightCompleted(b, now)) - Number(isProfileFlightCompleted(a, now))).forEach(f => {
        if (!f.origin || !f.dest) {
            console.log("Missing origin or dest");
            return;
        }
        const lat1 = parseFloat(f.origin.lat), lon1 = parseFloat(f.origin.lon);
        const lat2 = parseFloat(f.dest.lat), lon2 = parseFloat(f.dest.lon);

        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return;

        // Draw Geodesic Line
        const completed = isProfileFlightCompleted(f, now);
        // Align opposite-direction dashes so return flights do not fill the gaps.
        const reverseDash = !completed && (lon1 > lon2 || (lon1 === lon2 && lat1 > lat2));
        const curvePoints = reverseDash ? getGeodesicPath(lat2, lon2, lat1, lon1) : getGeodesicPath(lat1, lon1, lat2, lon2);
        const statusLabel = completed ? 'Completed' : 'Upcoming / ongoing';
        longitudeOffsets.forEach(offset => {
            const points = shiftPathLongitude(curvePoints, offset);
            if (satellite) {
                const outline = L.polyline(points, {
                    color: palette.border, weight: 4.5, opacity: 0.6,
                    dashArray: completed ? null : '8 6', interactive: false
                }).addTo(State.map);
                State.profileLayers.push(outline);
            }
            const line = L.polyline(points, {
                color: completed ? palette.completed : palette.pending, weight: 2.6,
                opacity: completed ? palette.completedOpacity : palette.pendingOpacity,
                dashArray: completed ? null : '8 6'
            });
            line.bindPopup(`${escapeHtml(f.flight_number)}<br>${escapeHtml(f.date)}<br>${escapeHtml(f.origin.code)} -> ${escapeHtml(f.dest.code)}<br>${statusLabel}`);
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
            const m = L.circleMarker(loc, { radius: 4.5, color: palette.border, weight: 1.4, fillColor: palette.airport, fillOpacity: 1 });
            m.bindPopup(`<b>${escapeHtml(code)}</b><br>${escapeHtml(data.name)}`);
            m.addTo(State.map);
            State.profileLayers.push(m);
        });
        if (fitBounds) fitLayers.push(L.circleMarker(data.loc));
    });

    // Fit Bounds
    if (fitBounds && fitLayers.length > 0) {
        const group = new L.featureGroup(fitLayers);
        State.map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 6, animate: false });
    }
    console.log(`Map rendering complete: ${drawnCount} routes drawn across ${longitudeOffsets.length} world copies, ${Object.keys(airports).length} airports`);
}

// --- Stage 2 Features: Heatmap & Filters ---

function renderFlightHeatmap(months) {
    const dataByYearMonth = {};
    let minYear = State.journeyYear && State.journeyYear !== 'all' ? Number(State.journeyYear) : (months.length ? Math.min(...months.map(m => Number(m.month.slice(0, 4)))) : new Date().getFullYear());
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
                        onclick="openFlightListModal('${yr}-${monthName}', filterFlightsForInsight('month', '${monthStr}', 'all'))">
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
        const programs = getUniqueValues(data, 'frequent_flyer_program');

        bar.innerHTML = `
            <label>Alliance: 
                <select id="filter-airline-alliance" onchange="applyLibraryFilter('alliance', this.value)">
                    <option value="">All</option>
                    ${alliances.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(formatAllianceLabel(a))}</option>`).join('')}
                </select>
            </label>
            <label>Country: 
                <select id="filter-airline-country" onchange="applyLibraryFilter('country', this.value)">
                    <option value="">All</option>
                    ${countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </label>
            <label>Loyalty Program:
                <select id="filter-airline-program" onchange="applyLibraryFilter('frequent_flyer_program', this.value)">
                    <option value="">All</option>
                    ${programs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
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
    bar.querySelectorAll('select').forEach(select => {
        const key = select.getAttribute('onchange')?.match(/applyLibraryFilter\('([^']+)'/)?.[1];
        if (key) select.value = State.libraryFilters[key] || '';
    });
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

            return compareDatasetValues(valA, valB, State.sort.dir);
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
        
        document.querySelectorAll('[data-route-view]').forEach(link => {
            link.addEventListener('click', event => {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                navigateTo(link.dataset.routeView);
            });
        });

        // Initialize view based on current URL
        const initialView = getViewFromPath();
        navigateTo(initialView, false);
        console.log("FlightLog: Navigated to", initialView);
    } catch (e) {
        console.error("FlightLog Init Error:", e);
        showToast(`App initialization failed: ${e.message}`, 'error');
    }
});
