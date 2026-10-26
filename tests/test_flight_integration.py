import os
import re
import sqlite3
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

import database  # noqa: E402
import flight_integration as fi  # noqa: E402
import app as app_module  # noqa: E402
from app import app, limiter  # noqa: E402

SQLITE_SCHEMA = """
CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, api_key_encrypted TEXT);
CREATE TABLE airports (id INTEGER PRIMARY KEY, user_id INT, name TEXT, iata_code TEXT, timezone TEXT);
CREATE TABLE airlines (id INTEGER PRIMARY KEY, user_id INT, name TEXT, iata_code TEXT);
CREATE TABLE aircraft_models (id INTEGER PRIMARY KEY, user_id INT, manufacturer TEXT, model TEXT);
CREATE TABLE flights (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INT, date TEXT, flight_number TEXT,
  airline_id INT, aircraft_model_id INT, origin_airport_id INT, dest_airport_id INT,
  dep_time_scheduled TEXT, arr_time_scheduled TEXT, dep_time_actual TEXT, arr_time_actual TEXT,
  std TEXT, sta TEXT, atd TEXT, ata TEXT, origin_terminal TEXT, dest_terminal TEXT, registration TEXT,
  duration_scheduled INT, duration_actual INT, distance INT);
CREATE TABLE flight_aliases (id INTEGER PRIMARY KEY, user_id INT, flight_id INT, flight_number TEXT,
  alias_type TEXT, airline_id INT, is_booked_number INT, source TEXT);
CREATE TABLE flight_aeroapi_jobs (id INTEGER PRIMARY KEY, user_id INT, flight_id INT, job_type TEXT);
CREATE TABLE internal_flight_requests (request_key TEXT, username TEXT, payload_hash TEXT, flight_id INT);
CREATE TABLE flight_external_refs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INT, flight_id INT, service TEXT,
  external_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE (user_id, service, external_id));
CREATE TABLE flight_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INT, flight_id INT, event_type TEXT,
  changes_json TEXT, snapshot_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE cancelled_flights (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INT, flight_id INT, snapshot_json TEXT,
  reason TEXT DEFAULT '', source TEXT DEFAULT '', cancelled_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO users (id, username) VALUES (7, 'traveller'), (8, 'someone-else');
INSERT INTO airports VALUES (1, 7, 'Milan Malpensa', 'MXP', 'Europe/Rome'), (2, 7, 'Frankfurt', 'FRA', 'Europe/Berlin');
INSERT INTO airlines VALUES (1, 7, 'Lufthansa', 'LH');
INSERT INTO aircraft_models VALUES (1, 7, 'Airbus', 'A320neo');
"""


def make_db():
    conn = sqlite3.connect(':memory:', check_same_thread=False)
    conn.executescript(SQLITE_SCHEMA)
    return conn


def add_flight(conn, user_id=7, **fields):
    row = {'date': '2099-12-20', 'flight_number': 'LH247', 'origin_airport_id': 1, 'dest_airport_id': 2,
           'airline_id': 1, 'std': '2099-12-20 14:40:00', 'sta': '2099-12-20 16:00:00'}
    row.update(fields)
    cols = ', '.join(['user_id'] + list(row))
    cur = conn.execute(f"INSERT INTO flights ({cols}) VALUES ({', '.join('?' * (len(row) + 1))})", [user_id, *row.values()])
    return cur.lastrowid


class FlightIntegrationModuleTest(unittest.TestCase):
    def setUp(self):
        self.conn = make_db()

    def test_snapshot_reads_joined_display_fields(self):
        fid = add_flight(self.conn, aircraft_model_id=1, origin_terminal='1')
        snap = fi.flight_snapshot(self.conn, 7, fid)
        self.assertEqual(snap['origin'], 'MXP')
        self.assertEqual(snap['destination_timezone'], 'Europe/Berlin')
        self.assertEqual(snap['aircraft'], 'Airbus A320neo')
        self.assertEqual(snap['std'], '2099-12-20 14:40:00')
        self.assertEqual(snap['status'], 'active')
        self.assertIsNone(fi.flight_snapshot(self.conn, 8, fid), 'other users never see the flight')

    def test_change_events_only_when_tracked_fields_change(self):
        fid = add_flight(self.conn)
        before = fi.flight_snapshot(self.conn, 7, fid)
        self.assertIsNone(fi.record_change(self.conn, 7, fid, before, 'aeroapi_filled'))
        self.conn.execute("UPDATE flights SET std = '2099-12-20 16:10:00', registration = 'D-AINA' WHERE id = ?", (fid,))
        event_id = fi.record_change(self.conn, 7, fid, before, 'aeroapi_filled')
        events = fi.list_events(self.conn, 7)
        self.assertEqual([e['id'] for e in events], [event_id])
        self.assertEqual(events[0]['changes']['std'], ['2099-12-20 14:40:00', '2099-12-20 16:10:00'])
        self.assertEqual(set(events[0]['changes']), {'std', 'registration'})
        self.assertEqual(events[0]['flight']['registration'], 'D-AINA')

    def test_event_feed_is_per_user_and_cursor_based(self):
        a = add_flight(self.conn)
        b = add_flight(self.conn, user_id=8)
        first = fi.record_event(self.conn, 7, a, 'created')
        fi.record_event(self.conn, 8, b, 'created')
        second = fi.record_event(self.conn, 7, a, 'changed', {'date': ['x', 'y']})
        self.assertEqual([e['id'] for e in fi.list_events(self.conn, 7)], [first, second])
        self.assertEqual([e['id'] for e in fi.list_events(self.conn, 7, after=first)], [second])
        self.assertEqual(fi.list_events(self.conn, 7, after=second), [])

    def test_external_refs_are_unique_per_source(self):
        a = add_flight(self.conn)
        b = add_flight(self.conn)
        self.assertEqual(fi.add_external_ref(self.conn, 7, a, 'mailbox', '118'), a)
        self.assertEqual(fi.add_external_ref(self.conn, 7, b, 'mailbox', '118'), a, 'first link wins')
        self.assertEqual(fi.find_ref(self.conn, 7, 'mailbox', '118'), a)
        self.assertIsNone(fi.find_ref(self.conn, 8, 'mailbox', '118'))
        self.assertEqual(fi.refs_for_flight(self.conn, 7, a), [{'service': 'mailbox', 'id': '118'}])

    def test_lookup_by_number_and_date_includes_booked_codeshares(self):
        fid = add_flight(self.conn)
        self.conn.execute("INSERT INTO flight_aliases (user_id, flight_id, flight_number, alias_type) VALUES (7, ?, 'UA9046', 'codeshare')", (fid,))
        self.assertEqual(fi.find_by_number_and_date(self.conn, 7, 'LH247', '2099-12-20'), fid)
        self.assertEqual(fi.find_by_number_and_date(self.conn, 7, 'UA9046', '2099-12-20'), fid)
        self.assertIsNone(fi.find_by_number_and_date(self.conn, 7, 'LH247', '2099-12-21'))

    def test_archive_removes_flight_keeps_full_snapshot_and_records_event(self):
        fid = add_flight(self.conn, registration='D-AINA')
        self.conn.execute("INSERT INTO flight_aliases (user_id, flight_id, flight_number, alias_type) VALUES (7, ?, 'UA9046', 'codeshare')", (fid,))
        self.conn.execute("INSERT INTO flight_aeroapi_jobs (user_id, flight_id, job_type) VALUES (7, ?, 'preflight_fill')", (fid,))
        summary = fi.archive_flight(self.conn, 7, fid, reason='airline cancelled', source='mailbox')
        self.assertEqual(summary['status'], 'cancelled')
        for table in ('flights', 'flight_aliases', 'flight_aeroapi_jobs'):
            col = 'id' if table == 'flights' else 'flight_id'
            self.assertEqual(self.conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {col} = ?", (fid,)).fetchone()[0], 0, table)
        cancelled = fi.cancelled_snapshot(self.conn, 7, fid)
        self.assertEqual((cancelled['status'], cancelled['flight_number'], cancelled['cancel_reason']), ('cancelled', 'LH247', 'airline cancelled'))
        self.assertEqual(fi.list_events(self.conn, 7)[-1]['type'], 'cancelled')
        self.assertIsNone(fi.archive_flight(self.conn, 7, fid), 'archiving twice is a no-op')

    def test_migration_is_additive_and_matches_fresh_schema(self):
        with open(os.path.join(ROOT, 'migrations', '20261026_flight_integration.sql'), encoding='utf-8') as fh:
            migration = fh.read()
        statements = [s.strip() for s in re.sub(r'--[^\n]*', '', migration).split(';') if s.strip()]
        self.assertEqual(len(statements), 3)
        self.assertTrue(all(s.startswith('CREATE TABLE IF NOT EXISTS') for s in statements))
        with open(os.path.join(ROOT, 'schema_mysql.sql'), encoding='utf-8') as fh:
            schema = fh.read()
        for statement in statements:
            self.assertIn(statement, schema)


class SqliteDb:
    """database.get_db() stand-in backed by sqlite (same '?' placeholders)."""
    def __init__(self, conn):
        self.conn = conn

    def execute(self, query, args=()):
        return self.conn.execute(query, args)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()


class FakeUsersConnection:
    def execute(self, query, args=()):
        class Cursor:
            def fetchone(self_inner):
                return {'id': args[0], 'username': 'traveller', 'api_key_encrypted': None}
        return Cursor()

    def close(self):
        pass


class InternalIntegrationApiTest(unittest.TestCase):
    def setUp(self):
        limiter.reset()
        self.client = app.test_client()
        self.saved_env = {k: os.environ.get(k) for k in ('INTERNAL_SERVICE_TOKEN', 'EVERFLY_INTERNAL_USERNAME')}
        os.environ['INTERNAL_SERVICE_TOKEN'] = 'shared-secret'
        os.environ['EVERFLY_INTERNAL_USERNAME'] = 'traveller'
        self.db = make_db()
        self.saved = (database.get_db, database.get_users_db, app_module._safely_auto_update_new_flight, app_module.schedule_flight_aeroapi_jobs)
        database.get_db = lambda: SqliteDb(self.db)
        database.get_users_db = lambda: FakeUsersConnection()
        self.refills = []
        app_module._safely_auto_update_new_flight = lambda fid: self.refills.append(fid)
        app_module.schedule_flight_aeroapi_jobs = lambda conn, uid, fid: 0
        self.auth = {'Authorization': 'Bearer shared-secret'}

    def tearDown(self):
        database.get_db, database.get_users_db, app_module._safely_auto_update_new_flight, app_module.schedule_flight_aeroapi_jobs = self.saved
        for k, v in self.saved_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def create(self, source_id='118', **extra):
        body = {'flightNumber': 'LH247', 'date': '2099-12-20', 'source': {'service': 'mailbox', 'id': source_id}, **extra}
        return self.client.post('/api/internal/flights', json=body, headers=self.auth)

    def test_endpoints_require_the_internal_token(self):
        for method, url in (('get', '/api/internal/flights/lookup?service=mailbox&id=1'), ('patch', '/api/internal/flights/1'),
                            ('post', '/api/internal/flights/1/cancel'), ('get', '/api/internal/flight-events')):
            self.assertEqual(getattr(self.client, method)(url, headers={'Authorization': 'Bearer wrong'}).status_code, 401, url)

    def test_create_with_source_links_records_event_and_dedupes(self):
        first = self.create()
        self.assertEqual(first.status_code, 201)
        fid = first.get_json()['flight']['id']
        self.assertEqual(self.refills, [fid])
        again = self.create()
        self.assertEqual(again.status_code, 200)
        self.assertEqual((again.get_json()['flight']['id'], again.get_json()['existing']), (fid, True))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM flights").fetchone()[0], 1)
        found = self.client.get('/api/internal/flights/lookup?service=mailbox&id=118', headers=self.auth).get_json()['flight']
        self.assertEqual((found['id'], found['status'], found['refs']), (fid, 'active', [{'service': 'mailbox', 'id': '118'}]))
        events = self.client.get('/api/internal/flight-events', headers=self.auth).get_json()
        self.assertEqual([e['type'] for e in events['events']], ['created'])

    def test_invalid_source_is_rejected(self):
        bad = self.client.post('/api/internal/flights', json={'flightNumber': 'LH247', 'date': '2099-12-20', 'source': {'service': 'Bad Service!', 'id': '1'}}, headers=self.auth)
        self.assertEqual(bad.status_code, 400)

    def test_patch_changes_date_clears_old_times_and_records_change(self):
        fid = self.create().get_json()['flight']['id']
        self.db.execute("UPDATE flights SET std = '2099-12-20 14:40:00', sta = '2099-12-20 16:00:00' WHERE id = ?", (fid,))
        self.db.execute("INSERT INTO flight_aeroapi_jobs (user_id, flight_id, job_type) VALUES (7, ?, 'preflight_fill')", (fid,))
        same = self.client.patch(f'/api/internal/flights/{fid}', json={'date': '2099-12-20'}, headers=self.auth).get_json()
        self.assertFalse(same['changed'])
        res = self.client.patch(f'/api/internal/flights/{fid}', json={'date': '2099-12-21', 'flightNumber': 'LH 249'}, headers=self.auth)
        body = res.get_json()
        self.assertTrue(body['changed'])
        self.assertEqual((body['flight']['date'], body['flight']['flight_number'], body['flight']['std']), ('2099-12-21', 'LH249', None))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM flight_aeroapi_jobs WHERE flight_id = ?", (fid,)).fetchone()[0], 0)
        changed = [e for e in self.client.get('/api/internal/flight-events', headers=self.auth).get_json()['events'] if e['type'] == 'changed']
        self.assertEqual(changed[0]['changes']['date'], ['2099-12-20', '2099-12-21'])
        self.assertEqual(self.client.patch('/api/internal/flights/999', json={'date': '2099-12-21'}, headers=self.auth).status_code, 404)

    def test_cancel_archives_and_is_idempotent(self):
        fid = self.create().get_json()['flight']['id']
        res = self.client.post(f'/api/internal/flights/{fid}/cancel', json={'reason': 'airline cancelled', 'service': 'mailbox'}, headers=self.auth)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['flight']['status'], 'cancelled')
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM flights").fetchone()[0], 0)
        again = self.client.post(f'/api/internal/flights/{fid}/cancel', json={}, headers=self.auth).get_json()
        self.assertTrue(again['alreadyCancelled'])
        looked = self.client.get('/api/internal/flights/lookup?service=mailbox&id=118', headers=self.auth).get_json()['flight']
        self.assertEqual((looked['status'], looked['refs']), ('cancelled', [{'service': 'mailbox', 'id': '118'}]))
        self.assertEqual(self.client.patch(f'/api/internal/flights/{fid}', json={'date': '2099-12-21'}, headers=self.auth).status_code, 409)
        types = [e['type'] for e in self.client.get('/api/internal/flight-events', headers=self.auth).get_json()['events']]
        self.assertEqual(types, ['created', 'cancelled'])
        self.assertEqual(self.client.post('/api/internal/flights/999/cancel', json={}, headers=self.auth).status_code, 404)

    def test_event_cursor(self):
        fid = self.create().get_json()['flight']['id']
        self.client.post(f'/api/internal/flights/{fid}/cancel', json={}, headers=self.auth)
        page = self.client.get('/api/internal/flight-events?limit=1', headers=self.auth).get_json()
        self.assertEqual(len(page['events']), 1)
        rest = self.client.get(f"/api/internal/flight-events?after={page['nextCursor']}", headers=self.auth).get_json()
        self.assertEqual([e['type'] for e in rest['events']], ['cancelled'])
        self.assertEqual(self.client.get('/api/internal/flight-events?after=x', headers=self.auth).status_code, 400)


if __name__ == '__main__':
    unittest.main()
