# AeroAPI Manual Candidate Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop ambiguous AeroAPI flight matches from being automatically applied, and let the user choose the intended candidate first.

**Architecture:** Add focused candidate-selection helpers in `app.py` and reuse them from automatic update and preview/apply endpoints. Keep database schema unchanged. Add unit tests around the pure matching helpers before changing production behavior.

**Tech Stack:** Flask, PyMySQL compatibility wrapper, Python `unittest`, existing AeroAPI helper functions.

---

### Task 1: Candidate Selection Helpers

**Files:**
- Modify: `app.py`
- Test: `tests/test_aeroapi_candidate_selection.py`

- [ ] **Step 1: Write failing tests**

Create tests for ambiguity without route data, route-based unique matching, and selected candidate index.

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m unittest tests.test_aeroapi_candidate_selection -v`

Expected: import or assertion failures because helper functions do not exist.

- [ ] **Step 3: Implement minimal helpers**

Add helpers that summarize candidates, compare airport codes, and select candidates by local route or explicit candidate index.

- [ ] **Step 4: Run tests to verify pass**

Run: `python -m unittest tests.test_aeroapi_candidate_selection -v`

Expected: all tests pass.

### Task 2: Wire Backend Endpoints

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Update preview/update logic**

Use the helper in `_find_aeroapi_match_for_flight`, `_build_aeroapi_preview`, and `update_single_flight_from_aeroapi`.

- [ ] **Step 2: Preserve no-write ambiguity**

Return `{"ambiguous": true, "candidates": [...]}` when no unique candidate can be selected.

- [ ] **Step 3: Run backend tests**

Run: `python -m unittest tests.test_aeroapi_candidate_selection tests.test_aeroapi_departure_date tests.test_aeroapi_field_diffs -v`

Expected: all tests pass.

### Task 3: Frontend Candidate Picker

**Files:**
- Modify: `static/js/app.js`

- [ ] **Step 1: Inspect existing AeroAPI preview/apply UI**

Find existing `aeroapi_preview`, `aeroapi_apply`, and `updateFlightFromAeroAPI` code.

- [ ] **Step 2: Add candidate picker flow**

When preview returns `ambiguous: true`, show candidate summaries and call preview again with `candidate_index`.

- [ ] **Step 3: Run smoke checks**

Run backend tests and inspect the UI code for syntax errors.

Expected: tests pass and JavaScript remains syntactically valid.
