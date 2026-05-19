# Mobile everfly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the everfly FlightLog app comfortable on phones while preserving the existing desktop table workflow.

**Architecture:** Keep the existing Flask/Jinja/static-JS structure. Add responsive markup hooks in `templates/index.html`, render mobile-friendly labels/classes in `static/js/app.js`, and apply the actual mobile layout in `static/css/style.css` under `@media (max-width: 768px)`. Update the operational 1Panel compose file with a healthcheck and the currently working database endpoint.

**Tech Stack:** Flask, Jinja, vanilla JavaScript, CSS media queries, Docker Compose.

---

### Task 1: Add Mobile Navigation Markup

**Files:**
- Modify: `templates/index.html`

- [ ] **Step 1: Add bottom navigation after the main app container**

Insert this markup after `</main>` and before the modal container:

```html
    <nav class="mobile-bottom-nav" aria-label="Mobile primary navigation">
        <button class="mobile-nav-item active" data-mobile-view="profile" onclick="navigateTo('profile')">
            <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
            <span>Profile</span>
        </button>
        <button class="mobile-nav-item" data-mobile-view="flights" onclick="navigateTo('flights')">
            <i class="fa-solid fa-plane-departure" aria-hidden="true"></i>
            <span>Flights</span>
        </button>
        <button class="mobile-nav-item mobile-nav-primary" onclick="openAddFlightModal()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            <span>Add</span>
        </button>
        <button class="mobile-nav-item" data-mobile-view="datasets" onclick="navigateTo('datasets')">
            <i class="fa-solid fa-database" aria-hidden="true"></i>
            <span>Data</span>
        </button>
    </nav>
```

- [ ] **Step 2: Add stable classes to the Flights header controls**

Replace the inline-only header wrapper:

```html
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
```

with:

```html
<div class="view-header flights-header">
```

Replace the nested actions wrapper:

```html
<div style="display: flex; gap: 10px;">
```

with:

```html
<div class="view-actions flights-actions">
```

- [ ] **Step 3: Fix malformed Aircraft header markup**

Remove the stray duplicated line immediately after the Aircraft `<th>`:

```html
                                        class="fas fa-sort"></i></th>
```

- [ ] **Step 4: Smoke check template syntax**

Run:

```bash
python -m py_compile app.py database.py
```

Expected: command exits `0`.

### Task 2: Keep Navigation State Synced

**Files:**
- Modify: `static/js/app.js`

- [ ] **Step 1: Update `navigateTo()` active-state logic**

Inside `navigateTo(viewName)`, after the existing top nav active-state updates, add:

```javascript
    document.querySelectorAll('.mobile-nav-item[data-mobile-view]').forEach(el => {
        el.classList.toggle('active', el.dataset.mobileView === viewName);
    });
```

- [ ] **Step 2: Preserve existing desktop behavior**

Do not remove the current `.nav-item` active-state logic. Desktop must keep the same top navigation behavior.

- [ ] **Step 3: Run JavaScript syntax check**

Run:

```bash
node --check static/js/app.js
```

Expected: command exits `0`.

### Task 3: Render Flights With Mobile Card Hooks

**Files:**
- Modify: `static/js/app.js`

- [ ] **Step 1: Add helper functions inside `renderFlights()` before `data.forEach`**

Add:

```javascript
    const escapeAttr = (value) => String(value || '').replace(/"/g, '&quot;');
    const safe = (value) => value || '-';
```

- [ ] **Step 2: Replace generated flight row HTML**

Replace the current `tr.innerHTML = ...` block in `renderFlights()` with markup that keeps desktop columns and adds mobile labels/classes:

```javascript
        tr.className = 'flight-row';
        tr.innerHTML = `
            <td class="flight-cell flight-date" data-label="Date" style="white-space:nowrap; font-weight:500;">${displayDate}</td>
            <td class="flight-cell flight-times" data-label="Times">
                <div style="font-size:0.75rem; color:#666">STD: ${formatTime(f.std)}</div>
                <div style="font-size:0.75rem; color:#333; margin-bottom:4px;">ATD: ${formatTime(f.atd)}</div>
                <div style="font-size:0.75rem; color:#666">STA: ${formatTime(f.sta)}</div>
                <div style="font-size:0.75rem; color:#333">ATA: ${formatTime(f.ata)}</div>
            </td>
            <td class="flight-cell flight-number" data-label="Flight">${safe(f.flight_number)}</td>
            <td class="flight-cell flight-registration" data-label="Reg">
                ${f.registration ?
                `<a href="https://www.flightera.net/en/planes/${f.registration}" target="_blank" rel="noopener" style="color:var(--primary-color); text-decoration:none; font-weight:500;">${f.registration}</a>`
                : '-'}
            </td>
            <td class="flight-cell flight-origin" data-label="From">
                <div style="font-weight:500">${f.origin_name || f.origin_code || '-'}</div>
                <div style="font-size:0.75rem; color:#666">${f.origin_code || '-'} ${f.origin_terminal ? `(${f.origin_terminal})` : ''}</div>
            </td>
            <td class="flight-cell flight-destination" data-label="To">
                <div style="font-weight:500">${f.dest_name || f.dest_code || '-'}</div>
                <div style="font-size:0.75rem; color:#666">${f.dest_code || '-'} ${f.dest_terminal ? `(${f.dest_terminal})` : ''}</div>
            </td>
            <td class="flight-cell flight-distance" data-label="Dist">${safe(f.distance)}</td>
            <td class="flight-cell flight-duration" data-label="Dur">${safe(f.duration_scheduled)}<br>${safe(f.duration_actual)}</td>
            <td class="flight-cell flight-airline" data-label="Airline">${safe(f.airline_name)}</td>
            <td class="flight-cell flight-aircraft" data-label="Aircraft">${safe(f.aircraft_model)}</td>
            <td class="flight-cell flight-variants" data-label="Variants"><small>${safe(f.tag_generation)}<br>${safe(f.tag_winglets)}<br>${safe(f.tag_config)}</small></td>
            <td class="flight-cell flight-seat" data-label="Seat/Type">${safe(f.seat_number)}<br><small>${safe(f.seat_type)}</small></td>
            <td class="flight-cell flight-class" data-label="Class">${safe(f.flight_class)}</td>
            <td class="flight-cell flight-note" data-label="Note" style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeAttr(f.note)}">${f.note || ''}</td>
            <td class="flight-cell flight-actions" data-label="Actions">
                <button class="btn btn-sm btn-icon" style="color:var(--accent-blue)" title="Update from AeroAPI" onclick="updateFlightFromAeroAPI(${f.id})"><i class="fa-solid fa-cloud-arrow-down"></i></button>
                <button class="btn btn-sm btn-icon" onclick="openEditFlightModal(${JSON.stringify(f).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-icon" style="color:var(--danger)" onclick="deleteFlight(${f.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
```

- [ ] **Step 3: Run JavaScript syntax check**

Run:

```bash
node --check static/js/app.js
```

Expected: command exits `0`.

### Task 4: Add Responsive Mobile CSS

**Files:**
- Modify: `static/css/style.css`

- [ ] **Step 1: Add desktop-safe shared layout classes**

Append before the mobile media query:

```css
.view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
}

.view-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.mobile-bottom-nav {
    display: none;
}
```

- [ ] **Step 2: Add mobile media query**

Append:

```css
@media (max-width: 768px) {
    body {
        padding-bottom: 78px;
    }

    .navbar {
        height: auto;
        min-height: 56px;
        padding: 8px 12px;
        gap: 8px;
    }

    .navbar-brand {
        font-size: 1.2rem;
    }

    .navbar-brand img {
        height: 28px;
    }

    .navbar-right {
        gap: 8px;
    }

    .navbar-right > .nav-item,
    .navbar-right > .btn-primary {
        display: none;
    }

    .user-display-name,
    .dropdown-toggle {
        display: none;
    }

    .dropdown-content {
        position: fixed;
        right: 12px;
        top: 58px;
    }

    .mobile-bottom-nav {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1500;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        background: #fff;
        border-top: 1px solid var(--border-color);
        box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.12);
        padding: 6px max(8px, env(safe-area-inset-left)) max(6px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-right));
    }

    .mobile-nav-item {
        border: 0;
        background: transparent;
        color: #666;
        min-height: 54px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font: inherit;
        font-size: 0.75rem;
    }

    .mobile-nav-item i {
        font-size: 1.05rem;
    }

    .mobile-nav-item.active {
        color: var(--primary-color);
        font-weight: 700;
    }

    .mobile-nav-primary i {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--primary-color);
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: -12px;
        box-shadow: 0 4px 10px rgba(0, 86, 179, 0.28);
    }

    .container {
        max-width: 100%;
        margin: 12px auto;
        padding: 0 12px;
    }

    .map-container {
        height: 42vh;
        min-height: 300px;
    }

    .map-controls {
        left: 8px;
        right: 8px;
        top: 8px;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
    }

    .map-controls select,
    .map-controls button {
        min-height: 34px;
    }

    #profile-header-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        padding: 14px 12px;
    }

    #profile-header-stats > div:first-child {
        grid-column: 1 / -1;
    }

    .ph-stat b {
        font-size: 1.35rem;
    }

    .ph-stat span {
        font-size: 0.7rem;
        letter-spacing: 0;
    }

    .stats-container {
        grid-template-columns: 1fr;
        gap: 12px;
        margin: 12px;
    }

    .stats-card {
        padding: 14px;
    }

    .stats-total {
        font-size: 2rem;
    }

    .view-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .view-header h2 {
        margin: 0;
        font-size: 1.35rem;
    }

    .view-actions {
        width: 100%;
        overflow-x: auto;
        padding-bottom: 2px;
    }

    .table-responsive {
        overflow: visible;
        background: transparent;
        box-shadow: none;
    }

    #flights-table {
        display: block;
        font-size: 0.9rem;
    }

    #flights-table thead {
        display: none;
    }

    #flights-table tbody {
        display: grid;
        gap: 12px;
    }

    #flights-table .flight-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 12px;
        background: #fff;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 14px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }

    #flights-table .flight-cell {
        display: block;
        border: 0;
        padding: 0;
        min-width: 0;
    }

    #flights-table .flight-cell::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 3px;
        color: #777;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
    }

    #flights-table .flight-date,
    #flights-table .flight-number,
    #flights-table .flight-origin,
    #flights-table .flight-destination,
    #flights-table .flight-actions,
    #flights-table .flight-note {
        grid-column: 1 / -1;
    }

    #flights-table .flight-date::before,
    #flights-table .flight-number::before {
        display: none;
    }

    #flights-table .flight-date {
        color: #666;
        font-size: 0.82rem;
    }

    #flights-table .flight-number {
        margin-top: -4px;
        color: var(--primary-color);
        font-size: 1.25rem;
        font-weight: 800;
    }

    #flights-table .flight-origin,
    #flights-table .flight-destination {
        background: #f8fafc;
        border-radius: 6px;
        padding: 10px;
    }

    #flights-table .flight-note {
        max-width: none !important;
        white-space: normal !important;
    }

    #flights-table .flight-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding-top: 8px;
        border-top: 1px solid #eee;
    }

    #flights-table .flight-actions::before {
        display: none;
    }

    .modal-overlay {
        align-items: stretch;
        padding: 0;
    }

    .modal {
        width: 100%;
        max-width: none;
        min-height: 100dvh;
        border-radius: 0;
    }

    .modal-body {
        flex: 1;
        max-height: none;
    }

    .modal-footer {
        position: sticky;
        bottom: 0;
        background: #fff;
    }

    .btn,
    .form-group input,
    .form-group select,
    .form-group textarea {
        min-height: 42px;
    }
}
```

- [ ] **Step 3: Validate CSS contains the mobile breakpoint**

Run:

```bash
rg -n "@media \\(max-width: 768px\\)|mobile-bottom-nav|flight-row" static/css/style.css
```

Expected: output includes all three patterns.

### Task 5: Align 1Panel Compose Health And Database Configuration

**Files:**
- Modify: `/opt/1panel/docker/compose/flightlog/docker-compose.yml`

- [ ] **Step 1: Add healthcheck**

Under `ports`, add:

```yaml
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=5)\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

- [ ] **Step 2: Align database host with current working runtime**

Change the `MYSQL_HOST` value from the non-resolving container hostname to the currently reachable host:

```yaml
      - MYSQL_HOST=REDACTED-INTERNAL-HOST
```

Keep existing runtime credentials unchanged unless the operator provides new secrets.

- [ ] **Step 3: Validate compose config**

Run:

```bash
cd /opt/1panel/docker/compose/flightlog && docker compose config >/tmp/flightlog-compose.yml
```

Expected: command exits `0`.

### Task 6: Verify Running App And Responsive UI

**Files:**
- Verify only.

- [ ] **Step 1: Rebuild and restart service from 1Panel compose directory**

Run:

```bash
cd /opt/1panel/docker/compose/flightlog && docker compose up -d --build
```

Expected: command exits `0` and `flightlog-app` is running.

- [ ] **Step 2: Verify health endpoint**

Run:

```bash
curl -sS -i --max-time 8 http://127.0.0.1:5000/api/health | sed -n '1,12p'
```

Expected: HTTP `200 OK` and body `{"status":"ok"}`.

- [ ] **Step 3: Verify login page**

Run:

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' --max-time 8 http://127.0.0.1:5000/login
```

Expected: `200 text/html; charset=utf-8` and non-zero byte size.

- [ ] **Step 4: Verify database smoke check**

Run:

```bash
docker exec flightlog-app sh -lc 'python - <<\"PY\"
import os, pymysql
conn=pymysql.connect(host=os.getenv(\"MYSQL_HOST\"), port=int(os.getenv(\"MYSQL_PORT\",3306)), user=os.getenv(\"MYSQL_USER\"), password=os.getenv(\"MYSQL_PASSWORD\"), database=os.getenv(\"MYSQL_DB\"), connect_timeout=5)
cur=conn.cursor()
cur.execute(\"select count(*) from flights\")
print(\"flights\", cur.fetchone()[0])
conn.close()
PY'
```

Expected: prints a numeric `flights` count.

- [ ] **Step 5: Verify Docker health status**

Run:

```bash
docker inspect flightlog-app --format '{{json .State.Health}}'
```

Expected: JSON health object exists and reports `healthy` after the start period.

- [ ] **Step 6: Verify syntax**

Run:

```bash
node --check static/js/app.js && python -m py_compile app.py database.py
```

Expected: command exits `0`.

- [ ] **Step 7: Commit app changes**

Run:

```bash
git add templates/index.html static/js/app.js static/css/style.css
git commit -m "feat: improve mobile everfly UI"
```

Expected: commit succeeds.
