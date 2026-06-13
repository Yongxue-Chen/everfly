# Complete Cloud Premium UI and Airline Logo Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the partial visual skin with the approved Cloud Premium desktop/mobile experience, force aircraft model and registration onto separate lines everywhere, prevent stale static assets, and populate all airline logos through ImageKit.

**Architecture:** Preserve the existing Flask APIs and vanilla JavaScript behavior. Restructure only the Jinja view shells and renderer markup, add a final cohesive responsive CSS layer, and add an idempotent server-side logo synchronization script using ImageKit and MySQL environment variables.

**Tech Stack:** Flask/Jinja, vanilla JavaScript, CSS, Python, MySQL, ImageKit Upload API, unittest, Docker Compose.

---

### Task 1: UI contracts and aircraft field separation
- Add source-contract tests for the Journey hero, responsive flight cards, separate aircraft model/registration elements, and versioned static assets.
- Run tests RED, implement markup contracts, then run GREEN.

### Task 2: Complete Cloud Premium desktop and mobile layout
- Restructure Journey around a premium hero, metrics, map, and insight cards.
- Upgrade Flights and Library surfaces while preserving table/filter/action behavior.
- Add dedicated mobile flight-card hierarchy and full-screen details.
- Run focused frontend and navigation tests.

### Task 3: Airline logo synchronization
- Add an idempotent script that maps IATA codes (plus explicit ICAO-only aliases), imports public airline logos into `/everfly/airlines/`, and updates `logo_url`, `logo_source_url`, and `logo_file_id`.
- Validate source availability before upload and report failures without clearing existing logos.
- Run the script with production `.env` and verify 31/31 coverage.

### Task 4: Verification and deployment
- Run Python/JavaScript syntax checks and all 56+ tests in Docker.
- Rebuild the production Compose service so it loads ImageKit environment variables.
- Verify health, static asset version, Logo coverage, and responsive source contracts.
- Commit and push all Git project changes.
