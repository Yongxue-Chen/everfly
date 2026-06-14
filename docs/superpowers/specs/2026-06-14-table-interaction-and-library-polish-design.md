# Table Interaction and Library Polish Design

## Goal

Keep efficient desktop tables while making entity destinations, destructive actions, aircraft metadata, airline logos, and Library records visually explicit on desktop and mobile.

## Approved Direction

- A valid airline logo displays alone. Missing or failed logos display a neutral airline icon, never initials behind transparent artwork.
- Airline Library name cells combine logo, name, and IATA/ICAO identity.
- Aircraft model, variant/config tags, and registration are three distinct visual levels.
- Whole flight rows clearly advertise that they open flight details; entity links use a separate pill/link treatment and destination-specific tooltips.
- Delete remains available in lists and is added to the entity panel with clear danger styling and labels on mobile.
- Library keeps desktop tables and sorting, while gaining premium identity cells, hover affordances, clearer actions, and refined mobile cards.

## Compatibility

Existing CRUD, sorting, filtering, external registration links, row-click details, entity navigation, AeroAPI actions, responsive layouts, and tenant protections remain unchanged.
