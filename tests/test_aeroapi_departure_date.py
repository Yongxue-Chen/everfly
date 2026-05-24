import os
import sys
import unittest
from datetime import datetime

import pytz


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import (  # noqa: E402
    build_aeroapi_departure_day_window,
    flight_matches_departure_local_date,
)


class AeroApiDepartureDateTest(unittest.TestCase):
    def test_future_window_is_departure_local_day_clamped_to_api_future_limit(self):
        now_utc = pytz.utc.localize(datetime(2026, 5, 24, 10, 9, 0))

        start, end = build_aeroapi_departure_day_window(
            "2026-05-25",
            "Asia/Shanghai",
            now_utc=now_utc,
        )

        self.assertEqual("2026-05-24T16:00:00Z", start)
        self.assertEqual("2026-05-25T16:00:00Z", end)

    def test_future_window_never_extends_past_aeroapi_two_day_future_limit(self):
        now_utc = pytz.utc.localize(datetime(2026, 5, 24, 10, 9, 0))

        start, end = build_aeroapi_departure_day_window(
            "2026-05-26",
            "America/Los_Angeles",
            now_utc=now_utc,
        )

        self.assertEqual("2026-05-26T07:00:00Z", start)
        self.assertEqual("2026-05-26T10:09:00Z", end)

    def test_matching_uses_departure_airport_local_date(self):
        self.assertTrue(
            flight_matches_departure_local_date(
                {"scheduled_out": "2026-05-24T16:30:00Z"},
                "2026-05-25",
                "Asia/Shanghai",
            )
        )
        self.assertFalse(
            flight_matches_departure_local_date(
                {"scheduled_out": "2026-05-25T16:30:00Z"},
                "2026-05-25",
                "Asia/Shanghai",
            )
        )


if __name__ == "__main__":
    unittest.main()
