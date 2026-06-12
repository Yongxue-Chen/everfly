# Modern Entity Cards and Airline Logos Design

## Goal

Modernize everfly into a clear, premium personal flight archive while preserving
all current functionality. Add consistent detail cards for flights, airlines,
airports, cities, and aircraft models so users can navigate naturally between
related records.

## Product Direction

everfly combines two modes:

- **Journey** is the personal flying archive. It emphasizes the map, lifetime
  statistics, recent flights, and meaningful records.
- **Flights** remains the efficient flight-history workspace.
- **Library** replaces the current Data label and remains the professional
  database-management workspace.

The visual direction is **Cloud Premium**: bright, restrained, aviation-inspired,
and optimized for clarity during extended use.

## Compatibility Constraint

The redesign must preserve all existing behavior, including:

- Profile map, year filtering, map layers, statistics, and charts.
- Flight sorting, filtering, editing, deletion, and AeroAPI updates.
- Dataset CRUD, searches, update actions, and existing fields.
- Desktop table workflows and mobile card workflows.
- Existing authentication, tenant isolation, and security protections.

Existing APIs and URLs should remain compatible unless a new endpoint is
required for entity details or logo management.

## Information Architecture

The primary navigation becomes:

- **Journey**: the redesigned Profile view.
- **Flights**: flight history and management.
- **Library**: cities, airports, airlines, and aircraft models.

The Add Flight action remains globally accessible. Settings and profile actions
remain available from the user menu.

## List and Card Behavior

Desktop lists remain tables because they provide efficient sorting, filtering,
comparison, and management for large datasets. Mobile lists continue to render
as cards using the existing responsive approach.

Every record has a detail-card representation, but detail cards do not replace
desktop tables. Clicking a record or a linked relationship opens its detail
card in the entity detail panel.

Examples:

- Clicking an airline logo or name in a flight opens the airline detail.
- Clicking an origin or destination opens the airport detail.
- Clicking the airport's city opens the city detail.
- Clicking an aircraft model opens the aircraft detail.
- Clicking a related flight opens the flight detail.

## Entity Detail Panel

On desktop, entity details open in a right-side panel approximately 440 pixels
wide. On mobile, the same panel becomes a full-screen detail view.

Opening and closing the panel must preserve the underlying page's scroll
position, filters, sorting, selected dataset, and loaded data. The panel
maintains a navigation history so users can move through related entities and
return to the previous entity.

The shared panel structure contains:

1. Back navigation, entity identity, and close action.
2. Logo or generated fallback mark, name, codes, and key metadata.
3. Summary statistics relevant to the entity.
4. Related entities and related flights.
5. Existing actions such as edit, delete, website link, and AeroAPI update
   where applicable.

Editing is available directly from the detail panel. After a successful edit,
the panel, underlying list, related records, and relevant statistics refresh
without losing the user's current context.

### Flight Detail

- Route, flight number, date, and schedule/actual times.
- Airline, origin airport, destination airport, and aircraft links.
- Distance, duration, terminal, registration, seat, class, tags, and note.
- Existing edit, delete, and AeroAPI actions.

### Airline Detail

- Logo, name, IATA, ICAO, callsign, country, alliance, and website.
- Frequent-flyer program and membership ID.
- Flight count, distance, duration, common routes, and related flights.
- Logo management and existing edit/delete actions.

### Airport Detail

- Name, IATA, ICAO, city, coordinates, timezone, and terminals.
- Visit count, departures, arrivals, common routes, and related flights.
- Existing update, edit, and delete actions.

### City Detail

- Name, country, country code, timezone, and continent.
- Associated airports and flights involving those airports.
- Visit and route statistics.
- Existing update, edit, and delete actions.

### Aircraft Model Detail

- Manufacturer, model, series, subtype, and supported tags/configurations.
- Flight count, distance, duration, registrations, and related flights.
- Existing edit and delete actions.

## Visual System

The Cloud Premium visual system uses:

- A light blue-gray application background.
- Deep aviation blue for primary actions and identity.
- Brighter blue for interactive emphasis.
- White cards with fine borders, larger corner radii, and restrained shadows.
- Clear numeric hierarchy and less use of uppercase labels.
- Comfortable table row height, clear hover states, and visually stable
  toolbars.
- Lower visual emphasis for destructive actions while keeping them accessible.
- Shared loading, empty, failure, and fallback states.

Airline logos display at approximately 32 pixels in flight lists and 64 pixels
in airline details. Logos use a consistent contained treatment so different
aspect ratios and transparent padding do not disrupt alignment.

## Airline Logo Storage

ImageKit is an optional, free-plan-friendly image delivery layer. MySQL stores
references and metadata, not image binary data.

The `airlines` table retains `logo_url` and adds:

- `logo_source_url`: the original public URL supplied by the user.
- `logo_file_id`: the ImageKit file identifier used for replacement or removal.

Users can either upload a logo or provide an external public URL. When ImageKit
is configured, the backend validates and imports the image once into an
`/everfly/airlines/` folder. The resulting ImageKit CDN URL becomes `logo_url`.

### Free-Plan Constraints

The logo feature must remain useful without paid ImageKit capacity:

- ImageKit configuration is optional.
- Logo uploads are limited to 1 MB.
- SVG, WebP, and PNG are preferred.
- Each airline stores one master logo.
- The UI uses only two stable transformation profiles: list and detail.
- Logos use lazy loading and long-lived browser caching.
- Replacements use new filenames instead of cache-purge requests.
- AI extensions, background removal, and unnecessary transformations are not
  used.

The current ImageKit Forever Free plan provides 20 GB monthly delivery
bandwidth, 3 GB fixed DAM storage, and 500 monthly cache-purge requests. Media
delivery stops when the bandwidth limit is reached, so ImageKit cannot be a
dependency for core application behavior.

Logo rendering follows this fallback chain:

1. ImageKit CDN `logo_url`.
2. Original `logo_source_url`.
3. A generated IATA, ICAO, or airline-name initial mark.

If ImageKit is unconfigured, unavailable, or over quota, all entity panels,
lists, CRUD operations, and navigation continue to work.

### Logo Security

External URL imports must:

- Allow only HTTP and HTTPS.
- Reject loopback, private, link-local, and internal network targets.
- Enforce request timeout, redirect limit, content-type validation, and size
  limit.
- Avoid exposing ImageKit private credentials to the browser.

Uploads must validate file type and size server-side.

## Backend Design

Add entity-detail endpoints that return the entity, relevant statistics,
related records, and relationships needed by the panel. Each endpoint must
enforce the current user's `user_id` on the primary record and all joins.

Candidate endpoints:

```text
GET /api/entities/flights/<id>
GET /api/entities/airlines/<id>
GET /api/entities/airports/<id>
GET /api/entities/cities/<id>
GET /api/entities/aircraft_models/<id>
POST /api/airlines/<id>/logo
DELETE /api/airlines/<id>/logo
```

The detailed flights API should include airline identity and logo fields needed
by the flight list. Existing generic CRUD routes continue to handle normal
record edits.

ImageKit credentials are supplied through environment variables and are never
stored in client-side code.

## Frontend Design

Add a shared entity-panel controller responsible for:

- Opening and closing the panel.
- Fetching entity details.
- Rendering shared loading, error, and fallback states.
- Maintaining panel navigation history.
- Refreshing affected cached data after edits.
- Converting to a full-screen view on mobile.

Entity-specific renderers provide the content for each entity type while using
the same panel shell. Existing list renderers gain stable clickable entity
links and must stop event propagation for action buttons.

The initial implementation remains within the existing Flask, Jinja, CSS, and
vanilla JavaScript architecture. A full SPA rewrite is outside this scope.

## Error Handling

- A failed detail request shows an inline retry state without affecting the
  underlying page.
- A missing or unauthorized entity closes or replaces the panel with a clear
  not-found state.
- A failed Logo import preserves the original URL when valid and shows the
  generated fallback when neither image source loads.
- Failed edits leave the panel open and preserve entered data where practical.
- ImageKit failures never block airline CRUD.

## Testing

Backend tests cover:

- Tenant isolation for every entity-detail endpoint and relationship join.
- Correct entity statistics and related-record results.
- Airline logo metadata CRUD.
- External URL SSRF protection, content-type checks, size limits, and timeouts.
- ImageKit-unconfigured and ImageKit-failure behavior.
- Detailed flight responses containing airline logo metadata.

Frontend tests cover:

- Entity links in flight and Library lists.
- Panel open, close, back navigation, and state preservation.
- Editing from the panel and refreshing affected content.
- ImageKit, source URL, and generated-logo fallback behavior.
- Existing sorting, filtering, CRUD, AeroAPI, map, and statistics behavior.
- Desktop table, mobile card, and mobile full-screen panel layouts.

## Delivery Approach

Implement this as a progressive enhancement of the existing application:

1. Introduce shared visual tokens and the panel shell without changing behavior.
2. Add entity-detail APIs and panel navigation.
3. Link all five entity types across Flights and Library.
4. Add free-plan-friendly ImageKit logo management and fallbacks.
5. Apply Cloud Premium visual refinements while preserving all workflows.
6. Run existing regression tests and new entity/logo tests.

## Out of Scope

- Rewriting the application as React, Vue, or another SPA framework.
- Replacing existing map or chart libraries.
- Automatically discovering logos from arbitrary internet searches.
- Paid ImageKit-only capabilities.
- Storing logo binary data in MySQL.
