#!/usr/bin/env python3
"""
migrate_sqlite_to_mysql.py
==========================
Migrates FlightLog data from SQLite (per-user .db files) to a shared MySQL
database using the schema in schema_mysql.sql.

MUST be run BEFORE switching the app code to MySQL.

Usage:
    python migrate_sqlite_to_mysql.py            # perform actual migration
    python migrate_sqlite_to_mysql.py --dry-run  # print what would happen, write nothing

Prerequisites:
    pip install PyMySQL python-dotenv

.env must contain:
    MYSQL_HOST=<server IP or localhost>
    MYSQL_PORT=3306
    MYSQL_USER=<mysql user>
    MYSQL_PASSWORD=<mysql password>
    MYSQL_DB=flightlog
"""

import os
import sys
import sqlite3

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("ERROR: PyMySQL not installed. Run: pip install PyMySQL")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv optional if env vars are set directly

# ── Config ────────────────────────────────────────────────────────────────────

DRY_RUN       = '--dry-run' in sys.argv
MYSQL_HOST    = os.environ.get('MYSQL_HOST', 'localhost')
MYSQL_PORT    = int(os.environ.get('MYSQL_PORT', 3306))
MYSQL_USER    = os.environ.get('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')
MYSQL_DB      = os.environ.get('MYSQL_DB', 'flightlog')

USERS_DB_PATH = 'users.db'
INSTANCE_DIR  = 'instance'
SCHEMA_PATH   = 'schema_mysql.sql'

# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg, indent=0):
    print("  " * indent + msg)


def get_mysql_conn():
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def apply_schema(mysql_conn):
    """Execute schema_mysql.sql against the MySQL database."""
    log(f"Applying schema from {SCHEMA_PATH} ...")
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        raw = f.read()

    # Strip inline comments before splitting on ';' so embedded semicolons
    # inside comment text cannot break the statement boundaries.
    clean_lines = []
    for line in raw.splitlines():
        # Remove inline comment portion (anything after bare --)
        if '--' in line:
            # Keep the part before the first '--'
            line = line[:line.index('--')]
        clean_lines.append(line)
    clean_sql = '\n'.join(clean_lines)

    statements = []
    for block in clean_sql.split(';'):
        stmt = block.strip()
        # Must contain at least one SQL keyword to be worth executing
        if any(kw in stmt.upper() for kw in ('CREATE', 'INSERT', 'ALTER', 'DROP')):
            statements.append(stmt)

    with mysql_conn.cursor() as cur:
        for stmt in statements:
            cur.execute(stmt)
    mysql_conn.commit()
    log("Schema OK.")


def sqlite_table_exists(conn, table):
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cur.fetchone() is not None


def sqlite_fetch_all(conn, table):
    """Return all rows of a SQLite table as list-of-dict."""
    cur = conn.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


# ── Per-table migration functions ─────────────────────────────────────────────

def migrate_cities(sqlite_conn, mysql_conn, user_id):
    if not sqlite_table_exists(sqlite_conn, 'cities'):
        return {}
    rows = sqlite_fetch_all(sqlite_conn, 'cities')
    log(f"cities: {len(rows)} rows", indent=1)
    id_map = {}

    with mysql_conn.cursor() as cur:
        for row in rows:
            old_id = row['id']
            if not DRY_RUN:
                cur.execute(
                    """INSERT INTO cities
                         (user_id, name, country, country_code, timezone, continent)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (user_id, row.get('name'), row.get('country'), row.get('country_code'),
                     row.get('timezone'), row.get('continent'))
                )
                id_map[old_id] = cur.lastrowid
            else:
                id_map[old_id] = old_id  # identity map for dry-run
    return id_map


def migrate_airports(sqlite_conn, mysql_conn, user_id, city_id_map):
    if not sqlite_table_exists(sqlite_conn, 'airports'):
        return {}
    rows = sqlite_fetch_all(sqlite_conn, 'airports')
    log(f"airports: {len(rows)} rows", indent=1)
    id_map = {}

    with mysql_conn.cursor() as cur:
        for row in rows:
            old_id = row['id']
            new_city_id = city_id_map.get(row.get('city_id'))
            if not DRY_RUN:
                cur.execute(
                    """INSERT INTO airports
                         (user_id, name, iata_code, icao_code, city_id, lat, lon, timezone, terminals)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (user_id, row.get('name'), row.get('iata_code'), row.get('icao_code'),
                     new_city_id, row.get('lat'), row.get('lon'),
                     row.get('timezone'), row.get('terminals'))
                )
                id_map[old_id] = cur.lastrowid
            else:
                id_map[old_id] = old_id
    return id_map


def migrate_airlines(sqlite_conn, mysql_conn, user_id):
    if not sqlite_table_exists(sqlite_conn, 'airlines'):
        return {}
    rows = sqlite_fetch_all(sqlite_conn, 'airlines')
    log(f"airlines: {len(rows)} rows", indent=1)
    id_map = {}

    with mysql_conn.cursor() as cur:
        for row in rows:
            old_id = row['id']
            if not DRY_RUN:
                cur.execute(
                    """INSERT INTO airlines
                         (user_id, name, iata_code, icao_code, callsign, country, logo_url,
                          frequent_flyer_program, frequent_flyer_id, alliance)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (user_id, row.get('name'), row.get('iata_code'), row.get('icao_code'),
                     row.get('callsign'), row.get('country'), row.get('logo_url'),
                     row.get('frequent_flyer_program'), row.get('frequent_flyer_id'),
                     row.get('alliance'))
                )
                id_map[old_id] = cur.lastrowid
            else:
                id_map[old_id] = old_id
    return id_map


def migrate_aircraft_models(sqlite_conn, mysql_conn, user_id):
    if not sqlite_table_exists(sqlite_conn, 'aircraft_models'):
        return {}
    rows = sqlite_fetch_all(sqlite_conn, 'aircraft_models')
    log(f"aircraft_models: {len(rows)} rows", indent=1)
    id_map = {}

    with mysql_conn.cursor() as cur:
        for row in rows:
            old_id = row['id']
            if not DRY_RUN:
                cur.execute(
                    """INSERT INTO aircraft_models
                         (user_id, manufacturer, model, series, subtype,
                          tags_generation, tags_engine, tags_winglets, tags_config, name)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (user_id, row.get('manufacturer'), row.get('model'), row.get('series'),
                     row.get('subtype'), row.get('tags_generation'), row.get('tags_engine'),
                     row.get('tags_winglets'), row.get('tags_config'), row.get('name'))
                )
                id_map[old_id] = cur.lastrowid
            else:
                id_map[old_id] = old_id
    return id_map


def migrate_flights(sqlite_conn, mysql_conn, user_id, airport_id_map, airline_id_map, aircraft_id_map):
    if not sqlite_table_exists(sqlite_conn, 'flights'):
        return 0
    rows = sqlite_fetch_all(sqlite_conn, 'flights')
    log(f"flights: {len(rows)} rows", indent=1)
    warn_count = 0

    with mysql_conn.cursor() as cur:
        for i, row in enumerate(rows):
            new_airline_id  = airline_id_map.get(row.get('airline_id'))
            new_aircraft_id = aircraft_id_map.get(row.get('aircraft_model_id'))
            new_origin_id   = airport_id_map.get(row.get('origin_airport_id'))
            new_dest_id     = airport_id_map.get(row.get('dest_airport_id'))

            # Warn if FK references were lost (e.g. orphaned FK in source data)
            if row.get('origin_airport_id') and new_origin_id is None:
                log(f"  WARN flight row {i+1}: origin_airport_id={row['origin_airport_id']} not found in airports map", indent=2)
                warn_count += 1
            if row.get('dest_airport_id') and new_dest_id is None:
                log(f"  WARN flight row {i+1}: dest_airport_id={row['dest_airport_id']} not found in airports map", indent=2)
                warn_count += 1

            if not DRY_RUN:
                cur.execute(
                    """INSERT INTO flights
                         (user_id, date, flight_number, airline_id, aircraft_model_id,
                          origin_airport_id, dest_airport_id,
                          dep_time_scheduled, arr_time_scheduled,
                          dep_time_actual, arr_time_actual,
                          seat_number, seat_type, flight_class,
                          reason, note,
                          origin_terminal, dest_terminal,
                          tag_generation, tag_winglets, tag_config,
                          registration, distance, duration_scheduled, duration_actual,
                          std, atd, sta, ata)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                               %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (user_id,
                     row.get('date'), row.get('flight_number'),
                     new_airline_id, new_aircraft_id, new_origin_id, new_dest_id,
                     row.get('dep_time_scheduled'), row.get('arr_time_scheduled'),
                     row.get('dep_time_actual'), row.get('arr_time_actual'),
                     row.get('seat_number'), row.get('seat_type'), row.get('flight_class'),
                     row.get('reason'), row.get('note'),
                     row.get('origin_terminal'), row.get('dest_terminal'),
                     row.get('tag_generation'), row.get('tag_winglets'), row.get('tag_config'),
                     row.get('registration'), row.get('distance'),
                     row.get('duration_scheduled'), row.get('duration_actual'),
                     row.get('std'), row.get('atd'), row.get('sta'), row.get('ata'))
                )
    return warn_count


# ── Users table ───────────────────────────────────────────────────────────────

def migrate_users(users_sqlite_conn, mysql_conn):
    """
    Migrate the users table from users.db to MySQL.
    Returns a dict: {sqlite_user_id: mysql_user_id}
    """
    log("\n[1/2] Migrating users table ...")
    rows = sqlite_fetch_all(users_sqlite_conn, 'users')
    if not rows:
        log("No users found in users.db.", indent=1)
        return {}

    id_map = {}
    with mysql_conn.cursor() as cur:
        for row in rows:
            old_id = row['id']
            cur.execute("SELECT id FROM users WHERE username = %s", (row['username'],))
            existing = cur.fetchone()
            if existing:
                log(f"User '{row['username']}' already in MySQL (id={existing['id']}), skipping insert.", indent=1)
                id_map[old_id] = existing['id']
                continue

            if not DRY_RUN:
                cur.execute(
                    """INSERT INTO users (username, password_hash, db_filename, api_key_encrypted)
                       VALUES (%s, %s, %s, %s)""",
                    (row['username'], row['password_hash'],
                     row.get('db_filename', ''), row.get('api_key_encrypted'))
                )
                new_id = cur.lastrowid
            else:
                new_id = old_id  # identity for dry-run

            id_map[old_id] = new_id
            log(f"User '{row['username']}': sqlite_id={old_id} → mysql_id={new_id}", indent=1)

    if not DRY_RUN:
        mysql_conn.commit()
    return id_map


# ── Per-user data ─────────────────────────────────────────────────────────────

def migrate_user_data(sqlite_db_path, mysql_user_id, username, mysql_conn):
    log(f"\n  User '{username}' (mysql_user_id={mysql_user_id})")

    if not os.path.exists(sqlite_db_path):
        log(f"SQLite DB not found: {sqlite_db_path} — skipping.", indent=2)
        return

    if os.path.getsize(sqlite_db_path) == 0:
        log(f"SQLite DB is empty: {sqlite_db_path} — skipping.", indent=2)
        return

    sqlite_conn = sqlite3.connect(sqlite_db_path)

    try:
        city_id_map     = migrate_cities(sqlite_conn, mysql_conn, mysql_user_id)
        airport_id_map  = migrate_airports(sqlite_conn, mysql_conn, mysql_user_id, city_id_map)
        airline_id_map  = migrate_airlines(sqlite_conn, mysql_conn, mysql_user_id)
        aircraft_id_map = migrate_aircraft_models(sqlite_conn, mysql_conn, mysql_user_id)
        warns           = migrate_flights(
            sqlite_conn, mysql_conn, mysql_user_id,
            airport_id_map, airline_id_map, aircraft_id_map
        )

        if not DRY_RUN:
            mysql_conn.commit()

        if warns:
            log(f"Done — {warns} FK warning(s) (see above).", indent=1)
        else:
            log("Done — no FK warnings.", indent=1)

    except Exception as e:
        mysql_conn.rollback()
        log(f"ERROR during migration for '{username}': {e}", indent=1)
        raise
    finally:
        sqlite_conn.close()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if DRY_RUN:
        log("=" * 60)
        log("DRY RUN — nothing will be written to MySQL")
        log("=" * 60)

    log(f"Connecting to MySQL: {MYSQL_USER}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}")
    try:
        mysql_conn = get_mysql_conn()
    except Exception as e:
        log(f"\nERROR: Cannot connect to MySQL: {e}")
        log("\nCheck your .env file contains:")
        log("  MYSQL_HOST=<server IP or localhost>")
        log("  MYSQL_PORT=3306")
        log("  MYSQL_USER=<user>")
        log("  MYSQL_PASSWORD=<password>")
        log("  MYSQL_DB=flightlog")
        sys.exit(1)

    log("Connected to MySQL.")

    # Apply schema
    try:
        apply_schema(mysql_conn)
    except Exception as e:
        log(f"ERROR applying schema: {e}")
        mysql_conn.close()
        sys.exit(1)

    # Open users.db
    if not os.path.exists(USERS_DB_PATH):
        log(f"\nERROR: '{USERS_DB_PATH}' not found.")
        log("Run this script from the FlightLog project root directory.")
        mysql_conn.close()
        sys.exit(1)

    users_sqlite = sqlite3.connect(USERS_DB_PATH)

    # Step 1: migrate users table
    user_id_map = migrate_users(users_sqlite, mysql_conn)

    # Fetch all users for db_filename lookups
    all_users = sqlite_fetch_all(users_sqlite, 'users')
    users_sqlite.close()

    # Step 2: migrate per-user flight data
    log(f"\n[2/2] Migrating per-user flight data for {len(all_users)} user(s) ...")
    for user in all_users:
        old_id         = user['id']
        mysql_user_id  = user_id_map.get(old_id)
        if mysql_user_id is None:
            log(f"WARNING: No MySQL ID mapped for sqlite user_id={old_id} ('{user['username']}'), skipping.")
            continue

        stored_path    = user.get('db_filename') or ''
        filename       = stored_path.replace('\\', '/').split('/')[-1]
        sqlite_db_path = os.path.join(INSTANCE_DIR, filename)

        migrate_user_data(sqlite_db_path, mysql_user_id, user['username'], mysql_conn)

    mysql_conn.close()

    log("\n" + "=" * 60)
    if DRY_RUN:
        log("DRY RUN complete — no data was written.")
    else:
        log("Migration complete!")
        log("\nVerify with these SQL queries on your MySQL:")
        log("  SELECT id, username FROM users;")
        log("  SELECT user_id, COUNT(*) AS flights FROM flights GROUP BY user_id;")
        log("  SELECT user_id, COUNT(*) AS airports FROM airports GROUP BY user_id;")
    log("=" * 60)


if __name__ == '__main__':
    main()
