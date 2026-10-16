#!/usr/bin/env python3
"""Repair city continent values from their ISO country codes."""

import argparse
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import database  # noqa: E402
from continent_mapping import continent_from_country_code  # noqa: E402


def backfill_city_continents(conn, apply=False):
    cursor = conn.execute(
        "SELECT id, name, country_code, continent FROM cities ORDER BY id"
    )
    changes = []
    skipped = []

    for city_id, name, country_code, current in cursor.fetchall():
        expected = continent_from_country_code(country_code)
        if not expected:
            skipped.append((city_id, name, country_code))
            continue
        if current == expected:
            continue
        changes.append((city_id, name, current, expected))
        if apply:
            conn.execute(
                "UPDATE cities SET continent = ? WHERE id = ?",
                (expected, city_id),
            )

    if apply:
        conn.commit()

    return changes, skipped


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write changes; without this flag the script is a dry run",
    )
    args = parser.parse_args()

    conn = database._DBWrapper(database._raw_connect())
    try:
        changes, skipped = backfill_city_continents(conn, apply=args.apply)
    finally:
        conn.close()

    action = "updated" if args.apply else "would update"
    print(f"{action} {len(changes)} city row(s)")
    for city_id, name, old, new in changes:
        print(f"  {city_id}: {name}: {old or '(empty)'} -> {new}")
    if skipped:
        print(f"skipped {len(skipped)} row(s) with unknown country codes")
        for city_id, name, country_code in skipped:
            print(f"  {city_id}: {name}: {country_code or '(empty)'}")


if __name__ == "__main__":
    main()
