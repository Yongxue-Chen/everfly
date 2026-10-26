"""Integration helpers for other services that track the same flights.

Other services (a mail parser that creates flights, a trip planner that links
itinerary items to flights) need three things from everfly:

* external references: which record in another service a flight came from;
* a change feed: an append-only list of events (created, schedule changed,
  actual times filled, cancelled) readable from a cursor;
* cancellation without losing data: a cancelled flight is moved to an archive
  table with a full snapshot, so it disappears from statistics, maps and lists
  without any of those queries having to learn about a status column.

Every function takes an open connection and leaves commit/rollback to the
caller. SQL is kept portable (no MySQL-only syntax) so the logic can be tested
against SQLite.
"""
import json

# Fields compared between snapshots; a difference in any of them is an event.
TRACKED_FIELDS = (
    'date', 'flight_number', 'std', 'sta', 'atd', 'ata',
    'origin', 'destination', 'origin_terminal', 'dest_terminal',
    'aircraft', 'registration',
)

_SNAPSHOT_SQL = """
    SELECT f.id, f.user_id, f.date, f.flight_number, f.std, f.sta, f.atd, f.ata,
           f.origin_terminal, f.dest_terminal, f.registration,
           ao.iata_code, ao.name, ao.timezone, ad.iata_code, ad.name, ad.timezone,
           al.name, al.iata_code, am.manufacturer, am.model
    FROM flights f
    LEFT JOIN airports ao ON ao.id = f.origin_airport_id AND ao.user_id = f.user_id
    LEFT JOIN airports ad ON ad.id = f.dest_airport_id AND ad.user_id = f.user_id
    LEFT JOIN airlines al ON al.id = f.airline_id AND al.user_id = f.user_id
    LEFT JOIN aircraft_models am ON am.id = f.aircraft_model_id AND am.user_id = f.user_id
    WHERE f.id = ? AND f.user_id = ?
"""


def _text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def flight_snapshot(conn, user_id, flight_id):
    """The fields other services display, as plain strings. None if missing."""
    row = conn.execute(_SNAPSHOT_SQL, (flight_id, user_id)).fetchone()
    if not row:
        return None
    aircraft = ' '.join(p for p in (_text(row[19]), _text(row[20])) if p) or None
    return {
        'id': row[0],
        'date': _text(row[2]),
        'flight_number': _text(row[3]),
        # Scheduled/actual local times at the departure and arrival airports.
        'std': _text(row[4]), 'sta': _text(row[5]), 'atd': _text(row[6]), 'ata': _text(row[7]),
        'origin_terminal': _text(row[8]), 'dest_terminal': _text(row[9]),
        'registration': _text(row[10]),
        'origin': _text(row[11]), 'origin_name': _text(row[12]), 'origin_timezone': _text(row[13]),
        'destination': _text(row[14]), 'destination_name': _text(row[15]), 'destination_timezone': _text(row[16]),
        'airline': _text(row[17]), 'airline_iata': _text(row[18]),
        'aircraft': aircraft,
        'status': 'active',
    }


def snapshot_changes(before, after):
    """{field: [old, new]} for tracked fields that differ."""
    before = before or {}
    after = after or {}
    return {
        field: [before.get(field), after.get(field)]
        for field in TRACKED_FIELDS
        if before.get(field) != after.get(field)
    }


def record_event(conn, user_id, flight_id, event_type, changes=None, snapshot=None):
    cur = conn.execute(
        "INSERT INTO flight_events (user_id, flight_id, event_type, changes_json, snapshot_json) VALUES (?, ?, ?, ?, ?)",
        (user_id, flight_id, event_type,
         json.dumps(changes or {}, ensure_ascii=False), json.dumps(snapshot or {}, ensure_ascii=False)),
    )
    return cur.lastrowid


def record_change(conn, user_id, flight_id, before, event_type):
    """Compare the current snapshot with `before`; record an event only if something changed."""
    after = flight_snapshot(conn, user_id, flight_id)
    if after is None:
        return None
    changes = snapshot_changes(before, after)
    if not changes:
        return None
    return record_event(conn, user_id, flight_id, event_type, changes, after)


def add_external_ref(conn, user_id, flight_id, service, external_id):
    existing = find_ref(conn, user_id, service, external_id)
    if existing is not None:
        return existing
    conn.execute(
        "INSERT INTO flight_external_refs (user_id, flight_id, service, external_id) VALUES (?, ?, ?, ?)",
        (user_id, flight_id, service, external_id),
    )
    return flight_id


def find_ref(conn, user_id, service, external_id):
    row = conn.execute(
        "SELECT flight_id FROM flight_external_refs WHERE user_id = ? AND service = ? AND external_id = ?",
        (user_id, service, external_id),
    ).fetchone()
    return row[0] if row else None


def refs_for_flight(conn, user_id, flight_id):
    cur = conn.execute(
        "SELECT service, external_id FROM flight_external_refs WHERE user_id = ? AND flight_id = ? ORDER BY id",
        (user_id, flight_id),
    )
    return [{'service': r[0], 'id': r[1]} for r in cur.fetchall()]


def find_by_number_and_date(conn, user_id, flight_number, date):
    row = conn.execute(
        "SELECT id FROM flights WHERE user_id = ? AND flight_number = ? AND date = ? ORDER BY id LIMIT 1",
        (user_id, flight_number, date),
    ).fetchone()
    if row:
        return row[0]
    # A codeshare number booked by the traveller can differ from the operating number.
    row = conn.execute(
        """SELECT f.id FROM flight_aliases fa JOIN flights f ON f.id = fa.flight_id AND f.user_id = fa.user_id
           WHERE fa.user_id = ? AND fa.flight_number = ? AND f.date = ? ORDER BY f.id LIMIT 1""",
        (user_id, flight_number, date),
    ).fetchone()
    return row[0] if row else None


def cancelled_snapshot(conn, user_id, flight_id):
    row = conn.execute(
        "SELECT snapshot_json, reason, cancelled_at FROM cancelled_flights WHERE user_id = ? AND flight_id = ? ORDER BY id DESC LIMIT 1",
        (user_id, flight_id),
    ).fetchone()
    if not row:
        return None
    data = json.loads(row[0]) if isinstance(row[0], str) else (row[0] or {})
    summary = dict(data.get('summary') or {})
    summary.update({'id': flight_id, 'status': 'cancelled', 'cancel_reason': row[1], 'cancelled_at': _text(row[2])})
    return summary


def archive_flight(conn, user_id, flight_id, reason='', source=''):
    """Move a flight to cancelled_flights (full row + aliases) and delete it.

    Returns the summary snapshot, or None if the flight does not exist.
    Callers commit; a failure part-way must be rolled back by the caller.
    """
    summary = flight_snapshot(conn, user_id, flight_id)
    if summary is None:
        return None
    cur = conn.execute("SELECT * FROM flights WHERE id = ? AND user_id = ?", (flight_id, user_id))
    columns = [d[0] for d in cur.description]
    full_row = {k: _text(v) for k, v in zip(columns, cur.fetchone())}
    cur = conn.execute(
        "SELECT flight_number, alias_type, airline_id, is_booked_number, source FROM flight_aliases WHERE user_id = ? AND flight_id = ?",
        (user_id, flight_id),
    )
    aliases = [dict(zip(('flight_number', 'alias_type', 'airline_id', 'is_booked_number', 'source'), r)) for r in cur.fetchall()]
    summary['status'] = 'cancelled'
    conn.execute(
        "INSERT INTO cancelled_flights (user_id, flight_id, snapshot_json, reason, source) VALUES (?, ?, ?, ?, ?)",
        (user_id, flight_id, json.dumps({'summary': summary, 'row': full_row, 'aliases': aliases}, ensure_ascii=False),
         (reason or '')[:255], (source or '')[:40]),
    )
    # flight_aeroapi_jobs is ON DELETE RESTRICT; aliases cascade but are removed explicitly for clarity.
    conn.execute("DELETE FROM flight_aeroapi_jobs WHERE user_id = ? AND flight_id = ?", (user_id, flight_id))
    conn.execute("DELETE FROM flight_aliases WHERE user_id = ? AND flight_id = ?", (user_id, flight_id))
    conn.execute("DELETE FROM flights WHERE id = ? AND user_id = ?", (flight_id, user_id))
    record_event(conn, user_id, flight_id, 'cancelled', {'status': ['active', 'cancelled']}, summary)
    return summary


def list_events(conn, user_id, after=0, limit=100):
    cur = conn.execute(
        """SELECT id, flight_id, event_type, changes_json, snapshot_json, created_at
           FROM flight_events WHERE user_id = ? AND id > ? ORDER BY id LIMIT ?""",
        (user_id, int(after), int(limit)),
    )
    events = []
    for r in cur.fetchall():
        load = lambda v: json.loads(v) if isinstance(v, str) else (v or {})
        events.append({'id': r[0], 'flight_id': r[1], 'type': r[2], 'changes': load(r[3]),
                       'flight': load(r[4]), 'created_at': _text(r[5])})
    return events
