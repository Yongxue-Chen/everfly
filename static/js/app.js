
// --- Constants & Config ---
const API_BASE = '/api';

const DATASETS = {
    cities: {
        label: 'Cities',
        endpoint: 'cities',
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'country', label: 'Country' },
            { key: 'country_code', label: 'Code' },
            { key: 'timezone', label: 'Timezone' }
        ],
        fields: [
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'country', label: 'Country', type: 'text' },
            { key: 'country_code', label: 'Country Code', type: 'text', placeholder: 'e.g. US' },
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
            { key: 'frequent_flyer_id', label: 'FF ID (Member No.)', type: 'text', required: false }
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
            { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
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
        if (datasetKey === 'airports') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-info';
            btn.innerHTML = '<i class="fas fa-magic"></i> Auto-Fill';
            btn.onclick = async () => {
                if (!confirm('Auto-fill missing ICAO/City data for airports?')) return;
                const res = await API.post('airports/batch_update', {});
                alert(res.message || res.error);
                loadDataset('airports');
            };
            dynamicContainer.appendChild(btn);
        }
        if (datasetKey === 'cities') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-info';
            btn.innerHTML = '<i class="fas fa-magic"></i> Auto-Fill Codes';
            btn.onclick = async () => {
                if (!confirm('Auto-fill missing Country Codes?')) return;
                const res = await API.post('cities/batch_update', {});
                alert(res.message || res.error);
                loadDataset('cities');
            };
            dynamicContainer.appendChild(btn);
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
        const res = await fetch(`${API_BASE}/clear/${config.endpoint}`, { method: 'DELETE' });
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
        // Auto-Generate Name for Aircraft
        if (State.currentDataset === 'aircraft_models') {
            const suffix = (data.subtype && data.subtype.trim()) ? data.subtype : data.series;
            data.name = `${data.model}-${suffix}`;
        }
        await API.post(config.endpoint, data);
        loadDataset(State.currentDataset); // Refresh
    });
}

async function openEditDatasetModal(item) {
    const config = DATASETS[State.currentDataset];
    // Ensure dependencies are loaded
    if (State.currentDataset === 'airports' && !State.cache.cities) State.cache.cities = await API.get('cities');

    openModal(`Edit ${config.label}`, () => createForm(config.fields, item), async (data) => {
        // Auto-Generate Name for Aircraft
        if (State.currentDataset === 'aircraft_models') {
            const suffix = (data.subtype && data.subtype.trim()) ? data.subtype : data.series;
            data.name = `${data.model}-${suffix}`;
        }
        await API.put(config.endpoint, item.id, data);
        loadDataset(State.currentDataset); // Refresh
    });
}

function openImportModal() {
    const config = DATASETS[State.currentDataset];
    const contentFn = () => {
        const div = document.createElement('div');
        // Smart linking messages
        let extraHint = '';
        if (config.endpoint === 'airports') extraHint = '<br><strong>Tip:</strong> You can use "city" or "city_name" instead of city_id.';
        if (config.endpoint === 'flights') extraHint = '<br><strong>Tip:</strong> Use codes (origin_code, dest_code, airline_iata) instead of IDs.';

        div.innerHTML = `
            <p>Select a CSV file to import into <strong>${config.label}</strong>.</p>
            <p><small>Base headers: ${config.fields.map(f => f.key).join(', ')}</small>
            <span style="color:#666; font-size:0.9em;">${extraHint}</span></p>
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
        if (field.type === 'select') {
            input = document.createElement('select');
            input.name = field.key;

            // Add Default Option
            const defOpt = document.createElement('option');
            defOpt.value = "";
            defOpt.textContent = "-- Select --";
            input.appendChild(defOpt);

            if (field.lookup) {
                const lookupData = State.cache[field.lookup] || [];
                lookupData.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.id;
                    option.textContent = opt[field.display];
                    if (values[field.key] == opt.id) option.selected = true;
                    input.appendChild(option);
                });
            } else if (field.options) {
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value || opt;
                    option.textContent = opt.label || opt;
                    if (values[field.key] == option.value) option.selected = true;
                    input.appendChild(option);
                });
            }
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
            <td>${f.origin_code} <small class="text-muted">${f.origin_terminal ? `(${f.origin_terminal})` : ''}</small></td>
            <td>${f.dest_code} <small class="text-muted">${f.dest_terminal ? `(${f.dest_terminal})` : ''}</small></td>
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
        { key: 'flight_number', label: 'Flight Number', type: 'text' },
        { key: 'registration', label: 'Aircraft Reg', type: 'text', placeholder: 'e.g. B-1234' },

        { key: 'origin_airport_id', label: 'Origin', type: 'select', lookup: 'airports', display: 'name' },
        { key: 'origin_terminal', label: 'Origin Terminal', type: 'select', options: [] }, // Dynamic
        { key: 'dest_airport_id', label: 'Destination', type: 'select', lookup: 'airports', display: 'name' },
        { key: 'dest_terminal', label: 'Dest Terminal', type: 'select', options: [] }, // Dynamic

        // Date & Times (ISO Datetime)
        { key: 'std', label: 'Sched Departure', type: 'datetime-local' }, // Timezone hint via label?
        { key: 'atd', label: 'Actual Departure', type: 'datetime-local' },
        { key: 'sta', label: 'Sched Arrival', type: 'datetime-local' },
        { key: 'ata', label: 'Actual Arrival', type: 'datetime-local' },

        { key: 'distance', label: 'Distance', type: 'number', placeholder: 'km/mi' },
        { key: 'duration_scheduled', label: 'Sched Duration (min)', type: 'number' },
        { key: 'duration_actual', label: 'Actual Duration (min)', type: 'number' },

        { key: 'airline_id', label: 'Airline', type: 'select', lookup: 'airlines', display: 'name' },
        { key: 'aircraft_model_id', label: 'Aircraft', type: 'select', lookup: 'models', display: 'name' }, // Using Name ID

        // Dynamic Variant Selects
        { key: 'tag_generation', label: 'Generation', type: 'select', options: [] },
        { key: 'tag_winglets', label: 'Winglets', type: 'select', options: [] },
        { key: 'tag_config', label: 'Config', type: 'select', options: [] },

        { key: 'seat_number', label: 'Seat', type: 'text' },
        { key: 'flight_class', label: 'Class', type: 'text' },
        { key: 'note', label: 'Note', type: 'textarea' }
    ];

    // Hack: manually fix the lookup in createForm to look at the right cache key
    State.cache.models = aircraft;

    openModal('Add Flight', () => {
        const form = createForm(flightFields);

        // --- Airport Terminal & Timezone Logic ---
        const originSelect = form.querySelector('[name="origin_airport_id"]');
        const destSelect = form.querySelector('[name="dest_airport_id"]');
        const originTermSelect = form.querySelector('[name="origin_terminal"]');
        const destTermSelect = form.querySelector('[name="dest_terminal"]');

        // Helper to find timezone
        const getTz = (airportId) => {
            const airport = airports.find(a => a.id == airportId);
            if (airport && airport.city_id && State.cache.cities) {
                const city = State.cache.cities.find(c => c.id == airport.city_id);
                return city ? city.timezone : '';
            }
            return '';
        };

        const updateAirportInfo = (airportId, terminalSelect, labelPrefix) => {
            // Update Terminals
            terminalSelect.innerHTML = '<option value="">-- Select --</option>';
            const airport = airports.find(a => a.id == airportId);
            if (airport && airport.terminals) {
                const terms = airport.terminals.split(',').map(t => t.trim());
                if (terms.length > 0) {
                    terms.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t;
                        opt.textContent = t;
                        terminalSelect.appendChild(opt);
                    });
                }
            }

            // update timezone label hint
            const tz = getTz(airportId);
            if (tz) {
                // Find label for this SELECT and append TZ
                // Simplified: just log or alert for now, or updating label text?
                // Better: Update the label of the "Sched Departure" / "Sched Arrival" inputs to include TZ
                if (labelPrefix === 'Origin') {
                    const l1 = form.querySelector('label[for="std"]'); // form generator might not set ids match keys exactly without looping
                    // Our createForm helper creates labels? 
                    // Let's just assume we can find fields. 
                    // Actually, let's just use a floating info span if possible, or update the label directly if we can find it.
                    // For now, let's just store it or use a simple alert/console. 
                    // A proper way is to modify the label text: "Sched Departure (UTC+8)"
                    const stdLabel = Array.from(form.querySelectorAll('label')).find(l => l.innerText.includes('Sched Departure'));
                    if (stdLabel) stdLabel.innerText = `Sched Departure (${tz})`;
                    const atdLabel = Array.from(form.querySelectorAll('label')).find(l => l.innerText.includes('Actual Departure'));
                    if (atdLabel) atdLabel.innerText = `Actual Departure (${tz})`;
                } else {
                    const staLabel = Array.from(form.querySelectorAll('label')).find(l => l.innerText.includes('Sched Arrival'));
                    if (staLabel) staLabel.innerText = `Sched Arrival (${tz})`;
                    const ataLabel = Array.from(form.querySelectorAll('label')).find(l => l.innerText.includes('Actual Arrival'));
                    if (ataLabel) ataLabel.innerText = `Actual Arrival (${tz})`;
                }
            }
        };

        originSelect.addEventListener('change', (e) => updateAirportInfo(e.target.value, originTermSelect, 'Origin'));
        destSelect.addEventListener('change', (e) => updateAirportInfo(e.target.value, destTermSelect, 'Dest'));

        // --- Aircraft Variant Logic ---
        const aircraftSelect = form.querySelector('[name="aircraft_model_id"]');
        const genSelect = form.querySelector('[name="tag_generation"]');
        const winSelect = form.querySelector('[name="tag_winglets"]');
        const confSelect = form.querySelector('[name="tag_config"]');

        const updateVariants = (modelId) => {
            // Reset all
            [genSelect, winSelect, confSelect].forEach(s => s.innerHTML = '<option value="">-- Select --</option>');

            const model = aircraft.find(m => m.id == modelId);
            if (!model) return;

            const populate = (select, tags) => {
                if (!tags) return;
                const options = tags.split(',').map(t => t.trim());
                options.forEach(opt => {
                    const el = document.createElement('option');
                    el.value = opt;
                    el.textContent = opt;
                    select.appendChild(el);
                });
            };

            populate(genSelect, model.tags_generation);
            populate(winSelect, model.tags_winglets);
            populate(confSelect, model.tags_config);
        };

        aircraftSelect.addEventListener('change', (e) => updateVariants(e.target.value));

        return form;
    }, async (data) => {
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
