import math
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
    generate_geodesic_points,
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

    def test_known_tz_no_std_whole_day_beyond_limit_uses_schedules(self):
        # Far-future date with only the origin timezone known (no std yet): the entire
        # local departure day is beyond now+2days, so we can be sure without the exact time.
        flight = _make_flight(std=None, origin_airport_id=1)
        flight = ("FR37", "2026-10-05") + flight[2:]
        conn = _FakeConn(timezone="Europe/Paris")
        self.assertEqual(
            "schedules",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=self.now_utc),
        )

    def test_known_tz_no_std_whole_day_within_limit_uses_ident(self):
        # The entire local departure day is comfortably inside now+2days.
        flight = _make_flight(std=None, origin_airport_id=1)
        flight = ("FR37", "2026-08-01") + flight[2:]
        conn = _FakeConn(timezone="Europe/Paris")
        self.assertEqual(
            "ident",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=self.now_utc),
        )

    def test_known_tz_no_std_day_straddling_limit_defers_to_schedules_then_ident(self):
        # now+2days falls somewhere *inside* the local departure day: knowing only the
        # date (not the exact time) can't tell us which side of the limit the real
        # departure lands on, so this must not be silently treated as "ident".
        now_utc = pytz.utc.localize(datetime(2026, 7, 30, 13, 0, 0))
        flight = _make_flight(std=None, origin_airport_id=1)
        flight = ("FR37", "2026-08-01") + flight[2:]
        conn = _FakeConn(timezone="UTC")
        self.assertEqual(
            "schedules_then_ident",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=now_utc),
        )

    def test_unknown_timezone_defers_to_schedules_then_ident(self):
        flight = _make_flight(std=None, origin_airport_id=None)
        conn = _FakeConn(timezone=None)
        self.assertEqual(
            "schedules_then_ident",
            _decide_aeroapi_strategy(flight, conn, uid=1, now_utc=self.now_utc),
        )


class GenerateGeodesicPointsTest(unittest.TestCase):
    def test_fallback_path_matches_pure_slerp_with_no_added_offset(self):
        # LHR -> JFK. Independently recompute the expected spherical-interpolation
        # midpoint and compare exactly -- the old generator deliberately pushed
        # waypoints off this line (up to ~0.15 rad) to fake a curved airway route.
        lat1, lon1, lat2, lon2 = 51.4700, -0.4543, 40.6413, -73.7781
        lat1_r, lon1_r, lat2_r, lon2_r = map(math.radians, (lat1, lon1, lat2, lon2))
        d = 2 * math.asin(math.sqrt(
            math.sin((lat2_r - lat1_r) / 2) ** 2 +
            math.cos(lat1_r) * math.cos(lat2_r) * math.sin((lon2_r - lon1_r) / 2) ** 2
        ))
        f = 0.5
        a = math.sin((1 - f) * d) / math.sin(d)
        b = math.sin(f * d) / math.sin(d)
        x = a * math.cos(lat1_r) * math.cos(lon1_r) + b * math.cos(lat2_r) * math.cos(lon2_r)
        y = a * math.cos(lat1_r) * math.sin(lon1_r) + b * math.cos(lat2_r) * math.sin(lon2_r)
        z = a * math.sin(lat1_r) + b * math.sin(lat2_r)
        expected_lat = math.degrees(math.atan2(z, math.sqrt(x ** 2 + y ** 2)))
        expected_lon = math.degrees(math.atan2(y, x))

        points = generate_geodesic_points(lat1, lon1, lat2, lon2, num_points=41)
        midpoint = points[20]
        self.assertAlmostEqual(midpoint['lat'], expected_lat, places=3)
        self.assertAlmostEqual(midpoint['lon'], expected_lon, places=3)
        # No fabricated altitude/speed for a fallback path -- we have no real data for it.
        for p in points:
            self.assertIsNone(p['alt'])
            self.assertIsNone(p['spd'])

    def test_endpoints_are_exact(self):
        points = generate_geodesic_points(51.4700, -0.4543, 40.6413, -73.7781, num_points=10)
        self.assertAlmostEqual(points[0]['lat'], 51.4700, places=3)
        self.assertAlmostEqual(points[0]['lon'], -0.4543, places=3)
        self.assertAlmostEqual(points[-1]['lat'], 40.6413, places=3)
        self.assertAlmostEqual(points[-1]['lon'], -73.7781, places=3)


if __name__ == "__main__":
    unittest.main()
