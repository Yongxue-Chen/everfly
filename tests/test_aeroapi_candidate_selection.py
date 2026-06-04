import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import select_aeroapi_candidate  # noqa: E402


class AeroApiCandidateSelectionTest(unittest.TestCase):
    def setUp(self):
        self.candidates = [
            {
                "ident": "DAL2272",
                "scheduled_out": "2026-06-02T18:55:00Z",
                "origin": {"code": "KSFO", "code_iata": "SFO", "timezone": "America/Los_Angeles"},
                "destination": {"code": "KLAX", "code_iata": "LAX", "timezone": "America/Los_Angeles"},
                "registration": "N3769L",
            },
            {
                "ident": "DAL2272",
                "scheduled_out": "2026-06-02T16:30:00Z",
                "origin": {"code": "KLAX", "code_iata": "LAX", "timezone": "America/Los_Angeles"},
                "destination": {"code": "KSFO", "code_iata": "SFO", "timezone": "America/Los_Angeles"},
                "registration": "N3769L",
            },
        ]

    def test_multiple_candidates_without_route_requires_manual_selection(self):
        result = select_aeroapi_candidate(
            self.candidates,
            "2026-06-02",
            None,
            existing_std=None,
            origin_codes=set(),
            dest_codes=set(),
        )

        self.assertTrue(result["ambiguous"])
        self.assertIsNone(result["match"])
        self.assertEqual(2, len(result["candidates"]))

    def test_local_route_selects_matching_candidate(self):
        result = select_aeroapi_candidate(
            self.candidates,
            "2026-06-02",
            "America/Los_Angeles",
            existing_std=None,
            origin_codes={"SFO", "KSFO"},
            dest_codes={"LAX", "KLAX"},
        )

        self.assertFalse(result["ambiguous"])
        self.assertEqual("KSFO", result["match"]["origin"]["code"])
        self.assertEqual(0, result["candidate_index"])

    def test_selected_candidate_index_overrides_ambiguity(self):
        result = select_aeroapi_candidate(
            self.candidates,
            "2026-06-02",
            None,
            existing_std=None,
            origin_codes=set(),
            dest_codes=set(),
            selected_candidate_index=1,
        )

        self.assertFalse(result["ambiguous"])
        self.assertEqual("KLAX", result["match"]["origin"]["code"])
        self.assertEqual(1, result["candidate_index"])


if __name__ == "__main__":
    unittest.main()
