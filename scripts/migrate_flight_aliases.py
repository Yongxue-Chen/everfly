#!/usr/bin/env python3
"""Create flight_aliases and move flight-number-only notes into structured data."""

import argparse
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import database  # noqa: E402


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS flight_aliases (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    flight_id INT NOT NULL,
    flight_number VARCHAR(30) NOT NULL,
    alias_type VARCHAR(30) NOT NULL DEFAULT 'codeshare',
    airline_id INT,
    is_booked_number BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(30) NOT NULL DEFAULT 'manual',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_flight_alias_number (flight_id, user_id, flight_number),
    INDEX idx_flight_alias_user (user_id),
    INDEX idx_flight_alias_airline_user (airline_id, user_id),
    CONSTRAINT fk_flight_alias_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_flight_alias_flight_tenant FOREIGN KEY (flight_id, user_id) REFERENCES flights (id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_flight_alias_airline_tenant FOREIGN KEY (airline_id, user_id) REFERENCES airlines (id, user_id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
"""


def compact_flight_number(value):
    number = re.sub(r"\s+", "", str(value or "")).upper()
    return number if re.fullmatch(r"[A-Z0-9]{2,3}[0-9][A-Z0-9]*", number) else None


def classify_number_note(primary, note, airline_iata=None, airline_icao=None):
    primary = compact_flight_number(primary)
    alias = compact_flight_number(note)
    iata = str(airline_iata or "").strip().upper()
    icao = str(airline_icao or "").strip().upper()
    if not primary or not alias or primary == alias:
        return None
    if iata and icao:
        if primary.startswith(iata) and alias == icao + primary[len(iata):]:
            return {"action": "clear_derived", "flight_number": alias}
        if primary.startswith(icao) and alias == iata + primary[len(icao):]:
            return {"action": "clear_derived", "flight_number": alias}
    return {"action": "migrate_codeshare", "flight_number": alias}


def migration_candidates(conn):
    cursor = conn.execute("""
        SELECT f.id, f.user_id, f.flight_number, f.note, a.iata_code, a.icao_code
        FROM flights f
        LEFT JOIN airlines a ON a.id = f.airline_id AND a.user_id = f.user_id
        WHERE f.note IS NOT NULL AND TRIM(f.note) <> ''
        ORDER BY f.id
    """)
    candidates = []
    for flight_id, user_id, primary, note, iata, icao in cursor.fetchall():
        classification = classify_number_note(primary, note, iata, icao)
        if classification:
            candidates.append({
                "flight_id": flight_id,
                "user_id": user_id,
                "primary": primary,
                **classification,
            })
    return candidates


def resolve_alias_airline_id(conn, user_id, flight_number):
    match = re.fullmatch(r"([A-Z0-9]{2})[0-9][A-Z0-9]*", flight_number)
    if not match:
        return None
    row = conn.execute(
        "SELECT id FROM airlines WHERE user_id = ? AND UPPER(iata_code) = ? LIMIT 1",
        (user_id, match.group(1)),
    ).fetchone()
    return row[0] if row else None


def apply_migration(conn, candidates):
    conn.execute(CREATE_TABLE_SQL)
    for item in candidates:
        if item["action"] == "migrate_codeshare":
            airline_id = resolve_alias_airline_id(conn, item["user_id"], item["flight_number"])
            conn.execute(
                """INSERT INTO flight_aliases
                   (user_id, flight_id, flight_number, alias_type, airline_id, source)
                   VALUES (?, ?, ?, 'codeshare', ?, 'note_migration')
                   ON DUPLICATE KEY UPDATE alias_type = 'codeshare', airline_id = VALUES(airline_id),
                       source = 'note_migration'""",
                (item["user_id"], item["flight_id"], item["flight_number"], airline_id),
            )
        conn.execute(
            "UPDATE flights SET note = NULL WHERE id = ? AND user_id = ?",
            (item["flight_id"], item["user_id"]),
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    conn = database._DBWrapper(database._raw_connect())
    try:
        candidates = migration_candidates(conn)
        if args.apply:
            apply_migration(conn, candidates)
    finally:
        conn.close()

    action = "migrated" if args.apply else "would migrate"
    print(f"{action} {len(candidates)} flight note(s)")
    for item in candidates:
        print(
            f"  {item['flight_id']}: {item['primary']} / {item['flight_number']}"
            f" -> {item['action']}"
        )


if __name__ == "__main__":
    main()

