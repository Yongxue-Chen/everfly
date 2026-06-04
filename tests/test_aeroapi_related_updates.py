import os
import sys
import unittest
from unittest.mock import patch


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import build_aeroapi_related_diffs, collect_aeroapi_related_updates  # noqa: E402


class AeroApiRelatedUpdatesTest(unittest.TestCase):
    def test_missing_related_values_are_reported_for_review(self):
        flight = (
            "VS4116", "2026-06-02",
            None, None,
            None, None, None, None,
            None, None,
            None, None, None, None,
            None, None,
        )
        candidate = {
            "origin": {"code": "KSFO", "code_iata": "SFO"},
            "destination": {"code": "KLAX", "code_iata": "LAX"},
            "operator": "DAL",
        }

        diffs = build_aeroapi_related_diffs(candidate, flight)

        self.assertEqual(
            [
                {"field": "origin_airport_id", "label": "Origin Airport", "remote": "SFO", "status": "missing"},
                {"field": "dest_airport_id", "label": "Destination Airport", "remote": "LAX", "status": "missing"},
                {"field": "airline_id", "label": "Airline", "remote": "DAL", "status": "missing"},
            ],
            diffs,
        )

    def test_missing_route_and_airline_are_collected_from_selected_candidate(self):
        flight = (
            "VS4116", "2026-06-02",
            None, None,
            None, None, None, None,
            None, None,
            None, None, None, None,
            None, None,
        )
        candidate = {
            "origin": {"code": "KSFO"},
            "destination": {"code": "KLAX"},
            "terminal_origin": "1",
            "terminal_destination": "2",
            "operator": "DAL",
        }
        terminal_updates = []

        with patch("app.get_or_create_airport", side_effect=[101, 202]) as airport_mock, \
             patch("app.get_or_create_airline", return_value=303) as airline_mock, \
             patch("app._ensure_terminal_in_db", side_effect=lambda conn, uid, aid, term: terminal_updates.append((aid, term))):
            fields, values = collect_aeroapi_related_updates(candidate, flight, object(), 1)

        self.assertEqual(
            ["origin_airport_id = ?", "dest_airport_id = ?", "airline_id = ?"],
            fields,
        )
        self.assertEqual([101, 202, 303], values)
        self.assertEqual([("KSFO", None), ("KLAX", None)], [call.args[:2] for call in airport_mock.call_args_list])
        airline_mock.assert_called_once_with("DAL", None, unittest.mock.ANY)
        self.assertEqual([(101, "T1"), (202, "T2")], terminal_updates)

    def test_existing_route_and_airline_are_not_replaced(self):
        flight = (
            "VS4116", "2026-06-02",
            11, 22,
            None, None, None, None,
            None, 33,
            None, None, None, None,
            None, None,
        )
        candidate = {
            "origin": {"code": "KSFO"},
            "destination": {"code": "KLAX"},
            "terminal_origin": "1",
            "terminal_destination": "2",
            "operator": "DAL",
        }
        terminal_updates = []

        with patch("app.get_or_create_airport", side_effect=[101, 202]), \
             patch("app.get_or_create_airline", return_value=303) as airline_mock, \
             patch("app._ensure_terminal_in_db", side_effect=lambda conn, uid, aid, term: terminal_updates.append((aid, term))):
            fields, values = collect_aeroapi_related_updates(candidate, flight, object(), 1)

        self.assertEqual([], fields)
        self.assertEqual([], values)
        airline_mock.assert_not_called()
        self.assertEqual([(11, "T1"), (22, "T2")], terminal_updates)


if __name__ == "__main__":
    unittest.main()
