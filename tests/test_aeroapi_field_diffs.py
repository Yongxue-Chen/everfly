import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import build_aeroapi_field_diffs  # noqa: E402


class AeroApiFieldDiffsTest(unittest.TestCase):
    def test_missing_local_values_are_selected_by_default(self):
        diffs = build_aeroapi_field_diffs(
            {"registration": None},
            {"registration": "G-VXYZ"},
        )

        self.assertEqual("registration", diffs[0]["field"])
        self.assertEqual("missing", diffs[0]["status"])
        self.assertTrue(diffs[0]["default_selected"])

    def test_conflicting_values_require_user_selection(self):
        diffs = build_aeroapi_field_diffs(
            {"origin_terminal": "T3"},
            {"origin_terminal": "T2"},
        )

        self.assertEqual("origin_terminal", diffs[0]["field"])
        self.assertEqual("conflict", diffs[0]["status"])
        self.assertFalse(diffs[0]["default_selected"])

    def test_matching_values_are_reported_but_not_selected(self):
        diffs = build_aeroapi_field_diffs(
            {"distance": 8610},
            {"distance": 8610},
        )

        self.assertEqual("distance", diffs[0]["field"])
        self.assertEqual("same", diffs[0]["status"])
        self.assertFalse(diffs[0]["default_selected"])

    def test_empty_remote_values_are_not_offered(self):
        self.assertEqual([], build_aeroapi_field_diffs(
            {"registration": "G-VXYZ"},
            {"registration": None},
        ))


if __name__ == "__main__":
    unittest.main()
