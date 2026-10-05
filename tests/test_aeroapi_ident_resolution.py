import os
import sys
import unittest
from unittest.mock import call, patch


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import _aeroapi_ident_candidates, _fetch_aeroapi_data_for_flight  # noqa: E402


class FakeConnection:
    def __init__(self, airline_row):
        self.airline_row = airline_row
        self.params = None

    def execute(self, _query, params):
        self.params = params
        return self

    def fetchone(self):
        return self.airline_row


class AeroApiIdentResolutionTest(unittest.TestCase):
    def test_converts_iata_ident_to_icao_ident(self):
        conn = FakeConnection(("U2", "EZY"))

        candidates = _aeroapi_ident_candidates("U2 8844", 14, conn, 1)

        self.assertEqual(["EZY8844", "U28844"], candidates)
        self.assertEqual((14, 1), conn.params)

    def test_keeps_stored_ident_when_airline_mapping_is_unavailable(self):
        conn = FakeConnection(None)

        self.assertEqual(
            ["FR37"],
            _aeroapi_ident_candidates("FR 37", 7, conn, 1),
        )

    @patch("app.fetch_aeroapi_data")
    def test_uses_icao_ident_first_and_stops_after_match(self, fetch):
        fetch.return_value = [{"ident": "EZY8844"}]
        flight = ("U28844", None, None, None, None, None, None, None, None, 14)

        rows = _fetch_aeroapi_data_for_flight(
            flight, FakeConnection(("U2", "EZY")), 1, "start", "end"
        )

        self.assertEqual([{"ident": "EZY8844"}], rows)
        fetch.assert_called_once_with("EZY8844", "start", "end")

    @patch("app.fetch_aeroapi_data")
    def test_falls_back_to_stored_ident_when_icao_has_no_rows(self, fetch):
        fetch.side_effect = [[], [{"ident": "U28844"}]]
        flight = ("U28844", None, None, None, None, None, None, None, None, 14)

        rows = _fetch_aeroapi_data_for_flight(
            flight, FakeConnection(("U2", "EZY")), 1, "start", "end"
        )

        self.assertEqual([{"ident": "U28844"}], rows)
        self.assertEqual(
            [
                call("EZY8844", "start", "end"),
                call("U28844", "start", "end"),
            ],
            fetch.call_args_list,
        )


if __name__ == "__main__":
    unittest.main()
