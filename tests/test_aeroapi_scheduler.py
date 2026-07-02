import os
import sys
import unittest
from datetime import datetime, timedelta

import pytz


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import (  # noqa: E402
    build_aeroapi_job_specs,
    build_aeroapi_unknown_timezone_window,
    calculate_post_arrival_aeroapi_run_at,
    calculate_preflight_aeroapi_run_at,
    next_post_arrival_retry_at,
)


class AeroApiSchedulerTest(unittest.TestCase):
    def test_preflight_run_is_before_earliest_worldwide_flight_date(self):
        run_at = calculate_preflight_aeroapi_run_at("2026-07-03")

        self.assertEqual(
            pytz.utc.localize(datetime(2026, 7, 2, 9, 30, 0)),
            run_at,
        )

    def test_unknown_timezone_window_covers_all_possible_local_departure_times(self):
        now_utc = pytz.utc.localize(datetime(2026, 7, 1, 12, 0, 0))

        start, end = build_aeroapi_unknown_timezone_window("2026-07-03", now_utc=now_utc)

        self.assertEqual("2026-07-02T10:00:00Z", start)
        self.assertEqual("2026-07-03T12:00:00Z", end)

    def test_unknown_timezone_window_is_clamped_to_two_day_api_future_limit(self):
        now_utc = pytz.utc.localize(datetime(2026, 7, 1, 12, 0, 0))

        start, end = build_aeroapi_unknown_timezone_window("2026-07-04", now_utc=now_utc)

        self.assertEqual("2026-07-03T10:00:00Z", start)
        self.assertEqual("2026-07-03T12:00:00Z", end)


    def test_post_arrival_run_uses_destination_timezone_plus_one_hour(self):
        run_at = calculate_post_arrival_aeroapi_run_at(
            "2026-07-03 20:00:00",
            "Asia/Shanghai",
        )

        self.assertEqual(
            pytz.utc.localize(datetime(2026, 7, 3, 13, 0, 0)),
            run_at,
        )

    def test_job_specs_include_preflight_and_post_arrival_when_arrival_exists(self):
        specs = build_aeroapi_job_specs({
            "id": 42,
            "user_id": 7,
            "date": "2026-07-03",
            "sta": "2026-07-03 20:00:00",
            "arr_time_scheduled": None,
            "dest_timezone": "Asia/Shanghai",
        })

        self.assertEqual(["preflight_fill", "post_arrival_fill"], [spec["job_type"] for spec in specs])
        self.assertEqual(pytz.utc.localize(datetime(2026, 7, 2, 9, 30, 0)), specs[0]["run_at_utc"])
        self.assertEqual(pytz.utc.localize(datetime(2026, 7, 3, 13, 0, 0)), specs[1]["run_at_utc"])


    def test_schema_declares_aeroapi_job_table(self):
        with open(os.path.join(ROOT, "schema_mysql.sql"), encoding="utf-8") as fh:
            schema = fh.read()

        self.assertIn("CREATE TABLE IF NOT EXISTS flight_aeroapi_jobs", schema)
        self.assertIn("UNIQUE KEY uq_aeroapi_job_flight_type", schema)

    def test_app_exposes_scheduler_hooks(self):
        with open(os.path.join(ROOT, "app.py"), encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("def migrate_flight_aeroapi_jobs", source)
        self.assertIn("def schedule_flight_aeroapi_jobs", source)
        self.assertIn("def run_due_aeroapi_jobs", source)
        self.assertIn("/api/internal/aeroapi_jobs/run", source)

    def test_post_arrival_retry_uses_limited_progressive_delays(self):
        base = pytz.utc.localize(datetime(2026, 7, 3, 15, 0, 0))

        self.assertEqual(base + timedelta(hours=1), next_post_arrival_retry_at(base, 1))
        self.assertEqual(base + timedelta(hours=2), next_post_arrival_retry_at(base, 2))
        self.assertEqual(base + timedelta(hours=4), next_post_arrival_retry_at(base, 3))


if __name__ == "__main__":
    unittest.main()
