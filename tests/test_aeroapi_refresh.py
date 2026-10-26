"""Scheduled jobs replace schedule/terminal/registration changes; plain fills never overwrite."""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

import app as app_module  # noqa: E402

# flight row as _load_flight_for_aeroapi returns it
FLIGHT = ('CA958', '2026-12-20', 1, 2, '2026-12-20 20:15:00', None, '2026-12-21 12:45:00', None, 'B-1234',
          5, None, 8000, 570, None, 'T1', None, 'Economy')

MATCH = {
    'ident': 'CCA958',
    'scheduled_out': '2026-12-20T20:00:00Z',   # 21:00 local: retimed +45 min
    'scheduled_in': '2026-12-21T05:30:00Z',    # 13:30 local
    'registration': 'B-5678',
    'terminal_origin': '2',
    'terminal_destination': None,
    'origin': {'code': 'EDDF', 'timezone': 'Europe/Berlin'},
    'destination': {'code': 'ZBAD', 'timezone': 'Asia/Shanghai'},
}


class FakeConn:
    def __init__(self):
        self.updates = []

    def execute(self, sql, args=()):
        if sql.startswith('UPDATE flights'):
            self.updates.append((sql, list(args)))
        return self

    def commit(self):
        pass


class AeroApiRefreshTest(unittest.TestCase):
    def setUp(self):
        self.saved = {name: getattr(app_module, name) for name in (
            '_fetch_aeroapi_data_for_flight', 'select_aeroapi_candidate', '_get_airport_codes',
            'collect_aeroapi_related_updates', 'sync_aeroapi_operating_identity', 'build_aeroapi_departure_day_window')}
        app_module._fetch_aeroapi_data_for_flight = lambda *a, **k: [MATCH]
        app_module.select_aeroapi_candidate = lambda *a, **k: {'match': MATCH}
        app_module._get_airport_codes = lambda *a, **k: []
        app_module.collect_aeroapi_related_updates = lambda *a, **k: ([], [])
        app_module.sync_aeroapi_operating_identity = lambda *a, **k: None
        app_module.build_aeroapi_departure_day_window = lambda *a, **k: (None, None)

    def tearDown(self):
        for name, fn in self.saved.items():
            setattr(app_module, name, fn)

    def run_update(self, **kw):
        conn = FakeConn()
        result = app_module._run_ident_update(FLIGHT, 'CA958', '2026-12-20', 'Europe/Berlin', conn, 1, 70, **kw)
        written = {}
        for sql, args in conn.updates:
            cols = [part.split(' = ')[0].strip() for part in sql.split('SET ', 1)[1].split(' WHERE')[0].split(',')]
            written.update(dict(zip(cols, args)))
        return result, written

    def test_plain_fill_keeps_existing_values(self):
        _, written = self.run_update(force=False)
        for col in ('std', 'sta', 'registration', 'origin_terminal', 'duration_scheduled'):
            self.assertNotIn(col, written, col)

    def test_refresh_replaces_changed_schedule_terminal_and_registration(self):
        result, written = self.run_update(force=False, refresh=True)
        self.assertTrue(result.get('success'))
        self.assertEqual(written['std'], '2026-12-20 21:00:00')
        self.assertEqual(written['sta'], '2026-12-21 13:30:00')
        self.assertEqual(written['registration'], 'B-5678')
        self.assertEqual(written['origin_terminal'], 'T2')
        self.assertNotIn('duration_scheduled', written, 'still 9h30, unchanged')
        self.assertNotIn('dest_terminal', written, 'no AeroAPI value, nothing to write')
        self.assertNotIn('distance', written, 'not a refresh field')

    def test_refresh_without_changes_writes_nothing(self):
        same = ('CA958', '2026-12-20', 1, 2, '2026-12-20 21:00:00', None, '2026-12-21 13:30:00', None, 'B-5678',
                5, None, 8000, 570, None, 'T2', None, 'Economy')
        conn = FakeConn()
        app_module._run_ident_update(same, 'CA958', '2026-12-20', 'Europe/Berlin', conn, 1, 70, force=False, refresh=True)
        written_cols = ' '.join(sql for sql, _ in conn.updates)
        for col in ('std', 'sta', 'registration', 'origin_terminal'):
            self.assertNotIn(col + ' = ?', written_cols, col)

    def test_jobs_run_in_refresh_mode(self):
        with open(os.path.join(ROOT, 'app.py'), encoding='utf-8') as fh:
            runner = fh.read().split('def run_due_aeroapi_jobs', 1)[1].split('def ', 1)[0]
        self.assertIn('update_single_flight_from_aeroapi(flight_id, force=False, refresh=True)', runner)

    def test_value_comparison_ignores_format(self):
        self.assertFalse(app_module._aeroapi_value_differs('2026-12-20 21:00:00', '2026-12-20T21:00:00'))
        self.assertTrue(app_module._aeroapi_value_differs('2026-12-20 21:00:00', '2026-12-20 20:15:00'))
        self.assertFalse(app_module._should_write_aeroapi('origin_airport_id', 9, 1, False, True), 'airports are never replaced')


if __name__ == '__main__':
    unittest.main()
