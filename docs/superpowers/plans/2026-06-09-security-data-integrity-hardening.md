# Security and Data Integrity Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent cross-user relationships and stored XSS, repair error handling, and introduce tenant-aware database constraints safely.

**Architecture:** Keep the existing generic CRUD and frontend structure, adding small centralized validation and escaping helpers. Apply strict constraints to clean installs while shipping a preflighted migration for existing databases.

**Tech Stack:** Flask, PyMySQL, vanilla JavaScript, MySQL, unittest

---

### Task 1: Backend relationship isolation and error handling

**Files:**
- Modify: `app.py`
- Create: `templates/error.html`
- Create: `tests/test_security_hardening.py`

- [ ] Write failing tests for tenant relationship validation, scoped joins,
  debug errors, and the CSRF template.
- [ ] Run the focused tests and verify they fail for the expected missing
  behavior.
- [ ] Add centralized relationship validation, scoped joins, non-recursive
  debug errors, and the error template.
- [ ] Run the focused tests and verify they pass.

### Task 2: Frontend dynamic HTML escaping

**Files:**
- Modify: `static/js/app.js`
- Create: `tests/test_frontend_xss_hardening.py`

- [ ] Write failing static tests requiring a shared escaping helper and escaped
  values in dynamic flight, dataset, profile, and statistics renderers.
- [ ] Run the focused tests and verify they fail.
- [ ] Add the escaping helper and apply it at dynamic HTML interpolation sites.
- [ ] Run the focused tests and verify they pass.

### Task 3: Tenant-aware database constraints

**Files:**
- Modify: `schema_mysql.sql`
- Create: `migrations/20260609_tenant_integrity_constraints.sql`
- Create: `tests/test_schema_tenant_integrity.py`

- [ ] Write failing schema tests for composite tenant keys, foreign keys, and
  migration preflight checks.
- [ ] Run the focused tests and verify they fail.
- [ ] Update the clean-install schema and add the guarded existing-database
  migration.
- [ ] Run the focused tests and verify they pass.

### Task 4: Verification

**Files:**
- Verify all changed files.

- [ ] Run the full unittest suite in the project runtime.
- [ ] Run syntax checks for Python and JavaScript.
- [ ] Review the final diff for unrelated changes and migration safety.
