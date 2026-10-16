import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import _normalize_flight_aliases, _normalize_internal_flight_payload
from scripts.migrate_flight_aliases import classify_number_note


class FlightAliasesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "schema_mysql.sql"), encoding="utf-8") as handle:
            cls.schema = handle.read()
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as handle:
            cls.frontend = handle.read()

    def test_normalizes_and_deduplicates_codeshares(self):
        self.assertEqual([
            {
                "flight_number": "VS4116",
                "alias_type": "codeshare",
                "is_booked_number": False,
                "source": "everinbox",
            }
        ], _normalize_flight_aliases([" vs 4116 ", "VS4116", "DL2272"], "DL2272", "everinbox"))

    def test_internal_payload_prefers_operating_number_and_keeps_marketing_number(self):
        payload, error = _normalize_internal_flight_payload({
            "flightNumber": "VS4116",
            "operatingFlightNumber": "DL2272",
            "codeshareFlightNumbers": ["AF5810"],
            "date": "2026-06-02",
        })
        self.assertIsNone(error)
        self.assertEqual("DL2272", payload["flight_number"])
        self.assertEqual(["AF5810", "VS4116"], [alias["flight_number"] for alias in payload["aliases"]])
        self.assertTrue(payload["aliases"][1]["is_booked_number"])

    def test_migration_distinguishes_icao_alias_from_codeshare(self):
        self.assertEqual(
            {"action": "clear_derived", "flight_number": "TOM2109"},
            classify_number_note("BY2109", "TOM2109", "BY", "TOM"),
        )
        self.assertEqual(
            {"action": "migrate_codeshare", "flight_number": "VS4116"},
            classify_number_note("DL2272", "VS4116", "DL", "DAL"),
        )
        self.assertIsNone(classify_number_note("DL2272", "Window seat", "DL", "DAL"))

    def test_schema_and_ui_expose_structured_codeshares(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS flight_aliases", self.schema)
        self.assertIn("Codeshare Flight Numbers", self.frontend)
        self.assertIn("Codeshare numbers", self.frontend)
        self.assertIn("flight_aliases", self.frontend)


if __name__ == "__main__":
    unittest.main()
