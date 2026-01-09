
// --- Constants & Config ---
const API_BASE = '/api';

const DATASETS = {
    cities: {
        label: 'Cities',
        endpoint: 'cities',
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'country', label: 'Country' },
            { key: 'timezone', label: 'Timezone' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'country', label: 'Country', type: 'text' },
            { key: 'timezone', label: 'Timezone', type: 'text' }
        ]
    },
    airports: {
        label: 'Airports',
        endpoint: 'airports',
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'iata_code', label: 'IATA' },
            { key: 'icao_code', label: 'ICAO' },
            { key: 'city_id', label: 'City', type: 'lookup', lookup: 'cities', display: 'name' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'iata_code', label: 'IATA Code', type: 'text' },
            { key: 'icao_code', label: 'ICAO Code', type: 'text' },
            { key: 'city_id', label: 'City', type: 'select', lookup: 'cities', display: 'name' },
            { key: 'lat', label: 'Latitude', type: 'number', step: 'any' },
            { key: 'lon', label: 'Longitude', type: 'number', step: 'any' }
        ]
    },
    airlines: {
        label: 'Airlines',
        endpoint: 'airlines',
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'iata_code', label: 'IATA' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'iata_code', label: 'IATA Code', type: 'text' },
            { key: 'frequent_flyer_program', label: 'FF Program', type: 'text' }
        ]
    },
    aircraft_models: {
        label: 'Aircraft',
        endpoint: 'aircraft_models',
        columns: [
            { key: 'manufacturer', label: 'Manufacturer' },
            { key: 'model', label: 'Model' },
            { key: 'series', label: 'Series' }
        ],
        fields: [
            { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
            { key: 'model', label: 'Model', type: 'text' },
            { key: 'series', label: 'Series', type: 'text' },
            { key: 'subtype', label: 'Subtype', type: 'text' },
            { key: 'generation', label: 'Generation', type: 'text' },
            { key: 'engine_type', label: 'Engine Type', type: 'text' },
            { key: 'winglets', label: 'Winglets', type: 'text' }
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
        aircraft_models: []
    }
};

// --- API Client ---
const API = {
    async get(endpoint) {
        const res = await fetch(`${API_BASE}/${endpoint}`);
        return res.json();
    },
    async post(endpoint, data) {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async upload(endpoint, formData) {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            body: formData // No Content-Type header, let browser set boundary
        });
        return res.json();
    },
    async put(endpoint, id, data) {
        const res = await fetch(`${API_BASE}/${endpoint}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async delete(endpoint, id) {
        const res = await fetch(`${API_BASE}/${endpoint}/${id}`, { method: 'DELETE' });
        return res.json();
    }
};

// --- View Management ---
function navigateTo(viewName) {
    // Update State
    State.currentView = viewName;

    // Update Navbar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Simple logic to find the nav item based on text content or index (assumed order)
    if (viewName === 'profile') document.querySelector('.nav-item:nth-child(1)').classList.add('active');
    if (viewName === 'flights') document.querySelector('.nav-item:nth-child(2)').classList.add('active');
    if (viewName === 'datasets') document.querySelector('.nav-item:nth-child(3)').classList.add('active');

    // Update View Visibility
    document.querySelectorAll('.view').forEach(el => el.style.display = 'none');

    // Show active view
    if (viewName === 'profile') {
        document.getElementById('view-profile').style.display = 'block';
        if (State.map) State.map.invalidateSize();
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
        State.map = L.map('flight-map').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(State.map);
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

// --- Data Loading & Rendering ---

async function loadDataset(datasetKey) {
    State.currentDataset = datasetKey;

    // Update Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Find button by onclick content is hacky but works for now
    const tabs = document.querySelectorAll('.tab-btn');
    if (datasetKey === 'cities') tabs[0].classList.add('active');
    if (datasetKey === 'airports') tabs[1].classList.add('active');
    if (datasetKey === 'airlines') tabs[2].classList.add('active');
    if (datasetKey === 'aircraft') datasetKey = 'aircraft_models'; // handle mismatch
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
        config.columns.forEach(col => {
            const td = document.createElement('td');
            let val = item[col.key];

            // Handle Lookups
            if (col.type === 'lookup' && State.cache[col.lookup]) {
                const lookupItem = State.cache[col.lookup].find(i => i.id === item[col.key]);
                val = lookupItem ? lookupItem[col.display] : val;
            }

            td.textContent = val;
            tr.appendChild(td);
        });

        // Actions
        const tdAction = document.createElement('td');
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
let currentModalSuccessCallback = null;

function openModal(title, contentFn, onSave) {
    document.getElementById('modal-title').textContent = title;
    const body = document.getElementById('modal-body');
    body.innerHTML = '';
    body.appendChild(contentFn());

    document.getElementById('modal-container').style.display = 'flex';
    currentModalSuccessCallback = onSave;

    // Save button handler
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.onclick = async () => {
        const form = body.querySelector('form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (currentModalSuccessCallback) {
            await currentModalSuccessCallback(data);
        }
        closeModal();
    };
}

function closeModal() {
    document.getElementById('modal-container').style.display = 'none';
    currentModalSuccessCallback = null;
}

// --- Form Generators ---
async function openAddDatasetModal() {
    const config = DATASETS[State.currentDataset];
    // Ensure dependencies are loaded
    if (State.currentDataset === 'airports' && !State.cache.cities) State.cache.cities = await API.get('cities');

    openModal(`Add ${config.label}`, () => createForm(config.fields), async (data) => {
        await API.post(config.endpoint, data);
        loadDataset(State.currentDataset); // Refresh
    });
}

async function openEditDatasetModal(item) {
    const config = DATASETS[State.currentDataset];
    // Ensure dependencies are loaded
    if (State.currentDataset === 'airports' && !State.cache.cities) State.cache.cities = await API.get('cities');

    openModal(`Edit ${config.label}`, () => createForm(config.fields, item), async (data) => {
        await API.put(config.endpoint, item.id, data);
        loadDataset(State.currentDataset); // Refresh
    });
}

function openImportModal() {
    const config = DATASETS[State.currentDataset];
    const contentFn = () => {
        const div = document.createElement('div');
        div.innerHTML = `
            <p>Select a CSV file to import into <strong>${config.label}</strong>.</p>
            <p><small>Ensure headers match: ${config.fields.map(f => f.key).join(', ')}</small></p>
            <div class="form-group">
                <input type="file" name="file" accept=".csv" required>
            </div>
        `;
        return div;
    };

    // Custom modal handling because it's multipart/form-data
    openModal(`Import ${config.label} CSV`, contentFn, null);

    // Override default save handler for this specific modal instance 
    // (a bit hacky given the simple modal implementation, but efficient)
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.onclick = async () => {
        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput.files[0]) return alert('Please select a file');

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        saveBtn.disabled = true;
        saveBtn.textContent = 'Uploading...';

        try {
            const res = await API.upload(`import/${config.endpoint}`, formData);
            if (res.error) {
                alert('Error: ' + res.error);
            } else {
                alert(res.message);
                if (res.errors && res.errors.length > 0) {
                    alert('Some rows failed:\n' + res.errors.slice(0, 10).join('\n') + (res.errors.length > 10 ? '\n...' : ''));
                }
                closeModal();
                loadDataset(State.currentDataset);
            }
        } catch (e) {
            alert('Upload failed: ' + e);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    };
}

function createForm(fields, values = {}) {
    const form = document.createElement('form');
    fields.forEach(field => {
        const grp = document.createElement('div');
        grp.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = field.label;
        grp.appendChild(label);

        let input;
        if (field.type === 'select' && field.lookup) {
            input = document.createElement('select');
            input.name = field.key;
            // Add options
            const lookupData = State.cache[field.lookup] || [];
            lookupData.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.id;
                option.textContent = opt[field.display];
                if (values[field.key] == opt.id) option.selected = true; // weak equal for string/int match
                input.appendChild(option);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type;
            input.name = field.key;
            input.value = values[field.key] || '';
        }

        grp.appendChild(input);
        form.appendChild(grp);
    });
    return form;
}

async function deleteDatasetItem(id) {
    if (!confirm('Are you sure?')) return;
    const config = DATASETS[State.currentDataset];
    await API.delete(config.endpoint, id);
    loadDataset(State.currentDataset);
}

// --- Flights Logic ---
async function loadFlights() {
    const flights = await API.get('flights/detailed'); // We created this special route
    const tbody = document.querySelector('#flights-table tbody');
    tbody.innerHTML = '';

    flights.forEach(f => {
        const tr = document.createElement('tr');
        // Simple View
        tr.innerHTML = `
            <td>${f.date}</td>
            <td>${f.flight_number}</td>
            <td>Unknown Reg</td> <!-- TODO: Add Reg to schema/lookup if exists -->
            <td>${f.origin_code}</td>
            <td>${f.dest_code}</td>
            <td>${f.dep_time_scheduled || '-'}</td>
            <td>${f.arr_time_scheduled || '-'}</td>
            <td>${f.airline_name}</td>
            <td>${f.aircraft_model}</td>
            <td>${f.seat_number || ''}</td>
            <td>${f.note || ''}</td>
            <td>
                <button class="btn btn-sm btn-icon" style="color:var(--danger)" onclick="deleteFlight(${f.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteFlight(id) {
    if (!confirm('Delete flight?')) return;
    await API.delete('flights', id);
    loadFlights();
}

async function openAddFlightModal() {
    // We need to fetch all dependencies: Airports, Airlines, Aircraft
    const [airports, airlines, aircraft] = await Promise.all([
        API.get('airports'),
        API.get('airlines'),
        API.get('aircraft_models')
    ]);

    // Cache them for form generation
    State.cache.airports = airports;
    State.cache.airlines = airlines;
    State.cache.models = aircraft; // mismatched key, let's just make custom form or align keys

    const flightFields = [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'flight_number', label: 'Flight Number', type: 'text' },
        { key: 'origin_airport_id', label: 'Origin', type: 'select', lookup: 'airports', display: 'iata_code' }, // Displaying IATA for now
        { key: 'dest_airport_id', label: 'Destination', type: 'select', lookup: 'airports', display: 'iata_code' },
        { key: 'airline_id', label: 'Airline', type: 'select', lookup: 'airlines', display: 'name' },
        { key: 'aircraft_model_id', label: 'Aircraft', type: 'select', lookup: 'models', display: 'model' },
        { key: 'seat_number', label: 'Seat', type: 'text' },
        { key: 'flight_class', label: 'Class', type: 'text' }
    ];

    // Hack: manually fix the lookup in createForm to look at the right cache key
    // or just copy keys to match lookup
    State.cache.models = aircraft;

    openModal('Add Flight', () => createForm(flightFields), async (data) => {
        await API.post('flights', data);
        if (State.currentView === 'flights') loadFlights();
        if (State.currentView === 'profile') loadProfile();
        alert('Flight added!');
    });
}

// --- Profile & Stats ---
async function loadProfile() {
    const flights = await API.get('flights/detailed');
    // Calculate total stats
    const totalFlights = flights.length;
    // ... calculate distance if we had geolib, for now mocked

    // Render Stats
    const statsContainer = document.querySelector('.stats-container');
    statsContainer.innerHTML = `
        <div class="stat-card" style="background:#fff; padding:20px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1); display:flex; gap:40px;">
            <div>
                <h1 style="margin:0; font-size:2.5rem;">${totalFlights}</h1>
                <span style="color:#666;">flights</span>
            </div>
            <div>
                <h1 style="margin:0; font-size:2.5rem;">0 km</h1> 
                <span style="color:#666;">distance (calculation pending)</span>
            </div>
        </div>
    `;

    // Render Map
    if (State.map) {
        // Clear layers
        State.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker) {
                layer.remove();
            }
        });

        flights.forEach(f => {
            if (f.origin_lat && f.dest_lat) {
                const latlngs = [
                    [f.origin_lat, f.origin_lon],
                    [f.dest_lat, f.dest_lon]
                ];
                // Draw line (Great Circle would require Arc.js or similar, using straight line for MVP)
                L.polyline(latlngs, { color: 'red', weight: 2, opacity: 0.7 }).addTo(State.map);

                // Add markers
                L.circleMarker([f.origin_lat, f.origin_lon], { radius: 3, color: 'red' }).addTo(State.map);
                L.circleMarker([f.dest_lat, f.dest_lon], { radius: 3, color: 'red' }).addTo(State.map);
            }
        });
    }
}


// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    navigateTo('profile');
});
