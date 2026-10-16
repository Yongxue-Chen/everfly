import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import (
    _aeroapi_operating_identity,
    _normalize_flight_aliases,
    _normalize_internal_flight_payload,
    sync_aeroapi_operating_identity,
)
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

    def test_internal_payload_keeps_only_the_received_number(self):
        payload, error = _normalize_internal_flight_payload({
            "flightNumber": "VS4116",
            "operatingFlightNumber": "DL2272",
            "codeshareFlightNumbers": ["AF5810"],
            "date": "2026-06-02",
        })
        self.assertIsNone(error)
        self.assertEqual("VS4116", payload["flight_number"])
        self.assertEqual([], payload["aliases"])

    def test_aeroapi_schedule_actual_ident_is_the_operating_number(self):
        self.assertEqual(
            ("DL2272", True),
            _aeroapi_operating_identity({
                "ident_iata": "VS4116",
                "actual_ident_icao": "DAL2272",
            }),
        )

    def test_aeroapi_flight_operator_is_used_when_received_number_is_linked(self):
        class Cursor:
            def fetchone(self):
                return None

        class Connection:
            def __init__(self):
                self.queries = []

            def execute(self, query, args=()):
                self.queries.append((query, args))
                return Cursor()

        conn = Connection()
        api_flight = {
            "operator_icao": "DAL",
            "operator_iata": "DL",
            "flight_number": "2272",
            "ident_iata": "DL2272",
            "codeshares_iata": ["VS4116"],
        }
        from unittest.mock import patch
        with patch("app.get_or_create_airline", return_value=31):
            result = sync_aeroapi_operating_identity(conn, 7, 42, "VS4116", api_flight)

        self.assertEqual("DL2272", result["flight_number"])
        self.assertTrue(any(
            query.startswith("UPDATE flights SET flight_number") and args == ("DL2272", 31, 42, 7)
            for query, args in conn.queries
        ))
        self.assertTrue(any(
            "INSERT INTO flight_aliases" in query and args[2] == "VS4116"
            for query, args in conn.queries
        ))

    def test_unlinked_aeroapi_ident_does_not_replace_received_number(self):
        class Connection:
            def execute(self, *_args, **_kwargs):
                raise AssertionError("database must not be changed")

        result = sync_aeroapi_operating_identity(
            Connection(), 7, 42, "VS4116",
            {"operator_iata": "DL", "flight_number": "2272", "codeshares_iata": []},
        )
        self.assertIsNone(result)

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
