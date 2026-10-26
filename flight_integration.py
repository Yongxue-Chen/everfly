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
import re

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


# ---- terminals ----------------------------------------------------------------

def normalize_terminal(value):
    """Terminal as everfly stores it: 'T1', 'T2B', 'N'/'S' (north/south), 'Main', short codes.

    Accepts what bookings say: 'Terminal 1', 'T1', '1', 'Terminal T2B', 'North Terminal'.
    Anything else is dropped rather than guessed.
    """
    text = re.sub(r'\s+', ' ', str(value or '')).strip().upper()
    text = re.sub(r'^TERMINAL\s*', '', text)
    text = re.sub(r'\s*TERMINAL$', '', text).strip()
    if not text:
        return None
    if text in ('N', 'NORTH'):
        return 'N'
    if text in ('S', 'SOUTH'):
        return 'S'
    if text == 'MAIN':
        return 'Main'
    match = re.fullmatch(r'T ?(\d{1,2}[A-Z]?)|(\d{1,2}[A-Z]?)', text)
    if match:
        return 'T' + (match.group(1) or match.group(2))
    if re.fullmatch(r'[A-Z]{1,4}', text):
        return text
    return None


def add_airport_terminal(conn, user_id, airport_id, terminal):
    """Add a terminal to the airport's comma-separated list if it is not there yet."""
    if not airport_id or not terminal:
        return
    row = conn.execute("SELECT terminals FROM airports WHERE id = ? AND user_id = ?", (airport_id, user_id)).fetchone()
    if not row:
        return
    terminals = [t.strip() for t in (row[0] or '').split(',') if t.strip()]
    if terminal not in terminals:
        terminals.append(terminal)
        terminals.sort()
        conn.execute("UPDATE airports SET terminals = ? WHERE id = ? AND user_id = ?", (", ".join(terminals), airport_id, user_id))


def apply_source_terminals(conn, user_id, flight_id, origin_terminal=None, dest_terminal=None):
    """Fill empty flight terminals from a booking (AeroAPI fills the rest) and record them on the airports.

    Returns True when the flight changed.
    """
    if not origin_terminal and not dest_terminal:
        return False
    row = conn.execute(
        "SELECT origin_terminal, dest_terminal, origin_airport_id, dest_airport_id FROM flights WHERE id = ? AND user_id = ?",
        (flight_id, user_id),
    ).fetchone()
    if not row:
        return False
    sets, values = [], []
    if origin_terminal and not row[0]:
        sets.append('origin_terminal = ?')
        values.append(origin_terminal)
    if dest_terminal and not row[1]:
        sets.append('dest_terminal = ?')
        values.append(dest_terminal)
    if sets:
        conn.execute(f"UPDATE flights SET {', '.join(sets)} WHERE id = ? AND user_id = ?", (*values, flight_id, user_id))
    add_airport_terminal(conn, user_id, row[2], origin_terminal or row[0])
    add_airport_terminal(conn, user_id, row[3], dest_terminal or row[1])
    return bool(sets)

