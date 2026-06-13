# Modern Entity Cards and Airline Logos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize everfly without removing existing behavior, add navigable detail panels for all five entity types, and add free-plan-friendly airline logo management with graceful fallbacks.

**Architecture:** Extend the existing Flask/Jinja/vanilla-JavaScript application progressively. Add tenant-scoped entity detail endpoints and optional ImageKit logo import helpers in `app.py`; add one reusable entity panel shell and controller to the existing frontend; retain all existing CRUD forms, tables, mobile cards, map, statistics, and AeroAPI actions.

**Tech Stack:** Flask, PyMySQL, MySQL, vanilla JavaScript, CSS, ImageKit HTTP Upload API via `requests`, Python `unittest`.

---

## File Structure

- Modify `app.py`: tenant-scoped entity detail queries, detailed flight logo fields, secure logo URL import, optional ImageKit upload, and logo routes.
- Modify `schema_mysql.sql`: airline logo source URL and ImageKit file ID columns.
- Create `migrations/20260612_airline_logo_metadata.sql`: migration for existing MySQL databases.
- Modify `templates/index.html`: navigation labels and reusable entity panel shell.
- Modify `static/js/app.js`: entity links, entity panel controller/renderers, edit actions, and logo fallback rendering.
- Modify `static/css/style.css`: Cloud Premium tokens, clickable entity styles, panel layout, and mobile full-screen behavior.
- Create `tests/test_entity_details.py`: backend endpoint and tenant-scoping coverage.
- Create `tests/test_airline_logo_management.py`: schema, validation, ImageKit-optional, and fallback contract coverage.
- Create `tests/test_entity_panel_frontend.py`: panel shell, links, navigation, and responsive contract coverage.

### Task 1: Airline Logo Metadata Contract

**Files:**
- Modify: `schema_mysql.sql`
- Create: `migrations/20260612_airline_logo_metadata.sql`
- Modify: `app.py`
- Test: `tests/test_airline_logo_management.py`

- [ ] **Step 1: Write failing schema and CRUD contract tests**

Add tests asserting that `airlines` contains `logo_url`, `logo_source_url`, and
`logo_file_id`; the migration adds the two new columns; and `airlines_cols`
allows all three fields.

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m unittest tests.test_airline_logo_management -v`

Expected: failures for missing `logo_source_url`, `logo_file_id`, and migration.

- [ ] **Step 3: Add the schema, migration, and CRUD allow-list fields**

Add nullable `TEXT logo_source_url` and `VARCHAR(255) logo_file_id` columns.
Create an idempotent migration using `INFORMATION_SCHEMA.COLUMNS` checks before
each `ALTER TABLE`. Extend `airlines_cols` with the three logo metadata fields.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `python -m unittest tests.test_airline_logo_management -v`

Expected: all Task 1 tests pass.

### Task 2: Tenant-Scoped Entity Detail APIs

**Files:**
- Modify: `app.py`
- Test: `tests/test_entity_details.py`

- [ ] **Step 1: Write failing endpoint contract tests**

Add source-contract tests asserting these routes exist and all primary queries
contain `WHERE ... user_id = ?`:

```text
GET /api/entities/flights/<id>
GET /api/entities/airlines/<id>
GET /api/entities/airports/<id>
GET /api/entities/cities/<id>
GET /api/entities/aircraft_models/<id>
```

Also assert `/api/flights/detailed` selects `al.logo_url`,
`al.logo_source_url`, `al.iata_code`, and `al.icao_code`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m unittest tests.test_entity_details -v`

Expected: failures because entity routes and detailed flight logo fields do not
exist.

- [ ] **Step 3: Implement shared detail response helpers and five routes**

Implement small helpers that return:

```python
{
    "type": "airlines",
    "entity": {...},
    "stats": {...},
    "related": {"flights": [...], "airports": [...]}
}
```

Every primary query and relationship join must scope by `g.user['id']`.
Missing entities return `{"error": "Not found"}`, HTTP 404. Related flights are
limited to the most recent 50 records to bound panel payload size.

- [ ] **Step 4: Extend detailed flights with airline identity and logo fields**

Select aliased airline logo and code fields from the existing tenant-scoped
airline join without changing existing response fields.

- [ ] **Step 5: Run focused and security tests**

Run:

```bash
python -m unittest tests.test_entity_details tests.test_security_hardening -v
```

Expected: all tests pass.

### Task 3: Shared Entity Panel and Cross-Entity Navigation

**Files:**
- Modify: `templates/index.html`
- Modify: `static/js/app.js`
- Modify: `static/css/style.css`
- Test: `tests/test_entity_panel_frontend.py`
- Test: `tests/test_frontend_xss_hardening.py`

- [ ] **Step 1: Write failing frontend contract tests**

Assert the template contains the entity panel shell and accessible close/back
buttons. Assert JavaScript contains:

```javascript
openEntityPanel(type, id)
closeEntityPanel()
goBackEntityPanel()
renderEntityPanel(payload)
```

Assert panel history is stored separately from current view state, and mobile
CSS makes the panel full width.

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m unittest tests.test_entity_panel_frontend -v`

Expected: failures because the panel shell/controller do not exist.

- [ ] **Step 3: Add the reusable panel shell and controller**

Add a fixed overlay/scrim plus right-side `<aside>`. The controller fetches
`/api/entities/${type}/${id}`, renders loading/error states, maintains a
`State.entityPanelHistory` stack, and never resets list sort/filter state.

- [ ] **Step 4: Add escaped entity-specific renderers**

Render shared identity, metadata, stats, related records, and action buttons.
All values interpolated into HTML must pass through `escapeHtml`; URLs use the
existing URL normalization approach. Reuse `openEditDatasetModal()` and
`openEditFlightModal()` for edits.

- [ ] **Step 5: Link Flights and Library records**

Make flight airline, origin, destination, aircraft, and row summary clickable.
Make each Library row open its entity panel while action buttons stop
propagation. Add links inside panel related-record sections.

- [ ] **Step 6: Run focused frontend and XSS tests**

Run:

```bash
python -m unittest tests.test_entity_panel_frontend tests.test_frontend_xss_hardening -v
```

Expected: all tests pass.

### Task 4: Free-Plan-Friendly Airline Logo Management

**Files:**
- Modify: `app.py`
- Modify: `static/js/app.js`
- Modify: `static/css/style.css`
- Test: `tests/test_airline_logo_management.py`

- [ ] **Step 1: Write failing validation and route tests**

Test the pure URL validator rejects non-HTTP schemes, loopback, private,
link-local, and unresolved/internal targets. Assert logo routes exist and
ImageKit credentials remain server-side environment variables.

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m unittest tests.test_airline_logo_management -v`

Expected: failures because validation and logo routes do not exist.

- [ ] **Step 3: Implement secure source URL validation**

Create a pure `validate_public_image_url()` helper using `urllib.parse`,
`socket.getaddrinfo`, and `ipaddress`. Require HTTP/HTTPS and reject every
resolved non-global address.

- [ ] **Step 4: Implement optional ImageKit import**

Add a server-side helper using `requests.post()` and these optional environment
variables:

```text
IMAGEKIT_PRIVATE_KEY
IMAGEKIT_URL_ENDPOINT
```

If configured, import a validated public URL into `/everfly/airlines/` with a
unique filename and save the returned URL/file ID. If unconfigured or import
fails, preserve `logo_source_url`, clear neither existing airline data nor
block CRUD, and return a usable response.

- [ ] **Step 5: Add logo update/delete routes**

`POST /api/airlines/<id>/logo` accepts JSON containing `source_url`.
`DELETE /api/airlines/<id>/logo` clears the three logo metadata fields. Both
routes require login, tenant-scope the airline, and never expose private keys.

- [ ] **Step 6: Add resilient frontend logo rendering**

Create a helper that renders ImageKit URL first, then source URL on `error`,
then a generated IATA/ICAO/name-initial mark. Use `loading="lazy"` and only
stable list/detail CSS sizes. Add logo controls to the airline detail panel.

- [ ] **Step 7: Run focused Logo tests**

Run: `python -m unittest tests.test_airline_logo_management tests.test_entity_panel_frontend -v`

Expected: all tests pass.

### Task 5: Cloud Premium Visual Upgrade and Navigation Labels

**Files:**
- Modify: `templates/index.html`
- Modify: `static/css/style.css`
- Modify: `static/js/app.js`
- Test: `tests/test_entity_panel_frontend.py`
- Test: `tests/test_nav_and_mobile_map_controls.py`

- [ ] **Step 1: Write failing visual contract tests**

Assert navigation labels are `Journey`, `Flights`, and `Library`; the CSS
defines shared surface, border, radius, shadow, muted-text, and primary tokens;
and disabled/current controls remain present.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
python -m unittest tests.test_entity_panel_frontend tests.test_nav_and_mobile_map_controls -v
```

Expected: visual contract failures.

- [ ] **Step 3: Apply Cloud Premium tokens and component refinements**

Update shared colors, backgrounds, borders, radii, shadows, table hover states,
buttons, tabs, stats cards, map controls, modals, and mobile cards. Preserve all
existing selectors relied on by JavaScript and tests.

- [ ] **Step 4: Rename visible navigation without changing internal view keys**

Keep `profile`, `flights`, and `datasets` internal identifiers. Change only
user-facing labels to Journey, Flights, and Library.

- [ ] **Step 5: Run visual contract and existing navigation tests**

Run:

```bash
python -m unittest tests.test_entity_panel_frontend tests.test_nav_and_mobile_map_controls -v
```

Expected: all tests pass.

### Task 6: Full Regression and Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document optional ImageKit configuration**

Add `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` as optional variables.
Document the fallback chain and that missing/exhausted ImageKit capacity does
not affect core functions.

- [ ] **Step 2: Run the complete test suite**

Run: `python -m unittest discover -s tests -v`

Expected: zero failures and zero errors.

- [ ] **Step 3: Review the final diff against the approved design**

Check that all five entities open in the panel, existing actions remain
reachable, tenant scoping is present, Logo fallback is resilient, and no
unrelated files are modified.

- [ ] **Step 4: Run syntax verification**

Run:

```bash
python -m py_compile app.py database.py
node --check static/js/app.js
```

Expected: both commands exit successfully with no output.
