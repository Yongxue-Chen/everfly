import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import clean_airport_name  # noqa: E402


class AirportNameCleaningTest(unittest.TestCase):
    def test_removes_common_airport_suffixes(self):
        cases = {
            "San Francisco International Airport": "San Francisco",
            "Los Angeles Intl Airport": "Los Angeles",
            "London Heathrow Airport": "London Heathrow",
            "Santa Barbara Municipal Airport": "Santa Barbara",
            "Reykjavik Domestic Airport": "Reykjavik",
        }

        for original, expected in cases.items():
            with self.subTest(original=original):
                self.assertEqual(expected, clean_airport_name(original))

    def test_keeps_distinctive_names_without_common_suffixes(self):
        self.assertEqual("Heathrow", clean_airport_name("Heathrow"))
        self.assertEqual("Charles de Gaulle", clean_airport_name("Charles de Gaulle"))


if __name__ == "__main__":
    unittest.main()
