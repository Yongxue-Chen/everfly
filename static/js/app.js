
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
    profileMapResizeObserverBound: false
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
                    <input type="text" name="username" value="${CURRENT_USER.username}" required>
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

    // Fetch dependencies for lookups (simple approach: fetch all dependent tables)
    // For production, we should optimize this.
    if (datasetKey === 'airports') await API.get('cities').then(d => State.cache.cities = d);
    if (datasetKey === 'flights') {
        // Flights view could use this generic logic too if we unified it
    }

    // Reset sort/filter on new dataset load
    State.filter = '';
    State.sort = { key: null, dir: 'asc' };
    document.getElementById('dataset-search').value = '';

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

    renderDatasetTable(config, data);
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

function renderDatasetTable(config, data) {
    const table = document.getElementById('dataset-table');
    table.className = 'data-table'; // Ensure class is set
    table.innerHTML = '';

    // Process Data (Filter & Sort)
    let processedData = [...data];

    // 1. Filter
    if (State.filter) {
        processedData = processedData.filter(item => {
            return Object.values(item).some(val =>
                String(val).toLowerCase().includes(State.filter)
            );
        });
    }

    // 2. Sort
    if (State.sort.key) {
        processedData.sort((a, b) => {
            let valA = a[State.sort.key];
            let valB = b[State.sort.key];

            // Handle Lookups for proper sorting
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

            if (State.currentDataset === 'airlines' && col.key === 'name' && item.website_url) {
                const link = document.createElement('a');
                link.href = normalizeWebsiteUrl(item.website_url);
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = val || '';
                td.appendChild(link);
            } else {
                td.textContent = val;
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
        btnEdit.className = 'btn btn-sm btn-icon';
        btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i>';
        btnEdit.onclick = () => openEditDatasetModal(item);

        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-sm btn-icon';
        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btnDel.style.color = 'var(--danger)';
        btnDel.onclick = () => deleteDatasetItem(item.id);

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
    header.innerHTML = `<h3>${title}</h3><button class="close-btn">&times;</button>`;
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
        null
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

    // Filter
    const filters = State.flightFilters;
    if (Object.keys(filters).length > 0) {
        data = data.filter(item => {
            return Object.entries(filters).every(([key, filterValue]) => {
                const keys = key.split(',');
                return keys.some(field => {
                    const val = (item[field] || '').toString().toLowerCase();
                    return val.includes(filterValue);
                });
            });
        });
    }

    // Sort
    const { key, dir } = State.flightSort;
    if (key) {
        data.sort((a, b) => {
            // Timestamp sorting for Date/Time fields
            if (key === 'std' || key === 'date') {
                const ta = a._std_ts;
                const tb = b._std_ts;
                return dir === 'asc' ? ta - tb : tb - ta;
            }

            let va = a[key];
            let vb = b[key];

            if (va === null || va === undefined) va = '';
            if (vb === null || vb === undefined) vb = '';

            // Special handling for numbers
            if (key === 'distance' || key === 'duration_actual') {
                va = parseFloat(va) || 0;
                vb = parseFloat(vb) || 0;
                return dir === 'asc' ? va - vb : vb - va;
            }

            // String comparison
            va = va.toString().toLowerCase();
            vb = vb.toString().toLowerCase();

            if (va < vb) return dir === 'asc' ? -1 : 1;
            if (va > vb) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const tbody = document.querySelector('#flights-table tbody');
    tbody.innerHTML = '';

    const escapeAttr = (value) => String(value || '').replace(/"/g, '&quot;');
    const safe = (value) => value || '-';

    data.forEach(f => {
        const tr = document.createElement('tr');
        const formatTime = (iso) => iso ? iso.replace('T', ' ').substring(0, 16) : '-';
        // Extract plain date for display (handle T or space separator)
        const displayDate = f.date ? f.date.split(/[ T]/)[0] : '-';
        const distanceText = f.distance ? `${f.distance} km` : '-';
        const scheduledDuration = f.duration_scheduled ? `${f.duration_scheduled} min` : '-';
        const actualDuration = f.duration_actual ? `${f.duration_actual} min` : '-';

        tr.className = 'flight-row';
        tr.innerHTML = `
            <td class="flight-cell flight-summary" data-label="Date / Flight">
                <div class="flight-summary-date">${displayDate}</div>
                <div class="flight-summary-number">${safe(f.flight_number)}</div>
            </td>
            <td class="flight-cell flight-times" data-label="Times">
                <div class="flight-times-grid">
                    <div><span>STD</span><strong>${formatTime(f.std)}</strong></div>
                    <div><span>ATD</span><strong>${formatTime(f.atd)}</strong></div>
                    <div><span>STA</span><strong>${formatTime(f.sta)}</strong></div>
                    <div><span>ATA</span><strong>${formatTime(f.ata)}</strong></div>
                </div>
            </td>
            <td class="flight-cell flight-origin" data-label="From">
                <div style="font-weight:500">${f.origin_name || f.origin_code || '-'}</div>
                <div style="font-size:0.75rem; color:#666">${f.origin_code || '-'} ${f.origin_terminal ? `(${f.origin_terminal})` : ''}</div>
            </td>
            <td class="flight-cell flight-destination" data-label="To">
                <div style="font-weight:500">${f.dest_name || f.dest_code || '-'}</div>
                <div style="font-size:0.75rem; color:#666">${f.dest_code || '-'} ${f.dest_terminal ? `(${f.dest_terminal})` : ''}</div>
            </td>
            <td class="flight-cell flight-metrics" data-label="Dist / Dur">
                <div>${distanceText}</div>
                <small>Sched ${scheduledDuration}</small>
                <small>Actual ${actualDuration}</small>
            </td>
            <td class="flight-cell flight-airline" data-label="Airline">${safe(f.airline_name)}</td>
            <td class="flight-cell flight-aircraft" data-label="Aircraft / Reg">
                <div>${safe(f.aircraft_model)}</div>
                <small>
                    ${f.registration ?
                    `<a href="https://www.flightera.net/en/planes/${f.registration}" target="_blank" rel="noopener">${f.registration}</a>`
                    : '-'}
                    ${f.tag_generation || f.tag_winglets || f.tag_config ? `<br>${[f.tag_generation, f.tag_winglets, f.tag_config].filter(Boolean).join(' / ')}` : ''}
                </small>
            </td>
            <td class="flight-cell flight-seat" data-label="Seat / Class">
                <div>${safe(f.seat_number)} <small>${safe(f.seat_type)}</small></div>
                <small>${safe(f.flight_class)}</small>
            </td>
            <td class="flight-cell flight-note" data-label="Note" style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeAttr(f.note)}">${f.note || ''}</td>
            <td class="flight-cell flight-actions" data-label="Actions">
                <button class="btn btn-sm btn-icon" style="color:var(--accent-blue)" title="Update from AeroAPI" onclick="updateFlightFromAeroAPI(${f.id})"><i class="fa-solid fa-cloud-arrow-down"></i></button>
                <button class="btn btn-sm btn-icon" onclick="openEditFlightModal(${JSON.stringify(f).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-icon" style="color:var(--danger)" onclick="deleteFlight(${f.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update headers sort icon
    document.querySelectorAll('#flights-table th').forEach(th => {
        const sortKey = th.getAttribute('onclick');
        if (sortKey) {
            // lazy checking, remove logic for simplicity or improve UI feedback later
        }
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
const renderStatsDashboard = (stats, container) => {
    if (!container) return;
    container.innerHTML = '';

    // Card 1: Locations
    const locCard = document.createElement('div');
    locCard.className = 'stats-card card-teal';
    locCard.innerHTML = `<div class="stats-header">Locations</div>`;
    const locList = document.createElement('div');
    const addLocItem = (label, count, key, title) => {
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.padding = '8px 0'; row.style.borderBottom = '1px solid #f9f9f9';

        row.innerHTML = `<span style="color:#555">${label}</span><strong style="color:#333">${count !== undefined ? count : 0}</strong>`;
        if (key && stats.top[key]) {
            row.style.cursor = 'pointer';
            row.style.padding = '8px 4px';
            row.style.borderRadius = '4px';
            row.onmouseenter = () => row.style.background = '#f0f0f0';
            row.onmouseleave = () => row.style.background = 'transparent';
            row.onclick = (e) => { e.stopPropagation(); showStatsModal(title, stats.top[key]); };
        }
        locList.appendChild(row);
    };
    addLocItem('Continents', stats.totals.continents, 'continents', 'Top Continents');
    addLocItem('Countries', stats.totals.countries, 'countries', 'Top Countries');
    addLocItem('Cities', stats.totals.cities, 'cities', 'Top Cities');
    addLocItem('Airports', stats.totals.airports, 'airports', 'Top Airports');
    addLocItem('Routes', stats.totals.routes, 'routes', 'Top Routes');
    locCard.appendChild(locList);

    // Card 2: Airlines
    const majorAlliances = ['天合联盟', '星空联盟', '寰宇一家', 'SkyTeam', 'Star Alliance', 'Oneworld'];
    const alCard = document.createElement('div');
    alCard.className = 'stats-card card-orange';
    alCard.innerHTML = `<div class="stats-header">Airlines</div><div class="stats-total">${stats.totals.airlines}</div><div class="stats-subtext">Total Airlines</div>`;

    // Alliance Breakdown (Merged)
    const alList = document.createElement('div');
    alList.style.marginTop = '15px';

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

    Object.entries(counts)
        .filter(([k, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => {
            const d = document.createElement('div');
            d.style.display = 'flex'; d.style.justifyContent = 'space-between'; d.style.marginBottom = '6px';
            d.style.cursor = 'pointer';
            d.style.padding = '2px 4px'; d.style.borderRadius = '4px';
            d.onmouseenter = () => d.style.background = '#f0f0f0';
            d.onmouseleave = () => d.style.background = 'transparent';

            d.innerHTML = `<span style="font-size:0.9rem; color:#666">${k}</span><b>${v}</b>`;
            d.onclick = (e) => {
                e.stopPropagation();
                // Filter airlines by group keywords
                const keywords = groups[k];
                const filtered = stats.top.airlines.filter(a => keywords.some(kw => (a.extra || '').includes(kw)));
                showStatsModal(k, filtered);
            };
            alList.appendChild(d);
        });
    alCard.appendChild(alList);
    alCard.onclick = () => showStatsModal('Top Airlines', stats.top.airlines);

    // Card 3: Aircraft
    const acCard = document.createElement('div');
    acCard.className = 'stats-card card-red';
    acCard.innerHTML = `<div class="stats-header">Aircraft</div><div class="stats-total">${stats.totals.aircraft}</div><div class="stats-subtext">Aircraft Models</div>`;
    const acList = document.createElement('div');
    acList.style.marginTop = '15px';
    const mfrs = Object.entries(stats.breakdowns.manufacturer || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    mfrs.forEach(([k, v]) => {
        const d = document.createElement('div');
        d.style.display = 'flex'; d.style.justifyContent = 'space-between'; d.style.marginBottom = '6px';
        d.style.cursor = 'pointer';
        d.style.padding = '2px 4px'; d.style.borderRadius = '4px';
        d.onmouseenter = () => d.style.background = '#f0f0f0';
        d.onmouseleave = () => d.style.background = 'transparent';

        d.innerHTML = `<span style="font-size:0.9rem; color:#666">${k}</span><b>${v}</b>`;
        d.onclick = (e) => {
            e.stopPropagation();
            // Filter aircraft by manufacturer (which is in 'extra')
            const filtered = stats.top.aircraft.filter(a => a.extra === k);
            showStatsModal(k + ' Models', filtered);
        };
        acList.appendChild(d);
    });
    acCard.appendChild(acList);
    acCard.onclick = () => showStatsModal('Top Aircraft', stats.top.aircraft);

    container.appendChild(locCard);
    container.appendChild(alCard);
    container.appendChild(acCard);

    // --- Chart: Flights per Year ---
    if (stats.flights_by_year && stats.flights_by_year.length > 0) {
        const chartCard = document.createElement('div');
        chartCard.className = 'stats-card';
        // Force full width if in grid
        chartCard.style.gridColumn = '1 / -1';
        chartCard.style.marginTop = '20px';
        chartCard.innerHTML = `
            <div class="stats-header">Flights per Year</div>
            <div style="height:300px; width:100%; position:relative;">
                <canvas id="yearChart"></canvas>
            </div>
        `;
        container.appendChild(chartCard);

        const ctx = chartCard.querySelector('#yearChart').getContext('2d');
        // Destroy previous chart if exists? 
        // Render function re-clears container (line 1344: container.innerHTML = ''), so safe to new Chart.
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: stats.flights_by_year.map(d => d.year),
                datasets: [{
                    label: 'Flights',
                    data: stats.flights_by_year.map(d => d.count),
                    borderColor: '#00cec9', // Teal accent
                    backgroundColor: 'rgba(0, 206, 201, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#00cec9',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 10,
                        cornerRadius: 4,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y} Flights`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [4, 4], color: '#f5f5f5', drawBorder: false },
                        ticks: { font: { size: 11 }, color: '#999', padding: 8 }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 }, color: '#999', padding: 8 }
                    }
                }
            }
        });
    }
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
            const extra = item.extra ? ` <small style='color:#999; margin-left:5px;'>${item.extra}</small>` : '';
            row.innerHTML = `
                <div class="chart-label" title="${item.name}">${item.name || 'Unknown'}${extra}</div>
                <div class="chart-bar-bg"><div class="chart-bar" style="width:${pct}%"></div></div>
                <div class="chart-val">${item.count}</div>
            `;
            d.appendChild(row);
        });
        return d;
    });
};

// Calculate & Render Header Stats
const renderHeaderStats = (flights) => {
    let totalDist = flights.reduce((sum, f) => sum + (parseFloat(f.distance) || 0), 0);
    let totalMin = flights.reduce((sum, f) => sum + (f.duration_actual || f.duration_scheduled || 0), 0);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;

    // Inject Container if missing
    const view = document.getElementById('view-profile');
    let header = document.getElementById('profile-header-stats');
    if (!header && view) {
        header = document.createElement('div');
        header.id = 'profile-header-stats';
        // Insert before map container (not flight-map itself which is nested)
        const mapContainer = document.querySelector('#view-profile .map-container');
        if (mapContainer) view.insertBefore(header, mapContainer);
        else view.prepend(header);
    }

    if (header) {
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:40px; height:40px; border-radius:50%; background:var(--primary-color); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem;">
                    <span>${CURRENT_USER.username[0].toUpperCase()}</span>
                </div>
                <div>
                    <div style="font-weight:bold; font-size:1.1rem; color: #2c3e50;">${CURRENT_USER.username}</div>
                    <div style="font-size:0.85rem; color:#7f8c8d; font-weight:500;">everfly User</div>
                </div>
            </div>
            <div class="ph-stat"><b>${flights.length}</b><span>Flights</span></div>
            <div class="ph-stat"><b>${Math.round(totalDist).toLocaleString()} km</b><span>Distance</span></div>
            <div class="ph-stat"><b>${hours}h ${mins}m</b><span>Duration</span></div>
        `;
    }
};

async function loadProfile() {
    try {
        const [stats, flights] = await Promise.all([
            API.get('stats'),
            API.get('flights/detailed')
        ]);
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
            line.bindPopup(`${f.flight_number}<br>${f.date}<br>${f.origin.code} -> ${f.dest.code}`);
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
            m.bindPopup(`<b>${code}</b><br>${data.name}`);
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
