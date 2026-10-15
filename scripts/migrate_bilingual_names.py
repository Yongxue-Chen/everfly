"""Plan/apply an ID-preserving, tenant-scoped name migration.

Default: emit a JSON plan. Save it outside the container before --apply.
Apply reads that same plan on stdin, checks every old value, then commits once.
--rollback reads the plan and swaps before/after values (also concurrency-safe).
No rows are inserted/deleted, and no foreign keys or membership fields change.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import airportsdata
import database
from china_localization import (
    CHINESE_REGION_CODES, localized_china_city, localized_china_airport,
    chinese_airline_name, chinese_country_name, bilingual_alliance,
)

ALLOWED = {'cities': {'name', 'country'}, 'airports': {'name'}, 'airlines': {'name', 'country', 'alliance'}}


def plan_changes(conn, uid):
    cursor = conn.cursor()
    changes = []
    def add(table, row, proposed):
        after = {k: v for k, v in proposed.items() if v is not None and row.get(k) != v}
        if after:
            changes.append({'table': table, 'id': row['id'], 'before': {k: row.get(k) for k in after}, 'after': after})
    cursor.execute('SELECT id,name,country,country_code FROM cities WHERE user_id=%s', (uid,))
    for row in cursor.fetchall():
        if row['country_code'] in CHINESE_REGION_CODES:
            add('cities', row, {'name': localized_china_city(row['name'], row['country_code']), 'country': chinese_country_name(row['country_code'])})
    catalog = airportsdata.load('IATA')
    icao_catalog = airportsdata.load('ICAO')
    cursor.execute('SELECT id,name,iata_code,icao_code FROM airports WHERE user_id=%s', (uid,))
    for row in cursor.fetchall():
        info = catalog.get(row['iata_code']) or icao_catalog.get(row['icao_code'])
        localized = localized_china_airport(info, row['iata_code'], row['icao_code']) if info else None
        if localized:
            add('airports', row, {'name': localized['airport']})
    cursor.execute('SELECT id,name,iata_code,country,alliance FROM airlines WHERE user_id=%s', (uid,))
    for row in cursor.fetchall():
        name = chinese_airline_name(row['iata_code'])
        proposed = {'alliance': bilingual_alliance(row['alliance'])}
        if name:
            proposed.update(name=name, country=chinese_country_name('CN'))
        add('airlines', row, proposed)
    return {'version': 1, 'user_id': uid, 'changes': changes}


def apply_plan(conn, plan, uid, rollback=False):
    if plan.get('version') != 1 or plan.get('user_id') != uid:
        raise ValueError('Wrong migration version or user')
    cursor = conn.cursor()
    try:
        for change in plan['changes']:
            table = change['table']
            before, after = change['before'], change['after']
            if rollback:
                before, after = after, before
            if table not in ALLOWED or not after or set(before) != set(after) or not set(after) <= ALLOWED[table]:
                raise ValueError('Unsupported migration fields')
            fields = sorted(after)
            cursor.execute(f"SELECT {','.join(fields)} FROM {table} WHERE id=%s AND user_id=%s FOR UPDATE", (change['id'], uid))
            current = cursor.fetchone()
            if current != before:
                raise ValueError(f"Concurrent change or missing row: {table} #{change['id']}; no updates committed")
            cursor.execute(f"UPDATE {table} SET {','.join(field+'=%s' for field in fields)} WHERE id=%s AND user_id=%s", tuple(after[field] for field in fields) + (change['id'], uid))
        conn.commit()
    except Exception:
        conn.rollback()
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', type=int, required=True)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--apply', action='store_true')
    modes.add_argument('--rollback', action='store_true')
    args = parser.parse_args()
    conn = database._raw_connect(dict_cursor=True)
    try:
        if args.apply or args.rollback:
            plan = json.load(sys.stdin)
            apply_plan(conn, plan, args.user_id, rollback=args.rollback)
            print(json.dumps({'updated_rows': len(plan['changes']), 'rollback': args.rollback}))
        else:
            print(json.dumps(plan_changes(conn, args.user_id), ensure_ascii=False, indent=2))
    finally:
        conn.close()
