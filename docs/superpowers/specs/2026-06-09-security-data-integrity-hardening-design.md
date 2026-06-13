# Security and Data Integrity Hardening Design

## Goal

Close the highest-priority security and data-integrity gaps without breaking an
existing FlightLog deployment that may contain legacy data.

## Scope

1. Reject cross-user relationship IDs when creating or updating airports and
   flights.
2. Restrict detailed-flight joins to records owned by the current user.
3. Escape all untrusted dynamic values before placing them in frontend
   `innerHTML`.
4. Fix recursive debug error handling and provide the missing CSRF error page.
5. Add tenant-aware constraints to the clean-install schema and provide an
   explicit, preflighted migration for existing databases.

Changing legacy string date/time columns is intentionally excluded because it
requires a separate data-cleaning migration.

## Backend Design

A relationship map defines which accepted foreign-key fields point to which
tenant-owned tables. Before generic CRUD inserts and updates, the application
checks every supplied non-null relationship ID using both `id` and `user_id`.
Invalid relationships return HTTP 400 and do not write data.

Detailed-flight joins include `AND related_table.user_id = current_user_id`.
This prevents legacy or malformed cross-user relationships from exposing data.

Production errors remain generic. Debug errors return the exception text
without recursively invoking the error helper. CSRF failures render a small
standalone error template.

## Frontend Design

Introduce a single `escapeHtml` helper and use it for every untrusted value
interpolated into dynamic HTML. Values written through `textContent` need no
additional escaping. User-entered website links remain limited to HTTP and
HTTPS URLs.

## Database Design

The clean-install schema adds:

- foreign keys from tenant tables to `users`;
- composite unique keys on `(id, user_id)`;
- composite foreign keys that require related records to belong to the same
  user;
- explicit delete behavior that preserves flights while nulling optional
  relationships.

The existing-database migration first runs validation queries that intentionally
fail when orphaned or cross-user relationships exist. Constraints are only
added after the preflight succeeds.

## Testing

Backend unit tests cover relationship validation, tenant-scoped detailed joins,
debug error responses, and the CSRF template. Static frontend tests verify that
dynamic renderers escape untrusted values. Schema tests verify that tenant-aware
constraints and migration preflight checks remain present.
