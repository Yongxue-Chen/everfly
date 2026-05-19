# Mobile everfly Service Design

## Goal

Improve the everfly FlightLog service for mobile phone use while preserving the existing desktop experience.

## Scope

This change covers:

- Mobile navigation and layout improvements for the authenticated app.
- Mobile card rendering for the Flights view.
- Mobile-friendly modal and form behavior.
- Deployment health and configuration cleanup for the existing Docker/1Panel service.

This change does not cover:

- Rebuilding the frontend framework.
- Changing database schema or flight data semantics.
- Changing the desktop table workflow.
- Adding new business features such as search presets, offline mode, or push notifications.

## Current State

The service is a Flask app served by Gunicorn from Docker. The deployed container is `flightlog-app`, exposed on host port `5000`, and the UI brand shown in templates is `everfly`.

The current desktop UI uses:

- A top navbar in `templates/index.html`.
- A wide flights table rendered by `static/js/app.js`.
- Shared styling in `static/css/style.css`.
- Dynamic modals generated from JavaScript.

This works on desktop, but the Flights table is too wide for phones and the top navigation becomes crowded on small screens.

The running Docker container is healthy at the application level, but its runtime database configuration differs from the current 1Panel compose file. The current compose file points to a database host that does not resolve from the running container network.

## UX Design

### Desktop

Desktop must keep the current workflow:

- Top navbar remains the primary navigation.
- Flights remain a full table with sorting, filtering, and action buttons.
- Existing Profile map and stats layout remain effectively unchanged except for non-invasive CSS cleanup.
- Existing Datasets table workflow remains available.

Desktop behavior is the compatibility baseline. Mobile changes must be applied through responsive CSS and narrowly scoped markup additions.

### Mobile Navigation

For screens at or below `768px`:

- The top navbar becomes compact.
- The brand remains visible.
- User/profile controls remain accessible.
- A fixed bottom navigation appears with four primary actions:
  - Profile
  - Flights
  - Add
  - Datasets

The Add action opens the existing Add Flight modal. The bottom navigation uses the same existing `navigateTo()` and modal functions so it does not create a second navigation state.

### Mobile Flights View

For screens at or below `768px`, the Flights table is visually transformed into card rows:

- The desktop table remains in the DOM.
- Table headers are hidden on mobile.
- Each flight row becomes a card.
- Each card shows:
  - Date and flight number as the primary line.
  - Origin to destination as the route line.
  - Time, airline, aircraft, seat/type, class, distance, duration, and note as compact details when available.
  - Edit and delete actions at the bottom.

The renderer in `static/js/app.js` should add stable mobile labels/classes to generated cells so CSS can present rows as cards without duplicating flight data logic.

### Mobile Profile View

For screens at or below `768px`:

- The map height is reduced to fit a phone viewport.
- Map controls become compact and avoid covering too much of the map.
- Header stats wrap into a compact grid.
- Stats cards become one-column cards with smaller spacing and type.

### Mobile Modals And Forms

For screens at or below `768px`:

- Modals become near full-screen sheets.
- Modal bodies scroll independently.
- Footer actions remain easy to tap.
- Form inputs and buttons have mobile-friendly touch targets.

## Deployment Design

The 1Panel compose file should be aligned with the running service:

- Add a Docker healthcheck that calls `http://127.0.0.1:5000/api/health`.
- Keep the database host consistent with the current working runtime configuration.
- Avoid writing real runtime secrets into repository files.

The compose file at `/opt/1panel/docker/compose/flightlog/docker-compose.yml` is operational configuration, not source-controlled app code.

## Testing

Verification should include:

- `curl http://127.0.0.1:5000/api/health` returns HTTP 200 and `{"status":"ok"}`.
- `curl http://127.0.0.1:5000/login` returns HTTP 200.
- A database smoke check from inside `flightlog-app` can read the `flights` table.
- Desktop viewport screenshot confirms the Flights view remains a table.
- Mobile viewport screenshot confirms the Flights view renders as cards.
- Mobile viewport screenshot confirms bottom navigation is visible and not overlapping critical content.
- Docker compose config validates after adding healthcheck.

## Risks

- The app currently has a large `app.js`; changes should stay localized to `renderFlights()` and navigation helpers.
- Inline styles in `templates/index.html` limit pure CSS control. Only targeted class additions should be made unless an inline style blocks mobile behavior.
- Recreating the container with the wrong database host can break the service. Compose config should be checked before restart.
