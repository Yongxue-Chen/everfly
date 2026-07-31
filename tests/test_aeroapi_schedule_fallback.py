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
    _parse_ident_airline_flightnum,
    _decide_aeroapi_strategy,
)


class _FakeCursor:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class _FakeConn:
    """Stubs the one query _get_airport_timezone() needs, without a real DB."""

    def __init__(self, timezone=None):
        self._timezone = timezone

    def execute(self, query, args=()):
        return _FakeCursor((self._timezone,) if self._timezone else None)


def _make_flight(std=None, origin_airport_id=None):
    # Matches the _load_flight_for_aeroapi() column order:
    # flight_number, date, origin_airport_id, dest_airport_id, std, atd, sta, ata,
    # registration, airline_id, aircraft_model_id, distance, duration_scheduled,
    # duration_actual, origin_terminal, dest_terminal, flight_class
    return (
        "FR37", "2026-06-20", origin_airport_id, None, std, None, None, None,
        None, None, None, None, None, None, None, None, None,
    )


class ParseIdentTest(unittest.TestCase):
    def test_splits_common_iata_idents(self):
        self.assertEqual(("U2", "8844"), _parse_ident_airline_flightnum("U28844"))
        self.assertEqual(("RK", "192"), _parse_ident_airline_flightnum("RK192"))
        self.assertEqual(("FR", "37"), _parse_ident_airline_flightnum("FR37"))
        self.assertEqual(("VS", "8"), _parse_ident_airline_flightnum("VS8"))

    def test_rejects_unparseable_idents(self):
        self.assertEqual((None, None), _parse_ident_airline_flightnum(""))
        self.assertEqual((None, None), _parse_ident_airline_flightnum("X"))


class DecideAeroapiStrategyTest(unittest.TestCase):
    def setUp(self):
        self.now_utc = pytz.utc.localize(datetime(2026, 7, 31, 12, 0, 0))

    def test_known_tz_and_std_far_future_uses_schedules(self):
        flight = _make_flight(std="2026-10-05 08:00:00", origin_airport_id=1)
        conn = _FakeConn(timezone="Europe/Paris")
        self.assertEqual(
            "schedules",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=self.now_utc),
        )

    def test_known_tz_and_std_within_two_days_uses_ident(self):
        flight = _make_flight(std="2026-08-01 08:00:00", origin_airport_id=1)
        conn = _FakeConn(timezone="Europe/Paris")
        self.assertEqual(
            "ident",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=self.now_utc),
        )

    def test_known_tz_no_std_falls_back_to_day_window_heuristic(self):
        # Far-future date with only the origin timezone known (no std yet).
        flight = _make_flight(std=None, origin_airport_id=1)
        flight = ("FR37", "2026-10-05") + flight[2:]
        conn = _FakeConn(timezone="Europe/Paris")
        self.assertEqual(
            "schedules",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=self.now_utc),
        )

    def test_unknown_timezone_defers_to_schedules_then_ident(self):
        flight = _make_flight(std=None, origin_airport_id=None)
        conn = _FakeConn(timezone=None)
        self.assertEqual(
            "schedules_then_ident",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=self.now_utc),
        )


if __name__ == "__main__":
    unittest.main()
