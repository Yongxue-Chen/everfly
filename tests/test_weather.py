"""Tests for the weather module (METAR fetching, caching, normalisation)."""

import os
import sys
import time
import unittest
from unittest.mock import patch, MagicMock

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Set required env vars before importing weather
os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

import weather  # noqa: E402


class TestIcaoValidation(unittest.TestCase):
    """ICAO code validation."""

    def test_valid_icao(self):
        with patch.object(weather, '_fetch_avwx', return_value=None), \
             patch.object(weather, '_fetch_noaa', return_value=None):
            # Should attempt to fetch (not rejected by validation)
            weather.clear_cache()
            result = weather.fetch_metar("ZBAA")
            # Result is None because both sources are mocked to return None
            self.assertIsNone(result)

    def test_invalid_icao_too_short(self):
        self.assertIsNone(weather.fetch_metar("ZB"))

    def test_invalid_icao_too_long(self):
        self.assertIsNone(weather.fetch_metar("ZBAAA"))

    def test_invalid_icao_with_numbers(self):
        self.assertIsNone(weather.fetch_metar("ZB12"))

    def test_invalid_icao_lowercase_normalised(self):
        """Lowercase input should be uppercased and accepted."""
        with patch.object(weather, '_fetch_avwx', return_value=None), \
             patch.object(weather, '_fetch_noaa', return_value=None):
            weather.clear_cache()
            result = weather.fetch_metar("zbaa")
            # Not rejected — validation uppercases first
            self.assertIsNone(result)

    def test_empty_icao(self):
        self.assertIsNone(weather.fetch_metar(""))

    def test_none_icao(self):
        self.assertIsNone(weather.fetch_metar(None))


class TestCache(unittest.TestCase):
    """In-memory caching behaviour."""

    def setUp(self):
        weather.clear_cache()

    def test_cache_hit_returns_cached_flag(self):
        fake_data = {
            "icao": "KSFO",
            "temperature": 15,
            "condition": "Mist",
            "source": "avwx",
        }
        with patch.object(weather, '_fetch_avwx', return_value=fake_data) as mock_avwx:
            # First call should fetch
            r1 = weather.fetch_metar("KSFO")
            self.assertFalse(r1["cached"])
            self.assertEqual(mock_avwx.call_count, 1)

            # Second call should hit cache
            r2 = weather.fetch_metar("KSFO")
            self.assertTrue(r2["cached"])
            self.assertEqual(mock_avwx.call_count, 1)  # not called again

    def test_cache_expires(self):
        fake_data = {
            "icao": "EGLL",
            "temperature": 20,
            "condition": "Clear",
            "source": "avwx",
        }
        with patch.object(weather, '_fetch_avwx', return_value=fake_data):
            weather.fetch_metar("EGLL")

            # Manually expire the cache entry
            ts, data = weather._cache["EGLL"]
            weather._cache["EGLL"] = (ts - weather.CACHE_TTL_SECONDS - 1, data)

            with patch.object(weather, '_fetch_avwx', return_value=fake_data) as mock_avwx:
                r = weather.fetch_metar("EGLL")
                self.assertFalse(r["cached"])
                self.assertEqual(mock_avwx.call_count, 1)

    def test_clear_cache(self):
        weather._cache["TEST"] = (time.time(), {"icao": "TEST"})
        weather.clear_cache()
        self.assertEqual(len(weather._cache), 0)


class TestAvwxNormalisation(unittest.TestCase):
    """AVWX response normalisation."""

    def test_normalise_basic(self):
        raw_avwx = {
            "raw": "METAR ZBAA 311200Z 18012KT 9999 FEW040 28/18 Q1013",
            "temperature": {"repr": "28", "value": 28},
            "dewpoint": {"repr": "18", "value": 18},
            "wind_direction": {"repr": "180", "value": 180},
            "wind_speed": {"repr": "12", "value": 12},
            "wind_gust": None,
            "visibility": {"repr": "9999", "value": 9999},
            "altimeter": {"repr": "1013", "value": 29.92},
            "clouds": [{"type": "FEW", "altitude": 40}],
            "wx_codes": [],
            "flight_rules": "VFR",
            "time": {"dt": "2026-07-31T12:00:00Z"},
        }
        result = weather._normalise_avwx(raw_avwx, "ZBAA")

        self.assertEqual(result["icao"], "ZBAA")
        self.assertEqual(result["temperature"], 28)
        self.assertEqual(result["dewpoint"], 18)
        self.assertEqual(result["wind_direction"], 180)
        self.assertEqual(result["wind_speed"], 12)
        self.assertIsNone(result["wind_gust"])
        self.assertEqual(result["visibility_m"], 9999)
        self.assertEqual(result["clouds"], "Few Clouds")
        self.assertEqual(result["flight_rules"], "VFR")
        self.assertEqual(result["flight_rules_emoji"], "🟢")
        self.assertEqual(result["source"], "avwx")

    def test_normalise_with_wx_codes(self):
        raw_avwx = {
            "raw": "METAR KSFO ...",
            "temperature": {"value": 15},
            "dewpoint": {"value": 13},
            "wind_direction": {"value": 290},
            "wind_speed": {"value": 8},
            "wind_gust": {"value": 15},
            "visibility": {"value": 4000},
            "altimeter": {"value": 30.12},
            "clouds": [{"type": "BKN", "altitude": 8}],
            "wx_codes": [{"value": "Mist"}],
            "flight_rules": "IFR",
            "time": {"dt": "2026-07-31T10:00:00Z"},
        }
        result = weather._normalise_avwx(raw_avwx, "KSFO")

        self.assertEqual(result["condition"], "Mist")
        self.assertEqual(result["wind_gust"], 15)
        self.assertEqual(result["flight_rules"], "IFR")
        self.assertEqual(result["flight_rules_emoji"], "🔴")


class TestNoaaNormalisation(unittest.TestCase):
    """NOAA AWC response normalisation."""

    def test_normalise_basic(self):
        raw_noaa = {
            "rawOb": "METAR KJFK 311200Z 24015G25KT 10SM SCT050 30/20 A3005",
            "temp": 30,
            "dewp": 20,
            "wdir": 240,
            "wspd": 15,
            "wgst": 25,
            "visib": 10,
            "altim": 30.05,
            "clouds": [{"cover": "SCT", "base": 5000}],
            "reportTime": "2026-07-31T12:00:00Z",
        }
        result = weather._normalise_noaa(raw_noaa, "KJFK")

        self.assertEqual(result["icao"], "KJFK")
        self.assertEqual(result["temperature"], 30)
        self.assertEqual(result["wind_speed"], 15)
        self.assertEqual(result["wind_gust"], 25)
        self.assertEqual(result["clouds"], "Scattered Clouds")
        self.assertEqual(result["source"], "noaa")
        self.assertIn(result["raw"], "METAR KJFK 311200Z 24015G25KT 10SM SCT050 30/20 A3005")


class TestDeriveFlightRules(unittest.TestCase):
    """Flight rules derivation from visibility and ceiling."""

    def test_vfr(self):
        clouds = [{"cover": "FEW", "base": 5000}]
        self.assertEqual(weather._derive_flight_rules(16000, clouds), "VFR")

    def test_mvfr_by_visibility(self):
        clouds = [{"cover": "FEW", "base": 5000}]
        self.assertEqual(weather._derive_flight_rules(6000, clouds), "MVFR")

    def test_mvfr_by_ceiling(self):
        clouds = [{"cover": "BKN", "base": 2000}]
        self.assertEqual(weather._derive_flight_rules(16000, clouds), "MVFR")

    def test_ifr_by_visibility(self):
        clouds = [{"cover": "FEW", "base": 5000}]
        self.assertEqual(weather._derive_flight_rules(3000, clouds), "IFR")

    def test_ifr_by_ceiling(self):
        clouds = [{"cover": "OVC", "base": 800}]
        self.assertEqual(weather._derive_flight_rules(16000, clouds), "IFR")

    def test_lifr_by_visibility(self):
        clouds = [{"cover": "FEW", "base": 5000}]
        self.assertEqual(weather._derive_flight_rules(800, clouds), "LIFR")

    def test_lifr_by_ceiling(self):
        clouds = [{"cover": "VV", "base": 200}]
        self.assertEqual(weather._derive_flight_rules(16000, clouds), "LIFR")

    def test_no_data_defaults_to_vfr(self):
        self.assertEqual(weather._derive_flight_rules(None, None), "VFR")


class TestFallbackBehaviour(unittest.TestCase):
    """AVWX failure falls back to NOAA."""

    def setUp(self):
        weather.clear_cache()

    def test_avwx_failure_uses_noaa(self):
        noaa_data = {
            "icao": "RJTT",
            "temperature": 25,
            "source": "noaa",
        }
        with patch.object(weather, '_fetch_avwx', return_value=None), \
             patch.object(weather, '_fetch_noaa', return_value=noaa_data):
            result = weather.fetch_metar("RJTT")
            self.assertIsNotNone(result)
            self.assertEqual(result["source"], "noaa")

    def test_both_fail_returns_none(self):
        with patch.object(weather, '_fetch_avwx', return_value=None), \
             patch.object(weather, '_fetch_noaa', return_value=None):
            result = weather.fetch_metar("XXXX")
            self.assertIsNone(result)


class TestCloudSummary(unittest.TestCase):
    """Cloud layer summary logic."""

    def test_empty_clouds(self):
        self.assertEqual(weather._cloud_summary([]), "Clear")
        self.assertEqual(weather._cloud_summary(None), "Clear")

    def test_few_clouds(self):
        self.assertEqual(
            weather._cloud_summary([{"type": "FEW", "altitude": 40}]),
            "Few Clouds",
        )

    def test_overcast(self):
        self.assertEqual(
            weather._cloud_summary([
                {"type": "SCT", "altitude": 20},
                {"type": "OVC", "altitude": 50},
            ]),
            "Overcast",
        )

    def test_clear_codes(self):
        for code in ("CLR", "SKC", "NCD", "NSC"):
            self.assertEqual(
                weather._cloud_summary([{"type": code}]),
                "Clear",
            )


class TestSafeFloat(unittest.TestCase):
    """_safe_float helper."""

    def test_none(self):
        self.assertIsNone(weather._safe_float(None))

    def test_dict_with_value(self):
        self.assertEqual(weather._safe_float({"value": 28}), 28.0)

    def test_dict_with_none_value(self):
        self.assertIsNone(weather._safe_float({"value": None}))

    def test_raw_number(self):
        self.assertEqual(weather._safe_float(15.5), 15.5)

    def test_invalid_string(self):
        self.assertIsNone(weather._safe_float("abc"))


if __name__ == '__main__':
    unittest.main()
