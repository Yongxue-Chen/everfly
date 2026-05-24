import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import normalize_flight_payload  # noqa: E402


class FlightPayloadNormalizationTest(unittest.TestCase):
    def test_empty_numeric_and_fk_fields_become_null(self):
        payload = {
            "origin_terminal": "T3",
            "duration_actual": "",
            "duration_scheduled": "",
            "distance": "",
            "airline_id": "",
            "aircraft_model_id": "",
        }

        normalized = normalize_flight_payload(payload)

        self.assertEqual("T3", normalized["origin_terminal"])
        self.assertIsNone(normalized["duration_actual"])
        self.assertIsNone(normalized["duration_scheduled"])
        self.assertIsNone(normalized["distance"])
        self.assertIsNone(normalized["airline_id"])
        self.assertIsNone(normalized["aircraft_model_id"])

    def test_non_empty_values_are_preserved(self):
        payload = {
            "origin_terminal": "T3",
            "duration_actual": "620",
            "distance": "8610",
            "airline_id": "12",
        }

        self.assertEqual(payload, normalize_flight_payload(payload))


if __name__ == "__main__":
    unittest.main()
