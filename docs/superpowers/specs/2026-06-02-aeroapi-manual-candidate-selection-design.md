# AeroAPI Manual Candidate Selection Design

## Goal

Prevent FlightLog from automatically writing incorrect AeroAPI data when one local flight number and date maps to multiple returned flight candidates, such as codeshare flights with opposite routes.

## Scope

This change applies only to AeroAPI flight updates and previews. It does not change the database schema, stats, flight import, airport import, or user API key storage.

## Behavior

When a flight has enough local route data, AeroAPI matching should prefer candidates whose origin and destination match the local origin and destination airport records.

When AeroAPI returns multiple candidates and FlightLog cannot uniquely determine the intended candidate, the backend should return an ambiguous-candidate response instead of updating the flight. The frontend should show a candidate picker. After the user chooses a candidate, the existing field-diff confirmation flow should show values from that selected candidate, and only then should selected fields be applied.

When AeroAPI returns exactly one usable candidate, the current preview and update behavior may continue.

## Data Flow

1. Load the local flight record.
2. Fetch AeroAPI candidates for the local flight number and departure date window.
3. Filter candidates to the local departure date.
4. If local origin and destination airports are known, filter or rank candidates by matching those airport codes.
5. If no single candidate remains, return candidate summaries for manual selection.
6. Use the selected candidate index to build remote values for preview/apply.

## Error Handling

Automatic update must not write fields when matching is ambiguous. The API should return a structured response with `ambiguous: true` and candidate summaries instead of treating ambiguity as an error.

Invalid selected candidate indexes should return an error response and leave the database unchanged.

## Testing

Add backend tests for:

- Multiple candidates without local route data returns ambiguity and does not choose by noon proximity.
- Local route data can identify a unique candidate.
- Selected candidate index drives preview values.
