
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
        aircraft_models: [],
        flights: []
    },
    flightSort: { key: 'date', dir: 'desc' },
    flightFilters: {}
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
        if (datasetKey === 'airlines') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-info';
            btn.innerHTML = '<i class="fas fa-magic"></i> Auto-Fill IATA';
            btn.onclick = async () => {
                if (!confirm('Auto-fill missing IATA codes from ICAO?')) return;
                const res = await API.post('airlines/batch_update', {});
                alert(res.message || res.error);
                loadDataset('airlines');
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
    const inputs = document.querySelectorAll('.filter-row input');
    State.flightFilters = {};
    const map = [
        'date', null, 'flight_number', 'registration', 'origin_name', 'dest_name',
        null, null, 'airline_name', 'aircraft_model', null, 'seat_number', 'flight_class',
        'note', null
    ];
    inputs.forEach((input, idx) => {
        if (input.value && map[idx]) {
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
            return Object.keys(filters).every(key => {
                const val = (item[key] || '').toString().toLowerCase();
                return val.includes(filters[key]);
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

    data.forEach(f => {
        const tr = document.createElement('tr');
        const formatTime = (iso) => iso ? iso.replace('T', ' ') : '-';
        // Extract plain date for display if f.date is a full timestamp
        const displayDate = f.date && f.date.includes('T') ? f.date.split('T')[0] : (f.date || '-');

        tr.innerHTML = `
            <td style="white-space:nowrap; font-weight:500;">${displayDate}</td>
            <td>
                <div style="font-size:0.75rem; color:#666">STD: ${formatTime(f.std)}</div>
                <div style="font-size:0.75rem; color:#333; margin-bottom:4px;">ATD: ${formatTime(f.atd)}</div>
                <div style="font-size:0.75rem; color:#666">STA: ${formatTime(f.sta)}</div>
                <div style="font-size:0.75rem; color:#333">ATA: ${formatTime(f.ata)}</div>
            </td>
            <td>${f.flight_number}</td>
            <td>${f.registration || '-'}</td>
            <td>
                <div style="font-weight:500">${f.origin_name || f.origin_code}</div>
                <div style="font-size:0.75rem; color:#666">${f.origin_code} ${f.origin_terminal ? `(${f.origin_terminal})` : ''}</div>
            </td>
            <td>
                <div style="font-weight:500">${f.dest_name || f.dest_code}</div>
                <div style="font-size:0.75rem; color:#666">${f.dest_code} ${f.dest_terminal ? `(${f.dest_terminal})` : ''}</div>
            </td>
            <td>${f.distance || '-'}</td>
            <td>${f.duration_scheduled || '-'}<br>${f.duration_actual || '-'}</td>
            <td>${f.airline_name}</td>
            <td>${f.aircraft_model}</td>
            <td><small>${f.tag_generation || '-'}<br>${f.tag_winglets || '-'}<br>${f.tag_config || '-'}</small></td>
            <td>${f.seat_number || '-'}<br><small>${f.seat_type || '-'}</small></td>
            <td>${f.flight_class || '-'}</td>
            <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.note || ''}">${f.note || ''}</td>
            <td>
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
    if (!confirm('Fill in missing flight details from AeroAPI?')) return;
    try {
        const res = await API.post(`flights/${id}/update_aeroapi`, {});
        if (res.success) {
            alert(`Updated ${res.fields_updated} fields.`);
            loadFlights();
        } else {
            alert('Update failed: ' + (res.error || res.message));
        }
    } catch (e) { alert('Error: ' + e); }
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
    }, null);

    // Override default save handler for this specific modal instance
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const fileInput = document.getElementById('csv-file-input');
            if (!fileInput || !fileInput.files[0]) return alert('Please select a file');

            saveBtn.disabled = true;
            saveBtn.textContent = 'Uploading...';

            try {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                const res = await API.upload(`import/flights`, formData);

                if (res.error) {
                    alert('Import Error: ' + res.error);
                } else {
                    const errorMsg = (res.errors && res.errors.length) ? "\nErrors: " + res.errors.join(", ") : "";
                    alert(res.message + errorMsg);
                    loadFlights();
                    closeModal();
                    State.currentDataset = old;
                }
            } catch (e) {
                alert('Import failed: ' + e);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        };
    }
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
    State.cache.models = aircraft;

    const flightFields = [
        { key: 'flight_number', label: 'Flight Number', type: 'text' },
        { key: 'registration', label: 'Aircraft Reg', type: 'text' },
        { key: 'origin_airport_id', label: 'Origin', type: 'select', lookup: 'airports', display: 'name' },
        { key: 'origin_terminal', label: 'Origin Terminal', type: 'select', options: [] },
        { key: 'dest_airport_id', label: 'Destination', type: 'select', lookup: 'airports', display: 'name' },
        { key: 'dest_terminal', label: 'Dest Terminal', type: 'select', options: [] },
        { key: 'std', label: 'Sched Departure', type: 'datetime-local' },
        { key: 'atd', label: 'Actual Departure', type: 'datetime-local' },
        { key: 'sta', label: 'Sched Arrival', type: 'datetime-local' },
        { key: 'ata', label: 'Actual Arrival', type: 'datetime-local' },
        { key: 'distance', label: 'Distance', type: 'number' },
        { key: 'duration_scheduled', label: 'Sched Duration (min)', type: 'number' },
        { key: 'duration_actual', label: 'Actual Duration (min)', type: 'number' },
        { key: 'airline_id', label: 'Airline', type: 'select', lookup: 'airlines', display: 'name' },
        { key: 'aircraft_model_id', label: 'Aircraft', type: 'select', lookup: 'models', display: 'name' },
        { key: 'tag_generation', label: 'Generation', type: 'select', options: [] },
        { key: 'tag_winglets', label: 'Winglets', type: 'select', options: [] },
        { key: 'tag_config', label: 'Config', type: 'select', options: [] },
        { key: 'seat_number', label: 'Seat', type: 'text' },
        { key: 'seat_type', label: 'Seat Type', type: 'text' },
        { key: 'flight_class', label: 'Class', type: 'text' },
        { key: 'note', label: 'Note', type: 'textarea' }
    ];

    openModal('Edit Flight', () => {
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
        await API.put('flights', item.id, data);
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

            // Auto Update Prompt
            if (confirm('Flight added. Fetch details from AeroAPI now?')) {
                updateFlightFromAeroAPI(flightId);
            }
        } catch (e) {
            alert('Error creating flight: ' + e);
        }
    });
}

// --- Profile & Stats ---
// --- Profile & Stats ---
// --- Profile & Stats ---
async function loadProfile() {
    const flights = await API.get('flights/detailed');

    // --- Year Filter Logic ---
    const yearSelect = document.getElementById('year-filter');
    if (yearSelect && yearSelect.options.length <= 1) {
        // Extract years
        const years = new Set(flights.map(f => f.date ? f.date.substring(0, 4) : null).filter(y => y));
        const sortedYears = Array.from(years).sort().reverse();
        sortedYears.forEach(year => {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            yearSelect.appendChild(opt);
        });

        // Attach listener
        yearSelect.onchange = loadProfile;
    }

    const selectedYear = yearSelect ? yearSelect.value : 'all';
    const filteredFlights = selectedYear === 'all'
        ? flights
        : flights.filter(f => f.date && f.date.startsWith(selectedYear));

    // --- Stats Calculation ---
    const totalFlights = filteredFlights.length;

    const totalDist = filteredFlights.reduce((sum, f) => sum + (parseFloat(f.distance) || 0), 0);

    const totalMinutes = filteredFlights.reduce((sum, f) => sum + (f.duration_actual || f.duration_scheduled || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    // Render Stats
    const statsContainer = document.querySelector('.stats-container');
    statsContainer.innerHTML = `
        <div class="stat-card" style="background:#fff; padding:20px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1); display:flex; gap:40px;">
            <div>
                <h1 style="margin:0; font-size:2.5rem;">${totalFlights}</h1>
                <span style="color:#666;">flights</span>
            </div>
            <div>
                <h1 style="margin:0; font-size:2.5rem;">${Math.round(totalDist).toLocaleString()} km</h1> 
                <span style="color:#666;">distance</span>
            </div>
            <div>
                <h1 style="margin:0; font-size:2.5rem;">${hours}h ${mins}m</h1> 
                <span style="color:#666;">duration</span>
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

        // Helper for Great Circle Path
        const getGeodesicPath = (lat1, lon1, lat2, lon2, numPoints = 100) => {
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
                const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
                const lambda = Math.atan2(y, x);
                points.push([toDeg(phi), toDeg(lambda)]);
            }
            return points;
        };

        filteredFlights.forEach(f => {
            if (f.origin_lat && f.dest_lat) {
                // Draw Geodesic Line
                const curvePoints = getGeodesicPath(
                    parseFloat(f.origin_lat), parseFloat(f.origin_lon),
                    parseFloat(f.dest_lat), parseFloat(f.dest_lon)
                );

                L.polyline(curvePoints, { color: '#ffb800', weight: 2, opacity: 0.8 }).addTo(State.map);

                // Add markers
                L.circleMarker([f.origin_lat, f.origin_lon], { radius: 3, color: '#00b0ff', fillColor: '#00b0ff', fillOpacity: 1 }).addTo(State.map);
                L.circleMarker([f.dest_lat, f.dest_lon], { radius: 3, color: '#00b0ff', fillColor: '#00b0ff', fillOpacity: 1 }).addTo(State.map);
            }
        });

        // Fit bounds if flights exist
        if (filteredFlights.length > 0) {
            // Optional: Create bounds from all points
            // State.map.fitBounds(...)
        }
    }
}


// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    navigateTo('profile');
});
